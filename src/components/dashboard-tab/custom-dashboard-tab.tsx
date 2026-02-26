"use client";

import type {
  DashboardGroup,
  FilterSpec,
  PanelDescriptor,
} from "@/components/shared/dashboard/dashboard-model";
import DashboardPage from "@/components/shared/dashboard/dashboard-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  Edit2,
  Filter,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { DashboardFilterConfigDialog } from "./dashboard-filter-config-dialog";
import {
  CustomDashboardStorage,
  type CustomDashboardConfig,
} from "./custom-dashboard-storage";
import { PanelConfigDialog } from "./panel-config-dialog";
import { TabManager } from "@/components/tab-manager";
import {
  CustomDashboardContext,
  type CustomDashboardPanelActions,
} from "./custom-dashboard-context";

interface CustomDashboardTabProps {
  dashboardId: string;
  dashboardName?: string;
}

const CustomDashboardTabComponent = ({
  dashboardId,
  dashboardName,
}: CustomDashboardTabProps) => {
  const storage = CustomDashboardStorage.getInstance();

  // Load dashboard config from storage
  const [config, setConfig] = useState<CustomDashboardConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [showPanelDialog, setShowPanelDialog] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [editingPanel, setEditingPanel] = useState<PanelDescriptor | null>(null);
  const [editingPanelIndex, setEditingPanelIndex] = useState<number>(-1);
  const [editingFilter, setEditingFilter] = useState<FilterSpec | null>(null);
  const [editingFilterIndex, setEditingFilterIndex] = useState<number>(-1);

  // Track the rendered dashboard key to force re-render after edits
  const [dashboardKey, setDashboardKey] = useState(0);

  // Load from storage on mount
  useEffect(() => {
    const loaded = storage.get(dashboardId);
    if (loaded) {
      setConfig(loaded);
      setEditingName(loaded.name);
    } else {
      // Dashboard not found - create a new one
      const newConfig = storage.createNew(dashboardName ?? "Untitled Dashboard");
      // Update the ID to match
      newConfig.id = dashboardId;
      storage.save(newConfig);
      setConfig(newConfig);
      setEditingName(newConfig.name);
      setIsEditing(true);
    }
  }, [dashboardId, dashboardName, storage]);

  // Save config to storage
  const saveConfig = useCallback(
    (updatedConfig: CustomDashboardConfig) => {
      storage.save(updatedConfig);
      setConfig(updatedConfig);
      setDashboardKey((k) => k + 1);
    },
    [storage]
  );

  // Handle name edit
  const handleSaveName = useCallback(() => {
    if (!config) return;
    const trimmed = editingName.trim();
    if (!trimmed) return;
    const updated = { ...config, name: trimmed };
    saveConfig(updated);
    setIsEditing(false);

    // Update tab title
    TabManager.updateTabTitle(
      `custom-dashboard:${dashboardId}`,
      trimmed
    );
  }, [config, editingName, saveConfig, dashboardId]);

  // Add panel
  const handleAddPanel = useCallback(
    (panel: PanelDescriptor) => {
      if (!config) return;
      if (editingPanelIndex >= 0) {
        // Update existing panel
        const updatedPanels = [...config.panels];
        updatedPanels[editingPanelIndex] = panel;
        saveConfig({ ...config, panels: updatedPanels });
      } else {
        // Add new panel
        saveConfig({ ...config, panels: [...config.panels, panel] });
      }
      setEditingPanel(null);
      setEditingPanelIndex(-1);
    },
    [config, editingPanelIndex, saveConfig]
  );

  // Edit panel
  const handleEditPanel = useCallback(
    (index: number) => {
      if (!config) return;
      const panels = flattenPanels(config.panels);
      if (index >= 0 && index < panels.length) {
        setEditingPanel(panels[index]);
        setEditingPanelIndex(index);
        setShowPanelDialog(true);
      }
    },
    [config]
  );

  // Delete panel
  const handleDeletePanel = useCallback(
    (index: number) => {
      if (!config) return;
      const panels = [...config.panels];
      // For flat panels, direct removal
      panels.splice(index, 1);
      saveConfig({ ...config, panels });
    },
    [config, saveConfig]
  );

  // Add filter
  const handleAddFilter = useCallback(
    (filter: FilterSpec) => {
      if (!config) return;
      const updatedSpecs = [...config.filterSpecs, filter];
      saveConfig({
        ...config,
        filterSpecs: updatedSpecs,
        filter: {
          ...config.filter,
          selectors: [
            {
              type: "filter",
              name: "filters",
              fields: updatedSpecs,
            },
          ],
        },
      });
      setEditingFilter(null);
      setEditingFilterIndex(-1);
    },
    [config, saveConfig]
  );

  // Update filter
  const handleUpdateFilter = useCallback(
    (filter: FilterSpec) => {
      if (!config || editingFilterIndex < 0) return;
      const updatedSpecs = [...config.filterSpecs];
      updatedSpecs[editingFilterIndex] = filter;
      saveConfig({
        ...config,
        filterSpecs: updatedSpecs,
        filter: {
          ...config.filter,
          selectors: [
            {
              type: "filter",
              name: "filters",
              fields: updatedSpecs,
            },
          ],
        },
      });
      setEditingFilter(null);
      setEditingFilterIndex(-1);
    },
    [config, editingFilterIndex, saveConfig]
  );

  // Delete filter
  const handleDeleteFilter = useCallback(
    (index: number) => {
      if (!config) return;
      const updatedSpecs = config.filterSpecs.filter((_, i) => i !== index);
      saveConfig({
        ...config,
        filterSpecs: updatedSpecs,
        filter: {
          ...config.filter,
          selectors: updatedSpecs.length
            ? [
                {
                  type: "filter",
                  name: "filters",
                  fields: updatedSpecs,
                },
              ]
            : undefined,
        },
      });
    },
    [config, saveConfig]
  );

  // Build Dashboard model for rendering
  const dashboard = useMemo(() => {
    if (!config) return null;
    return CustomDashboardStorage.toDashboard(config);
  }, [config, dashboardKey]);

  const allPanels = useMemo(
    () => (config ? flattenPanels(config.panels) : []),
    [config]
  );

  // Context value for per-widget edit/delete actions
  const panelActions = useMemo<CustomDashboardPanelActions>(
    () => ({
      onEditPanel: handleEditPanel,
      onDeletePanel: handleDeletePanel,
      getPanelIndex: (descriptor) => {
        return allPanels.findIndex((p) => p === descriptor);
      },
    }),
    [handleEditPanel, handleDeletePanel, allPanels]
  );

  if (!config || !dashboard) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  const hasPanels = allPanels.length > 0;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
        {/* Dashboard name */}
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="h-7 w-48 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") {
                  setEditingName(config.name);
                  setIsEditing(false);
                }
              }}
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveName}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setEditingName(config.name);
                setIsEditing(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            className="flex items-center gap-1.5 text-sm font-medium hover:bg-muted/50 px-2 py-1 rounded transition-colors"
            onClick={() => setIsEditing(true)}
          >
            {config.name}
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}

        <div className="flex-1" />

        {/* Add filter */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => {
            setEditingFilter(null);
            setEditingFilterIndex(-1);
            setShowFilterDialog(true);
          }}
        >
          <Filter className="h-3.5 w-3.5" />
          Add Filter
        </Button>

        {/* Add panel */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => {
            setEditingPanel(null);
            setEditingPanelIndex(-1);
            setShowPanelDialog(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Panel
        </Button>
      </div>

      {/* Filter chips bar (when filters exist) */}
      {config.filterSpecs.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-muted/30 shrink-0 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Filters:</span>
          {config.filterSpecs.map((spec, index) => (
            <div
              key={index}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-background border text-xs"
            >
              <span>{spec.displayText}</span>
              <button
                className="hover:text-foreground text-muted-foreground"
                onClick={() => {
                  setEditingFilter(spec);
                  setEditingFilterIndex(index);
                  setShowFilterDialog(true);
                }}
              >
                <Edit2 className="h-3 w-3" />
              </button>
              <button
                className="hover:text-destructive text-muted-foreground"
                onClick={() => handleDeleteFilter(index)}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dashboard content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <CustomDashboardContext.Provider value={panelActions}>
          {hasPanels ? (
            <DashboardPage
              key={dashboardKey}
              panels={dashboard}
              filterSpecs={config.filterSpecs}
              showTimeSpanSelector={config.filter.showTimeSpanSelector}
              showRefresh={config.filter.showRefresh}
              headerActions={
                <PanelEditOverlay
                  panels={allPanels}
                  onEditPanel={handleEditPanel}
                  onDeletePanel={handleDeletePanel}
                />
              }
            />
          ) : (
            <EmptyDashboardState
              onAddPanel={() => {
                setEditingPanel(null);
                setEditingPanelIndex(-1);
                setShowPanelDialog(true);
              }}
            />
          )}
        </CustomDashboardContext.Provider>
      </div>

      {/* Dialogs */}
      <PanelConfigDialog
        open={showPanelDialog}
        onOpenChange={setShowPanelDialog}
        onSave={handleAddPanel}
        editingPanel={editingPanel}
      />

      <DashboardFilterConfigDialog
        open={showFilterDialog}
        onOpenChange={setShowFilterDialog}
        onAdd={handleAddFilter}
        editingFilter={editingFilter}
        onUpdate={handleUpdateFilter}
      />
    </div>
  );
};

/**
 * Empty state when no panels are added yet
 */
function EmptyDashboardState({ onAddPanel }: { onAddPanel: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="text-muted-foreground mb-4">
        <svg className="h-16 w-16 mx-auto mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <p className="text-sm">No panels yet. Add a panel to get started.</p>
      </div>
      <Button onClick={onAddPanel} className="gap-2">
        <Plus className="h-4 w-4" />
        Add Your First Panel
      </Button>
    </div>
  );
}

/**
 * Overlay buttons that appear in the dashboard header for editing panels
 */
function PanelEditOverlay({
  panels,
  onEditPanel,
  onDeletePanel,
}: {
  panels: PanelDescriptor[];
  onEditPanel: (index: number) => void;
  onDeletePanel: (index: number) => void;
}) {
  if (panels.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Edit2 className="h-3.5 w-3.5" />
          Edit Panels
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {panels.map((panel, index) => (
          <DropdownMenuItem
            key={index}
            className="flex items-center justify-between"
            onSelect={(e) => e.preventDefault()}
          >
            <span className="text-sm truncate mr-2">
              {panel.titleOption?.title ?? `Panel ${index + 1}`}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onEditPanel(index)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => onDeletePanel(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Flatten panels from dashboard config (handles groups)
 */
function flattenPanels(
  panels: (PanelDescriptor | DashboardGroup)[]
): PanelDescriptor[] {
  const result: PanelDescriptor[] = [];
  for (const item of panels) {
    if ("charts" in item && Array.isArray((item as DashboardGroup).charts)) {
      result.push(...(item as DashboardGroup).charts);
    } else {
      result.push(item as PanelDescriptor);
    }
  }
  return result;
}

CustomDashboardTabComponent.displayName = "CustomDashboardTab";

export const CustomDashboardTab = memo(CustomDashboardTabComponent);
