import { BasePath } from "@/lib/base-path";
import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 30_000;

export function useAlertNotificationCount(enabled: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch(BasePath.getURL("/api/alerts/notifications/count"));
      if (res.ok) {
        const data = (await res.json()) as { count: number };
        setUnreadCount(data.count);
      }
    } catch {
      // Silently ignore fetch failures
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }

    void fetchCount();
    intervalRef.current = setInterval(() => {
      void fetchCount();
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, fetchCount]);

  return { unreadCount, refetch: fetchCount };
}
