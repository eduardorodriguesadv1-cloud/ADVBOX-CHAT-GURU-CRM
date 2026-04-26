export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function silenceLevel(date: string | Date | null | undefined): "ok" | "warning" | "critical" {
  if (!date) return "ok";
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (diffMin >= 120) return "critical"; // 2+ hours
  if (diffMin >= 30) return "warning";  // 30+ min
  return "ok";
}
