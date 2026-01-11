import React from "react";
import type { PanelDescriptor } from "./dashboard-model";
import type { DashboardVisualizationComponent } from "./dashboard-visualization-layout";
import { DashboardVisualizationPanel } from "./dashboard-visualization-panel";
import type { TimeSpan } from "./timespan-selector";

interface DashboardPanelProps {
  descriptor: PanelDescriptor;
  selectedTimeSpan?: TimeSpan;
  initialLoading?: boolean;
  onRef?: (ref: DashboardVisualizationComponent | null) => void;
  onCollapsedChange?: (isCollapsed: boolean) => void;
  onChartSelection?: (
    timeSpan: TimeSpan,
    { name, series, value }: { name: string; series: string; value: number }
  ) => void;
  className?: string;
}

/**
 * Factory component to render different panel types
 * Used for both main dashboard panels and drilldown panels
 *
 * REFACTORING IN PROGRESS:
 * - Table, Pie, Transpose-table, Timeseries, Gauge, Stat: Uses new refactored architecture (DashboardPanelNew)
 * - Others: Still using legacy components
 */
export const DashboardPanel: React.FC<DashboardPanelProps> = ({
  descriptor,
  selectedTimeSpan,
  initialLoading,
  onRef,
  onCollapsedChange,
  onChartSelection,
  className,
}) => {
  // Defensive check: ensure descriptor exists and has a type property
  if (!descriptor || !descriptor.type) {
    return <pre>Invalid descriptor: {JSON.stringify(descriptor, null, 2)}</pre>;
  }

  // Use new refactored implementation for table, pie, transpose-table, timeseries, gauge, and stat
  if (
    descriptor.type === "table" ||
    descriptor.type === "pie" ||
    descriptor.type === "transpose-table" ||
    descriptor.type === "line" ||
    descriptor.type === "bar" ||
    descriptor.type === "area" ||
    descriptor.type === "gauge" ||
    descriptor.type === "stat"
  ) {
    return (
      <DashboardVisualizationPanel
        ref={onRef}
        descriptor={descriptor}
        selectedTimeSpan={selectedTimeSpan}
        initialLoading={initialLoading}
        onCollapsedChange={onCollapsedChange}
        onChartSelection={onChartSelection}
        className={className}
      />
    );
  }

  return null;
};
