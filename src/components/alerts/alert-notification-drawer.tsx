import type { PersistedAlertEvent, PersistedAlertNotification } from "@/lib/alerting/alert-types";
import { BasePath } from "@/lib/base-path";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AlertNotificationItem } from "./alert-notification-item";

interface AlertNotificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCountChange?: () => void;
}

type NotificationWithEvent = PersistedAlertNotification & {
  event?: PersistedAlertEvent;
};

export function AlertNotificationDrawer({
  open,
  onOpenChange,
  onCountChange,
}: AlertNotificationDrawerProps) {
  const [notifications, setNotifications] = useState<NotificationWithEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(BasePath.getURL("/api/alerts/notifications?limit=50"));
      if (res.ok) {
        const data = (await res.json()) as NotificationWithEvent[];
        setNotifications(data);
      }
    } catch {
      // Silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await fetch(BasePath.getURL(`/api/alerts/notifications/${notificationId}`), {
          method: "PATCH",
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
        );
        onCountChange?.();
      } catch {
        // Silently ignore
      }
    },
    [onCountChange]
  );

  const handleDismiss = useCallback(
    async (notificationId: string) => {
      try {
        await fetch(BasePath.getURL(`/api/alerts/notifications/${notificationId}`), {
          method: "DELETE",
        });
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        onCountChange?.();
      } catch {
        // Silently ignore
      }
    },
    [onCountChange]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await fetch(BasePath.getURL("/api/alerts/notifications"), {
        method: "PATCH",
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      onCountChange?.();
    } catch {
      // Silently ignore
    }
  }, [onCountChange]);

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[380px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm font-medium">Notifications</SheetTitle>
            {hasUnread && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleMarkAllAsRead}
              >
                Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {loading && notifications.length === 0 && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                Loading...
              </div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No notifications</p>
              </div>
            )}
            {notifications.map((notification) => (
              <AlertNotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
