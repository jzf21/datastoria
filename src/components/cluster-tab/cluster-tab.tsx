import type {
  Dashboard,
  DashboardGroup,
  SelectorFilterSpec,
} from "@/components/shared/dashboard/dashboard-model";
import DashboardPage from "@/components/shared/dashboard/dashboard-page";
import { memo } from "react";
import { useConnection } from "../connection/connection-context";
import { clusterMetricsDashboard } from "./dashboards/cluster-metrics";
import { clusterStatusDashboard } from "./dashboards/cluster-status";

export const ClusterTab = memo(() => {
  const { connection } = useConnection();

  const dashboard = {
    version: 2,
    charts: [
      {
        title: "Cluster Status",
        collapsed: false,
        charts: clusterStatusDashboard,
      } as DashboardGroup,
      {
        title: "Cluster Metrics",
        collapsed: false,
        charts: clusterMetricsDashboard,
      } as DashboardGroup,
    ],
  } as Dashboard;

  return (
    <DashboardPage
      filterSpecs={[
        {
          filterType: "select",
          name: "hostname()",
          displayText: "hostname()",
          onPreviousFilters: true,
          datasource: {
            type: "sql",
            sql: `select distinct host_name from system.clusters WHERE cluster = '${connection!.cluster}' order by host_name`,
          },
        } as SelectorFilterSpec,
      ]}
      panels={dashboard}
      headerActions={null}
    />
  );
});
