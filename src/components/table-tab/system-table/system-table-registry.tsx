import DashboardTableComponent from "./system-table-dashboard";

/**
 * Type definition for a system table tab entry
 * Tuple where:
 * - 1st element: display text of the tab
 * - 2nd element: the component to render
 */
export type SystemTableTabEntry = [string, React.ComponentType<{ database: string; table: string }>];

/**
 * Registry for custom system table rendering components
 * Key: table name (without database, e.g., "dashboards" not "system.dashboards")
 * Value: list of tuples where 1st element is display text, 2nd element is the component
 */
export const SYSTEM_TABLE_REGISTRY = new Map<string, SystemTableTabEntry[]>([
  [
    "dashboards",
    [
      ["Dashboard", DashboardTableComponent],
    ],
  ],
]);

/**
 * Get custom tabs for a system table
 * @param tableName - The table name without database prefix (e.g., "dashboards")
 * @returns Array of tab entries, or undefined if not found
 */
export function getSystemTableTabs(tableName: string): SystemTableTabEntry[] | undefined {
  return SYSTEM_TABLE_REGISTRY.get(tableName);
}

