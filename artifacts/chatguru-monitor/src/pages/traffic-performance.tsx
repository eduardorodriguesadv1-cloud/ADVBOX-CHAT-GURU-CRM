import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RefreshCw, TrendingUp, TrendingDown, Users, DollarSign,
  Target, AlertCircle, CheckCircle, PauseCircle, Settings2,
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const TICKET_STORAGE_KEY = "crm_ticket_medio";

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

type FilterMode = "all" | "active" | "withSpend";

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

function normalizeGroupLabel(label: string): string {
  const map: Record<string, string> = {
    "[ENGAJAMENTO]": "ENGAJAMENTO",
    "{ENGAJAMENTO}": "ENGAJAMENTO",
    "(ENGAJAMENTO)": "ENGAJAMENTO",
    "(ENG)": "ENGAJAMENTO",
    "[LEADS]": "LEADS",
    "(LEADS)": "LEADS",
    "[WHATS]": "WHATS",
    "[RECONHECIMENTO]": "RECONHECIMENTO",
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

function StatusBadgeMeta({ status }: { status: string }) {
  if (status === "ACTIVE")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
        <CheckCircle className="w-3 h-3" /> Ativa
      </span>
    );
  if (status === "PAUSED")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
        <PauseCircle className="w-3 h-3" /> Pausada
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
      {status}
    </span>
  );
}

function cplCrmColor(cpl: number | null): { border: string; bg: string } {
  if (cpl == null) return { border: "#e2e8f0", bg: "transparent" };
  if (cpl <= 30) return { border: "#16a34a", bg: "#f0fdf4" };
  if (cpl <= 80) return { border: "#d97706", bg: "#fffbeb" };
  return { border: "#dc2626", bg: "#fef2f2" };
}

