import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Bell } from "lucide-react";
import { useCallback, useState } from "react";
import { useAlertNotificationCount } from "./use-alert-notifications";
import { AlertNotificationDrawer } from "./alert-notification-drawer";

interface AlertNotificationBellProps {
  enabled: boolean;
}

export function AlertNotificationBell({ enabled }: AlertNotificationBellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { unreadCount, refetch } = useAlertNotificationCount(enabled);

  const handleCountChange = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          size="default"
          tooltip={{
            children: "Notifications",
            className:
              "bg-primary text-primary-foreground text-xs px-2 py-1 border-0 rounded-sm",
          }}
          onClick={() => setDrawerOpen(true)}
          className="relative"
        >
          <Bell className="h-5 w-5" />
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 left-5 h-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium flex items-center justify-center px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
      <AlertNotificationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onCountChange={handleCountChange}
      />
    </>
  );
}
