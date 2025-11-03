"use client";

import { connect } from "echarts";
import { useCallback, useMemo, useRef } from "react";
import type { ChartDescriptor } from "./chart-utils";
import type { Dashboard } from "./dashboard-model";
import type { RefreshableComponent, RefreshParameter } from "./refreshable-component";
import RefreshableStatComponent from "./refreshable-stat-chart";
import TimeSpanSelector, { BUILT_IN_TIME_SPAN_LIST } from "./timespan-selector";

interface DashboardViewProps {
  dashboard: Dashboard;
  searchParams?: Record<string, unknown> | URLSearchParams;
}

const DashboardView: React.FC<DashboardViewProps> = ({ dashboard, searchParams = {} }) => {
  const inputFilterRef = useRef<HTMLInputElement>(undefined);
  const subComponentRefs = useRef<(RefreshableComponent | null)[]>([]);
  const filterRef = useRef<TimeSpanSelector>(null as any);

  // Function to connect all chart instances together
  const connectAllCharts = useCallback(() => {
    const chartInstances: echarts.ECharts[] = subComponentRefs.current
      .filter((ref): ref is RefreshableComponent => ref !== null && typeof (ref as unknown as { getEChartInstance?: () => echarts.ECharts }).getEChartInstance === "function")
      .map((ref) => {
        const component = ref as unknown as { getEChartInstance: () => echarts.ECharts };
        return component.getEChartInstance();
      })
      .filter((echartInstance) => echartInstance !== undefined);

    if (chartInstances.length === 0) {
      return;
    }

    const chartNumber = dashboard.charts.filter((chart: ChartDescriptor) => chart.type !== "table").length;
    if (chartInstances.length === chartNumber) {
      // Connect all echarts together on this page
      connect(chartInstances);
    }
  }, [dashboard]);

  // Callback when the sub component is mounted or unmounted
  const onSubComponentUpdated = useCallback(
    (subComponent: RefreshableComponent | null, index: number) => {
      subComponentRefs.current[index] = subComponent;

      if (subComponent === null) {
        // Skip the unmounted event
        return;
      }

      if (subComponent && typeof subComponent.refresh === "function") {
        // Load data for the sub component once it's rendered
        subComponent.refresh({
          inputFilter: inputFilterRef.current?.value,
          selectedTimeSpan: filterRef.current?.getSelectedTimeSpan().calculateAbsoluteTimeSpan(),
        });
      }

      connectAllCharts();
    },
    // We need to access properties of dashboard which is set after this component is loaded
    [connectAllCharts]
  );

  const refreshAllCharts = useCallback(() => {
    if (filterRef.current === undefined) {
      return;
    }

    console.trace("Refreshing all charts/tables...");
    const refreshParam = {
      selectedTimeSpan: filterRef.current.getSelectedTimeSpan().calculateAbsoluteTimeSpan(),
    } as RefreshParameter;
    filterRef.current.getSelectedTimeSpan();
    subComponentRefs.current.forEach((chart) => {
      if (chart !== null) {
        chart.refresh(refreshParam);
      }
    });
  }, []);

  const onQueryConditionChange = useCallback(() => {
    // Start a timer to refresh all charts so that the refresh does not block any UI updates
    setTimeout(() => {
      refreshAllCharts();
    }, 10);
  }, [refreshAllCharts]);

  // Provide a default DisplayTimeSpan instance if not provided or if it's not an instance
  const defaultTimeSpan = useMemo(() => {
    // Otherwise, use the default "Last 15 Mins"
    return BUILT_IN_TIME_SPAN_LIST[3];
  }, [dashboard?.filter]);

  console.log("Rendering dashboard", dashboard?.name);

  return (
    <>
      <div className="flex pr-2 justify-end">
        <TimeSpanSelector
          ref={filterRef}
          defaultTimeSpan={defaultTimeSpan}
          onSelectedSpanChanged={onQueryConditionChange}
        />
      </div>

      {/* Dashboard section */}
      <div className="pt-1 flex-1 overflow-y-auto">
        {dashboard && dashboard.charts && (
          <div className="card-container flex flex-wrap">
            {dashboard.charts.map((chart: ChartDescriptor, index) => (
              <div
                key={index}
                className="p-1"
                style={{
                  width: `${chart.width >= 4 ? 100 : (chart.width / 4) * 100}%`,
                }}
              >
                {/* {(chart.type === "line" || chart.type === "bar" || chart.type === "pie") && (
                  <RefreshableChartComponent
                    id={"chart_" + index}
                    onIntervalClick={onClickChartInterval}
                    onChartInstanceChanged={connectAllCharts}
                    ref={(el) => {
                      onSubComponentUpdated(el, index);
                    }}
                    descriptor={chart}
                  />
                )} */}
                {chart.type === "stat" && (
                  <RefreshableStatComponent
                    ref={(el) => {
                      onSubComponentUpdated(el, index);
                    }}
                    descriptor={chart as any}
                    searchParams={searchParams instanceof URLSearchParams ? searchParams : undefined}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="h-[100px]">{/* Margin for scroll */}</div>
      </div>
    </>
  );
};

export default DashboardView;
