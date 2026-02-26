"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabManager } from "@/components/tab-manager";
import { LayoutDashboard, Plus, Trash2 } from "lucide-react";
import { memo, useCallback, useState } from "react";
import {
  CustomDashboardStorage,
  type CustomDashboardConfig,
} from "./custom-dashboard-storage";

interface CustomDashboardListProps {
  onClose?: () => void;
}

/**
 * A list of all saved custom dashboards with create/open/delete actions.
 * Used inside the sidebar hover card or popover.
 */
const CustomDashboardListComponent = ({ onClose }: CustomDashboardListProps) => {
  const storage = CustomDashboardStorage.getInstance();
  const [dashboards, setDashboards] = useState<CustomDashboardConfig[]>(() =>
    storage.getAll()
  );
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const refreshList = useCallback(() => {
    setDashboards(storage.getAll());
  }, [storage]);

  const handleCreate = useCallback(() => {
    const name = newName.trim() || "Untitled Dashboard";
    const config = storage.createNew(name);
    setNewName("");
    setShowCreate(false);
    refreshList();

    // Open the new dashboard in a tab
    TabManager.openTab({
      id: `custom-dashboard:${config.id}`,
      type: "custom-dashboard",
      dashboardId: config.id,
      dashboardName: config.name,
    });
    onClose?.();
  }, [newName, storage, refreshList, onClose]);

  const handleOpen = useCallback(
    (config: CustomDashboardConfig) => {
      TabManager.openTab({
        id: `custom-dashboard:${config.id}`,
        type: "custom-dashboard",
        dashboardId: config.id,
        dashboardName: config.name,
      });
      onClose?.();
    },
    [onClose]
  );

  const handleDelete = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      storage.delete(id);
      refreshList();
    },
    [storage, refreshList]
  );

  return (
    <div className="space-y-2">
      {/* Create new */}
      {showCreate ? (
        <div className="flex items-center gap-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Dashboard name"
            className="h-7 text-sm flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setShowCreate(false);
            }}
          />
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleCreate}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <button
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors text-primary"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-4 w-4" />
          New Dashboard
        </button>
      )}

      {/* Dashboard list */}
      {dashboards.length === 0 && !showCreate && (
        <p className="text-xs text-muted-foreground px-2 py-1">
          No custom dashboards yet
        </p>
      )}

      {dashboards.map((db) => (
        <div
          key={db.id}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors group"
          onClick={() => handleOpen(db)}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1 text-left">{db.name}</span>
          <button
            className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity shrink-0"
            onClick={(e) => handleDelete(db.id, e)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

CustomDashboardListComponent.displayName = "CustomDashboardList";

export const CustomDashboardList = memo(CustomDashboardListComponent);
