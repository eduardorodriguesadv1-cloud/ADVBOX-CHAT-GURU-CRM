import './_group.css';

const mockLeads = [
  { id: 1, name: "Edinalva Tavares", phone: "(55) 31971-38469", message: "Olá! Tenho interesse e queria mais informações, por favor.", agent: "Thiago Tavares", time: "17:14", status: "open", origem: "META ADS" },
  { id: 2, name: "Joana", phone: "(11) 98397-4167", message: "Olá! Tenho interesse e queria mais informações, por favor.", agent: "Thiago Tavares", time: "17:14", status: "open", origem: "META ADS" },
  { id: 3, name: "Lu Santana", phone: "(11) 98713-7960", message: "Olá! Tenho interesse e queria mais informações, por favor.", agent: "Thiago Tavares", time: "17:11", status: "in_progress", origem: "META ADS" },
  { id: 4, name: "costurado🧵", phone: "(13) 99121-5531", message: "Olá! Tenho interesse e queria mais informações, por favor.", agent: "Thiago Tavares", time: "17:10", status: "open", origem: "BASE" },
  { id: 5, name: "Wilma", phone: "558173200881", message: "ptt", agent: "Marilia12", time: "17:07", status: "open", origem: "BASE" },
];

const stats = { total: 8, open: 6, inProgress: 1, waiting: 0, resolved: 1, closed: 0 };

function initials(name: string) {
  return name.replace(/[^\w\s]/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

const avatarColors = ['#3b82f6','#8b5cf6','#06b6d4','#f59e0b','#10b981','#ef4444','#ec4899'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % avatarColors.length;
  return avatarColors[h];
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    open:        { label: "Aberto",        bg: "#fef3c7", color: "#92400e" },
    in_progress: { label: "Em Atendimento", bg: "#dbeafe", color: "#1e40af" },
    waiting:     { label: "Aguardando",    bg: "#fed7aa", color: "#9a3412" },
    resolved:    { label: "Resolvido",     bg: "#d1fae5", color: "#065f46" },
    closed:      { label: "Fechado",       bg: "#f3f4f6", color: "#374151" },
  };
  const s = map[status] ?? { label: status, bg: "#f3f4f6", color: "#374151" };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

function OrigemBadge({ origem }: { origem: string }) {
  const isAds = origem === "META ADS";
  return (
    <span style={{ background: isAds ? "#ede9fe" : "#e0f2fe", color: isAds ? "#5b21b6" : "#0369a1", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 500 }}>
      {isAds ? "📣 " : "🏢 "}{origem}
    </span>
  );
}

const funnelSteps = [
  { label: "Leads Captados", value: 8, pct: 100, color: "#3b82f6" },
  { label: "Abertos", value: 6, pct: 75, color: "#f59e0b" },
  { label: "Em Atendimento", value: 1, pct: 12.5, color: "#06b6d4" },
  { label: "Resolvidos", value: 1, pct: 12.5, color: "#10b981" },
];

export function Redesign() {
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div style={{ minHeight: '100vh', background: 'hsl(210 20% 98%)', padding: '28px 32px', fontFamily: 'Inter, sans-serif', color: 'hsl(222 47% 11%)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px' }}>Dashboard</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14, textTransform: 'capitalize' }}>{today}</p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#334155' }}>
          ↻ Atualizar
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Hoje", value: stats.total, icon: "👥", bg: "#eff6ff", border: "#bfdbfe", val: "#1d4ed8" },
          { label: "Abertos", value: stats.open, icon: "🔔", bg: "#fffbeb", border: "#fde68a", val: "#92400e" },
          { label: "Em Atendimento", value: stats.inProgress, icon: "💬", bg: "#eff6ff", border: "#bfdbfe", val: "#1d4ed8" },
          { label: "Resolvidos", value: stats.resolved, icon: "✅", bg: "#f0fdf4", border: "#bbf7d0", val: "#065f46" },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>{c.label}</span>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: c.val }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Funil + Leads */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        {/* Funil */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600 }}>Funil de Leads</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {funnelSteps.map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{s.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{s.value}</span>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 99, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500, color: '#64748b' }}>Por Origem</p>
            {[
              { label: "META ADS", count: 3, color: "#8b5cf6" },
              { label: "Base", count: 2, color: "#06b6d4" },
            ].map(o => (
              <div key={o.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: o.color }} />
                  <span style={{ fontSize: 12 }}>{o.label}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{o.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leads Recentes */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Leads Recentes</h2>
            <a href="#" style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}>Ver todos →</a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {mockLeads.map((lead, i) => (
              <div key={lead.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < mockLeads.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor(lead.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {initials(lead.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{lead.name}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{lead.phone}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.message}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <OrigemBadge origem={lead.origem} />
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>• {lead.agent} • {lead.time}</span>
                  </div>
                </div>
                <StatusPill status={lead.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
