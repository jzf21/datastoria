import type { StatDescriptor } from "@/components/dashboard/chart-utils";
import DashboardContainer, { type DashboardContainerRef } from "@/components/dashboard/dashboard-container";
import type { Dashboard } from "@/components/dashboard/dashboard-model";
import type { TimeSpan } from "@/components/dashboard/timespan-selector";
import { replaceTimeSpanParams } from "@/components/dashboard/sql-time-utils";
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";

import type { RefreshableTabViewRef } from "./table-tab";

export interface PartLogViewProps {
  database: string;
  table: string;
  autoLoad?: boolean;
}

export const PartLogView = forwardRef<RefreshableTabViewRef, PartLogViewProps>(({ database, table }, ref) => {
  const [selectedTimeSpan, setSelectedTimeSpan] = useState<TimeSpan | undefined>(undefined);
  const dashboardContainerRef = useRef<DashboardContainerRef>(null);

  useImperativeHandle(
    ref,
    () => ({
      refresh: (timeSpan?: TimeSpan) => {
        if (timeSpan) {
          setSelectedTimeSpan(timeSpan);
          // Use the provided timeSpan for refresh immediately
          setTimeout(() => {
            dashboardContainerRef.current?.refresh(timeSpan);
          }, 10);
        } else {
          // Use current selectedTimeSpan or trigger refresh with undefined
          setTimeout(() => {
            dashboardContainerRef.current?.refresh(selectedTimeSpan);
          }, 10);
        }
      },
      supportsTimeSpanSelector: true,
    }),
    [selectedTimeSpan]
  );

  // Create stat descriptor for merge count
  const mergeCountStatDescriptor = useMemo<StatDescriptor>(() => {
    // Use template parameters for time span
    const sqlTemplate = `
SELECT count()
FROM merge('system', '^part_log')
WHERE 
    event_date >= toDate(fromUnixTimestamp({startTimestamp:UInt32})) 
    AND event_date <= toDate(fromUnixTimestamp({endTimestamp:UInt32}))
    AND event_time >= fromUnixTimestamp({startTimestamp:UInt32})
    AND event_time < fromUnixTimestamp({endTimestamp:UInt32})
    AND database = '${database}'
    AND table = '${table}'
    AND event_type = 'MergeParts'`;

    // Replace time span parameters
    // If no time span is selected, use a default (start of today to now)
    // This ensures the SQL is valid even before user selects a time span
    let timeSpanToUse = selectedTimeSpan;
    if (!timeSpanToUse) {
      const now = new Date();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      timeSpanToUse = {
        startISO8601: startOfToday.toISOString(),
        endISO8601: now.toISOString(),
      };
    }
    const sql = replaceTimeSpanParams(sqlTemplate, timeSpanToUse);

    return {
      type: "stat",
      id: `merge-count-${database}-${table}`,
      titleOption: {
        title: "Number of Merges",
        align: "left",
      },
      isCollapsed: false,
      width: 1,
      query: {
        sql: sql,
        headers: {
          "Content-Type": "text/plain",
        },
        params: {
          default_format: "JSON",
        },
      },
      valueOption: {
        reducer: "sum",
        align: "center",
        format: "comma_number",
      },
    };
  }, [database, table, selectedTimeSpan]);

  // Create dashboard with the stat chart
  const dashboard = useMemo<Dashboard>(() => {
    return {
      name: `part-log-${database}-${table}`,
      folder: "",
      title: "Part Log",
      filter: {
        showFilterInput: false,
        showTimeSpanSelector: false,
        showRefresh: false,
        showAutoRefresh: false,
      },
      charts: [mergeCountStatDescriptor],
    };
  }, [mergeCountStatDescriptor, database, table]);

  return (
    <DashboardContainer
      ref={dashboardContainerRef}
      dashboard={dashboard}
      hideTimeSpanSelector={true}
      externalTimeSpan={selectedTimeSpan}
    />
  );
});

PartLogView.displayName = "PartLogView";

