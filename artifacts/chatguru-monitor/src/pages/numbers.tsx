import React from "react";
import { Smartphone, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface WaNumber {
  id: number;
  number: string;
  label: string;
  team: string;
  active: boolean;
  leadsTotal: number;
}

const TEAM_LABELS: Record<string, string> = {
  COMERCIAL_TRAFEGO: "Comercial Tráfego",
  ATENDIMENTO: "Atendimento",
};

function formatNumber(n: string) {
  const d = n.replace(/\D/g, "");
  if (d.length >= 12) return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  return n;
}

export function Numbers() {
  const [numbers, setNumbers] = React.useState<WaNumber[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`${BASE_URL}/api/whatsapp-numbers`)
      .then(r => r.json())
      .then(d => setNumbers(d.numbers ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Números de WhatsApp</h1>
        <p className="text-muted-foreground text-sm mt-1">Origens de atendimento do escritório.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {numbers.map(num => {
            const isComercial = num.team === "COMERCIAL_TRAFEGO";
            return (
              <div key={num.id} className="bg-card border border-border rounded-xl p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: isComercial ? "#ede9fe" : "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Smartphone className="h-5 w-5" style={{ color: isComercial ? "#7c3aed" : "#0284c7" }} />
                    </div>
                    <div>
                      <p className="font-semibold text-base">{num.label}</p>
                      <p className="text-sm text-muted-foreground font-mono">{formatNumber(num.number)}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${num.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {num.active ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div style={{ background: isComercial ? "#f5f3ff" : "#f0f9ff", borderRadius: 10, padding: "12px 16px" }}>
                    <p className="text-xs text-muted-foreground">Total de Leads</p>
                    <p className="text-2xl font-bold mt-0.5" style={{ color: isComercial ? "#7c3aed" : "#0284c7" }}>{num.leadsTotal}</p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">Equipe</p>
                    <p className="text-sm font-medium mt-0.5">{TEAM_LABELS[num.team] ?? num.team}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-muted/30 border border-dashed border-border rounded-xl p-6 text-center">
        <p className="text-sm text-muted-foreground">Para adicionar um novo número de WhatsApp, entre em contato com o administrador do sistema.</p>
      </div>
    </div>
  );
}
