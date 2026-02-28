"use client";

import { cn } from "@/lib/utils";
import { useMemo, useCallback, useRef, useState, useEffect } from "react";
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from 'react-grid-layout/react';
import type { Layout, LayoutItem, ResponsiveLayouts } from 'react-grid-layout';
import type { DashboardGroup, PanelDescriptor, GridPos } from "./dashboard-model";
import { getPanelConstraints } from './dashboard-layout-constraints';
import { saveSectionLayout, loadSectionLayout } from './dashboard-layout-storage';
import { SectionHeader } from './dashboard-section-header';
import type { DashboardVisualizationComponent } from "./dashboard-visualization-layout";
import { DashboardVisualizationPanel } from "./dashboard-visualization-panel";
import type { TimeSpan } from "./timespan-selector";

export interface DashboardSectionProps {
  /** Dashboard ID for layout storage */
  dashboardId: string;
  /** Section index for layout storage key */
  sectionIndex: number;
  /** Section group data (null for ungrouped panels) */
  group: DashboardGroup | null;
  /** Panels in this section */
  panels: PanelDescriptor[];
  /** Whether this section is collapsed */
  isCollapsed: boolean;
  /** Callback when collapse state changes */
  onToggleCollapse: () => void;
  /** Callback when a subcomponent ref is updated */
  onSubComponentUpdated: (
    subComponent: DashboardVisualizationComponent | null,
    globalPanelIndex: number
  ) => void;
  /** Starting index for global panel numbering */
  globalPanelStartIndex: number;
  /** Initial time span for queries */
  initialTimeSpan?: TimeSpan;
  /** Initial filter expression */
  initialFilterExpression?: string;
  /** Initial loading state */
  initialLoading?: boolean;
  /** Panel collapse states (keyed by global panel index) */
  panelCollapseStates: Map<number, boolean>;
  /** Callback when panel collapse state changes */
  onPanelCollapsedChange: (globalPanelIndex: number, collapsed: boolean) => void;
  /** Callback when chart selection occurs */
  onChartSelection?: (
    timeSpan: TimeSpan,
    selection: { name: string; series: string; value: number }
  ) => void;
  /** Whether to show edit controls (for custom dashboards) */
  showEditControls?: boolean;
  /** Callback when section is renamed */
  onRename?: (newTitle: string) => void;
  /** Callback when section is deleted */
  onDelete?: () => void;
}

// Helper function to get gridPos from panel
function getGridPos(panel: PanelDescriptor): GridPos {
  if (panel.gridPos) {
    return panel.gridPos;
  }
  console.warn(
    `Panel "${panel.titleOption?.title ?? panel.type}" is missing gridPos. Using default.`
  );
  return { w: 24, h: 6 };
}

// Generate react-grid-layout layouts from panels
function generateLayoutsFromPanels(panels: PanelDescriptor[]): ResponsiveLayouts {
  const lg: LayoutItem[] = [];
  const md: LayoutItem[] = [];
  const sm: LayoutItem[] = [];

  panels.forEach((panel, index) => {
    const gridPos = getGridPos(panel);
    const constraints = getPanelConstraints(panel.type);
    const key = `panel-${index}`;

    // Desktop layout (24 cols)
    lg.push({
      i: key,
      x: gridPos.x ?? (index * 6) % 24,
      y: gridPos.y ?? Math.floor((index * 6) / 24) * 4,
      w: gridPos.w,
      h: gridPos.h,
      ...constraints,
    });

    // Tablet layout (6 cols)
    const mdW = Math.max(constraints.minW, Math.round((gridPos.w / 24) * 6));
    md.push({
      i: key,
      x: (index * 3) % 6,
      y: Math.floor((index * 3) / 6) * 4,
      w: Math.min(mdW, 6),
      h: gridPos.h,
      minW: Math.min(constraints.minW, 6),
      minH: constraints.minH,
      maxW: 6,
      maxH: constraints.maxH,
    });

    // Mobile layout (1 col) - stack vertically
    sm.push({
      i: key,
      x: 0,
      y: index * 4,
      w: 1,
      h: gridPos.h,
      minW: 1,
      minH: constraints.minH,
      maxW: 1,
      maxH: constraints.maxH,
      static: true,
    });
  });

  return { lg, md, sm };
}

/**
 * Dashboard section component containing a header and a grid of panels.
 * Each section has its own ResponsiveGridLayout for independent drag/resize.
 */
