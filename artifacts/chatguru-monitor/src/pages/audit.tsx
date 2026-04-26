import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, Users, Layers, Image, AlertCircle, CheckCircle,
  ShieldAlert, Info, Lightbulb, ExternalLink, CheckSquare, Square,
  BarChart2, Filter,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const DONE_KEY = "audit_done_items";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────
type IssueSeverity = "critical" | "high" | "medium" | "low";
type AuditTab = "overview" | "audiences" | "diagnostico" | "recomendacoes";
type AudienceFilter = "all" | "duplicate" | "never" | "historic" | "stale" | "orphan";

interface DiagnosticIssue {
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

interface AudienceWithIssues {
  id: number;
  metaAudienceId: string;
  name: string;
  type: string | null;
  subtype: string | null;
  approximateCount: number | null;
  status: string | null;
  lastUsedAt: string | null;
  issues: string[];
  adsetCount: number;
}

interface AuditOverview {
  audiences: { total: number; duplicates: number; unused: number; historic: number; stale: number; orphanEngagement: number };
  adsets: { total: number; withOverlap: number };
  ads: { total: number; lowCtr: number; highFrequency: number; noConversions: number; duplicates: number };
  totalIssues: number;
  issuesBySeverity: Record<IssueSeverity, number>;
}

interface Recommendation {
  id: string;
  priority: number;
  title: string;
  detail: string;
  impact: string;
  items: Array<{ id: number | string; name: string }>;
}

interface AuditData {
  overview: AuditOverview;
  issues: DiagnosticIssue[];
  audiencesWithIssues: AudienceWithIssues[];
  recommendations: Recommendation[];
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────
function fmtNum(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR").format(v);
}

function severityConfig(s: IssueSeverity) {
  const map = {
    critical: { label: "Crítico", icon: ShieldAlert, cls: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-500", badge: "bg-red-100 text-red-700 border-red-200" },
    high: { label: "Alto", icon: AlertCircle, cls: "text-orange-700 bg-orange-50 border-orange-200", dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700 border-orange-200" },
    medium: { label: "Médio", icon: Info, cls: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    low: { label: "Baixo", icon: Lightbulb, cls: "text-blue-700 bg-blue-50 border-blue-200", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  };
  return map[s];
}

function audienceStatusBadge(status: string | null) {
  if (status === "ready") return <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Pronto</span>;
  if (status === "in_progress") return <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">Processando</span>;
  if (status === "expired") return <span className="text-xs text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Expirado</span>;
  return <span className="text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">{status ?? "—"}</span>;
}

function audienceTypeBadge(type: string | null) {
  const cfg = {
    CUSTOM: "bg-purple-50 text-purple-700 border-purple-200",
    LOOKALIKE: "bg-orange-50 text-orange-700 border-orange-200",
    WEBSITE: "bg-blue-50 text-blue-700 border-blue-200",
    CUSTOMER_LIST: "bg-green-50 text-green-700 border-green-200",
    ENGAGEMENT: "bg-pink-50 text-pink-700 border-pink-200",
    VIDEO: "bg-indigo-50 text-indigo-700 border-indigo-200",
    OFFLINE: "bg-slate-50 text-slate-700 border-slate-200",
  }[type ?? "CUSTOM"] ?? "bg-slate-50 text-slate-700 border-slate-200";
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg}`}>{type ?? "—"}</span>;
}

// ────────────────────────────────────────────────
// Overview stat card
// ────────────────────────────────────────────────
function OverviewCard({ label, value, sub, icon: Icon, color }: { label: string; value: number; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-current opacity-70">{label}</span>
        <Icon className="w-4 h-4 opacity-40" />
      </div>
      <div className="text-2xl font-bold tabular-nums">{fmtNum(value)}</div>
      {sub && <p className="text-xs opacity-70 leading-snug">{sub}</p>}
    </div>
  );
}

// ────────────────────────────────────────────────
// Issue card
// ────────────────────────────────────────────────
function IssueCard({ issue }: { issue: DiagnosticIssue }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = severityConfig(issue.severity);
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border p-4 space-y-2 ${cfg.cls}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Icon className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>{cfg.label}</span>
              <span className="text-xs opacity-60 capitalize">{issue.category}</span>
            </div>
            <p className="font-semibold text-sm mt-1 leading-snug">{issue.title}</p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-xs opacity-60 hover:opacity-100 shrink-0 mt-1">
          {expanded ? "menos" : "mais"}
        </button>
      </div>
      <p className="text-sm opacity-80 leading-relaxed">{issue.description}</p>
      {expanded && (
        <div className="space-y-2 pt-1">
          <div className="text-xs bg-white/40 rounded-lg p-2 space-y-1">
            <p><span className="font-semibold">Impacto:</span> {issue.impactEstimate}</p>
            <p><span className="font-semibold">Ação:</span> {issue.suggestion}</p>
          </div>
          {issue.items.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold opacity-70">Itens afetados ({issue.items.length}):</p>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {issue.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-white/30 rounded px-2 py-1">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                    <span className="font-medium truncate">{item.name}</span>
                    {item.detail && <span className="opacity-60 ml-auto shrink-0">{item.detail}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// Recommendation card
// ────────────────────────────────────────────────
function RecommendationCard({
  rec,
  done,
  onToggle,
}: {
  rec: Recommendation;
  done: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-xl border p-4 space-y-2 transition-opacity ${done ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <button onClick={onToggle} className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors">
          {done ? <CheckSquare className="w-5 h-5 text-green-600" /> : <Square className="w-5 h-5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground w-5 text-center">{rec.priority}</span>
            <p className={`font-semibold text-sm leading-snug ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {rec.title}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-7">{rec.detail}</p>
          <div className="ml-7 mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{rec.impact}</span>
            {rec.items.length > 0 && (
              <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary hover:underline">
                {expanded ? "ocultar" : `ver ${rec.items.length} item(s)`}
              </button>
            )}
          </div>
          {expanded && (
            <div className="ml-7 mt-2 space-y-1 max-h-36 overflow-y-auto">
              {rec.items.map((item, i) => (
                <div key={i} className="text-xs text-muted-foreground flex items-center gap-2 bg-muted/40 rounded px-2 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </div>
              ))}
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
export function AuditPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AuditTab>("overview");
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | "all">("all");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [doneItems, setDoneItems] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(DONE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const toggleDone = (id: string) => {
    setDoneItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(DONE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const { data, isLoading, error } = useQuery<AuditData>({
    queryKey: ["audit-data"],
    queryFn: () =>
      fetch(`${BASE_URL}/api/audit/run`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const syncAudiencesMutation = useMutation({
    mutationFn: () =>
      fetch(`${BASE_URL}/api/audit/sync/audiences`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    onSuccess: (res: { audiences: number; usages: number }) => {
      setSyncMsg(`Sincronizado: ${res.audiences} públicos, ${res.usages} relações adset↔público`);
      queryClient.invalidateQueries({ queryKey: ["audit-data"] });
      setTimeout(() => setSyncMsg(null), 6000);
    },
    onError: (err: Error) => {
      setSyncMsg("Erro: " + err.message);
      setTimeout(() => setSyncMsg(null), 5000);
    },
  });

  const o = data?.overview;
  const issues = data?.issues ?? [];
  const audiences = data?.audiencesWithIssues ?? [];
  const recommendations = data?.recommendations ?? [];

  const filteredAudiences = useMemo(() => {
    if (audienceFilter === "all") return audiences;
    if (audienceFilter === "duplicate") return audiences.filter((a) => a.issues.includes("Duplicado"));
    if (audienceFilter === "never") return audiences.filter((a) => a.issues.includes("Nunca usado"));
    if (audienceFilter === "historic") return audiences.filter((a) => a.issues.includes("Uso histórico"));
    if (audienceFilter === "stale") return audiences.filter((a) => a.issues.includes("Em preenchimento"));
    if (audienceFilter === "orphan") return audiences.filter((a) => a.issues.includes("Engajamento órfão"));
    return audiences;
  }, [audiences, audienceFilter]);

  const filteredIssues = useMemo(() => {
    if (severityFilter === "all") return issues;
    return issues.filter((i) => i.severity === severityFilter);
  }, [issues, severityFilter]);

  const sortedIssues = useMemo(() => {
    const order: Record<IssueSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...filteredIssues].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [filteredIssues]);

  const tabs: { key: AuditTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "overview", label: "Visão Geral", icon: <BarChart2 className="w-4 h-4" /> },
    { key: "audiences", label: "Públicos", icon: <Users className="w-4 h-4" />, count: o?.audiences.total },
    { key: "diagnostico", label: "Diagnóstico", icon: <ShieldAlert className="w-4 h-4" />, count: o?.totalIssues },
    { key: "recomendacoes", label: "Recomendações", icon: <Lightbulb className="w-4 h-4" />, count: recommendations.length },
  ];

  const severityFilters: { key: IssueSeverity | "all"; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "critical", label: "Crítico" },
    { key: "high", label: "Alto" },
    { key: "medium", label: "Médio" },
    { key: "low", label: "Baixo" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Auditoria Meta Ads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Diagnóstico automático de públicos, anúncios e campanhas</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {syncMsg && (
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md max-w-xs">{syncMsg}</span>
          )}
          <button
            onClick={() => syncAudiencesMutation.mutate()}
            disabled={syncAudiencesMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncAudiencesMutation.isPending ? "animate-spin" : ""}`} />
            Sync Públicos
          </button>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["audit-data"] })}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Reanalisar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {(error as Error).message}
        </div>
      )}

      {/* Container with tabs */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b bg-muted/20 overflow-x-auto">
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
              {t.icon}
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  tab === t.key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── TAB OVERVIEW ── */}
          {tab === "overview" && (
            <div className="space-y-6">
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
              ) : o ? (
                <>
                  {/* Severity overview */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(["critical", "high", "medium", "low"] as IssueSeverity[]).map((s) => {
                      const cfg = severityConfig(s);
                      const count = o.issuesBySeverity[s];
                      return (
                        <div key={s} className={`rounded-xl border p-4 ${cfg.cls}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <cfg.icon className="w-4 h-4" />
                            <span className="text-xs font-semibold">{cfg.label}</span>
                          </div>
                          <div className="text-3xl font-bold tabular-nums">{count}</div>
                          <p className="text-xs opacity-70 mt-1">problema(s)</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Section cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Audiences */}
                    <div className="rounded-xl border p-4 space-y-3 bg-purple-50 border-purple-200 text-purple-900">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <span className="font-semibold text-sm">Públicos</span>
                      </div>
                      <div className="text-3xl font-bold">{fmtNum(o.audiences.total)}</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span>Duplicados</span><span className="font-semibold">{o.audiences.duplicates}</span></div>
                        <div className="flex justify-between"><span>Nunca utilizados</span><span className="font-semibold">{o.audiences.unused}</span></div>
                        {(o.audiences.historic ?? 0) > 0 && (
                          <div className="flex justify-between text-slate-500"><span>Só em AdSets pausados</span><span className="font-semibold">{o.audiences.historic}</span></div>
                        )}
                        <div className="flex justify-between"><span>Em preenchimento</span><span className="font-semibold">{o.audiences.stale}</span></div>
                        {(o.audiences.orphanEngagement ?? 0) > 0 && (
                          <div className="flex justify-between text-orange-600"><span>Eng. sem Leads ativo</span><span className="font-semibold">{o.audiences.orphanEngagement}</span></div>
                        )}
                      </div>
                    </div>

                    {/* Adsets */}
                    <div className="rounded-xl border p-4 space-y-3 bg-blue-50 border-blue-200 text-blue-900">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4" />
                        <span className="font-semibold text-sm">Conjuntos</span>
                      </div>
                      <div className="text-3xl font-bold">{fmtNum(o.adsets.total)}</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span>Com sobreposição</span><span className="font-semibold">{o.adsets.withOverlap}</span></div>
                      </div>
                    </div>

                    {/* Ads */}
                    <div className="rounded-xl border p-4 space-y-3 bg-orange-50 border-orange-200 text-orange-900">
                      <div className="flex items-center gap-2">
                        <Image className="w-4 h-4" />
                        <span className="font-semibold text-sm">Anúncios</span>
                      </div>
                      <div className="text-3xl font-bold">{fmtNum(o.ads.total)}</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span>Baixo CTR</span><span className="font-semibold">{o.ads.lowCtr}</span></div>
                        <div className="flex justify-between"><span>Alta frequência</span><span className="font-semibold">{o.ads.highFrequency}</span></div>
                        <div className="flex justify-between"><span>Sem conversão (+R$50)</span><span className="font-semibold">{o.ads.noConversions}</span></div>
                        <div className="flex justify-between"><span>Duplicados</span><span className="font-semibold">{o.ads.duplicates}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Summary text */}
                  <div className="bg-muted/30 rounded-xl p-4 text-sm text-muted-foreground text-center">
                    Total de <span className="font-semibold text-foreground">{o.totalIssues} problema(s) detectado(s)</span> ·{" "}
                    <span className="font-semibold text-foreground">{recommendations.length} recomendação(ões)</span> geradas automaticamente
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-10">Nenhum dado. Clique em "Reanalisar" para rodar o diagnóstico.</p>
              )}
            </div>
          )}

          {/* ── TAB AUDIENCES ── */}
          {tab === "audiences" && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 w-fit">
                {([
                  { key: "all" as AudienceFilter, label: `Todos (${audiences.length})` },
                  { key: "duplicate" as AudienceFilter, label: `Duplicados (${o?.audiences.duplicates ?? 0})` },
                  { key: "never" as AudienceFilter, label: `Nunca usados (${o?.audiences.unused ?? 0})` },
                  { key: "historic" as AudienceFilter, label: `Só pausados (${o?.audiences.historic ?? 0})` },
                  { key: "stale" as AudienceFilter, label: `Processando (${o?.audiences.stale ?? 0})` },
                  { key: "orphan" as AudienceFilter, label: `Eng. órfão (${o?.audiences.orphanEngagement ?? 0})` },
                ] as { key: AudienceFilter; label: string }[]).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setAudienceFilter(f.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      audienceFilter === f.key
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}</div>
              ) : filteredAudiences.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  {audiences.length === 0 ? "Nenhum público sincronizado. Clique em 'Sync Públicos'." : "Nenhum público com esse filtro."}
                </p>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                        <th className="text-left px-3 py-3 font-medium text-muted-foreground">Tipo</th>
                        <th className="text-right px-3 py-3 font-medium text-muted-foreground">Tamanho</th>
                        <th className="text-center px-3 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-right px-3 py-3 font-medium text-muted-foreground">Conjuntos</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Problemas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredAudiences.map((a) => (
                        <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground leading-snug">{a.name}</p>
                            {a.subtype && <p className="text-xs text-muted-foreground">{a.subtype}</p>}
                          </td>
                          <td className="px-3 py-3">{audienceTypeBadge(a.type)}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                            {a.approximateCount ? fmtNum(a.approximateCount) : "—"}
                          </td>
                          <td className="px-3 py-3 text-center">{audienceStatusBadge(a.status)}</td>
                          <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{a.adsetCount}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {a.issues.length === 0 ? (
                                <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> OK</span>
                              ) : a.issues.map((issue, i) => (
                                <span key={i} className="text-xs px-1.5 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">{issue}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB DIAGNÓSTICO ── */}
          {tab === "diagnostico" && (
            <div className="space-y-4">
              {/* Severity filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                  {severityFilters.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setSeverityFilter(f.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        severityFilter === f.key
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f.label}
                      {f.key !== "all" && o && (
                        <span className="ml-1 opacity-60">({o.issuesBySeverity[f.key as IssueSeverity]})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
              ) : sortedIssues.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-foreground font-semibold">Nenhum problema encontrado!</p>
                  <p className="text-sm text-muted-foreground mt-1">Conta em boa saúde ou aguardando sync de dados.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedIssues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
                </div>
              )}
            </div>
          )}

          {/* ── TAB RECOMENDAÇÕES ── */}
          {tab === "recomendacoes" && (
            <div className="space-y-4">
              {/* Progress */}
              {recommendations.length > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                  <CheckSquare className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{doneItems.size}</span> de{" "}
                    <span className="font-semibold text-foreground">{recommendations.length}</span> concluídas
                  </span>
                  {doneItems.size > 0 && (
                    <button
                      onClick={() => { setDoneItems(new Set()); localStorage.removeItem(DONE_KEY); }}
                      className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                    >
                      Limpar marcações
                    </button>
                  )}
                </div>
              )}

              {isLoading ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
              ) : recommendations.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-foreground font-semibold">Nenhuma recomendação pendente!</p>
                  <p className="text-sm text-muted-foreground mt-1">Rode o diagnóstico após o sync completo para gerar recomendações.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      rec={rec}
                      done={doneItems.has(rec.id)}
                      onToggle={() => toggleDone(rec.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Sync de públicos automático diariamente às 06:00 (Brasília). Diagnóstico gerado sob demanda.
      </p>
    </div>
  );
}
