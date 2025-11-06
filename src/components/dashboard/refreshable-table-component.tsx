"use client";

import { Api, type ApiCanceller, type ApiErrorResponse } from "@/lib/api";
import { useConnection } from "@/lib/connection/ConnectionContext";
import { StringUtils } from "@/lib/string-utils";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Formatter, type FormatName } from "../../lib/formatter";
import FloatingProgressBar from "../floating-progress-bar";
import { ThemedSyntaxHighlighter } from "../themed-syntax-highlighter";
import { Card, CardContent, CardDescription, CardHeader } from "../ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Dialog } from "../use-dialog";
import type { ColumnDef, SQLQuery, TableDescriptor } from "./chart-utils";
import type { RefreshableComponent, RefreshParameter } from "./refreshable-component";
import type { TimeSpan } from "./timespan-selector";
import { useRefreshable } from "./use-refreshable";

interface RefreshableTableComponentProps {
  // The table descriptor configuration
  descriptor: TableDescriptor;

  // Runtime
  selectedTimeSpan?: TimeSpan;

  // Used for generating links
  searchParams?: URLSearchParams;
}

// Replace ORDER BY clause in SQL query
function replaceOrderByClause(
  sql: string,
  orderByColumn: string | null,
  orderDirection: "asc" | "desc" | null
): string {
  if (!orderByColumn || !orderDirection) {
    // Remove ORDER BY clause if sorting is cleared
    // Match ORDER BY ... (until LIMIT or end of string)
    return sql.replace(/\s+ORDER\s+BY\s+[^\s]+(?:\s+(?:ASC|DESC))?(?:\s*,\s*[^\s]+\s+(?:ASC|DESC)?)*/gi, "");
  }

  const orderByClause = `ORDER BY ${orderByColumn} ${orderDirection.toUpperCase()}`;

  // Case-insensitive regex to match ORDER BY clause (including multi-column)
  // Matches: ORDER BY col1 [ASC|DESC] [, col2 [ASC|DESC]] ... until LIMIT or end
  const orderByRegex =
    /\s+ORDER\s+BY\s+[^\s]+(?:\s+(?:ASC|DESC))?(?:\s*,\s*[^\s]+\s+(?:ASC|DESC)?)*(?=\s+LIMIT|\s*$)/gi;

  if (orderByRegex.test(sql)) {
    // Replace existing ORDER BY
    return sql.replace(orderByRegex, ` ${orderByClause}`);
  } else {
    // Add ORDER BY before LIMIT if exists, otherwise at the end
    const limitRegex = /\s+LIMIT\s+\d+/i;
    if (limitRegex.test(sql)) {
      return sql.replace(limitRegex, ` ${orderByClause}$&`);
    } else {
      return sql.trim() + ` ${orderByClause}`;
    }
  }
}

