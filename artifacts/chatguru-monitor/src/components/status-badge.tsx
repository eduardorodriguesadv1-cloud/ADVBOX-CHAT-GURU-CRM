import React from "react";
import { Badge } from "@/components/ui/badge";
import { type ConversationStatus } from "@workspace/api-client-react";

interface StatusBadgeProps {
  status: ConversationStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    open: { label: "Aberto", className: "bg-amber-500 hover:bg-amber-600 text-white" },
    in_progress: { label: "Em Atendimento", className: "bg-blue-500 hover:bg-blue-600 text-white" },
    waiting: { label: "Aguardando", className: "bg-orange-500 hover:bg-orange-600 text-white" },
    resolved: { label: "Resolvido", className: "bg-green-500 hover:bg-green-600 text-white" },
    closed: { label: "Fechado", className: "bg-slate-500 hover:bg-slate-600 text-white" },
    unknown: { label: "Desconhecido", className: "bg-slate-300 hover:bg-slate-400 text-slate-800" },
  };

  const config = statusConfig[status] || statusConfig.unknown;

  return (
    <Badge className={config.className} variant="default">
      {config.label}
    </Badge>
  );
}
