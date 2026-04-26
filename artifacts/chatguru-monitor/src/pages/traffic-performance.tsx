import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, TrendingUp, Users, DollarSign, Target, AlertCircle, CheckCircle, PauseCircle } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface CampaignRow {
  id: number;
  name: string;
  status: string;
  objective: string | null;
  totalSpend: number;
  totalImpressions: number;
  totalConversations: number;
  cplMeta: number | null;
  crmLeads?: number;
  crmContracts?: number;
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

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtNum(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR").format(v);
}

function StatusBadgeMeta({ status }: { status: string }) {
  if (status === "ACTIVE") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
      <CheckCircle className="w-3 h-3" /> Ativa
    </span>
  );
  if (status === "PAUSED") return (
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

export function TrafficPerformance() {
  const queryClient = useQueryClient();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

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
  const campaigns = data?.campaigns ?? [];

  const statCards = [
    {
      label: "Investido (30d)",
      value: fmtBRL(s?.totalSpend),
      icon: DollarSign,
      bg: "#eff6ff",
      border: "#bfdbfe",
      valColor: "#1d4ed8",
    },
    {
      label: "Leads no CRM",
      value: fmtNum(s?.totalCrmLeads),
      icon: Users,
      bg: "#f0fdf4",
      border: "#bbf7d0",
      valColor: "#065f46",
    },
    {
      label: "CPL Meta",
      value: fmtBRL(s?.cplMeta),
      icon: Target,
      bg: "#fff7ed",
      border: "#fed7aa",
      valColor: "#9a3412",
    },
    {
      label: "CPL CRM",
      value: fmtBRL(s?.cplCrm),
      icon: TrendingUp,
      bg: "#fdf4ff",
      border: "#e9d5ff",
      valColor: "#7c3aed",
    },
    {
      label: "Contratos",
      value: fmtNum(s?.totalContracts),
      icon: CheckCircle,
      bg: "#f0fdf4",
      border: "#bbf7d0",
      valColor: "#065f46",
    },
    {
      label: "Impressões",
      value: fmtNum(s?.totalImpressions),
      icon: TrendingUp,
      bg: "#f8fafc",
      border: "#e2e8f0",
      valColor: "#475569",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Performance de Tráfego</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Meta Ads × CRM — últimos 30 dias</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          : statCards.map((c) => (
              <div
                key={c.label}
                style={{ background: c.bg, borderColor: c.border }}
                className="rounded-xl border p-4 space-y-2"
              >
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
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-foreground">Campanhas</h2>
        </div>
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            <p>Nenhuma campanha sincronizada.</p>
            <p className="mt-1 text-xs">Configure a variável META_ACCESS_TOKEN e clique em "Sincronizar Meta".</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Campanha</th>
                  <th className="text-center font-medium text-muted-foreground px-3 py-3">Status</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-3">Investido</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-3">Impressões</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-3">Conv. Meta</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-3">CPL Meta</th>
                  <th className="text-right font-medium text-muted-foreground px-3 py-3">Leads CRM</th>
                  <th className="text-right font-medium text-muted-foreground px-5 py-3">Contratos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground">{c.name}</div>
                      {c.objective && (
                        <div className="text-xs text-muted-foreground">{c.objective}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadgeMeta status={c.status} />
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">
                      {fmtBRL(c.totalSpend)}
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                      {fmtNum(c.totalImpressions)}
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                      {fmtNum(c.totalConversations)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {c.cplMeta != null ? (
                        <span className={c.cplMeta > 100 ? "text-red-600" : c.cplMeta > 50 ? "text-yellow-600" : "text-green-600"}>
                          {fmtBRL(c.cplMeta)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                      {fmtNum(c.crmLeads)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {(c.crmContracts ?? 0) > 0 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 font-bold text-xs">
                          {c.crmContracts}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground text-center">
        Sincronização automática diária às 07:00 (horário de Brasília). Dados atualizados: {data ? "agora" : "—"}
      </p>
    </div>
  );
}
