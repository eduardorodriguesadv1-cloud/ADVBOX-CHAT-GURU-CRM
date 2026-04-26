import React, { useState } from "react";
import { BarChart2, RefreshCw, AlertTriangle, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getCampaign } from "@/lib/campaignColors";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface SummaryData {
  date: string;
  newLeadsTotal: number;
  byCampaign: Array<{ campaign: string; count: number }>;
  byNumber: Array<{ whatsappNumberId: number | null; count: number }>;
  movement: { inProgress: number; resolved: number; closed: number };
  alerts: { urgent: number; cooling: number };
}

interface Summary {
  id: number;
  date: string;
  data: SummaryData;
  generatedAt: string;
}

function useSummaries() {
  const [summaries, setSummaries] = React.useState<Summary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/api/summaries`);
      const d = await r.json();
      setSummaries(d.summaries ?? []);
    } finally { setLoading(false); }
  }, []);
  React.useEffect(() => { load(); }, [load]);
  return { summaries, loading, reload: load };
}

function SummaryCard({ summary }: { summary: Summary }) {
  const d = summary.data;
  const dateLabel = new Date(summary.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const maxCampaign = Math.max(...d.byCampaign.map(c => c.count), 1);

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize">{dateLabel}</h3>
        <span className="text-xs text-muted-foreground">{new Date(summary.generatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>

      {/* Resumo rápido */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{d.newLeadsTotal}</p>
          <p className="text-xs text-blue-500 mt-0.5">Novos leads</p>
        </div>
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{d.movement.resolved + d.movement.closed}</p>
          <p className="text-xs text-green-500 mt-0.5">Resolvidos</p>
        </div>
        <div className={`rounded-xl p-3 text-center border ${(d.alerts.urgent + d.alerts.cooling) > 0 ? "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900" : "bg-muted/30 border-border"}`}>
          <p className={`text-2xl font-bold ${(d.alerts.urgent + d.alerts.cooling) > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
            {d.alerts.urgent + d.alerts.cooling}
          </p>
          <p className={`text-xs mt-0.5 ${(d.alerts.urgent + d.alerts.cooling) > 0 ? "text-amber-500" : "text-muted-foreground"}`}>Alertas</p>
        </div>
      </div>

      {/* Por campanha */}
      {d.byCampaign.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Por campanha</p>
          <div className="space-y-1.5">
            {d.byCampaign.sort((a, b) => b.count - a.count).map(c => {
              const meta = getCampaign(c.campaign);
              return (
                <div key={c.campaign} className="flex items-center gap-2">
                  <span className="text-xs truncate flex-1">{meta.emoji} {meta.label}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden" style={{ width: 60 }}>
                      <div style={{ height: "100%", width: `${(c.count / maxCampaign) * 100}%`, background: meta.color, borderRadius: 99 }} />
                    </div>
                    <span className="text-xs font-semibold w-4 text-right">{c.count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function Summaries() {
  const { toast } = useToast();
  const { summaries, loading, reload } = useSummaries();
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      await fetch(`${BASE_URL}/api/summaries/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      toast({ title: "Resumo gerado!" });
      reload();
    } finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart2 className="h-6 w-6 text-primary" />
            Resumos Diários
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gerado todo dia às 20h. Histórico dos últimos 30 dias.</p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
          Gerar Agora
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
        </div>
      ) : summaries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum resumo gerado ainda.</p>
          <p className="text-xs mt-1">Clique em "Gerar Agora" para criar o resumo de hoje.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summaries.map(s => <SummaryCard key={s.id} summary={s} />)}
        </div>
      )}
    </div>
  );
}
