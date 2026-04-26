import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, TrendingUp, TrendingDown, Users, DollarSign,
  Target, AlertCircle, CheckCircle, PauseCircle, Settings2,
  X, Eye, BarChart2, Layers, Image, Lightbulb,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const TICKET_STORAGE_KEY = "crm_ticket_medio";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────
interface CampaignRow {
  id: number;
  name: string;
  status: string;
  objective: string | null;
  totalSpend: number;
  totalImpressions: number;
  totalConversations: number;
  cplMeta: number | null;
  crmLeads: number;
  crmContracts: number;
}

interface PerformanceSummary {
  totalSpend: number;
  totalImpressions: number;
  totalMetaConversations: number;
  totalCrmLeads: number;
  totalContracts: number;
  cplMeta: number | null;
  cplCrm: number | null;
}

interface PerformanceData {
  period: string;
  summary: PerformanceSummary;
  campaigns: CampaignRow[];
}

interface AdSetDetail {
  id: number;
  name: string;
  status: string;
  dailyBudget: string | null;
  audienceType: string | null;
  targetingSummary: string | null;
  ageMin: number | null;
  ageMax: number | null;
  genders: string | null;
  totalSpend: number;
  totalImpressions: number;
  totalConversations: number;
  cplMeta: number | null;
  avgCtr: number | null;
  avgFrequency: number | null;
}

interface AdDetail {
  id: number;
  name: string;
  status: string;
  adsetName: string;
  creativeType: string | null;
  creativeUrl: string | null;
  headline: string | null;
  body: string | null;
  callToAction: string | null;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversations: number;
  avgCtr: number | null;
  avgCpc: number | null;
  avgCpm: number | null;
  avgFrequency: number | null;
}

interface CampaignFull {
  id: number;
  name: string;
  status: string;
  objective: string | null;
  dailyBudget: string | null;
  adsetCount: number;
  adCount: number;
  metrics: Array<{
    date: string;
    spend: string;
    impressions: number;
    conversationsStarted: number;
    reach: number;
  }>;
}

type FilterMode = "all" | "active" | "withSpend";
type ModalTab = "resumo" | "conjuntos" | "anuncios" | "diagnostico";

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────
const GROUPS: { label: string; prefix: string | null }[] = [
  { label: "[LEADS]", prefix: "[LEADS]" },
  { label: "[WHATS]", prefix: "[WHATS]" },
  { label: "[ENGAJAMENTO]", prefix: "[ENGAJAMENTO]" },
  { label: "{ENGAJAMENTO}", prefix: "{ENGAJAMENTO}" },
  { label: "[RECONHECIMENTO]", prefix: "[RECONHECIMENTO]" },
  { label: "(LEADS)", prefix: "(LEADS)" },
  { label: "(ENGAJAMENTO)", prefix: "(ENGAJAMENTO)" },
  { label: "(ENG)", prefix: "(ENG)" },
  { label: "Outras", prefix: null },
];

function getGroup(name: string): string {
  const up = name.toUpperCase();
  for (const g of GROUPS) {
    if (g.prefix && up.startsWith(g.prefix.toUpperCase())) return g.label;
  }
  return "Outras";
}

function normalizeGroup(label: string): string {
  const map: Record<string, string> = {
    "[ENGAJAMENTO]": "ENGAJAMENTO", "{ENGAJAMENTO}": "ENGAJAMENTO",
    "(ENGAJAMENTO)": "ENGAJAMENTO", "(ENG)": "ENGAJAMENTO",
    "[LEADS]": "LEADS", "(LEADS)": "LEADS",
    "[WHATS]": "WHATS", "[RECONHECIMENTO]": "RECONHECIMENTO",
  };
  return map[label] ?? label;
}

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtNum(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR").format(v);
}

function fmtPct(v: number) {
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
}

function cplCrmColor(cpl: number | null) {
  if (cpl == null) return { border: "#e2e8f0", bg: "transparent" };
  if (cpl <= 30) return { border: "#16a34a", bg: "#f0fdf4" };
  if (cpl <= 80) return { border: "#d97706", bg: "#fffbeb" };
  return { border: "#dc2626", bg: "#fef2f2" };
}

