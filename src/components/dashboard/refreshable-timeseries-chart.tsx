"use client";

import { Api, type ApiCanceller, type ApiErrorResponse, type ApiResponse } from "@/lib/api";
import { useConnection } from "@/lib/connection/ConnectionContext";
import { DateTimeExtension } from "@/lib/datetime-utils";
import { Formatter, type FormatName } from "@/lib/formatter";
import { cn } from "@/lib/utils";
import * as echarts from "echarts";
import { ChevronRight } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import FloatingProgressBar from "../floating-progress-bar";
import { Card, CardContent, CardDescription, CardHeader } from "../ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Skeleton } from "../ui/skeleton";
import type { SQLQuery, TimeseriesDescriptor } from "./chart-utils";
import type { RefreshableComponent, RefreshParameter } from "./refreshable-component";
import type { TimeSpan } from "./timespan-selector";
import { useRefreshable } from "./use-refreshable";

interface RefreshableTimeseriesChartProps {
  // The timeseries descriptor configuration
  descriptor: TimeseriesDescriptor;

  // Runtime
  selectedTimeSpan?: TimeSpan;

  // Used for generating links
  searchParams?: URLSearchParams;
}

const RefreshableTimeseriesChart = forwardRef<RefreshableComponent, RefreshableTimeseriesChartProps>(
  function RefreshableTimeseriesChart(props, ref) {
    const { descriptor } = props;
    const { selectedConnection } = useConnection();

    // Debug logging
    useEffect(() => {
      console.log(`[RefreshableTimeseriesChart] Component mounted with descriptor:`, {
        id: descriptor.id,
        type: descriptor.type,
        titleOption: descriptor.titleOption,
        hasTitle: !!descriptor.titleOption?.title,
        title: descriptor.titleOption?.title,
        query: descriptor.query?.sql?.substring(0, 100),
      });
    }, [descriptor]);

    // State
    const [data, setData] = useState<Record<string, unknown>[]>([]);
    const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
    const [meta, setMeta] = useState<Array<{ name: string; type?: string }>>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Refs
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartInstanceRef = useRef<echarts.ECharts | null>(null);
    const apiCancellerRef = useRef<ApiCanceller | null>(null);

    // Initialize echarts instance
    useEffect(() => {
      if (chartContainerRef.current && !chartInstanceRef.current) {
        const chartInstance = echarts.init(chartContainerRef.current);
        chartInstanceRef.current = chartInstance;

        // Handle window resize
        const handleResize = () => {
          chartInstance.resize();
        };
        window.addEventListener("resize", handleResize);

        return () => {
          window.removeEventListener("resize", handleResize);
          chartInstance.dispose();
          chartInstanceRef.current = null;
        };
      }
    }, []);

    // Infer format from metric name
    const inferFormatFromMetricName = useCallback((metricName: string): FormatName => {
      const lowerName = metricName.toLowerCase();
      if (lowerName.includes("bytes")) {
        return "binary_size";
      } else if (lowerName.includes("microseconds")) {
        return "microsecond";
      } else if (lowerName.includes("milliseconds")) {
        return "millisecond";
      } else if (lowerName.includes("nanoseconds")) {
        return "nanosecond";
      }
      return "short_number";
    }, []);

    // Update chart when data changes
    useEffect(() => {
      if (!chartInstanceRef.current) {
        return;
      }

      if (!data || data.length === 0) {
        // Show empty state
        chartInstanceRef.current.setOption({
          title: {
            show: true,
            text: "No data",
            left: "center",
            top: "center",
            textStyle: {
              color: "#999",
            },
          },
        });
        return;
      }

      try {
        // Find timestamp column
        const firstRow = data[0];
        const timestampKey = Object.keys(firstRow).find(
          (key) => key.toLowerCase().includes("time") || key.toLowerCase().includes("date") || key === "timestamp" || key === "t"
        ) || "t";

        // Identify columns: timestamp, labels (group by columns), and metrics
        const allColumns = meta.length > 0 
          ? meta.map((m) => m.name)
          : Object.keys(firstRow);
        
        // Explicitly exclude timestamp column from label columns
        const labelColumns = allColumns.filter((col) => {
          const lower = col.toLowerCase();
          // Explicitly exclude the timestamp key and any time-related columns
          return col !== timestampKey && 
                 col.toLowerCase() !== timestampKey.toLowerCase() &&
                 !lower.includes("time") && 
                 !lower.includes("date") &&
                 !col.includes("(") && // Metrics usually have function names like avg(...)
                 !col.includes("sum(") &&
                 !col.includes("count(") &&
                 !col.includes("avg(") &&
                 !col.includes("min(") &&
                 !col.includes("max(");
        });

        const metricColumns = allColumns.filter((col) => {
          return col !== timestampKey && !labelColumns.includes(col);
        });

        console.log(`[TimeseriesChart ${descriptor.id}] Column classification:`, {
          timestampKey,
          labelColumns,
          metricColumns,
        });

        // Get unique timestamps and sort them
        // Convert all timestamps to milliseconds for consistent comparison
        const timestamps = Array.from(
          new Set(
            data.map((row) => {
              const ts = row[timestampKey] as number;
              return typeof ts === "number" && ts > 1e10 ? ts : ts * 1000;
            })
          )
        ).sort((a, b) => a - b);

        // Build x-axis data
        const xAxisData: string[] = timestamps.map((ts) => {
          const date = new Date(ts);
          return DateTimeExtension.formatDateTime(date, "HH:mm:ss") || "";
        });

        // Create a map: timestamp (ms) -> data point for quick lookup
        const timestampMap = new Map<number, Record<string, unknown>>();
        data.forEach((row) => {
          const ts = row[timestampKey] as number;
          const timestamp = typeof ts === "number" && ts > 1e10 ? ts : ts * 1000;
          timestampMap.set(timestamp, row);
        });

        // Build series data - group by labels if present
        const series: echarts.SeriesOption[] = [];
        const FormatterInstance = Formatter.getInstance();

        if (labelColumns.length > 0) {
          // Group data by label combinations for each metric
          metricColumns.forEach((metricCol) => {
            const labelGroups = new Map<string, Array<{ timestamp: number; value: number }>>();
            
            data.forEach((row) => {
              const ts = row[timestampKey] as number;
              const timestamp = typeof ts === "number" && ts > 1e10 ? ts : ts * 1000;
              const value = row[metricCol];
              
              // Convert value to number
              let numValue: number;
              if (typeof value === "number") {
                numValue = value;
              } else if (typeof value === "string") {
                numValue = parseFloat(value);
                if (isNaN(numValue)) return; // Skip invalid values
              } else {
                return; // Skip non-numeric values
              }

              // Build label key from all label columns, explicitly excluding timestamp
              // Filter out timestamp values if they somehow got included
              const labelKeyParts = labelColumns
                .filter((labelCol) => labelCol !== timestampKey && labelCol.toLowerCase() !== timestampKey.toLowerCase())
                .map((labelCol) => {
                  const value = row[labelCol];
                  // Skip if value looks like a timestamp (large number)
                  if (typeof value === "number" && value > 1e10) {
                    return null;
                  }
                  // Convert to string, treating empty string as 'empty-hostname' for hostname-like columns
                  const strValue = String(value || "");
                  // If it's empty and the column name suggests it's a hostname identifier, use 'empty-hostname'
                  if (strValue === "" && (labelCol.toLowerCase().includes("host") || labelCol.toLowerCase().includes("hostname"))) {
                    return "empty-hostname";
                  }
                  return strValue;
                })
                .filter((part) => part !== null);
              
              const labelKey = labelKeyParts.length > 0 
                ? labelKeyParts.join(" - ") 
                : metricCol; // Fallback to metric name if no valid labels

              if (!labelGroups.has(labelKey)) {
                labelGroups.set(labelKey, []);
              }

              labelGroups.get(labelKey)!.push({ timestamp, value: numValue });
            });

            console.log(`[TimeseriesChart ${descriptor.id}] Label groups for metric ${metricCol}:`, {
              labelGroups: Array.from(labelGroups.entries()).map(([key, points]) => ({
                label: key,
                pointCount: points.length,
              })),
            });

            // Create series for each label group
            labelGroups.forEach((points, labelKey) => {
              // Sort points by timestamp
              points.sort((a, b) => a.timestamp - b.timestamp);

              // Create data array aligned with xAxisData
              const seriesData: (number | null)[] = timestamps.map((tsMs) => {
                const point = points.find((p) => {
                  return Math.abs(p.timestamp - tsMs) < 1000; // Within 1 second tolerance
                });
                return point ? point.value : null;
              });

              // Use label as series name (if multiple metrics, append metric name)
              const seriesName = metricColumns.length > 1 ? `${labelKey} (${metricCol})` : labelKey;
              series.push({
                name: seriesName,
                type: descriptor.type === "bar" ? "bar" : "line",
                data: seriesData,
                yAxisIndex: 0,
                smooth: true,
                showSymbol: false, // Hide dots, show only smooth lines
                areaStyle: descriptor.type === "area" ? { opacity: 0.3 } : undefined,
              });
            });
          });
        } else {
          // No labels - create one series per metric
          metricColumns.forEach((metricCol) => {
            // Create data array aligned with xAxisData
            const seriesData: (number | null)[] = timestamps.map((tsMs) => {
              const row = timestampMap.get(tsMs);
              if (!row) return null;
              
              const value = row[metricCol];
              if (typeof value === "number") {
                return value;
              } else if (typeof value === "string") {
                const num = parseFloat(value);
                return isNaN(num) ? null : num;
              }
              return null;
            });

            // Use metric name as series name
            series.push({
              name: metricCol,
              type: descriptor.type === "bar" ? "bar" : "line",
              data: seriesData,
              yAxisIndex: 0,
              smooth: true,
              showSymbol: false, // Hide dots, show only smooth lines
              areaStyle: descriptor.type === "area" ? { opacity: 0.3 } : undefined,
            });
          });
        }

        // Build y-axis configuration - don't use label names
        const yAxisOption = descriptor.yAxis?.[0] || {};
        const yAxis: echarts.EChartsOption["yAxis"] = [{
          type: "value",
          name: "", // Don't show label names
          min: yAxisOption.min,
          minInterval: yAxisOption.minInterval,
          interval: yAxisOption.interval,
          inverse: yAxisOption.inverse,
          splitLine: { show: true },
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            formatter: (value: number) => {
              // Use first metric's format for y-axis labels
              if (metricColumns.length > 0) {
                const format = inferFormatFromMetricName(metricColumns[0]);
                const formatter = FormatterInstance.getFormatter(format);
                const formatted = formatter(value);
                // Ensure we return a string
                return typeof formatted === "string" ? formatted : String(formatted);
              }
              return String(value);
            },
          },
        }];

        // Build final echarts option
        const option: echarts.EChartsOption = {
          title: {
            show: false,
          },
          tooltip: {
            trigger: "axis",
            axisPointer: {
              type: "line",
            },
            formatter: (params: unknown) => {
              if (!Array.isArray(params)) {
                return "";
              }
              const firstParam = params[0] as { axisValue: string };
              const timestamp = firstParam.axisValue;
              let result = `<div style="margin-bottom: 4px;">${timestamp}</div>`;
              
              params.forEach((param: { value: number | null; seriesName: string; color: string }) => {
                const value = param.value;
                if (value !== null && value !== undefined) {
                  // Find the metric column for this series
                  // If labels exist, series name is the label value; otherwise it's the metric name
                  let metricCol: string;
                  if (labelColumns.length > 0) {
                    // Series name is a label value, find the metric column
                    metricCol = metricColumns[0] || "";
                  } else {
                    // Series name is the metric column name
                    metricCol = param.seriesName;
                  }
                  
                  const format = metricCol ? inferFormatFromMetricName(metricCol) : "short_number";
                  const formatter = FormatterInstance.getFormatter(format);
                  const formattedValue = formatter(value);
                  
                  result += `<div style="margin-top: 2px;">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:${param.color};margin-right:5px;"></span>
                    ${param.seriesName}: <strong>${formattedValue}</strong>
                  </div>`;
                }
              });
              return result;
            },
          },
          legend: {
            data: series.map((s) => s.name as string),
            show: series.length > 0,
            top: 0,
            type: "scroll",
          },
          grid: {
            left: "3%",
            right: "4%",
            bottom: "10%",
            top: series.length > 0 ? "15%" : "5%",
            containLabel: true,
          },
          xAxis: {
            type: "category",
            data: xAxisData,
            boundaryGap: descriptor.type === "bar",
          },
          yAxis: yAxis,
          series: series,
        };

        chartInstanceRef.current.setOption(option, true);
        
        // Resize after setting option to ensure proper rendering
        setTimeout(() => {
          if (chartInstanceRef.current) {
            chartInstanceRef.current.resize();
          }
        }, 50);
      } catch (err) {
        console.error("Error updating chart:", err);
        setError(err instanceof Error ? err.message : "Error updating chart");
      }
    }, [data, descriptor, detectedColumns, meta, inferFormatFromMetricName]);

    // Load data from API
    const loadData = useCallback(
      async (param: RefreshParameter) => {
        if (!selectedConnection) {
          setError("No connection selected");
          return;
        }

        if (!descriptor.query) {
          setError("No query defined for this chart component.");
          return;
        }

        if (!param.selectedTimeSpan) {
          setError("Please choose time span.");
          return;
        }

        console.trace(`Loading data for timeseries chart [${descriptor.id}]...`);

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

          // Calculate rounding and seconds from selectedTimeSpan
          const startTime = new Date(param.selectedTimeSpan.startISO8601);
          const endTime = new Date(param.selectedTimeSpan.endISO8601);
          const seconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
          
          // Calculate rounding based on time span (default to 1/100 of the range, minimum 1 second)
          const rounding = Math.max(1, Math.floor(seconds / 100));

          // Replace template parameters with ClickHouse parameter syntax
          // {rounding} -> {param_rounding:UInt32}
          // {seconds} -> {param_seconds:UInt32}
          let finalSql = query.sql;
          finalSql = finalSql.replace(/{rounding:UInt32}/g, String(rounding));
          finalSql = finalSql.replace(/{seconds:UInt32}/g, String(seconds));

          // Log the SQL for debugging
          console.log(`[TimeseriesChart ${descriptor.id}] Executing SQL:`, finalSql);
          console.log(`[TimeseriesChart ${descriptor.id}] Parameters: param_rounding=${rounding}, param_seconds=${seconds}`);
          console.log(`[TimeseriesChart ${descriptor.id}] TimeSpan:`, param.selectedTimeSpan);

          // Check if there are any remaining old-style placeholders (for backward compatibility)
          if (finalSql.includes("{rounding}") || finalSql.includes("{seconds}")) {
            console.warn(`[TimeseriesChart ${descriptor.id}] Warning: Old-style placeholders found in SQL (use {param_rounding:UInt32} and {param_seconds:UInt32})`);
          }

          // Store finalSql in a variable accessible to error handler
          const executedSql = finalSql;

          const api = Api.create(selectedConnection);
          const canceller = api.executeSQL(
            {
              sql: finalSql,
              headers: query.headers,
              params: {
                default_format: "JSON",
                output_format_json_quote_64bit_integers: 0,
                ...query.params,
              },
            },
            (response: ApiResponse) => {
              try {
                const responseData = response.data;

                // JSON format returns { meta: [...], data: [...], rows: number, statistics: {...} }
                const rows = responseData.data || [];
                const meta = responseData.meta || [];

                // Check if rows are arrays or objects
                const firstRow = rows[0];
                const isArrayFormat = Array.isArray(firstRow);

                console.log(`[TimeseriesChart ${descriptor.id}] Data format:`, isArrayFormat ? "array" : "object");
                console.log(`[TimeseriesChart ${descriptor.id}] First row sample:`, firstRow);

                // Transform data for chart
                const transformedData = rows.map((row: unknown) => {
                  const dataPoint: Record<string, unknown> = {};

                  if (isArrayFormat) {
                    // Array format: row is [value1, value2, ...]
                    const rowArray = row as unknown[];
                    meta.forEach((colMeta: { name: string; type?: string }, index: number) => {
                      const value = rowArray[index];
                      const colName = colMeta.name;
                      
                      // Handle timestamp column (common names: timestamp, time, _time, t, etc.)
                      if (colName.toLowerCase().includes("time") || colName.toLowerCase().includes("date") || colName === "t") {
                        // Convert to timestamp if it's a string
                        if (typeof value === "string") {
                          dataPoint.timestamp = new Date(value).getTime();
                        } else if (typeof value === "number") {
                          // If it's already a number, treat as Unix timestamp (seconds or milliseconds)
                          // ClickHouse typically returns Unix timestamps in seconds
                          dataPoint.timestamp = value > 1e10 ? value : value * 1000;
                        } else {
                          dataPoint.timestamp = new Date(String(value)).getTime();
                        }
                        // Also store with original name for compatibility
                        dataPoint[colName] = dataPoint.timestamp;
                      } else {
                        dataPoint[colName] = value;
                      }
                    });
                  } else {
                    // Object format: row is {column1: value1, column2: value2, ...}
                    const rowObject = row as Record<string, unknown>;
                    Object.keys(rowObject).forEach((colName) => {
                      const value = rowObject[colName];
                      
                      // Handle timestamp column (common names: timestamp, time, _time, t, etc.)
                      if (colName.toLowerCase().includes("time") || colName.toLowerCase().includes("date") || colName === "t") {
                        // Convert to timestamp if it's a string
                        if (typeof value === "string") {
                          dataPoint.timestamp = new Date(value).getTime();
                        } else if (typeof value === "number") {
                          // If it's already a number, treat as Unix timestamp (seconds or milliseconds)
                          // ClickHouse typically returns Unix timestamps in seconds
                          dataPoint.timestamp = value > 1e10 ? value : value * 1000;
                        } else {
                          dataPoint.timestamp = new Date(String(value)).getTime();
                        }
                        // Also store with original name for compatibility
                        dataPoint[colName] = dataPoint.timestamp;
                      } else {
                        dataPoint[colName] = value;
                      }
                    });
                  }
                  
                  return dataPoint;
                });

                // Store meta for later use in chart rendering
                setMeta(meta);

                // Auto-detect columns if not specified in descriptor
                if (descriptor.columns.length === 0 || (descriptor.columns.length === 1 && typeof descriptor.columns[0] === "string" && descriptor.columns[0] === "value")) {
                  // Find metric columns (exclude timestamp and label columns)
                  let metricColumns: string[];
                  
                  if (isArrayFormat && meta.length > 0) {
                    // Use meta for array format
                    metricColumns = meta
                      .map((colMeta: { name: string; type?: string }) => colMeta.name)
                      .filter((name: string) => {
                        const lower = name.toLowerCase();
                        return !lower.includes("time") && 
                               !lower.includes("date") && 
                               name !== "t" &&
                               (name.includes("(") || name.includes("sum(") || name.includes("count(") || name.includes("avg(") || name.includes("min(") || name.includes("max("));
                      });
                  } else {
                    // Use object keys for object format
                    const firstRowObj = rows[0] as Record<string, unknown>;
                    metricColumns = Object.keys(firstRowObj).filter(
                      (name: string) => {
                        const lower = name.toLowerCase();
                        return !lower.includes("time") && 
                               !lower.includes("date") && 
                               name !== "t" &&
                               (name.includes("(") || name.includes("sum(") || name.includes("count(") || name.includes("avg(") || name.includes("min(") || name.includes("max("));
                      }
                    );
                  }
                  
                  if (metricColumns.length > 0) {
                    setDetectedColumns(metricColumns);
                  }
                } else {
                  setDetectedColumns([]);
                }

                setData(transformedData);
                setError("");
              } catch (err) {
                console.error("Error processing chart response:", err);
                const errorMessage = err instanceof Error ? err.message : String(err);
                setError(errorMessage);
              } finally {
                setIsLoading(false);
              }
            },
            (error: ApiErrorResponse) => {
              const errorMessage = error.errorMessage || "Unknown error occurred";
              const lowerErrorMessage = errorMessage.toLowerCase();
              if (lowerErrorMessage.includes("cancel") || lowerErrorMessage.includes("abort")) {
                setIsLoading(false);
                return;
              }

              console.error(`[TimeseriesChart ${descriptor.id}] API Error:`, error);
              console.error(`[TimeseriesChart ${descriptor.id}] SQL that failed:`, executedSql);
              console.error(`[TimeseriesChart ${descriptor.id}] Error details:`, {
                httpStatus: error.httpStatus,
                errorMessage: error.errorMessage,
                data: error.data,
              });
              setError(errorMessage);
              setIsLoading(false);
            },
            () => {
              setIsLoading(false);
            }
          );

          apiCancellerRef.current = canceller;
        } catch (error) {
          const errorMessage = (error as Error).message || "Unknown error occurred";
          setError(errorMessage);
          setIsLoading(false);
          console.error(error);
        }
      },
      [descriptor, selectedConnection]
    );

    // Internal refresh function
    const refreshInternal = useCallback(
      (param: RefreshParameter) => {
        console.trace(`Refreshing timeseries chart [${descriptor.id}]...`);

        if (!descriptor.query) {
          console.error(`No query defined for chart [${descriptor.id}]`);
          setError("No query defined for this chart component.");
          return;
        }

        loadData(param);
      },
      [descriptor, loadData]
    );

    // Use shared refreshable hook
    const { componentRef, isCollapsed, setIsCollapsed, refresh, getLastRefreshParameter } = useRefreshable({
      componentId: descriptor.id,
      initialCollapsed: descriptor.isCollapsed ?? false,
      refreshInternal,
    });

    // Resize chart when expanded/collapsed state changes
    useEffect(() => {
      if (chartInstanceRef.current && !isCollapsed) {
        // Use setTimeout to ensure DOM is updated before resizing
        const timer = setTimeout(() => {
          if (chartInstanceRef.current && chartContainerRef.current) {
            chartInstanceRef.current.resize();
            // Re-render chart with current data when expanded
            if (data && data.length > 0) {
              // Trigger a re-render by calling setOption again
              const currentOption = chartInstanceRef.current.getOption();
              if (currentOption) {
                chartInstanceRef.current.setOption(currentOption as echarts.EChartsOption, false);
              }
            }
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [isCollapsed, data]);

    // Expose methods via ref (including getEChartInstance for echarts connection)
    useImperativeHandle(ref, () => ({
      refresh,
      getLastRefreshParameter,
      getEChartInstance: () => chartInstanceRef.current || undefined,
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

    const hasTitle = !!descriptor.titleOption?.title;

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
          {!hasTitle && descriptor.titleOption && (
            <CardHeader className="pt-5 pb-3">
              {descriptor.titleOption.description && (
                <CardDescription className="text-xs">{descriptor.titleOption.description}</CardDescription>
              )}
            </CardHeader>
          )}
          <CollapsibleContent>
            <CardContent className="px-0 p-0">
              {error ? (
                <div className="flex flex-col items-center justify-center h-[300px] gap-2 text-destructive p-8">
                  <p className="font-semibold">Error loading chart data:</p>
                  <p className="text-sm">{error}</p>
                </div>
              ) : isLoading && data.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
                <div
                  ref={chartContainerRef}
                  className="h-[300px] w-full"
                  style={{ minHeight: descriptor.height ? `${descriptor.height}px` : undefined }}
                />
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  }
);

RefreshableTimeseriesChart.displayName = "RefreshableTimeseriesChart";

export default RefreshableTimeseriesChart;
export type { RefreshableTimeseriesChartProps };