const RefreshableTableComponent = forwardRef<RefreshableComponent, RefreshableTableComponentProps>(
  function RefreshableTableComponent(props, ref) {
    const { descriptor } = props;
    const { selectedConnection } = useConnection();

    // State
    const [data, setData] = useState<Record<string, unknown>[]>([]);
    const [columns, setColumns] = useState<ColumnDef[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [sort, setSort] = useState<{ column: string | null; direction: "asc" | "desc" | null }>({
      column: descriptor.sortOption?.initialSort?.column || null,
      direction: descriptor.sortOption?.initialSort?.direction || null,
    });

    // Refs
    const apiCancellerRef = useRef<ApiCanceller | null>(null);
    // Ref to store current sort state for synchronous access in loadData
    const sortRef = useRef<{ column: string | null; direction: "asc" | "desc" | null }>({
      column: descriptor.sortOption?.initialSort?.column || null,
      direction: descriptor.sortOption?.initialSort?.direction || null,
    });

    // Normalize columns: convert string columns to ColumnDef objects
    const normalizeColumns = useCallback((): ColumnDef[] => {
      return descriptor.columns.map((col) => {
        if (typeof col === "string") {
          return { name: col } as ColumnDef;
        }
        return col;
      });
    }, [descriptor.columns]);

    // Infer column format based on sample data
    const inferColumnFormat = useCallback((columnName: string, sampleRows: Record<string, unknown>[]): string | undefined => {
      if (sampleRows.length === 0) return undefined;

      // Sample up to 10 rows to infer type
      const sampleSize = Math.min(10, sampleRows.length);
      const samples = sampleRows.slice(0, sampleSize).map(row => row[columnName]);

      // Check if all samples are null/undefined
      const allNull = samples.every(val => val === null || val === undefined);
      if (allNull) return undefined;

      // Find first non-null sample
      const firstNonNull = samples.find(val => val !== null && val !== undefined);
      if (firstNonNull === undefined) return undefined;

      // Check for complex types
      const isArray = Array.isArray(firstNonNull);
      const isObject = typeof firstNonNull === "object" && firstNonNull !== null && !isArray;
      const isMap = isObject && Object.keys(firstNonNull as Record<string, unknown>).length > 0;

      // Check for Map type first (separate from other complex types)
      if (isMap) {
        const allMaps = samples
          .filter(val => val !== null && val !== undefined)
          .every(val => typeof val === "object" && !Array.isArray(val) && val !== null);
        
        if (allMaps) {
          return "map";
        }
      }

      // Check for Array or other complex types
      if (isArray) {
        const allArrays = samples
          .filter(val => val !== null && val !== undefined)
          .every(val => Array.isArray(val));

        if (allArrays) {
          return "complexType";
        }
      }

      // Check for other objects (non-map, non-array)
      if (isObject && !isMap) {
        const allObjects = samples
          .filter(val => val !== null && val !== undefined)
          .every(val => typeof val === "object" && !Array.isArray(val) && val !== null);

        if (allObjects) {
          return "complexType";
        }
      }

      // Check for long strings
      const stringValues = samples
        .filter(val => val !== null && val !== undefined)
        .map(val => typeof val === "object" ? JSON.stringify(val) : String(val));
      
      const maxLength = Math.max(...stringValues.map(s => s.length));
      if (maxLength > 200) {
        return "truncatedText";
      }

      return undefined;
    }, []);

    // Initialize columns from descriptor
    useEffect(() => {
      setColumns(normalizeColumns());
    }, [normalizeColumns]);

    // Keep sortRef in sync with sort state
    useEffect(() => {
      sortRef.current = sort;
    }, [sort]);

    // Load data from API
    const loadData = useCallback(
      async (param: RefreshParameter) => {
        if (!selectedConnection) {
          setError("No connection selected");
          return;
        }

        if (!descriptor.query) {
          setError("No query defined for this table component.");
          return;
        }

        console.trace(
          `Loading data for table [${descriptor.id}], queryType: ${(descriptor.query as SQLQuery & { type?: string })?.type}`
        );

        setIsLoading(true);
        setError("");

        try {
          // Cancel previous request if any
          if (apiCancellerRef.current) {
            apiCancellerRef.current.cancel();
            apiCancellerRef.current = null;
          }

          // Build query from descriptor
          const query = Object.assign({}, descriptor.query) as SQLQuery;

          // If query has interval (time series), we might need to update it with selectedTimeSpan
          // For now, we'll use the query as-is, but in the future we can inject timeSpan parameters
          if (param.selectedTimeSpan && query.interval) {
            query.interval = {
              ...query.interval,
              startISO8601: param.selectedTimeSpan.startISO8601,
              endISO8601: param.selectedTimeSpan.endISO8601,
            };
          }

          // Apply server-side sorting if enabled
          // Use sortRef for synchronous access to current sort state
          let finalSql = query.sql;
          if (descriptor.sortOption?.serverSideSorting && sortRef.current.column && sortRef.current.direction) {
            finalSql = replaceOrderByClause(query.sql, sortRef.current.column, sortRef.current.direction);
          }

          // Create AbortController for cancellation
          const abortController = new AbortController();
          const canceller: ApiCanceller = {
            cancel: () => {
              abortController.abort();
            },
          };
          apiCancellerRef.current = canceller;

          const api = Api.create(selectedConnection);
          
          try {
            const response = await api.executeAsync(
              {
                sql: finalSql,
                headers: query.headers,
                params: {
                  default_format: "JSON",
                  output_format_json_quote_64bit_integers: 0,
                  ...query.params,
                },
              },
              abortController.signal
            );

            // Check if request was aborted
            if (abortController.signal.aborted) {
              setIsLoading(false);
              return;
            }

            const responseData = response.data;

            // JSON format returns { meta: [...], data: [...], rows: number, statistics: {...} }
            const rows = responseData.data || [];
            const meta = responseData.meta || [];

            // Build column map from descriptor columns (overrides)
            const columnMap = new Map<string, ColumnDef>();
            const descriptorColumns = normalizeColumns();
            descriptorColumns.forEach((colDef) => {
              columnMap.set(colDef.name, colDef);
            });

            // Build meta map for quick lookup (all server columns)
            const metaMap = new Map<string, { name: string; type?: string }>();
            meta.forEach((colMeta: { name: string; type?: string }) => {
              metaMap.set(colMeta.name, colMeta);
            });

            // Strategy:
            // 1. If descriptor.columns is provided (non-empty): Use ALL server columns,
            //    but override with descriptor column definitions where they match.
            //    Preserve descriptor column order for overridden columns, then append rest.
            // 2. If descriptor.columns is empty/omitted: Use all server columns with defaults.
            const finalColumns: ColumnDef[] = [];
            
            if (descriptorColumns.length > 0) {
              // Behavior: Use all server columns, but override with descriptor definitions
              const processedColumnNames = new Set<string>();
              
              // First, add columns in descriptor order (if they exist in server response)
              descriptorColumns.forEach((colDef) => {
                if (metaMap.has(colDef.name)) {
                  finalColumns.push(colDef);
                  processedColumnNames.add(colDef.name);
                }
              });
              
              // Then, add remaining server columns that weren't in descriptor
              meta.forEach((colMeta: { name: string; type?: string }) => {
                if (!processedColumnNames.has(colMeta.name)) {
                  // Use override if exists, otherwise use default
                  const existingDef = columnMap.get(colMeta.name);
                  finalColumns.push(existingDef || ({ name: colMeta.name } as ColumnDef));
                }
              });
            } else {
              // Behavior: Use all server columns with defaults, apply any overrides if they exist
              meta.forEach((colMeta: { name: string; type?: string }) => {
                const existingDef = columnMap.get(colMeta.name);
                finalColumns.push(existingDef || ({ name: colMeta.name } as ColumnDef));
              });
            }

            // Apply type inference to columns without format
            finalColumns.forEach((colDef) => {
              if (!colDef.format) {
                const inferredFormat = inferColumnFormat(colDef.name, rows as Record<string, unknown>[]);
                if (inferredFormat) {
                  colDef.format = inferredFormat as FormatName;
                }
              }
            });

            setColumns(finalColumns);
            setData(rows as Record<string, unknown>[]);
            setError("");
            setIsLoading(false);
          } catch (error) {
            // Check if request was aborted
            if (abortController.signal.aborted) {
              setIsLoading(false);
              return;
            }

            // Handle ApiErrorResponse
            if (error && typeof error === "object" && "errorMessage" in error) {
              const apiError = error as ApiErrorResponse;
              const errorMessage = apiError.errorMessage || "Unknown error occurred";
              const lowerErrorMessage = errorMessage.toLowerCase();
              
              if (lowerErrorMessage.includes("cancel") || lowerErrorMessage.includes("abort")) {
                setIsLoading(false);
                return;
              }

              console.error("API Error:", apiError);
              setError(errorMessage);
              setIsLoading(false);
            } else {
              // Handle other errors
              const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
              console.error("Error processing table response:", error);
              setError(errorMessage);
              setIsLoading(false);
            }
          }
        } catch (error) {
          const errorMessage = (error as Error).message || "Unknown error occurred";
          setError(errorMessage);
          setIsLoading(false);
          console.error(error);
        }
      },
      [descriptor, selectedConnection, normalizeColumns, inferColumnFormat]
    );

    // Internal refresh function
    const refreshInternal = useCallback(
      (param: RefreshParameter) => {
        console.trace(`Refreshing table [${descriptor.id}]...`);

        if (!descriptor.query) {
          console.error(`No query defined for table [${descriptor.id}]`);
          setError("No query defined for this table component.");
          return;
        }

        loadData(param);
      },
      [descriptor, loadData]
    );

    // Use shared refreshable hook
    const getInitialParams = useCallback(() => {
      return props.selectedTimeSpan ? ({ selectedTimeSpan: props.selectedTimeSpan } as RefreshParameter) : undefined;
    }, [props.selectedTimeSpan]);

    const { componentRef, isCollapsed, setIsCollapsed, refresh, getLastRefreshParameter } = useRefreshable({
      componentId: descriptor.id,
      initialCollapsed: descriptor.isCollapsed ?? false,
      refreshInternal,
      getInitialParams,
    });

    // Store refresh function in ref for use in handleSort
    const refreshRef = useRef(refresh);
    useEffect(() => {
      refreshRef.current = refresh;
    }, [refresh]);

    // Preserve inputFilter behavior: refresh when it changes
    useEffect(() => {
      const inputFilter =
        props.searchParams instanceof URLSearchParams ? props.searchParams.get("filter")?.toString() || "" : "";
      if (inputFilter) {
        refresh({ inputFilter, selectedTimeSpan: props.selectedTimeSpan });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.searchParams]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      refresh,
      getLastRefreshParameter,
    }));

    // Cleanup API canceller on unmount
    useEffect(() => {
      return () => {
        if (apiCancellerRef.current) {
          apiCancellerRef.current.cancel();
          apiCancellerRef.current = null;
        }
      };
    }, []);

    // Format cell value based on column definition
    const formatCellValue = useCallback((value: unknown, columnDef: ColumnDef): React.ReactNode => {
      // Handle empty values: null, undefined, or empty string
      if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
        return <span className="text-muted-foreground">-</span>;
      }

      // Special handling for SQL format
      if (columnDef.format === "sql") {
        const stringValue = String(value);
        const truncatedValue = stringValue.length > 50 ? stringValue.substring(0, 50) + "..." : stringValue;
        return (
          <span
            className="cursor-pointer hover:text-primary underline decoration-dotted"
            onClick={(e) => {
              e.stopPropagation();
              Dialog.showDialog({
                title: "SQL Query",
                description: "Full SQL query text",
                mainContent: (
                  <div className="overflow-auto">
                    <ThemedSyntaxHighlighter language="sql" customStyle={{ fontSize: "14px", margin: 0 }}>
                      {StringUtils.prettyFormatQuery(stringValue)}
                    </ThemedSyntaxHighlighter>
                  </div>
                ),
                className: "max-w-4xl max-h-[80vh]",
                dialogButtons: [{ text: "Close", onClick: async () => true, default: true }],
              });
            }}
            title="Click to view full SQL"
          >
            {truncatedValue}
          </span>
        );
      }

      // Apply format if specified
      if (columnDef.format) {
        const formatter = Formatter.getInstance().getFormatter(columnDef.format);
        // Pass args as params to the formatter (third parameter)
        const formatted = formatter(value, undefined, columnDef.formatArgs);
        // If formatter returns empty string, show '-'
        if (formatted === "" || (typeof formatted === "string" && formatted.trim() === "")) {
          return <span className="text-muted-foreground">-</span>;
        }
        return formatted;
      }

      // Default formatting
      if (typeof value === "object") {
        return <span className="font-mono text-xs">{JSON.stringify(value)}</span>;
      }

      const stringValue = String(value);
      // If string conversion results in empty, show '-'
      if (stringValue.trim() === "") {
        return <span className="text-muted-foreground">-</span>;
      }

      return <span>{stringValue}</span>;
    }, []);

    // Get cell alignment class
    const getCellAlignmentClass = useCallback((columnDef: ColumnDef): string => {
      switch (columnDef.align) {
        case "left":
          return "text-left";
        case "right":
          return "text-right";
        case "center":
          return "text-center";
        default:
          return "text-left";
      }
    }, []);

    // Handle column sorting
    const handleSort = useCallback(
      (columnName: string) => {
        const column = columns.find((col) => col.name === columnName);
        if (!column || column.sortable === false) {
          return;
        }

        let newSort: { column: string | null; direction: "asc" | "desc" | null };
        if (sort.column === columnName) {
          // Cycle through: asc -> desc -> null
          if (sort.direction === "asc") {
            newSort = { column: columnName, direction: "desc" };
          } else if (sort.direction === "desc") {
            newSort = { column: null, direction: null };
          } else {
            newSort = { column: columnName, direction: "asc" };
          }
        } else {
          newSort = { column: columnName, direction: "asc" };
        }

        // Update both state and ref synchronously
        setSort(newSort);
        sortRef.current = newSort;

        // If server-side sorting is enabled, trigger a refresh with the new sort
        if (descriptor.sortOption?.serverSideSorting) {
          const refreshParam = { inputFilter: `sort_${Date.now()}_${newSort.column}_${newSort.direction}` };
          refreshRef.current(refreshParam);
        }
      },
      [columns, sort, descriptor.sortOption]
    );

    // Get sort icon for column
    const getSortIcon = useCallback(
      (columnName: string) => {
        const column = columns.find((col) => col.name === columnName);
        if (!column || column.sortable === false) {
          return null;
        }

        if (sort.column !== columnName) {
          return <ArrowUpDown className="inline-block w-4 h-4 ml-1 opacity-50" />;
        }
        if (sort.direction === "asc") {
          return <ArrowUp className="inline-block w-4 h-4 ml-1" />;
        }
        if (sort.direction === "desc") {
          return <ArrowDown className="inline-block w-4 h-4 ml-1" />;
        }
        return <ArrowUpDown className="inline-block w-4 h-4 ml-1 opacity-50" />;
      },
      [columns, sort]
    );

    // Sorted data - only apply client-side sorting if server-side sorting is disabled
    const sortedData = useMemo(() => {
      // If server-side sorting is enabled, return data as-is (already sorted by server)
      if (descriptor.sortOption?.serverSideSorting) {
        return data;
      }

      // Client-side sorting
      if (!sort.column || !sort.direction) {
        return data;
      }

      return [...data].sort((a, b) => {
        let aValue: unknown = a[sort.column!];
        let bValue: unknown = b[sort.column!];

        // Handle null/undefined values
        if (aValue == null) aValue = "";
        if (bValue == null) bValue = "";

        // Compare values
        let comparison = 0;
        if (typeof aValue === "number" && typeof bValue === "number") {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        return sort.direction === "asc" ? comparison : -comparison;
      });
    }, [data, sort, descriptor.sortOption]);

    // Render functions for TableBody
    const renderError = useCallback(() => {
      if (!error) return null;
      return (
        <TableRow>
          <TableCell colSpan={columns.length} className="text-center text-destructive p-8">
            <div className="flex flex-col items-center justify-center h-[72px] gap-2">
              <p className="font-semibold">Error loading table data:</p>
              <p className="text-sm">{error}</p>
            </div>
          </TableCell>
        </TableRow>
      );
    }, [error, columns.length]);

    const renderLoading = useCallback(() => {
      if (!isLoading || data.length > 0) return null;
      return (
        <>
          {Array.from({ length: 3 }).map((_, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={column.name} className={cn(getCellAlignmentClass(column), "whitespace-nowrap !p-2")}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </>
      );
    }, [isLoading, data.length, columns, getCellAlignmentClass]);

    const renderNoData = useCallback(() => {
      if (error || isLoading || data.length > 0) return null;
      return (
        <TableRow>
          <TableCell colSpan={columns.length} className="text-center text-muted-foreground p-8">
            <div className="flex items-center justify-center h-[72px]">No data found</div>
          </TableCell>
        </TableRow>
      );
    }, [error, isLoading, data.length, columns.length]);

    const renderData = useCallback(() => {
      // Don't hide data during refresh - keep showing existing data until new data arrives
      if (error || data.length === 0) return null;
      return (
        <>
          {sortedData.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((column) => {
                // Handle action columns
                if (column.renderAction) {
                  return (
                    <TableCell
                      key={column.name}
                      className={cn(getCellAlignmentClass(column), "whitespace-nowrap !p-2")}
                    >
                      {column.renderAction(row, rowIndex)}
                    </TableCell>
                  );
                }

                // Regular data columns
                const value = row[column.name];
                return (
                  <TableCell key={column.name} className={cn(getCellAlignmentClass(column), "whitespace-nowrap !p-2")}>
                    {formatCellValue(value, column)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </>
      );
    }, [error, data.length, sortedData, columns, getCellAlignmentClass, formatCellValue]);

    const hasTitle = !!descriptor.titleOption?.title && descriptor.titleOption?.showTitle !== false;
    const isStickyHeader = descriptor.headOption?.isSticky === true;

    // Render functions for direct table structure (when sticky header is enabled)
    const renderErrorDirect = useCallback(() => {
      if (!error) return null;
      return (
        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
          <td colSpan={columns.length} className="p-4 align-middle text-center text-destructive !p-8">
            <div className="flex flex-col items-center justify-center h-[72px] gap-2">
              <p className="font-semibold">Error loading table data:</p>
              <p className="text-sm">{error}</p>
            </div>
          </td>
        </tr>
      );
    }, [error, columns.length]);

    const renderLoadingDirect = useCallback(() => {
      if (!isLoading || data.length > 0) return null;
      return (
        <>
          {Array.from({ length: 3 }).map((_, index) => (
            <tr key={index} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              {columns.map((column) => (
                <td key={column.name} className={cn("p-4 align-middle", getCellAlignmentClass(column), "whitespace-nowrap !p-2")}>
                  <Skeleton className="h-5 w-full" />
                </td>
              ))}
            </tr>
          ))}
        </>
      );
    }, [isLoading, data.length, columns, getCellAlignmentClass]);

    const renderNoDataDirect = useCallback(() => {
      if (error || isLoading || data.length > 0) return null;
      return (
        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
          <td colSpan={columns.length} className="p-4 align-middle text-center text-muted-foreground !p-8">
            <div className="flex items-center justify-center h-[72px]">No data found</div>
          </td>
        </tr>
      );
    }, [error, isLoading, data.length, columns.length]);

    const renderDataDirect = useCallback(() => {
      if (error || data.length === 0) return null;
      return (
        <>
          {sortedData.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              {columns.map((column) => {
                // Handle action columns
                if (column.renderAction) {
                  return (
                    <td
                      key={column.name}
                      className={cn("p-4 align-middle", getCellAlignmentClass(column), "whitespace-nowrap !p-2")}
                    >
                      {column.renderAction(row, rowIndex)}
                    </td>
                  );
                }

                // Regular data columns
                const value = row[column.name];
                // For percentage_bar format, don't apply whitespace-nowrap to allow the bar to render properly
                const shouldWrap = column.format === "percentage_bar";
                return (
                  <td key={column.name} className={cn("p-4 align-middle", getCellAlignmentClass(column), !shouldWrap && "whitespace-nowrap", "!p-2")}>
                    {formatCellValue(value, column)}
                  </td>
                );
              })}
            </tr>
          ))}
        </>
      );
    }, [error, data.length, sortedData, columns, getCellAlignmentClass, formatCellValue]);

    return (
      <Card ref={componentRef} className="@container/card relative">
        <FloatingProgressBar show={isLoading} />
        <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
          {hasTitle && descriptor.titleOption && (
            <CardHeader className="p-0">
              <CollapsibleTrigger className="w-full">
                <div className={cn("flex items-center p-3 bg-muted/50 transition-colors gap-2 hover:bg-muted")}>
                  <ChevronRight
                    className={cn("h-4 w-4 transition-transform duration-200 shrink-0", !isCollapsed && "rotate-90")}
                  />
                  <div className="flex-1 text-left">
                    <CardDescription
                      className={cn(
                        descriptor.titleOption.align ? "text-" + descriptor.titleOption.align : "text-left",
                        "font-semibold text-foreground m-0"
                      )}
                    >
                      {descriptor.titleOption.title}
                    </CardDescription>
                    {descriptor.titleOption.description && (
                      <CardDescription className="text-xs mt-1 m-0">
                        {descriptor.titleOption.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
            </CardHeader>
          )}
          <CollapsibleContent>
            <CardContent className={cn("px-0 p-0", !isStickyHeader && "overflow-auto", isStickyHeader && "max-h-[60vh] overflow-auto")}>
              {isStickyHeader ? (
                // Use direct table structure for sticky header to avoid nested scroll containers
                <div className="relative w-full">
                  <table className="w-full caption-bottom text-sm">
                    <thead className={cn("[&_tr]:border-b sticky top-0 z-10 bg-background")}>
                      <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        {columns.map((column) => {
                          const isSortable = column.sortable !== false && column.renderAction === undefined;
                          return (
                            <th
                              key={column.name}
                              className={cn(
                                "px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
                                getCellAlignmentClass(column),
                                column.width && `w-[${column.width}px]`,
                                column.minWidth && `min-w-[${column.minWidth}px]`,
                                "whitespace-nowrap",
                                isSortable && "cursor-pointer hover:bg-muted/50 select-none h-10"
                              )}
                              style={{
                                width: column.width ? `${column.width}px` : undefined,
                                minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
                              }}
                              onClick={() => isSortable && handleSort(column.name)}
                            >
                              {isLoading && data.length === 0 ? (
                                <Skeleton className="h-5 w-20" />
                              ) : (
                                <>
                                  {column.title || column.name}
                                  {isSortable && getSortIcon(column.name)}
                                </>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      {renderErrorDirect()}
                      {renderLoadingDirect()}
                      {renderNoDataDirect()}
                      {renderDataDirect()}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((column) => {
                        const isSortable = column.sortable !== false && column.renderAction === undefined;
                        return (
                          <TableHead
                            key={column.name}
                            className={cn(
                              getCellAlignmentClass(column),
                              column.width && `w-[${column.width}px]`,
                              column.minWidth && `min-w-[${column.minWidth}px]`,
                              "whitespace-nowrap",
                              isSortable && "cursor-pointer hover:bg-muted/50 select-none h-10"
                            )}
                            style={{
                              width: column.width ? `${column.width}px` : undefined,
                              minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
                            }}
                            onClick={() => isSortable && handleSort(column.name)}
                          >
                            {isLoading && data.length === 0 ? (
                              <Skeleton className="h-5 w-20" />
                            ) : (
                              <>
                                {column.title || column.name}
                                {isSortable && getSortIcon(column.name)}
                              </>
                            )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {renderError()}
                    {renderLoading()}
                    {renderNoData()}
                    {renderData()}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }
);

RefreshableTableComponent.displayName = "RefreshableTableComponent";

export default RefreshableTableComponent;
export type { RefreshableTableComponentProps };