// ────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────
function StatusBadgeMeta({ status }: { status: string }) {
  if (status === "ACTIVE")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" /> Ativa</span>;
  if (status === "PAUSED")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full"><PauseCircle className="w-3 h-3" /> Pausada</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">{status}</span>;
}

function AudienceBadge({ type }: { type: string | null }) {
  const cfg = {
    open: { label: "Aberto", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    custom: { label: "Customizado", cls: "bg-purple-50 text-purple-700 border-purple-200" },
    lookalike: { label: "Lookalike", cls: "bg-orange-50 text-orange-700 border-orange-200" },
    saved: { label: "Salvo", cls: "bg-green-50 text-green-700 border-green-200" },
  }[type ?? "open"] ?? { label: type ?? "—", cls: "bg-slate-50 text-slate-700 border-slate-200" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>;
}

function RoiCell({ contracts, spend, ticket }: { contracts: number; spend: number; ticket: number }) {
  if (contracts === 0 || spend === 0) return <span className="text-muted-foreground">—</span>;
  const roi = ((contracts * ticket - spend) / spend) * 100;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${roi >= 0 ? "text-green-600" : "text-red-600"}`}>
      {roi >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {fmtPct(roi)}
    </span>
  );
}

function GroupSummaryRow({ label, totalSpend, totalLeads, totalContracts, ticket }: { label: string; totalSpend: number; totalLeads: number; totalContracts: number; ticket: number }) {
  const roi = totalContracts > 0 && totalSpend > 0 ? ((totalContracts * ticket - totalSpend) / totalSpend) * 100 : null;
  return (
    <tr className="bg-muted/60 border-y border-border/70">
      <td className="px-5 py-2 font-semibold text-xs text-foreground/70 uppercase tracking-wider" colSpan={2}>{label}</td>
      <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-foreground/80">{fmtBRL(totalSpend)}</td>
      <td className="px-3 py-2" colSpan={3} />
      <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">{totalLeads > 0 ? fmtNum(totalLeads) : "—"}</td>
      <td className="px-3 py-2 text-right text-xs font-semibold">{totalContracts > 0 ? String(totalContracts) : "—"}</td>
      <td className="px-5 py-2 text-right text-xs font-semibold">{roi != null ? <span className={roi >= 0 ? "text-green-600" : "text-red-600"}>{fmtPct(roi)}</span> : "—"}</td>
    </tr>
  );
}

// ────────────────────────────────────────────────
// Diagnóstico automático
// ────────────────────────────────────────────────
interface DiagnosticoResult {
  positivos: string[];
  atencao: string[];
  sugestoes: string[];
}

function buildDiagnostico(
  campaign: CampaignFull,
  adsets: AdSetDetail[],
  ads: AdDetail[],
  globalCplMeta: number | null
): DiagnosticoResult {
  const positivos: string[] = [];
  const atencao: string[] = [];
  const sugestoes: string[] = [];

  const totalSpend = campaign.metrics.reduce((a, m) => a + Number(m.spend), 0);
  const totalConv = campaign.metrics.reduce((a, m) => a + m.conversationsStarted, 0);
  const totalImp = campaign.metrics.reduce((a, m) => a + m.impressions, 0);
  const cplMeta = totalConv > 0 ? totalSpend / totalConv : null;
  const avgCtr = ads.reduce((a, ad) => a + (ad.avgCtr ?? 0), 0) / (ads.length || 1);
  const avgFreq = adsets.reduce((a, as) => a + (as.avgFrequency ?? 0), 0) / (adsets.length || 1);

  // CPL
  if (cplMeta != null && cplMeta < 5) positivos.push(`CPL Meta excelente: ${fmtBRL(cplMeta)} por conversa`);
  else if (cplMeta != null && cplMeta < (globalCplMeta ?? 10)) positivos.push(`CPL Meta abaixo da média do escritório (${fmtBRL(cplMeta)})`);
  else if (cplMeta != null && cplMeta > 80) atencao.push(`CPL Meta elevado: ${fmtBRL(cplMeta)} por conversa`);

  // CTR
  if (avgCtr > 2) positivos.push(`CTR acima de 2% — criativos gerando cliques`);
  else if (avgCtr > 0 && avgCtr < 0.5) atencao.push(`CTR baixo (${avgCtr.toFixed(2)}%) — criativos podem estar cansados`);

  // Frequência
  if (avgFreq > 0 && avgFreq < 3) positivos.push(`Frequência saudável (${avgFreq.toFixed(1)}) — sem fadiga de público`);
  else if (avgFreq >= 4) atencao.push(`Frequência alta (${avgFreq.toFixed(1)}) — sinais de saturação do público`);

  // Conversas nos últimos 7 dias
  const last7 = campaign.metrics
    .filter((m) => {
      const d = new Date(m.date);
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return d >= cutoff;
    })
    .reduce((a, m) => a + m.conversationsStarted, 0);

  if (last7 > 0) positivos.push(`${last7} conversas nos últimos 7 dias`);
  else if (campaign.status === "ACTIVE") atencao.push("Sem conversas nos últimos 7 dias");

  // Spend sem retorno
  if (totalSpend > 100 && totalConv === 0) atencao.push(`R$ ${totalSpend.toFixed(2)} investidos sem nenhuma conversa`);

  // Conjuntos ativos
  const activeAdsets = adsets.filter((a) => a.status === "ACTIVE");
  if (activeAdsets.length > 0) positivos.push(`${activeAdsets.length} conjunto(s) ativos`);

  // Sugestões
  if (cplMeta != null && cplMeta < 5) sugestoes.push("Considerar aumentar o budget — CPL excelente, escalar pode trazer mais resultados");
  if (cplMeta != null && cplMeta > 80) sugestoes.push("Avaliar pausa da campanha — CPL muito alto comparado às demais");
  if (avgFreq >= 4) sugestoes.push("Ampliar ou renovar o público — frequência alta indica saturação");
  if (avgCtr < 0.5 && avgCtr > 0) sugestoes.push("Testar novos criativos — CTR baixo reduz a relevância e eleva o CPM");
  if (campaign.status === "ACTIVE" && last7 === 0) sugestoes.push("Verificar configurações — campanha ativa mas sem conversas recentes");
  if (totalSpend > 0 && cplMeta != null && cplMeta < (globalCplMeta ?? 999)) sugestoes.push("Duplicar essa campanha como referência para outros conjuntos");

  if (positivos.length === 0 && totalSpend === 0) {
    atencao.push("Sem dados de métricas nos últimos 30 dias");
    sugestoes.push("Rode o sync completo para puxar os dados de conjuntos e anúncios");
  }

  return { positivos, atencao, sugestoes };
}

// ────────────────────────────────────────────────
// Campaign Detail Modal
// ────────────────────────────────────────────────
function CampaignDetailModal({
  campaign,
  onClose,
  globalCplMeta,
}: {
  campaign: CampaignRow;
  onClose: () => void;
  globalCplMeta: number | null;
}) {
  const [tab, setTab] = useState<ModalTab>("resumo");

  const { data: detail, isLoading: loadingDetail } = useQuery<CampaignFull>({
    queryKey: ["campaign-detail", campaign.id],
    queryFn: () => fetch(`${BASE_URL}/api/campaigns/${campaign.id}`).then((r) => r.json()),
  });

  const { data: adsets = [], isLoading: loadingAdsets } = useQuery<AdSetDetail[]>({
    queryKey: ["campaign-adsets", campaign.id],
    queryFn: () => fetch(`${BASE_URL}/api/campaigns/${campaign.id}/adsets`).then((r) => r.json()),
    enabled: tab === "conjuntos" || tab === "diagnostico",
  });

  const { data: ads = [], isLoading: loadingAds } = useQuery<AdDetail[]>({
    queryKey: ["campaign-ads", campaign.id],
    queryFn: () => fetch(`${BASE_URL}/api/campaigns/${campaign.id}/ads`).then((r) => r.json()),
    enabled: tab === "anuncios" || tab === "diagnostico",
  });

  const diagnostico = useMemo(() => {
    if (!detail) return null;
    return buildDiagnostico(detail, adsets, ads, globalCplMeta);
  }, [detail, adsets, ads, globalCplMeta]);

  const tabs: { key: ModalTab; label: string; icon: React.ReactNode }[] = [
    { key: "resumo", label: "Resumo", icon: <BarChart2 className="w-4 h-4" /> },
    { key: "conjuntos", label: `Conjuntos${detail ? ` (${detail.adsetCount})` : ""}`, icon: <Layers className="w-4 h-4" /> },
    { key: "anuncios", label: `Anúncios${detail ? ` (${detail.adCount})` : ""}`, icon: <Image className="w-4 h-4" /> },
    { key: "diagnostico", label: "Diagnóstico", icon: <Lightbulb className="w-4 h-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">Campanha</p>
            <h2 className="font-semibold text-foreground leading-tight text-sm sm:text-base truncate">{campaign.name}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadgeMeta status={campaign.status} />
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-muted/30 shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {/* ── TAB RESUMO ── */}
          {tab === "resumo" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Investido (30d)", value: fmtBRL(campaign.totalSpend) },
                  { label: "Impressões", value: fmtNum(campaign.totalImpressions) },
                  { label: "Conv. Meta", value: fmtNum(campaign.totalConversations) },
                  { label: "CPL Meta", value: fmtBRL(campaign.cplMeta) },
                  { label: "Leads CRM", value: fmtNum(campaign.crmLeads) },
                  { label: "Contratos", value: fmtNum(campaign.crmContracts) },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-bold tabular-nums mt-1">{s.value}</p>
                  </div>
                ))}
              </div>
              {loadingDetail ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : detail && detail.metrics.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Últimas métricas diárias</p>
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left px-3 py-2 text-muted-foreground font-medium">Data</th>
                          <th className="text-right px-3 py-2 text-muted-foreground font-medium">Investido</th>
                          <th className="text-right px-3 py-2 text-muted-foreground font-medium">Impressões</th>
                          <th className="text-right px-3 py-2 text-muted-foreground font-medium">Conversas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {detail.metrics.slice(0, 14).map((m) => (
                          <tr key={m.date} className="hover:bg-muted/20">
                            <td className="px-3 py-1.5 tabular-nums">{m.date}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{fmtBRL(Number(m.spend))}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{fmtNum(m.impressions)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{m.conversationsStarted > 0 ? m.conversationsStarted : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : detail ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem métricas diárias. Rode o sync para atualizar.</p>
              ) : null}
            </div>
          )}

          {/* ── TAB CONJUNTOS ── */}
          {tab === "conjuntos" && (
            <div className="space-y-3">
              {loadingAdsets ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
              ) : adsets.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  <p>Nenhum conjunto sincronizado.</p>
                  <p className="text-xs mt-1">Use "Sync Completo" para puxar os conjuntos de anúncios.</p>
                </div>
              ) : adsets.map((as) => (
                <div key={as.id} className="rounded-lg border p-4 space-y-2 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-snug">{as.name}</p>
                      {as.targetingSummary && (
                        <p className="text-xs text-muted-foreground mt-0.5">{as.targetingSummary}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <AudienceBadge type={as.audienceType} />
                      <StatusBadgeMeta status={as.status} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 pt-1">
                    {[
                      { label: "Orçamento/dia", value: as.dailyBudget ? fmtBRL(Number(as.dailyBudget)) : "—" },
                      { label: "Investido", value: fmtBRL(as.totalSpend) },
                      { label: "Impressões", value: fmtNum(as.totalImpressions) },
                      { label: "Conversas", value: fmtNum(as.totalConversations) },
                      { label: "CPL Meta", value: fmtBRL(as.cplMeta) },
                    ].map((s) => (
                      <div key={s.label} className="bg-muted/30 rounded px-2 py-1.5">
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="text-sm font-semibold tabular-nums">{s.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── TAB ANÚNCIOS ── */}
          {tab === "anuncios" && (
            <div className="space-y-3">
              {loadingAds ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)
              ) : ads.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  <p>Nenhum anúncio sincronizado.</p>
                  <p className="text-xs mt-1">Use "Sync Completo" para puxar os anúncios.</p>
                </div>
              ) : ads.map((ad) => (
                <div key={ad.id} className="rounded-lg border overflow-hidden flex gap-0">
                  {/* Thumbnail */}
                  {ad.creativeUrl ? (
                    <div className="w-24 shrink-0 bg-muted">
                      <img
                        src={ad.creativeUrl}
                        alt={ad.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  ) : (
                    <div className="w-24 shrink-0 bg-muted flex items-center justify-center">
                      <Image className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  )}
                  {/* Info */}
                  <div className="flex-1 p-3 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium leading-snug truncate">{ad.name}</p>
                      <StatusBadgeMeta status={ad.status} />
                    </div>
                    {ad.headline && <p className="text-xs font-semibold text-foreground/80">{ad.headline}</p>}
                    {ad.body && <p className="text-xs text-muted-foreground line-clamp-2">{ad.body}</p>}
                    {ad.callToAction && (
                      <span className="inline-text text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{ad.callToAction}</span>
                    )}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {[
                        { label: "Gasto", value: fmtBRL(ad.totalSpend) },
                        { label: "Impressões", value: fmtNum(ad.totalImpressions) },
                        { label: "CTR", value: ad.avgCtr != null ? `${(ad.avgCtr * 100).toFixed(2)}%` : "—" },
                        { label: "Conversas", value: fmtNum(ad.totalConversations) },
                      ].map((s) => (
                        <div key={s.label} className="bg-muted/30 rounded px-1.5 py-1">
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                          <p className="text-xs font-semibold tabular-nums">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── TAB DIAGNÓSTICO ── */}
          {tab === "diagnostico" && (
            <div className="space-y-4">
              {!diagnostico || (loadingAdsets && loadingAds) ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
              ) : (
                <>
                  {diagnostico.positivos.length > 0 && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-2">
                      <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Pontos positivos
                      </p>
                      <ul className="space-y-1">
                        {diagnostico.positivos.map((p, i) => (
                          <li key={i} className="text-sm text-green-700 flex items-start gap-2">
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {diagnostico.atencao.length > 0 && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-2">
                      <p className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Pontos de atenção
                      </p>
                      <ul className="space-y-1">
                        {diagnostico.atencao.map((a, i) => (
                          <li key={i} className="text-sm text-yellow-700 flex items-start gap-2">
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />{a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {diagnostico.sugestoes.length > 0 && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
                      <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4" /> Sugestões
                      </p>
                      <ul className="space-y-1">
                        {diagnostico.sugestoes.map((s, i) => (
                          <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Análise baseada nos dados dos últimos 30 dias. CPL Meta médio do escritório: {fmtBRL(globalCplMeta)}.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────
export function TrafficPerformance() {
  const queryClient = useQueryClient();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [ticketInput, setTicketInput] = useState<string>(() => localStorage.getItem(TICKET_STORAGE_KEY) ?? "5000");
  const [showTicketEdit, setShowTicketEdit] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignRow | null>(null);

  const ticket = useMemo(() => {
    const v = Number(ticketInput.replace(/\D/g, ""));
    return isNaN(v) || v <= 0 ? 5000 : v;
  }, [ticketInput]);

  const saveTicket = () => {
    localStorage.setItem(TICKET_STORAGE_KEY, String(ticket));
    setShowTicketEdit(false);
  };

  const { data, isLoading, error } = useQuery<PerformanceData>({
    queryKey: ["campaigns-performance"],
    queryFn: () => fetch(`${BASE_URL}/api/campaigns/performance`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    staleTime: 5 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: () => fetch(`${BASE_URL}/api/campaigns/sync`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    onSuccess: (res: { campaigns: number; metrics: number }) => {
      setSyncMsg(`Sincronizado: ${res.campaigns} campanhas, ${res.metrics} métricas`);
      queryClient.invalidateQueries({ queryKey: ["campaigns-performance"] });
      setTimeout(() => setSyncMsg(null), 5000);
    },
    onError: (err: Error) => { setSyncMsg("Erro: " + err.message); setTimeout(() => setSyncMsg(null), 5000); },
  });

  const syncFullMutation = useMutation({
    mutationFn: () => fetch(`${BASE_URL}/api/campaigns/sync/full`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
    onSuccess: (res: { campaigns: number; metrics: number; adsets: number; ads: number; adMetrics: number }) => {
      setSyncMsg(`Sync completo: ${res.campaigns} campanhas · ${res.adsets} conjuntos · ${res.ads} anúncios · ${res.adMetrics} métricas`);
      queryClient.invalidateQueries({ queryKey: ["campaigns-performance"] });
      setTimeout(() => setSyncMsg(null), 8000);
    },
    onError: (err: Error) => { setSyncMsg("Erro no sync completo: " + err.message); setTimeout(() => setSyncMsg(null), 5000); },
  });

  const s = data?.summary;
  const globalCplMeta = s?.cplMeta ?? null;

  const filteredCampaigns = useMemo(() => {
    let list = [...(data?.campaigns ?? [])];
    if (filter === "active") list = list.filter((c) => c.status === "ACTIVE");
    if (filter === "withSpend") list = list.filter((c) => c.totalSpend > 0);
    list.sort((a, b) => b.totalSpend - a.totalSpend);
    return list;
  }, [data, filter]);

  const groupedCampaigns = useMemo(() => {
    const map = new Map<string, CampaignRow[]>();
    for (const c of filteredCampaigns) {
      const g = normalizeGroup(getGroup(c.name));
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(c);
    }
    return map;
  }, [filteredCampaigns]);

  const statCards = [
    { label: "Investido (30d)", value: fmtBRL(s?.totalSpend), icon: DollarSign, bg: "#eff6ff", border: "#bfdbfe", valColor: "#1d4ed8" },
    { label: "Leads no CRM", value: fmtNum(s?.totalCrmLeads), icon: Users, bg: "#f0fdf4", border: "#bbf7d0", valColor: "#065f46" },
    { label: "CPL Meta", value: fmtBRL(s?.cplMeta), icon: Target, bg: "#fff7ed", border: "#fed7aa", valColor: "#9a3412" },
    { label: "CPL CRM", value: fmtBRL(s?.cplCrm), icon: TrendingUp, bg: "#fdf4ff", border: "#e9d5ff", valColor: "#7c3aed" },
    { label: "Contratos", value: fmtNum(s?.totalContracts), icon: CheckCircle, bg: "#f0fdf4", border: "#bbf7d0", valColor: "#065f46" },
    { label: "Impressões", value: fmtNum(s?.totalImpressions), icon: TrendingUp, bg: "#f8fafc", border: "#e2e8f0", valColor: "#475569" },
  ];

  const filterBtns: { key: FilterMode; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "active", label: "Só ativas" },
    { key: "withSpend", label: "Só com gasto" },
  ];

  const isPending = syncMutation.isPending || syncFullMutation.isPending;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Performance de Tráfego</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Meta Ads × CRM — últimos 30 dias</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {syncMsg && (
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md max-w-xs truncate">
              {syncMsg}
            </span>
          )}
          <button
            onClick={() => syncMutation.mutate()}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            Sincronizar
          </button>
          <button
            onClick={() => syncFullMutation.mutate()}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            title="Sync completo: campanhas + conjuntos + anúncios + métricas (pode demorar alguns minutos)"
          >
            <RefreshCw className={`w-4 h-4 ${syncFullMutation.isPending ? "animate-spin" : ""}`} />
            Sync Completo
          </button>
        </div>
      </div>

      {/* Ticket médio */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
        <Settings2 className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground">Ticket médio por contrato:</span>
        {showTicketEdit ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">R$</span>
            <input
              type="number"
              value={ticketInput}
              onChange={(e) => setTicketInput(e.target.value)}
              className="w-28 text-sm border border-border rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              onKeyDown={(e) => e.key === "Enter" && saveTicket()}
              autoFocus
            />
            <button onClick={saveTicket} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md hover:bg-primary/90">Salvar</button>
            <button onClick={() => setShowTicketEdit(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setShowTicketEdit(true)} className="text-sm font-semibold text-primary hover:underline">{fmtBRL(ticket)}</button>
        )}
        <span className="text-xs text-muted-foreground ml-auto hidden sm:block">ROI = (Contratos × Ticket − Investido) / Investido</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          : statCards.map((c) => (
              <div key={c.label} style={{ background: c.bg, borderColor: c.border }} className="rounded-xl border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">{c.label}</span>
                  <c.icon className="w-4 h-4 text-muted-foreground/50" />
                </div>
                <div style={{ color: c.valColor }} className="text-xl font-bold tabular-nums">{c.value}</div>
              </div>
            ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />{(error as Error).message}
        </div>
      )}

      {/* Campaigns table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold text-foreground">
            Campanhas <span className="text-xs font-normal text-muted-foreground">({filteredCampaigns.length} exibidas)</span>
          </h2>
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {filterBtns.map((btn) => (
              <button
                key={btn.key}
                onClick={() => setFilter(btn.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === btn.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 py-2 border-b bg-muted/20 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="font-medium">CPL CRM:</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border-l-2 border-green-500 bg-green-50 inline-block" />≤ R$ 30 boa performance</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border-l-2 border-yellow-500 bg-yellow-50 inline-block" />R$ 30–80 atenção</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border-l-2 border-red-500 bg-red-50 inline-block" />&gt; R$ 80 caro</span>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}</div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm"><p>Nenhuma campanha encontrada com esse filtro.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Campanha</th>
                  <th className="text-center font-medium text-muted-foreground px-3 py-3">Status</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-3">Investido ↓</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-3">Impressões</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-3">Conv. Meta</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-3">CPL Meta</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-3">Leads CRM</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-3">Contratos</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-3">ROI Est.</th>
                  <th className="text-center font-medium text-muted-foreground px-3 py-3">Det.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Array.from(groupedCampaigns.entries()).map(([groupName, rows]) => {
                  const gSpend = rows.reduce((a, r) => a + r.totalSpend, 0);
                  const gLeads = rows.reduce((a, r) => a + (r.crmLeads ?? 0), 0);
                  const gContracts = rows.reduce((a, r) => a + (r.crmContracts ?? 0), 0);
                  return (
                    <React.Fragment key={groupName}>
                      <GroupSummaryRow label={groupName} totalSpend={gSpend} totalLeads={gLeads} totalContracts={gContracts} ticket={ticket} />
                      {rows.map((c) => {
                        const cplCrm = (c.crmLeads ?? 0) > 0 ? c.totalSpend / (c.crmLeads ?? 1) : null;
                        const colors = cplCrmColor(cplCrm);
                        return (
                          <tr key={c.id} className="hover:bg-muted/30 transition-colors" style={{ borderLeft: `3px solid ${colors.border}` }}>
                            <td className="px-4 py-3" style={{ background: colors.bg + "44" }}>
                              <div className="font-medium text-foreground leading-snug">{c.name}</div>
                              {c.objective && <div className="text-xs text-muted-foreground mt-0.5">{c.objective}</div>}
                            </td>
                            <td className="px-3 py-3 text-center"><StatusBadgeMeta status={c.status} /></td>
                            <td className="px-3 py-3 text-right font-semibold tabular-nums">
                              {c.totalSpend > 0 ? fmtBRL(c.totalSpend) : <span className="text-muted-foreground font-normal">—</span>}
                            </td>
                            <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{fmtNum(c.totalImpressions || undefined)}</td>
                            <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                              {c.totalConversations > 0 ? fmtNum(c.totalConversations) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {c.cplMeta != null ? (
                                <span className={c.cplMeta > 100 ? "text-red-600" : c.cplMeta > 50 ? "text-yellow-600" : "text-green-600"}>{fmtBRL(c.cplMeta)}</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {(c.crmLeads ?? 0) > 0 ? <span className="font-medium">{fmtNum(c.crmLeads)}</span> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-3 text-right">
                              {(c.crmContracts ?? 0) > 0 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 font-bold text-xs">{c.crmContracts}</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <RoiCell contracts={c.crmContracts ?? 0} spend={c.totalSpend} ticket={ticket} />
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button
                                onClick={() => setSelectedCampaign(c)}
                                className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                title="Ver detalhes"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Sync básico: campanhas + métricas. Sync Completo: + conjuntos + anúncios + métricas por anúncio (demora ~2-5 min).
      </p>

      {/* Modal */}
      {selectedCampaign && (
        <CampaignDetailModal
          campaign={selectedCampaign}
          onClose={() => setSelectedCampaign(null)}
          globalCplMeta={globalCplMeta}
        />
      )}
    </div>
  );
}
