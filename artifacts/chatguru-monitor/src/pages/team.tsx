import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Pencil, Trash2, Check, X, Flame, BarChart2, Star, Trophy } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

interface Agent {
  id: number;
  name: string;
  phone?: string | null;
  team: "COMERCIAL_TRAFEGO" | "ATENDIMENTO";
  active: boolean;
}

interface AgentStats {
  total: number;
  active: number;
  converted: number;
  convertedThisMonth: number;
  conversionRate: number;
}

interface AgentWithStats extends Agent {
  stats: AgentStats;
}

const TEAMS: Record<string, string> = {
  COMERCIAL_TRAFEGO: "Comercial Tráfego",
  ATENDIMENTO: "Atendimento",
};

const TEAM_COLOR: Record<string, string> = {
  COMERCIAL_TRAFEGO: "#8b5cf6",
  ATENDIMENTO: "#06b6d4",
};

const TEAM_CAPACITY: Record<string, number> = {
  COMERCIAL_TRAFEGO: 30,
  ATENDIMENTO: 20,
};

function useAgentStats() {
  const [agents, setAgents] = React.useState<AgentWithStats[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/api/agents/stats`);
      const d = await r.json();
      setAgents(d.stats ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);
  return { agents, loading, reload: load };
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

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function CapacityBar({ active, capacity, color }: { active: number; capacity: number; color: string }) {
  const pct = Math.min(100, Math.round((active / capacity) * 100));
  const barColor = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : color;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">Capacidade</span>
        <span className="text-xs font-semibold" style={{ color: barColor }}>{pct}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

function AgentCard({ agent, onEdit, onDelete }: {
  agent: AgentWithStats;
  onEdit: (a: AgentWithStats) => void;
  onDelete: (id: number) => void;
}) {
  const color = TEAM_COLOR[agent.team];
  const capacity = TEAM_CAPACITY[agent.team];

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center rounded-full text-white font-bold text-sm shrink-0"
          style={{ width: 44, height: 44, background: color }}
        >
          {initials(agent.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm truncate">{agent.name}</p>
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${agent.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
              {agent.active ? "Ativo" : "Inativo"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{TEAMS[agent.team] ?? agent.team}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(agent)}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(agent.id)}
            className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50">
            <Flame className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground leading-none">Ativos</p>
            <p className="text-base font-bold leading-tight">{agent.stats.active}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-50">
            <BarChart2 className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground leading-none">Total histórico</p>
            <p className="text-base font-bold leading-tight">{agent.stats.total}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-green-50">
            <Trophy className="h-3.5 w-3.5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground leading-none">Fechados no mês</p>
            <p className="text-base font-bold leading-tight">{agent.stats.convertedThisMonth}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-50">
            <Star className="h-3.5 w-3.5 text-purple-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground leading-none">Conversão</p>
            <p className="text-base font-bold leading-tight">{agent.stats.conversionRate}%</p>
          </div>
        </div>
      </div>

      {/* Capacity bar */}
      <CapacityBar active={agent.stats.active} capacity={capacity} color={color} />
    </div>
  );
}

function AgentForm({ initial, onSave, onCancel }: {
  initial?: Partial<Agent>;
  onSave: (data: Partial<Agent>) => void;
  onCancel: () => void;
}) {
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
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Ex: Thiago Tavares"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Telefone</label>
          <input
            value={phone ?? ""}
            onChange={e => setPhone(e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="(81) 99999-9999"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Equipe *</label>
          <select
            value={team}
            onChange={e => setTeam(e.target.value as Agent["team"])}
            className="mt-1 w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          >
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
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5" />Cancelar
        </button>
        <button
          onClick={() => onSave({ name, phone: phone || undefined, team, active })}
          disabled={!name}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Check className="h-3.5 w-3.5" />Salvar
        </button>
      </div>
    </div>
  );
}

function TeamSection({
  team,
  agents,
  onEdit,
  onDelete,
}: {
  team: "COMERCIAL_TRAFEGO" | "ATENDIMENTO";
  agents: AgentWithStats[];
  onEdit: (a: AgentWithStats) => void;
  onDelete: (id: number) => void;
}) {
  const color = TEAM_COLOR[team];
  const totalActive = agents.reduce((s, a) => s + a.stats.active, 0);
  const totalLeads = agents.reduce((s, a) => s + a.stats.total, 0);
  const totalContracts = agents.reduce((s, a) => s + a.stats.convertedThisMonth, 0);

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
        <h2 className="text-sm font-semibold">{TEAMS[team]}</h2>
        <span className="text-xs text-muted-foreground">
          {agents.length} atendente{agents.length !== 1 ? "s" : ""}
        </span>
        <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
          <span><span className="font-semibold text-foreground">{totalActive}</span> ativos</span>
          <span><span className="font-semibold text-foreground">{totalLeads}</span> total</span>
          <span><span className="font-semibold text-foreground">{totalContracts}</span> fechados/mês</span>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          Nenhum atendente nesta equipe.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map(a => (
            <AgentCard key={a.id} agent={a} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Team() {
  const { toast } = useToast();
  const { agents: agentStats, loading: statsLoading, reload: reloadStats } = useAgentStats();
  const { agents: plainAgents, reload: reloadPlain } = useAgents();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AgentWithStats | null>(null);

  const reload = () => { reloadStats(); reloadPlain(); };

  const grouped = {
    COMERCIAL_TRAFEGO: agentStats.filter(a => a.team === "COMERCIAL_TRAFEGO"),
    ATENDIMENTO: agentStats.filter(a => a.team === "ATENDIMENTO"),
  };

  const saveAgent = async (data: Partial<Agent>) => {
    try {
      if (editing) {
        await fetch(`${BASE_URL}/api/agents/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        toast({ title: "Atendente atualizado!" });
      } else {
        await fetch(`${BASE_URL}/api/agents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        toast({ title: "Atendente criado!" });
      }
      setShowForm(false);
      setEditing(null);
      reload();
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const deleteAgent = async (id: number) => {
    if (!confirm("Remover este atendente?")) return;
    await fetch(`${BASE_URL}/api/agents/${id}`, { method: "DELETE" });
    toast({ title: "Atendente removido." });
    reload();
  };

  // Total summary bar
  const totalActive = agentStats.reduce((s, a) => s + a.stats.active, 0);
  const totalLeads = agentStats.reduce((s, a) => s + a.stats.total, 0);
  const totalContracts = agentStats.reduce((s, a) => s + a.stats.convertedThisMonth, 0);
  const avgConversion = agentStats.length > 0
    ? Math.round(agentStats.reduce((s, a) => s + a.stats.conversionRate, 0) / agentStats.length)
    : 0;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipe</h1>
          <p className="text-muted-foreground text-sm mt-1">Desempenho e gestão dos atendentes.</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Adicionar
        </button>
      </div>

      {/* Summary stats */}
      {!statsLoading && agentStats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Ativos agora", value: totalActive, icon: <Flame className="h-4 w-4 text-amber-500" />, bg: "bg-amber-50" },
            { label: "Total histórico", value: totalLeads, icon: <BarChart2 className="h-4 w-4 text-blue-500" />, bg: "bg-blue-50" },
            { label: "Fechados no mês", value: totalContracts, icon: <Trophy className="h-4 w-4 text-green-600" />, bg: "bg-green-50" },
            { label: "Conversão média", value: `${avgConversion}%`, icon: <Star className="h-4 w-4 text-purple-500" />, bg: "bg-purple-50" },
          ].map(({ label, value, icon, bg }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>{icon}</div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && !editing && (
        <AgentForm onSave={saveAgent} onCancel={() => setShowForm(false)} />
      )}

      {/* Edit form */}
      {editing && (
        <AgentForm initial={editing} onSave={saveAgent} onCancel={() => setEditing(null)} />
      )}

      {/* Agents by team */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          {(["COMERCIAL_TRAFEGO", "ATENDIMENTO"] as const).map(team => (
            <TeamSection
              key={team}
              team={team}
              agents={grouped[team]}
              onEdit={setEditing}
              onDelete={deleteAgent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
