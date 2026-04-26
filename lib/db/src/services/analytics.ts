import { db } from "../index";
import {
  customAudiencesTable,
  audienceUsageTable,
  adSetsTable,
  adsTable,
  adMetricsDailyTable,
  campaignsTable,
} from "../schema";
import { eq, and, gte, lt, isNull, or, sql, desc, inArray } from "drizzle-orm";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
export type IssueSeverity = "critical" | "high" | "medium" | "low";

export interface DiagnosticIssue {
  id: string;
  severity: IssueSeverity;
  category: "audience" | "ad" | "campaign";
  title: string;
  description: string;
  impactEstimate: string;
  suggestion: string;
  metaLink?: string;
  items: Array<{ id: number | string; name: string; detail?: string }>;
}

export interface AudienceWithIssues {
  id: number;
  metaAudienceId: string;
  name: string;
  type: string | null;
  subtype: string | null;
  approximateCount: number | null;
  status: string | null;
  lastUsedAt: Date | null;
  issues: string[];
  adsetCount: number;
}

export interface AuditOverview {
  audiences: {
    total: number;
    duplicates: number;
    unused: number;
    stale: number;
  };
  adsets: {
    total: number;
    withOverlap: number;
  };
  ads: {
    total: number;
    lowCtr: number;
    highFrequency: number;
    noConversions: number;
    duplicates: number;
  };
  totalIssues: number;
  issuesBySeverity: Record<IssueSeverity, number>;
}

// ──────────────────────────────────────────────────────────────
// 1. Duplicate Audiences
// ──────────────────────────────────────────────────────────────
export async function detectDuplicateAudiences(): Promise<DiagnosticIssue[]> {
  const audiences = await db
    .select({
      id: customAudiencesTable.id,
      metaAudienceId: customAudiencesTable.metaAudienceId,
      name: customAudiencesTable.name,
      rules: customAudiencesTable.rules,
      type: customAudiencesTable.type,
    })
    .from(customAudiencesTable)
    .where(sql`${customAudiencesTable.rules} IS NOT NULL`);

  const seen = new Map<string, typeof audiences[0][]>();
  for (const a of audiences) {
    const key = JSON.stringify(a.rules);
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(a);
  }

  const duplicateGroups = [...seen.values()].filter((g) => g.length > 1);

  const issues: DiagnosticIssue[] = [];
  for (const group of duplicateGroups) {
    issues.push({
      id: `dup-aud-${group[0].id}`,
      severity: "medium",
      category: "audience",
      title: `${group.length} públicos com regras idênticas`,
      description: `Os públicos têm exatamente as mesmas regras de segmentação, gerando sobreposição e desperdício de orçamento.`,
      impactEstimate: "Redução de CPL estimada: 5-15%",
      suggestion: "Manter o público mais antigo e remover os duplicados dos conjuntos de anúncios.",
      items: group.map((a) => ({ id: a.id, name: a.name, detail: a.type ?? undefined })),
    });
  }

  return issues;
}

// ──────────────────────────────────────────────────────────────
// 2. Unused Audiences
// ──────────────────────────────────────────────────────────────
export async function detectUnusedAudiences(): Promise<DiagnosticIssue[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const usedIds = await db
    .select({ audienceId: audienceUsageTable.audienceId })
    .from(audienceUsageTable);
  const usedSet = new Set(usedIds.map((r) => r.audienceId));

  const allAudiences = await db.select().from(customAudiencesTable);

  const neverUsed = allAudiences.filter((a) => !usedSet.has(a.id));
  const longUnused = allAudiences.filter(
    (a) => usedSet.has(a.id) && a.lastUsedAt && a.lastUsedAt < ninetyDaysAgo
  );

  const issues: DiagnosticIssue[] = [];

  if (neverUsed.length > 0) {
    issues.push({
      id: "unused-audiences-never",
      severity: "low",
      category: "audience",
      title: `${neverUsed.length} público(s) nunca utilizados`,
      description: "Esses públicos foram criados mas jamais associados a nenhum conjunto de anúncios.",
      impactEstimate: "Limpeza de conta — sem impacto financeiro direto",
      suggestion: "Avaliar se ainda são relevantes ou excluir para organizar a conta.",
      items: neverUsed.map((a) => ({ id: a.id, name: a.name, detail: a.type ?? undefined })),
    });
  }

  if (longUnused.length > 0) {
    issues.push({
      id: "unused-audiences-90d",
      severity: "low",
      category: "audience",
      title: `${longUnused.length} público(s) sem uso há +90 dias`,
      description: "Esses públicos foram utilizados no passado mas estão inativos há mais de 3 meses.",
      impactEstimate: "Limpeza de conta — reduz confusão operacional",
      suggestion: "Deletar públicos obsoletos ou arquivar para revisão futura.",
      items: longUnused.map((a) => ({
        id: a.id,
        name: a.name,
        detail: a.lastUsedAt ? `Último uso: ${a.lastUsedAt.toLocaleDateString("pt-BR")}` : undefined,
      })),
    });
  }

  return issues;
}

