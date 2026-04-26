import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Pencil, Trash2, Check, X } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface Agent {
  id: number;
  name: string;
  phone?: string | null;
  team: "COMERCIAL_TRAFEGO" | "ATENDIMENTO";
  active: boolean;
}

function useAgents() {
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/api/agents`);
      const d = await r.json();
      setAgents(d.agents ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);
  return { agents, loading, reload: load };
}

const TEAMS: Record<string, string> = {
  COMERCIAL_TRAFEGO: "Comercial Tráfego",
  ATENDIMENTO: "Atendimento",
};
const TEAM_COLOR: Record<string, string> = {
  COMERCIAL_TRAFEGO: "#8b5cf6",
  ATENDIMENTO: "#06b6d4",
};

function AgentRow({ agent, onEdit, onDelete }: { agent: Agent; onEdit: (a: Agent) => void; onDelete: (id: number) => void }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: TEAM_COLOR[agent.team], display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
        {agent.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{agent.name}</p>
        <p className="text-xs text-muted-foreground">{TEAMS[agent.team] ?? agent.team}{agent.phone ? ` • ${agent.phone}` : ""}</p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full ${agent.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
        {agent.active ? "Ativo" : "Inativo"}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onEdit(agent)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onDelete(agent.id)} className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function AgentForm({ initial, onSave, onCancel }: { initial?: Partial<Agent>; onSave: (data: Partial<Agent>) => void; onCancel: () => void }) {
  const [name, setName] = React.useState(initial?.name ?? "");
  const [phone, setPhone] = React.useState(initial?.phone ?? "");
  const [team, setTeam] = React.useState<Agent["team"]>(initial?.team ?? "COMERCIAL_TRAFEGO");
  const [active, setActive] = React.useState(initial?.active ?? true);

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3 mb-4">
      <p className="text-sm font-semibold">{initial?.id ? "Editar Atendente" : "Novo Atendente"}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Nome *</label>
          <input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Ex: Thiago Tavares" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Telefone</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" placeholder="(81) 99999-9999" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Equipe *</label>
          <select value={team} onChange={e => setTeam(e.target.value as Agent["team"])} className="mt-1 w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="COMERCIAL_TRAFEGO">Comercial Tráfego</option>
            <option value="ATENDIMENTO">Atendimento</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="rounded" />
            Ativo
          </label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"><X className="h-3.5 w-3.5" />Cancelar</button>
        <button onClick={() => onSave({ name, phone: phone || undefined, team, active })} disabled={!name} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"><Check className="h-3.5 w-3.5" />Salvar</button>
      </div>
    </div>
  );
}

export function Team() {
  const { toast } = useToast();
  const { agents, loading, reload } = useAgents();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);

  const grouped = {
    COMERCIAL_TRAFEGO: agents.filter(a => a.team === "COMERCIAL_TRAFEGO"),
    ATENDIMENTO: agents.filter(a => a.team === "ATENDIMENTO"),
  };

  const saveAgent = async (data: Partial<Agent>) => {
    try {
      if (editing) {
        await fetch(`${BASE_URL}/api/agents/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        toast({ title: "Atendente atualizado!" });
      } else {
        await fetch(`${BASE_URL}/api/agents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        toast({ title: "Atendente criado!" });
      }
      setShowForm(false); setEditing(null); reload();
    } catch { toast({ title: "Erro ao salvar", variant: "destructive" }); }
  };

  const deleteAgent = async (id: number) => {
    if (!confirm("Remover este atendente?")) return;
    await fetch(`${BASE_URL}/api/agents/${id}`, { method: "DELETE" });
    toast({ title: "Atendente removido." });
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipe</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerenciar atendentes do escritório.</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors">
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>

      {(showForm && !editing) && <AgentForm onSave={saveAgent} onCancel={() => setShowForm(false)} />}

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(["COMERCIAL_TRAFEGO", "ATENDIMENTO"] as const).map(team => (
            <div key={team} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: TEAM_COLOR[team] }} />
                <h2 className="text-sm font-semibold">{TEAMS[team]}</h2>
                <span className="text-xs text-muted-foreground ml-auto">{grouped[team].length} atendentes</span>
              </div>
              {grouped[team].length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum atendente nesta equipe.</p>
              ) : (
                grouped[team].map(a => (
                  <React.Fragment key={a.id}>
                    {editing?.id === a.id
                      ? <AgentForm initial={a} onSave={saveAgent} onCancel={() => setEditing(null)} />
                      : <AgentRow agent={a} onEdit={setEditing} onDelete={deleteAgent} />}
                  </React.Fragment>
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
