import type { StatDescriptor } from "@/components/dashboard/chart-utils";
import DashboardContainer from "@/components/dashboard/dashboard-container";
import type { Dashboard } from "@/components/dashboard/dashboard-model";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const dashboard = {
  name: "metrics",
  folder: "metrics",
  title: "Metrics",
  filter: {
    defaultTimeSpan: "1h",
  },
  charts: [
    {
      type: "stat",
      titleOption: {
        title: "Server UP Time",
      },
      width: 1,
      description: "How long the server has been running",
      query: {
        sql: "SELECT uptime() * 1000",
      },
      valueOption: {
        format: "timeDuration",
      },
    },
    {
      type: "stat",
      titleOption: {
        title: "Server Version",
      },
      width: 1,
      description: "The version of the server",
      query: {
        sql: "SELECT version()",
      },
      valueOption: {
      },
    },
    {
      type: "stat",
      titleOption: {
        title: "Databases",
      },
      width: 1,
      description: "The number of databases on the server",
      query: {
        sql: "SELECT count() FROM system.databases",
      },
      valueOption: {
      },
    },
    {
      type: "stat",
      titleOption: {
        title: "Tables",
      },
      width: 1,
      description: "The number of databases on the server",
      query: {
        sql: "SELECT count() FROM system.tables",
      },
      valueOption: {
      },
    },
    {
      type: "stat",
      titleOption: {
        title: "Total Size of tables",
      },
      width: 1,
      description: "Total size of all active parts",
      query: {
        sql: `SELECT sum(bytes_on_disk) FROM system.parts WHERE active = 1`,
      },
      valueOption: {
        format: "binary_size",
      },
    },
    {
      type: "stat",
      titleOption: {
        title: "Used Storage",
      },
      width: 1,
      description: "The number of databases on the server",
      query: {
        sql: `SELECT round((1 - sum(free_space) / sum(total_space)) * 100, 2) AS used_percent
        FROM system.disks`,
      },
      valueOption: {
        format: "percentage",
      },
    },
    {
      type: "stat",
      titleOption: {
        title: "Ongoing Merges",
      },
      width: 1,
      description: "The number of ongoing merges",
      query: {
        sql: `SELECT count() FROM system.merges`,
      },
      valueOption: {
      },
    },
    {
      type: "stat",
      titleOption: {
        title: "Ongoing Mutations",
      },
      width: 1,
      description: "The number of ongoing mutations",
      query: {
        sql: `SELECT count() FROM system.mutations WHERE is_done = 0`,
      },
      valueOption: {
      },
    },
    {
      type: "stat",
      titleOption: {
        title: "Running queries",
      },
      width: 1,
      description: "The number of running queries",
      query: {
        sql: `SELECT count() FROM system.processes`,
      },
      valueOption: {
      },
    },
  ],
} as Dashboard;

function DashboardPage() {
  return (
    <div className="px-2 pt-2">
      <DashboardContainer dashboard={dashboard} />
    </div>
  );
}
