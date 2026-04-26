import { useEffect, useRef, useCallback } from "react";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const POLL_INTERVAL = 90_000; // 90 seconds
const STORAGE_KEY = "cg_last_conv_count";

export function useBrowserNotifications() {
  const permissionRef = useRef<NotificationPermission>("default");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    permissionRef.current = perm;
    return perm;
  }, []);

  const checkForNew = useCallback(async () => {
    if (permissionRef.current !== "granted") return;
    try {
      const r = await fetch(`${BASE_URL}/api/chatguru/stats`);
      if (!r.ok) return;
      const data = await r.json();
      const currentTotal: number = data.stats?.totalConversations ?? data.totalConversations ?? 0;
      const prev = parseInt(localStorage.getItem(STORAGE_KEY) ?? "0", 10);

      if (prev > 0 && currentTotal > prev) {
        const diff = currentTotal - prev;
        new Notification("🔔 Novo lead recebido!", {
          body: `${diff} novo${diff > 1 ? "s lead" : " lead"} chegou${diff > 1 ? "ram" : ""} via WhatsApp.`,
          icon: "/favicon.svg",
          badge: "/favicon.svg",
          tag: "new-lead",
        });
      }
      localStorage.setItem(STORAGE_KEY, String(currentTotal));
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => {
    if (!("Notification" in window)) return;
    permissionRef.current = Notification.permission;

    // Auto-request permission after short delay if default
    if (Notification.permission === "default") {
      setTimeout(() => requestPermission(), 3000);
    }

    timerRef.current = setInterval(checkForNew, POLL_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [checkForNew, requestPermission]);

  return { requestPermission };
}
