import React from "react";
import { useGetStats, getGetStatsQueryKey, useGetWebhookUrl, getGetWebhookUrlQueryKey } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/status-badge";
import { formatPhone, formatDate } from "@/lib/utils";
import { RefreshCw, Copy, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

function getInitials(name: string) {
  return name
    .replace(/[^\w\s]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const AVATAR_COLORS = [
  "#3b82f6","#8b5cf6","#06b6d4","#f59e0b","#10b981","#ef4444","#ec4899","#6366f1",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)];
}

function OrigemBadge({ origem }: { origem?: string }) {
  if (!origem) return null;
  const isAds = origem.toLowerCase().includes("ads") || origem.toLowerCase().includes("meta") || origem.toLowerCase().includes("trafego");
  return (
    <span
      style={{
        background: isAds ? "#ede9fe" : "#e0f2fe",
        color: isAds ? "#5b21b6" : "#0369a1",
        borderRadius: 20,
        padding: "1px 8px",
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: "nowrap" as const,
      }}
    >
      {isAds ? "📣 " : "🏢 "}
      {origem}
    </span>
  );
}

export function Dashboard() {
  const { toast } = useToast();

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
    isFetching,
  } = useGetStats({
    query: {
      queryKey: getGetStatsQueryKey(),
      refetchInterval: 30000,
    },
  });

  const { data: webhookInfo } = useGetWebhookUrl({
    query: { queryKey: getGetWebhookUrlQueryKey() },
  });

  const copyWebhook = () => {
    if (webhookInfo?.url) {
      navigator.clipboard.writeText(webhookInfo.url);
      toast({ title: "Copiado!", description: "URL do Webhook copiada." });
    }
  };

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const statCards = [
    { label: "Total Hoje", value: stats?.todayTotal ?? 0, icon: "👥", bg: "#eff6ff", border: "#bfdbfe", valColor: "#1d4ed8" },
    { label: "Abertos", value: stats?.open ?? 0, icon: "🔔", bg: "#fffbeb", border: "#fde68a", valColor: "#92400e" },
    { label: "Em Atendimento", value: stats?.inProgress ?? 0, icon: "💬", bg: "#eff6ff", border: "#bfdbfe", valColor: "#1d4ed8" },
    { label: "Aguardando", value: stats?.waiting ?? 0, icon: "⏳", bg: "#fff7ed", border: "#fed7aa", valColor: "#9a3412" },
    { label: "Resolvidos", value: stats?.resolved ?? 0, icon: "✅", bg: "#f0fdf4", border: "#bbf7d0", valColor: "#065f46" },
    { label: "Fechados", value: stats?.closed ?? 0, icon: "🔒", bg: "#f8fafc", border: "#e2e8f0", valColor: "#475569" },
  ];

  const total = stats?.todayTotal ?? 0;
  const funnelSteps = [
    { label: "Captados", value: total, color: "#3b82f6" },
    { label: "Abertos", value: stats?.open ?? 0, color: "#f59e0b" },
    { label: "Em Atendimento", value: stats?.inProgress ?? 0, color: "#06b6d4" },
    { label: "Resolvidos", value: stats?.resolved ?? 0, color: "#10b981" },
  ];

  const originCounts: Record<string, number> = {};
  if (stats?.recentActivity) {
    for (const a of stats.recentActivity) {
      const origem = (a as any).origem || "Desconhecido";
      originCounts[origem] = (originCounts[origem] ?? 0) + 1;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1 capitalize">{today}</p>
        </div>
        <button
          onClick={() => refetchStats()}
          disabled={isFetching}
          className="flex items-center gap-2 bg-white border border-border rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {statsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>Não foi possível carregar as estatísticas.</AlertDescription>
        </Alert>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statsLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-12" />
              </div>
            ))
          : statCards.map((c) => (
              <div
                key={c.label}
                style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: "16px" }}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                  <span className="text-lg">{c.icon}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: c.valColor, lineHeight: 1 }}>{c.value}</div>
              </div>
            ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funil de Leads */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold">Funil de Leads</h2>
          {statsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {funnelSteps.map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <span className="text-xs font-semibold">{s.value}</span>
                  </div>
                  <div className="bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      style={{
                        height: "100%",
                        width: total > 0 ? `${(s.value / total) * 100}%` : "0%",
                        background: s.color,
                        borderRadius: 99,
                        minWidth: s.value > 0 ? 8 : 0,
                        transition: "width 0.5s",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Por Origem */}
          {!statsLoading && Object.keys(originCounts).length > 0 && (
            <div className="pt-4 border-t border-border space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Por Origem</p>
              {Object.entries(originCounts).map(([origem, count], i) => {
                const isAds = origem.toLowerCase().includes("ads") || origem.toLowerCase().includes("meta") || origem.toLowerCase().includes("trafego");
                return (
                  <div key={origem} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: isAds ? "#8b5cf6" : "#06b6d4" }} />
                      <span className="text-xs">{origem}</span>
                    </div>
                    <span className="text-xs font-semibold">{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Webhook URL */}
          {webhookInfo?.url && (
            <div className="pt-4 border-t border-border space-y-2">
              <p className="text-xs font-medium text-muted-foreground">URL do Webhook</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-2 py-1.5 bg-muted rounded text-xs truncate font-mono text-muted-foreground border border-border">
                  {webhookInfo.url}
                </code>
                <button
                  onClick={copyWebhook}
                  className="p-1.5 rounded bg-muted hover:bg-muted/80 border border-border transition-colors"
                  title="Copiar"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Leads Recentes */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold">Leads Recentes</h2>
            <a href="/conversations" className="text-xs text-primary hover:underline">Ver todos →</a>
          </div>

          {statsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
            <div>
              {stats.recentActivity.map((activity, i) => {
                const name = activity.contactName || formatPhone(activity.chatNumber);
                const origem = (activity as any).origem as string | undefined;
                return (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 py-3"
                    style={{ borderBottom: i < stats.recentActivity!.length - 1 ? "1px solid hsl(var(--border))" : "none" }}
                  >
                    {/* Avatar */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: avatarColor(name),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: 700,
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(name) || "?"}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{name}</span>
                        {activity.contactName && (
                          <span className="text-xs text-muted-foreground">{formatPhone(activity.chatNumber)}</span>
                        )}
                      </div>
                      {activity.lastMessage && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{activity.lastMessage}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {origem && <OrigemBadge origem={origem} />}
                        {activity.assignedAgent && (
                          <span className="text-xs text-muted-foreground">• {activity.assignedAgent}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          • {formatDate(activity.lastMessageAt || activity.updatedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex-shrink-0">
                      <StatusBadge status={activity.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhuma atividade recente registrada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