function RoiCell({ contracts, spend, ticket }: { contracts: number; spend: number; ticket: number }) {
  if (contracts === 0 || spend === 0) return <span className="text-muted-foreground">—</span>;
  const roi = ((contracts * ticket - spend) / spend) * 100;
  const positive = roi >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${positive ? "text-green-600" : "text-red-600"}`}>
      {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {fmtPct(roi)}
    </span>
  );
}

interface GroupSummaryRowProps {
  label: string;
  totalSpend: number;
  totalLeads: number;
  totalContracts: number;
  ticket: number;
}

function GroupSummaryRow({ label, totalSpend, totalLeads, totalContracts, ticket }: GroupSummaryRowProps) {
  const roi = totalContracts > 0 && totalSpend > 0
    ? ((totalContracts * ticket - totalSpend) / totalSpend) * 100
    : null;
  return (
    <tr className="bg-muted/60 border-y border-border/70">
      <td className="px-5 py-2 font-semibold text-xs text-foreground/70 uppercase tracking-wider" colSpan={2}>
        {label}
      </td>
      <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-foreground/80">
        {fmtBRL(totalSpend)}
      </td>
      <td className="px-3 py-2 text-right text-xs text-muted-foreground" colSpan={2} />
      <td className="px-3 py-2 text-right text-xs text-muted-foreground" />
      <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-foreground/80">
        {totalLeads > 0 ? fmtNum(totalLeads) : "—"}
      </td>
      <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-foreground/80">
        {totalContracts > 0 ? String(totalContracts) : "—"}
      </td>
      <td className="px-5 py-2 text-right text-xs font-semibold">
        {roi != null ? (
          <span className={roi >= 0 ? "text-green-600" : "text-red-600"}>
            {fmtPct(roi)}
          </span>
        ) : "—"}
      </td>
    </tr>
  );
}

export function TrafficPerformance() {
  const queryClient = useQueryClient();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [ticketInput, setTicketInput] = useState<string>(
    () => localStorage.getItem(TICKET_STORAGE_KEY) ?? "5000"
  );
  const [showTicketEdit, setShowTicketEdit] = useState(false);

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
    queryFn: () =>
      fetch(`${BASE_URL}/api/campaigns/performance`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    staleTime: 5 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      fetch(`${BASE_URL}/api/campaigns/sync`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    onSuccess: (res: { campaigns: number; metrics: number }) => {
      setSyncMsg(`Sincronizado: ${res.campaigns} campanhas, ${res.metrics} métricas`);
      queryClient.invalidateQueries({ queryKey: ["campaigns-performance"] });
      setTimeout(() => setSyncMsg(null), 5000);
    },
    onError: (err: Error) => {
      setSyncMsg("Erro: " + (err.message ?? "Falha na sincronização"));
      setTimeout(() => setSyncMsg(null), 5000);
    },
  });

  const s = data?.summary;

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
      const g = normalizeGroupLabel(getGroup(c.name));
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
            <span className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
              {syncMsg}
            </span>
          )}
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            Sincronizar Meta
          </button>
        </div>
      </div>

      {/* Ticket médio configurável */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
        <Settings2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
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
            <button
              onClick={saveTicket}
              className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md hover:bg-primary/90"
            >
              Salvar
            </button>
            <button
              onClick={() => setShowTicketEdit(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowTicketEdit(true)}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {fmtBRL(ticket)}
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto hidden sm:block">
          ROI = (Contratos × Ticket − Investido) / Investido
        </span>
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
                <div style={{ color: c.valColor }} className="text-xl font-bold tabular-nums">
                  {c.value}
                </div>
              </div>
            ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {(error as Error).message}
        </div>
      )}

      {/* Campaigns table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Table header + filters */}
        <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold text-foreground">
            Campanhas
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({filteredCampaigns.length} exibidas)
            </span>
          </h2>
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {filterBtns.map((btn) => (
              <button
                key={btn.key}
                onClick={() => setFilter(btn.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filter === btn.key
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
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
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            <p>Nenhuma campanha encontrada com esse filtro.</p>
          </div>
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
                  <th className="text-right font-medium text-muted-foreground px-5 py-3">ROI Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Array.from(groupedCampaigns.entries()).map(([groupName, rows]) => {
                  const gSpend = rows.reduce((a, r) => a + r.totalSpend, 0);
                  const gLeads = rows.reduce((a, r) => a + (r.crmLeads ?? 0), 0);
                  const gContracts = rows.reduce((a, r) => a + (r.crmContracts ?? 0), 0);

                  return (
                    <React.Fragment key={groupName}>
                      <GroupSummaryRow
                        label={groupName}
                        totalSpend={gSpend}
                        totalLeads={gLeads}
                        totalContracts={gContracts}
                        ticket={ticket}
                      />
                      {rows.map((c) => {
                        const cplCrm = (c.crmLeads ?? 0) > 0 ? c.totalSpend / (c.crmLeads ?? 1) : null;
                        const colors = cplCrmColor(cplCrm);
                        return (
                          <tr
                            key={c.id}
                            className="hover:bg-muted/30 transition-colors"
                            style={{ borderLeft: `3px solid ${colors.border}` }}
                          >
                            <td className="px-4 py-3" style={{ background: colors.bg + "44" }}>
                              <div className="font-medium text-foreground leading-snug">{c.name}</div>
                              {c.objective && (
                                <div className="text-xs text-muted-foreground mt-0.5">{c.objective}</div>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <StatusBadgeMeta status={c.status} />
                            </td>
                            <td className="px-3 py-3 text-right font-semibold tabular-nums">
                              {c.totalSpend > 0 ? fmtBRL(c.totalSpend) : <span className="text-muted-foreground font-normal">—</span>}
                            </td>
                            <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                              {fmtNum(c.totalImpressions || undefined)}
                            </td>
                            <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                              {c.totalConversations > 0 ? fmtNum(c.totalConversations) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {c.cplMeta != null ? (
                                <span className={c.cplMeta > 100 ? "text-red-600" : c.cplMeta > 50 ? "text-yellow-600" : "text-green-600"}>
                                  {fmtBRL(c.cplMeta)}
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">
                              {(c.crmLeads ?? 0) > 0 ? (
                                <span className="font-medium">{fmtNum(c.crmLeads)}</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-3 text-right">
                              {(c.crmContracts ?? 0) > 0 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 font-bold text-xs">
                                  {c.crmContracts}
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <RoiCell contracts={c.crmContracts ?? 0} spend={c.totalSpend} ticket={ticket} />
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

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        Sincronização automática diária às 07:00 (horário de Brasília).
      </p>
    </div>
  );
}
