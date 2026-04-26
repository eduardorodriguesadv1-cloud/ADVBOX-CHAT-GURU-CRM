import React from "react";
import { RefreshCw, Tag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface TagItem { id: number; name: string; total: number; }
interface GroupedTags { [category: string]: TagItem[]; }

const CATEGORY_LABELS: Record<string, string> = {
  ORIGEM: "🌐 Origem",
  SETOR: "🏢 Setor",
  STATUS: "📊 Status do Lead",
  CASO: "⚖️ Tipo de Caso",
  MOTIVO_DESCARTE: "🗑️ Motivo de Descarte",
};

const CATEGORY_COLORS: Record<string, string> = {
  ORIGEM: "#3b82f6",
  SETOR: "#8b5cf6",
  STATUS: "#f59e0b",
  CASO: "#10b981",
  MOTIVO_DESCARTE: "#ef4444",
};

export function TagsPage() {
  const { toast } = useToast();
  const [grouped, setGrouped] = React.useState<GroupedTags>({});
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/api/tags`);
      const d = await r.json();
      setGrouped(d.grouped ?? {});
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      await fetch(`${BASE_URL}/api/tags/sync`, { method: "POST" });
      toast({ title: "Tags sincronizadas!" });
      load();
    } finally { setSyncing(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
          <p className="text-muted-foreground text-sm mt-1">Classificação e categorização de leads.</p>
        </div>
        <button onClick={sync} disabled={syncing} className="flex items-center gap-2 px-3 py-2 border border-border text-sm rounded-lg hover:bg-muted transition-colors disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          Sincronizar
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(grouped).map(([category, tags]) => {
            const color = CATEGORY_COLORS[category] ?? "#64748b";
            const label = CATEGORY_LABELS[category] ?? category;
            const maxTotal = Math.max(...tags.map(t => t.total), 1);
            return (
              <div key={category} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-sm font-semibold">{label}</h2>
                  <span className="text-xs text-muted-foreground ml-auto">{tags.length} tags</span>
                </div>
                <div className="space-y-2">
                  {tags.map(tag => (
                    <div key={tag.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-xs font-medium truncate">{tag.name}</span>
                          <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{tag.total}</span>
                        </div>
                        <div className="bg-muted rounded-full h-1.5 overflow-hidden">
                          <div style={{ height: "100%", width: `${(tag.total / maxTotal) * 100}%`, background: color, borderRadius: 99, minWidth: tag.total > 0 ? 6 : 0 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
