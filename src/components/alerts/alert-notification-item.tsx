import type { PersistedAlertEvent, PersistedAlertNotification } from "@/lib/alerting/alert-types";
import { AlertTriangle, CheckCircle, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertNotificationItemProps {
  notification: PersistedAlertNotification & { event?: PersistedAlertEvent };
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
}

function formatTimeAgo(date: Date): string {
  const now = Date.now();
  const diffMs = now - new Date(date).getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function SeverityIcon({ severity, status }: { severity?: string; status?: string }) {
  if (status === "resolved") {
    return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
  }
  if (severity === "CRITICAL") {
    return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  }
  return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
}

export function AlertNotificationItem({
  notification,
  onMarkAsRead,
  onDismiss,
}: AlertNotificationItemProps) {
  const event = notification.event;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-3 py-2.5 rounded-md transition-colors",
        !notification.is_read
          ? "bg-accent/50 hover:bg-accent/70"
          : "hover:bg-accent/30"
      )}
      onClick={() => {
        if (!notification.is_read) {
          onMarkAsRead(notification.id);
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !notification.is_read) {
          onMarkAsRead(notification.id);
        }
      }}
    >
      <SeverityIcon severity={event?.severity} status={event?.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug line-clamp-2">
          {event?.title ?? "Alert notification"}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-muted-foreground">
            {formatTimeAgo(notification.created_at)}
          </span>
          {event?.status === "resolved" && (
            <span className="text-[11px] text-green-500 font-medium">Resolved</span>
          )}
          {!notification.is_read && (
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          )}
        </div>
      </div>
      <button
        className="shrink-0 p-0.5 rounded-sm hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
        style={{ opacity: 1 }}
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
