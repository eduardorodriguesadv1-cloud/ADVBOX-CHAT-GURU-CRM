import React from "react";
import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

export const STATUS_CONFIG: Record<string, { label: string; className: string; color: string }> = {
  // Pipeline novo
  lead_novo:          { label: "Lead Novo",          className: "bg-slate-500 hover:bg-slate-600 text-white",   color: "#64748b" },
  lead_qualificado:   { label: "Lead Qualificado",   className: "bg-blue-500 hover:bg-blue-600 text-white",    color: "#3b82f6" },
  em_atendimento:     { label: "Em Atendimento",     className: "bg-cyan-500 hover:bg-cyan-600 text-white",    color: "#06b6d4" },
  follow_up:          { label: "Follow Up",          className: "bg-amber-500 hover:bg-amber-600 text-white",  color: "#f59e0b" },
  contrato_assinado:  { label: "Contrato Assinado",  className: "bg-green-600 hover:bg-green-700 text-white",  color: "#16a34a" },
  cliente_ativo:      { label: "Cliente Ativo",      className: "bg-emerald-500 hover:bg-emerald-600 text-white", color: "#10b981" },
  cliente_procedente: { label: "Cliente Procedente", className: "bg-teal-500 hover:bg-teal-600 text-white",    color: "#14b8a6" },
  lead_descartado:    { label: "Lead Descartado",    className: "bg-red-400 hover:bg-red-500 text-white",      color: "#f87171" },
  // Legado (backward compat)
  open:               { label: "Lead Novo",          className: "bg-slate-500 hover:bg-slate-600 text-white",   color: "#64748b" },
  in_progress:        { label: "Em Atendimento",     className: "bg-cyan-500 hover:bg-cyan-600 text-white",    color: "#06b6d4" },
  waiting:            { label: "Lead Qualificado",   className: "bg-blue-500 hover:bg-blue-600 text-white",    color: "#3b82f6" },
  resolved:           { label: "Contrato Assinado",  className: "bg-green-600 hover:bg-green-700 text-white",  color: "#16a34a" },
  closed:             { label: "Lead Descartado",    className: "bg-red-400 hover:bg-red-500 text-white",      color: "#f87171" },
  unknown:            { label: "Lead Novo",          className: "bg-slate-400 hover:bg-slate-500 text-white",   color: "#94a3b8" },
};

const FALLBACK = { label: "Desconhecido", className: "bg-slate-300 hover:bg-slate-400 text-slate-800", color: "#cbd5e1" };

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? FALLBACK;
  return (
    <Badge className={config.className} variant="default">
      {config.label}
    </Badge>
  );
}