export function DashboardSection({
  dashboardId,
  sectionIndex,
  group,
  panels,
  isCollapsed,
  onToggleCollapse,
  onSubComponentUpdated,
  globalPanelStartIndex,
  initialTimeSpan,
  initialFilterExpression,
  initialLoading,
  panelCollapseStates,
  onPanelCollapsedChange,
  onChartSelection,
  showEditControls = false,
  onRename,
  onDelete,
}: DashboardSectionProps) {
  const { width, mounted, containerRef } = useContainerWidth();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track expand count to force grid remount after collapse/expand cycle
  const [expandCount, setExpandCount] = useState(0);
  const prevIsCollapsed = useRef(isCollapsed);

  useEffect(() => {
    // When transitioning from collapsed to expanded, increment counter to force remount
    if (prevIsCollapsed.current && !isCollapsed) {
      setExpandCount(c => c + 1);
    }
    prevIsCollapsed.current = isCollapsed;
  }, [isCollapsed]);

  // Generate default layouts
  const defaultLayouts = useMemo(
    () => generateLayoutsFromPanels(panels),
    [panels]
  );

  // Load saved layouts or use defaults
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => {
    const saved = loadSectionLayout(dashboardId, sectionIndex);
    return saved ?? defaultLayouts;
  });

  // Update layouts when panels change
  useEffect(() => {
    const saved = loadSectionLayout(dashboardId, sectionIndex);
    setLayouts(saved ?? defaultLayouts);
  }, [dashboardId, sectionIndex, defaultLayouts]);

  // Handle layout change with debounced save
  const onLayoutChange = useCallback(
    (_currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
      setLayouts(allLayouts);

      // Debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveSectionLayout(dashboardId, sectionIndex, allLayouts);
      }, 500);
    },
    [dashboardId, sectionIndex]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Breakpoint configuration
  const breakpoints = { lg: 1024, md: 768, sm: 0 };
  const cols = { lg: 24, md: 6, sm: 1 };

  const sectionTitle = group?.title ?? "Ungrouped";

  // Don't render header for ungrouped section if there's only ungrouped panels
  const showHeader = group !== null;

  console.log('[DashboardSection] Render - sectionIndex:', sectionIndex, 'isCollapsed:', isCollapsed, 'panels.length:', panels.length, 'showHeader:', showHeader, 'mounted:', mounted, 'width:', width);

  return (
    <div className="w-full">
      {showHeader && (
        <SectionHeader
          title={sectionTitle}
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
          showEditControls={showEditControls}
          onRename={onRename}
          onDelete={onDelete}
        />
      )}

      {/* Always render container so useContainerWidth hook can measure width */}
      {panels.length > 0 && (
        <div
          ref={containerRef}
          className="w-full"
          style={isCollapsed ? { height: 0, overflow: 'hidden', visibility: 'hidden' } : undefined}
        >
          {!isCollapsed && mounted && width > 0 && (
            <ResponsiveGridLayout
              key={`grid-${sectionIndex}-${expandCount}`}
              className="layout"
              width={width}
              layouts={layouts}
              breakpoints={breakpoints}
              cols={cols}
              rowHeight={36}
              margin={[8, 8]}
              containerPadding={[0, 0]}
              onLayoutChange={onLayoutChange}
              dragConfig={{ enabled: true, bounded: false, handle: ".dashboard-drag-handle", threshold: 3 }}
              compactor={verticalCompactor}
            >
              {panels.map((panel, localIndex) => {
                const globalIndex = globalPanelStartIndex + localIndex;
                const isPanelCollapsed = panelCollapseStates.get(globalIndex) ?? panel.collapsed ?? false;

                return (
                  <div key={`panel-${localIndex}`} className="h-full">
                    <div className={cn("w-full h-full", isPanelCollapsed && "h-auto")}>
                      <DashboardVisualizationPanel
                        descriptor={panel}
                        initialTimeSpan={initialTimeSpan}
                        initialFilterExpression={initialFilterExpression}
                        initialLoading={initialLoading}
                        ref={(el) => onSubComponentUpdated(el, globalIndex)}
                        onCollapsedChange={(collapsed) => onPanelCollapsedChange(globalIndex, collapsed)}
                        onChartSelection={onChartSelection}
                      />
                    </div>
                  </div>
                );
              })}
            </ResponsiveGridLayout>
          )}
        </div>
      )}

      {!isCollapsed && panels.length === 0 && showEditControls && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground border-b">
          No panels in this section. Add panels to get started.
        </div>
      )}
    </div>
  );
}