// ──────────────────────────────────────────────────────────────
// 3. Audience Overlap (same audience in multiple active adsets of same campaign)
// ──────────────────────────────────────────────────────────────
export async function detectAudienceOverlap(): Promise<DiagnosticIssue[]> {
  const usages = await db
    .select({
      audienceId: audienceUsageTable.audienceId,
      audienceName: customAudiencesTable.name,
      adsetId: audienceUsageTable.adsetId,
      adsetName: adSetsTable.name,
      adsetStatus: adSetsTable.status,
      campaignId: adSetsTable.campaignId,
      campaignName: campaignsTable.name,
    })
    .from(audienceUsageTable)
    .innerJoin(customAudiencesTable, eq(customAudiencesTable.id, audienceUsageTable.audienceId))
    .innerJoin(adSetsTable, eq(adSetsTable.id, audienceUsageTable.adsetId))
    .innerJoin(campaignsTable, eq(campaignsTable.id, adSetsTable.campaignId))
    .where(eq(audienceUsageTable.type, "INCLUDED"));

  // Group by audience → campaign to find multiple active adsets using same audience
  const map = new Map<string, typeof usages>();
  for (const u of usages) {
    const key = `${u.audienceId}-${u.campaignId}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(u);
  }

  const issues: DiagnosticIssue[] = [];
  for (const [, group] of map) {
    const active = group.filter((g) => g.adsetStatus === "ACTIVE");
    if (active.length < 2) continue;
    issues.push({
      id: `overlap-${group[0].audienceId}-${group[0].campaignId}`,
      severity: "critical",
      category: "audience",
      title: `Canibalização: público "${group[0].audienceName}" em ${active.length} conjuntos ativos`,
      description: `Campanha "${active[0].campaignName}" tem ${active.length} conjuntos ativos competindo pelo mesmo público, elevando CPM e CPL.`,
      impactEstimate: "Redução de CPL de até 20-30% ao consolidar",
      suggestion: "Consolidar em um único conjunto ou excluir o público nos demais para evitar sobreposição.",
      items: active.map((g) => ({ id: g.adsetId, name: g.adsetName, detail: g.campaignName })),
    });
  }

  return issues;
}

// ──────────────────────────────────────────────────────────────
// 4. Stale Audiences (in_progress for 30+ days)
// ──────────────────────────────────────────────────────────────
export async function detectStaleAudiences(): Promise<DiagnosticIssue[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const stale = await db
    .select()
    .from(customAudiencesTable)
    .where(
      and(
        eq(customAudiencesTable.status, "in_progress"),
        lt(customAudiencesTable.updatedAt, thirtyDaysAgo)
      )
    );

  if (stale.length === 0) return [];

  return [
    {
      id: "stale-audiences",
      severity: "medium",
      category: "audience",
      title: `${stale.length} público(s) travados em preenchimento há +30 dias`,
      description: "Públicos com status 'in_progress' há mais de 30 dias geralmente indicam problema de fonte de dados ou tamanho insuficiente.",
      impactEstimate: "Risco de conjuntos entregando para público limitado",
      suggestion: "Verificar no Gerenciador de Anúncios se a fonte de dados ainda está ativa. Considerar recriar o público.",
      items: stale.map((a) => ({
        id: a.id,
        name: a.name,
        detail: `Tamanho estimado: ${a.approximateCount?.toLocaleString("pt-BR") ?? "desconhecido"}`,
      })),
    },
  ];
}

// ──────────────────────────────────────────────────────────────
// 5. Low Performance Ads
// ──────────────────────────────────────────────────────────────
export async function detectLowPerformanceAds(): Promise<DiagnosticIssue[]> {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Get aggregated metrics per ad for last 14 days
  const adMetrics = await db
    .select({
      adId: adMetricsDailyTable.adId,
      adName: adsTable.name,
      adStatus: adsTable.status,
      totalSpend: sql<string>`SUM(${adMetricsDailyTable.spend})`,
      totalConversations: sql<number>`SUM(${adMetricsDailyTable.conversations})`,
      avgCtr: sql<string>`AVG(${adMetricsDailyTable.ctr})`,
      avgFrequency: sql<string>`AVG(${adMetricsDailyTable.frequency})`,
    })
    .from(adMetricsDailyTable)
    .innerJoin(adsTable, eq(adsTable.id, adMetricsDailyTable.adId))
    .where(gte(adMetricsDailyTable.date, sql`${fourteenDaysAgo}::date`))
    .groupBy(adMetricsDailyTable.adId, adsTable.name, adsTable.status);

  const lowCtr: typeof adMetrics = [];
  const highFreq: typeof adMetrics = [];
  const noConv: typeof adMetrics = [];

  for (const m of adMetrics) {
    if (m.adStatus !== "ACTIVE") continue;
    const ctr = Number(m.avgCtr ?? 0);
    const freq = Number(m.avgFrequency ?? 0);
    const spend = Number(m.totalSpend ?? 0);
    const conv = Number(m.totalConversations ?? 0);

    if (ctr > 0 && ctr < 0.005) lowCtr.push(m); // < 0.5%
    if (freq >= 4) highFreq.push(m);
    if (spend >= 50 && conv === 0) noConv.push(m);
  }

  const issues: DiagnosticIssue[] = [];

  if (lowCtr.length > 0) {
    issues.push({
      id: "low-ctr-ads",
      severity: "high",
      category: "ad",
      title: `${lowCtr.length} anúncio(s) com CTR abaixo de 0,5% nos últimos 14 dias`,
      description: "CTR baixo indica que o criativo não está capturando atenção ou o público não é relevante para a mensagem.",
      impactEstimate: "Aumentar CTR de 0,5% para 2% pode reduzir CPM em 30-40%",
      suggestion: "Testar novos criativos, diferentes imagens/vídeos ou ajustar o copy do anúncio.",
      items: lowCtr.map((m) => ({
        id: m.adId,
        name: m.adName,
        detail: `CTR: ${(Number(m.avgCtr ?? 0) * 100).toFixed(2)}%`,
      })),
    });
  }

  if (highFreq.length > 0) {
    issues.push({
      id: "high-frequency-ads",
      severity: "high",
      category: "ad",
      title: `${highFreq.length} anúncio(s) com frequência alta (≥4)`,
      description: "Frequência acima de 4 indica que o mesmo usuário está vendo o anúncio repetidamente — sinal de fadiga de público.",
      impactEstimate: "Fadiga eleva CPM e reduz eficiência do orçamento",
      suggestion: "Ampliar o público, adicionar novos criativos ou pausar os anúncios saturados.",
      items: highFreq.map((m) => ({
        id: m.adId,
        name: m.adName,
        detail: `Frequência média: ${Number(m.avgFrequency ?? 0).toFixed(1)}`,
      })),
    });
  }

  if (noConv.length > 0) {
    issues.push({
      id: "no-conversion-ads",
      severity: "high",
      category: "ad",
      title: `${noConv.length} anúncio(s) com +R$50 gastos sem conversão`,
      description: "Investimento significativo sem nenhuma conversa gerada nos últimos 14 dias.",
      impactEstimate: `Economia potencial: R$ ${noConv.reduce((a, m) => a + Number(m.totalSpend ?? 0), 0).toFixed(2)}`,
      suggestion: "Avaliar pausa imediata e redirecionar budget para anúncios com conversão.",
      items: noConv.map((m) => ({
        id: m.adId,
        name: m.adName,
        detail: `Investido: R$ ${Number(m.totalSpend ?? 0).toFixed(2)}`,
      })),
    });
  }

  return issues;
}

// ──────────────────────────────────────────────────────────────
// 6. Duplicate Ads
// ──────────────────────────────────────────────────────────────
export async function detectDuplicateAds(): Promise<DiagnosticIssue[]> {
  const ads = await db
    .select({
      id: adsTable.id,
      name: adsTable.name,
      headline: adsTable.headline,
      body: adsTable.body,
      status: adsTable.status,
    })
    .from(adsTable)
    .where(sql`${adsTable.headline} IS NOT NULL OR ${adsTable.body} IS NOT NULL`);

  const seen = new Map<string, typeof ads>();
  for (const ad of ads) {
    const key = `${(ad.headline ?? "").toLowerCase().trim()}|${(ad.body ?? "").slice(0, 100).toLowerCase().trim()}`;
    if (key === "|") continue;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(ad);
  }

  const dupeGroups = [...seen.values()].filter((g) => g.length > 1);

  if (dupeGroups.length === 0) return [];

  return [
    {
      id: "duplicate-ads",
      severity: "medium",
      category: "ad",
      title: `${dupeGroups.reduce((a, g) => a + g.length, 0)} anúncios duplicados (${dupeGroups.length} grupo(s))`,
      description: "Anúncios com o mesmo headline e copy rodando simultaneamente fragmentam dados e dificultam análise de performance.",
      impactEstimate: "Consolidação melhora leitura de dados e reduz fragmentação de aprendizado",
      suggestion: "Consolidar em um único anúncio por grupo, mantendo o de melhor CTR.",
      items: dupeGroups.flatMap((g) =>
        g.map((a) => ({ id: a.id, name: a.name, detail: a.headline ?? undefined }))
      ),
    },
  ];
}

// ──────────────────────────────────────────────────────────────
// Run all diagnostics
// ──────────────────────────────────────────────────────────────
export async function runFullDiagnostics(): Promise<{
  issues: DiagnosticIssue[];
  overview: AuditOverview;
  audiencesWithIssues: AudienceWithIssues[];
}> {
  const [dupAud, unusedAud, overlap, stale, lowPerf, dupAds] = await Promise.all([
    detectDuplicateAudiences(),
    detectUnusedAudiences(),
    detectAudienceOverlap(),
    detectStaleAudiences(),
    detectLowPerformanceAds(),
    detectDuplicateAds(),
  ]);

  const allIssues = [...dupAud, ...unusedAud, ...overlap, ...stale, ...lowPerf, ...dupAds];

  // Counts for overview
  const [audienceCount, adsetCount, adCount] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(customAudiencesTable),
    db.select({ count: sql<number>`COUNT(*)` }).from(adSetsTable),
    db.select({ count: sql<number>`COUNT(*)` }).from(adsTable),
  ]);

  const issuesBySeverity: Record<IssueSeverity, number> = {
    critical: 0, high: 0, medium: 0, low: 0,
  };
  for (const issue of allIssues) issuesBySeverity[issue.severity]++;

  const dupAudItems = dupAud.flatMap((i) => i.items);
  const unusedItems = unusedAud.flatMap((i) => i.items);
  const lowCtrIssue = lowPerf.find((i) => i.id === "low-ctr-ads");
  const highFreqIssue = lowPerf.find((i) => i.id === "high-frequency-ads");
  const noConvIssue = lowPerf.find((i) => i.id === "no-conversion-ads");
  const dupAdsIssue = dupAds[0];

  const overview: AuditOverview = {
    audiences: {
      total: Number(audienceCount[0]?.count ?? 0),
      duplicates: dupAudItems.length,
      unused: unusedItems.length,
      stale: stale.flatMap((i) => i.items).length,
    },
    adsets: {
      total: Number(adsetCount[0]?.count ?? 0),
      withOverlap: overlap.flatMap((i) => i.items).length,
    },
    ads: {
      total: Number(adCount[0]?.count ?? 0),
      lowCtr: lowCtrIssue?.items.length ?? 0,
      highFrequency: highFreqIssue?.items.length ?? 0,
      noConversions: noConvIssue?.items.length ?? 0,
      duplicates: dupAdsIssue?.items.length ?? 0,
    },
    totalIssues: allIssues.length,
    issuesBySeverity,
  };

  // Audiences with issue tags
  const allAudiences = await db
    .select({
      id: customAudiencesTable.id,
      metaAudienceId: customAudiencesTable.metaAudienceId,
      name: customAudiencesTable.name,
      type: customAudiencesTable.type,
      subtype: customAudiencesTable.subtype,
      approximateCount: customAudiencesTable.approximateCount,
      status: customAudiencesTable.status,
      lastUsedAt: customAudiencesTable.lastUsedAt,
      adsetCount: sql<number>`COUNT(DISTINCT ${audienceUsageTable.adsetId})`,
    })
    .from(customAudiencesTable)
    .leftJoin(audienceUsageTable, eq(audienceUsageTable.audienceId, customAudiencesTable.id))
    .groupBy(customAudiencesTable.id)
    .orderBy(desc(customAudiencesTable.approximateCount));

  const dupAudIds = new Set(dupAudItems.map((i) => Number(i.id)));
  const unusedAudIds = new Set(unusedItems.map((i) => Number(i.id)));
  const staleAudIds = new Set(stale.flatMap((i) => i.items).map((i) => Number(i.id)));

  const audiencesWithIssues: AudienceWithIssues[] = allAudiences.map((a) => {
    const issues: string[] = [];
    if (dupAudIds.has(a.id)) issues.push("Duplicado");
    if (unusedAudIds.has(a.id)) issues.push("Não usado");
    if (staleAudIds.has(a.id)) issues.push("Em preenchimento");
    return { ...a, issues, adsetCount: Number(a.adsetCount ?? 0) };
  });

  return { issues: allIssues, overview, audiencesWithIssues };
}

// ──────────────────────────────────────────────────────────────
// Recommendations
// ──────────────────────────────────────────────────────────────
export interface Recommendation {
  id: string;
  priority: number;
  title: string;
  detail: string;
  impact: string;
  items: Array<{ id: number | string; name: string }>;
}

export async function buildRecommendations(issues: DiagnosticIssue[]): Promise<Recommendation[]> {
  const recs: Recommendation[] = [];
  let priority = 1;

  const critical = issues.filter((i) => i.severity === "critical");
  const high = issues.filter((i) => i.severity === "high");
  const medium = issues.filter((i) => i.severity === "medium");
  const low = issues.filter((i) => i.severity === "low");

  // Overlap / canibalização (crítico)
  for (const issue of critical) {
    recs.push({
      id: `rec-${issue.id}`,
      priority: priority++,
      title: issue.title,
      detail: issue.suggestion,
      impact: issue.impactEstimate,
      items: issue.items,
    });
  }

  // High severity
  const noConv = high.find((i) => i.id === "no-conversion-ads");
  if (noConv && noConv.items.length > 0) {
    recs.push({
      id: "rec-pause-no-conv",
      priority: priority++,
      title: `Pausar ${noConv.items.length} anúncio(s) sem conversão`,
      detail: "Redirecionar budget para anúncios com histórico de conversão.",
      impact: noConv.impactEstimate,
      items: noConv.items,
    });
  }

  const lowCtr = high.find((i) => i.id === "low-ctr-ads");
  if (lowCtr && lowCtr.items.length > 0) {
    recs.push({
      id: "rec-refresh-creative",
      priority: priority++,
      title: `Renovar criativos de ${lowCtr.items.length} anúncio(s) com baixo CTR`,
      detail: lowCtr.suggestion,
      impact: lowCtr.impactEstimate,
      items: lowCtr.items,
    });
  }

  const highFreq = high.find((i) => i.id === "high-frequency-ads");
  if (highFreq && highFreq.items.length > 0) {
    recs.push({
      id: "rec-expand-audience",
      priority: priority++,
      title: `Ampliar público de ${highFreq.items.length} anúncio(s) com fadiga`,
      detail: highFreq.suggestion,
      impact: highFreq.impactEstimate,
      items: highFreq.items,
    });
  }

  // Medium
  const dupAud = medium.find((i) => i.id.startsWith("dup-aud-"));
  if (dupAud) {
    recs.push({
      id: "rec-delete-dup-aud",
      priority: priority++,
      title: `Eliminar ${dupAud.items.length} público(s) duplicado(s)`,
      detail: dupAud.suggestion,
      impact: dupAud.impactEstimate,
      items: dupAud.items,
    });
  }

  const dupAds = medium.find((i) => i.id === "duplicate-ads");
  if (dupAds) {
    recs.push({
      id: "rec-consolidate-ads",
      priority: priority++,
      title: dupAds.title,
      detail: dupAds.suggestion,
      impact: dupAds.impactEstimate,
      items: dupAds.items,
    });
  }

  // Low
  const unusedAll = low.filter((i) => i.id.startsWith("unused-"));
  const unusedItems = unusedAll.flatMap((i) => i.items);
  if (unusedItems.length > 0) {
    recs.push({
      id: "rec-cleanup-audiences",
      priority: priority++,
      title: `Limpar ${unusedItems.length} público(s) não utilizados`,
      detail: "Excluir ou arquivar públicos que não estão em nenhum conjunto ativo.",
      impact: "Organização da conta — sem custo financeiro",
      items: unusedItems,
    });
  }

  return recs;
}
