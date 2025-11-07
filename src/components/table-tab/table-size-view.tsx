import type { FieldOption, TableDescriptor } from "@/components/dashboard/chart-utils";
import type { RefreshableComponent } from "@/components/dashboard/refreshable-component";
import RefreshableTableComponent from "@/components/dashboard/refreshable-table-component";
import type { TimeSpan } from "@/components/dashboard/timespan-selector";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { RefreshableTabViewRef } from "./table-tab";

export interface TableSizeViewProps {
  database: string;
  table: string;
  autoLoad?: boolean;
}

export const TableSizeView = forwardRef<RefreshableTabViewRef, TableSizeViewProps>(
  ({ database, table, autoLoad = false }, ref) => {
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useImperativeHandle(ref, () => ({
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      refresh: (_timeSpan?: TimeSpan) => {
        setRefreshTrigger((prev) => prev + 1);
      },
    }));

    return (
      <div className="space-y-2">
        <TableSizeViewImpl database={database} table={table} refreshTrigger={refreshTrigger} autoLoad={autoLoad} />
        <ColumnSizeView database={database} table={table} refreshTrigger={refreshTrigger} autoLoad={autoLoad} />
        <IndexSizeView database={database} table={table} refreshTrigger={refreshTrigger} autoLoad={autoLoad} />
        <ProjectionSizeView database={database} table={table} refreshTrigger={refreshTrigger} autoLoad={autoLoad} />
      </div>
    );
  }
);

TableSizeView.displayName = "TableSizeView";

function TableSizeViewImpl({
  database,
  table,
  refreshTrigger,
  autoLoad = false,
}: TableSizeViewProps & { refreshTrigger?: number; autoLoad?: boolean }) {
  const tableComponentRef = useRef<RefreshableComponent>(null);
  const isMountedRef = useRef(true);

  // Create table descriptor
  const tableDescriptor = useMemo<TableDescriptor>(() => {
    const fieldOptions: Record<string, FieldOption> = {
      partCount: {
        title: "Part Count",
        sortable: true,
        align: "center",
        format: "comma_number",
        position: 3,
      },
      rows: {
        title: "Rows",
        sortable: true,
        align: "center",
        format: "comma_number",
        position: 4,
      },
      avgRowSize: {
        title: "Avg Row Size",
        sortable: true,
        align: "center",
        format: "binary_size",
        position: 5,
      },
      diskSize: {
        title: "On Disk Size",
        sortable: true,
        align: "center",
        format: "binary_size",
        position: 6,
      },
      uncompressedSize: {
        title: "Uncompressed Size",
        sortable: true,
        align: "center",
        format: "binary_size",
        position: 7,
      },
      compressRatio: {
        title: "Compress Ratio",
        sortable: true,
        align: "center",
        position: 8,
        format: (value: unknown) => {
          if (value === null || value === undefined) {
            return "-";
          }
          return `${value} : 1`;
        },
      },
    };

    // Base SQL that always includes both host and disk_name in SELECT
    // The GROUP BY clause will be dynamically modified by the refreshable-table-component
    const sql = `
SELECT 
    count(1) as partCount,
    sum(rows) as rows,
    sum(bytes_on_disk) AS diskSize,
    sum(data_uncompressed_bytes) AS uncompressedSize,
    round(sum(data_uncompressed_bytes) / sum(data_compressed_bytes), 2) AS compressRatio,
    round(diskSize / rows, 2) AS avgRowSize
FROM
    system.parts
WHERE 
    database = '${database}' 
    AND table = '${table}'
    AND active = 1
ORDER BY 
    diskSize DESC`;

    return {
      type: "table",
      id: `table-size-${database}-${table}`,
      titleOption: {
        title: "Overall Size",
        align: "left",
      },
      isCollapsed: false,
      width: 100,
      query: {
        sql: sql,
        headers: {
          "Content-Type": "text/plain",
        },
        params: {
          default_format: "JSON",
        },
      },
      sortOption: {
        initialSort: {
          column: "diskSize",
          direction: "desc",
        },
        serverSideSorting: true,
      },
      fieldOptions: fieldOptions,
    };
  }, [database, table]);

  useEffect(() => {
    isMountedRef.current = true;
    if (autoLoad || (refreshTrigger !== undefined && refreshTrigger > 0)) {
      // Force refresh by passing a unique timestamp to bypass the parameter change check
      const refreshParam = { inputFilter: `refresh_${Date.now()}_${refreshTrigger}` };
      tableComponentRef.current?.refresh(refreshParam);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [autoLoad, refreshTrigger]);

  return <RefreshableTableComponent ref={tableComponentRef} descriptor={tableDescriptor} />;
}

function ColumnSizeView({
  database,
  table,
  refreshTrigger,
  autoLoad = false,
}: TableSizeViewProps & { refreshTrigger?: number; autoLoad?: boolean }) {
  const tableComponentRef = useRef<RefreshableComponent>(null);
  const isMountedRef = useRef(true);

  // Create table descriptor
  const tableDescriptor = useMemo<TableDescriptor>(() => {
    const fieldOptions: Record<string, FieldOption> = {
      column: {
        title: "Column",
        sortable: true,
        align: "left", // First column is left aligned
      },
      rowsCount: {
        title: "Rows",
        sortable: true,
        align: "center",
        format: "comma_number",
      },
      uncompressed_size: {
        title: "Uncompressed Size",
        sortable: true,
        align: "center",
        format: "binary_size",
      },
      compressed_size: {
        title: "Compressed Size",
        sortable: true,
        align: "center",
        format: "binary_size",
      },
      size_percentage_of_table: {
        title: "Size Percentage of Table",
        sortable: true,
        align: "center",
        format: "percentage_bar",
      },
      compress_ratio: {
        title: "Compress Ratio",
        sortable: true,
        align: "left",
        format: (value: unknown) => {
          if (value === null || value === undefined) {
            return "-";
          }
          return `${value} : 1`;
        },
      },
      avg_uncompressed_size: {
        title: "Avg Uncompressed Size",
        sortable: true,
        align: "center",
        format: "binary_size",
      },
    };

    const sql = `
SELECT 
    column,
    sum(column_data_compressed_bytes) AS compressed_size,
    sum(column_data_uncompressed_bytes) AS uncompressed_size,
    round(sum(column_data_uncompressed_bytes) / sum(column_data_compressed_bytes), 0) AS compress_ratio,
    sum(rows) AS rowsCount,
    round(sum(column_data_uncompressed_bytes) / sum(rows), 0) AS avg_uncompressed_size,
    compressed_size * 100 / (select sum(bytes_on_disk) from system.parts where database = '${database}' and table = '${table}' and active = 1) AS size_percentage_of_table
FROM 
    system.parts_columns
WHERE 
    database = '${database}' 
    AND table = '${table}'
    AND active = 1
GROUP BY 
    column
ORDER BY 
    compressed_size DESC`;

    return {
      type: "table",
      id: `column-size-${database}-${table}`,
      titleOption: {
        title: "Size By Column",
        align: "left",
      },
      isCollapsed: false,
      width: 100,
      query: {
        sql: sql,
        headers: {
          "Content-Type": "text/plain",
        },
        params: {
          default_format: "JSON",
        },
      },
      sortOption: {
        initialSort: {
          column: "compressed_size",
          direction: "desc",
        },
      },
      fieldOptions: fieldOptions,
    };
  }, [database, table]);

  useEffect(() => {
    isMountedRef.current = true;
    if (autoLoad || (refreshTrigger !== undefined && refreshTrigger > 0)) {
      // Force refresh by passing a unique timestamp to bypass the parameter change check
      const refreshParam = { inputFilter: `refresh_${Date.now()}_${refreshTrigger}` };
      tableComponentRef.current?.refresh(refreshParam);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [autoLoad, refreshTrigger]);

  return <RefreshableTableComponent ref={tableComponentRef} descriptor={tableDescriptor} />;
}

function IndexSizeView({
  database,
  table,
  refreshTrigger,
  autoLoad = false,
}: TableSizeViewProps & { refreshTrigger?: number; autoLoad?: boolean }) {
  const tableComponentRef = useRef<RefreshableComponent>(null);
  const isMountedRef = useRef(true);

  // Create table descriptor
  const tableDescriptor = useMemo<TableDescriptor>(() => {

    const sql = `
SELECT *
FROM system.data_skipping_indices
WHERE
    database = '${database}'
    AND table = '${table}'
`;

    return {
      type: "table",
      id: `index-size-${database}-${table}`,
      titleOption: {
        title: "Size By Index",
        align: "left",
      },
      isCollapsed: false,
      width: 100,
      query: {
        sql: sql,
        headers: {
          "Content-Type": "text/plain",
        },
        params: {
          default_format: "JSON",
        },
      },
      sortOption: {
        initialSort: {
          column: "data_compressed_bytes",
          direction: "desc",
        },
      },
      fieldOptions: {
        data_compressed_bytes: {
          sortable: true,
          align: "left",
          format: "binary_size",
        },
        data_uncompressed_bytes: {
          sortable: true,
          align: "left",
          format: "binary_size",
        }
      },
    };
  }, [database, table]);

  useEffect(() => {
    isMountedRef.current = true;
    if (autoLoad || (refreshTrigger !== undefined && refreshTrigger > 0)) {
      // Force refresh by passing a unique timestamp to bypass the parameter change check
      const refreshParam = { inputFilter: `refresh_${Date.now()}_${refreshTrigger}` };
      tableComponentRef.current?.refresh(refreshParam);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [autoLoad, refreshTrigger]);

  return <RefreshableTableComponent ref={tableComponentRef} descriptor={tableDescriptor} />;
}

function ProjectionSizeView({
  database,
  table,
  refreshTrigger,
  autoLoad = false,
}: TableSizeViewProps & { refreshTrigger?: number; autoLoad?: boolean }) {
  const tableComponentRef = useRef<RefreshableComponent>(null);
  const isMountedRef = useRef(true);

  // Create table descriptor
  const tableDescriptor = useMemo<TableDescriptor>(() => {
    const sql = `
SELECT A.database, 
  A.table, 
  A.name, 
  A.type,
  B.part_count, 
  B.rows, 
  B.bytes_on_disk,
  B.parent_bytes_on_disk,
  B.bytes_on_disk * 100 / B.parent_bytes_on_disk as percentage_of_parent,
  B.last_modified_time,
  A.query
FROM system.projections AS A
LEFT JOIN
(
    SELECT 
        name, 
        count() as part_count, 
        sum(bytes_on_disk) as bytes_on_disk,
        sum(rows) as rows,
        sum(parent_bytes_on_disk) as  parent_bytes_on_disk,
        max(modification_time)  as last_modified_time
    FROM system.projection_parts
    WHERE
        database = '${database}'
        AND table = '${table}'
        AND active
    GROUP BY name
) AS B
ON A.name = B.name
ORDER BY 1, 2, 3
`;

    return {
      type: "table",
      id: `projection-size-${database}-${table}`,
      titleOption: {
        title: "Size By Projection",
        align: "left",
      },
      isCollapsed: false,
      width: 100,
      query: {
        sql: sql,
        headers: {
          "Content-Type": "text/plain",
        },
        params: {
          default_format: "JSON",
        },
      },
      sortOption: {
        initialSort: {
          column: "",
          direction: "desc",
        },
      },
      fieldOptions: {
        bytes_on_disk: {
          sortable: true,
          align: "left",
          format: "binary_size",
        },
        rows: {
          sortable: true,
          align: "left",
          format: "comma_number",
        },
        parent_bytes_on_disk: {
          sortable: true,
          align: "left",
          format: "binary_size",
        },
        percentage_of_parent: {
          sortable: true,
          align: "left",
          format: "percentage_bar",
        },
      },
    };
  }, [database, table]);

  useEffect(() => {
    isMountedRef.current = true;
    if (autoLoad || (refreshTrigger !== undefined && refreshTrigger > 0)) {
      // Force refresh by passing a unique timestamp to bypass the parameter change check
      const refreshParam = { inputFilter: `refresh_${Date.now()}_${refreshTrigger}` };
      tableComponentRef.current?.refresh(refreshParam);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [autoLoad, refreshTrigger]);

  return <RefreshableTableComponent ref={tableComponentRef} descriptor={tableDescriptor} />;
}
