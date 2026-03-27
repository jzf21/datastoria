"use client";

import { useConnection } from "@/components/connection/connection-context";
import type { PersistedAlertRule } from "@/lib/alerting/alert-types";
import { extractMetricFromClusterStatus } from "@/lib/alerting/engine/metric-collectors";
import { BasePath } from "@/lib/base-path";
import type { Connection, JSONCompactFormatResponse } from "@/lib/connection/connection";
import type { GetClusterStatusOutput } from "@/lib/ai/tools/client/status/collect-cluster-status";
import { useEffect, useRef } from "react";

const EVALUATION_POLL_INTERVAL_MS = 60_000;

export function AlertEvaluationProvider({ children }: { children: React.ReactNode }) {
  const { connection, isConnectionAvailable } = useConnection();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const evaluatingRef = useRef(false);

  useEffect(() => {
    if (!isConnectionAvailable || !connection) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const evaluateRules = async () => {
      if (evaluatingRef.current) return;
      evaluatingRef.current = true;

      try {
        const connectionId = connection.name;
        const res = await fetch(
          BasePath.getURL(`/api/alerts/rules/due?connection_id=${encodeURIComponent(connectionId)}`)
        );
        if (!res.ok) return;

        const rules = (await res.json()) as PersistedAlertRule[];
        if (rules.length === 0) return;

        const clusterStatusOutput = await collectBasicClusterStatus(connection);
        if (!clusterStatusOutput) return;

        const results = [];
        for (const rule of rules) {
          const evalResult = extractMetricFromClusterStatus(
            clusterStatusOutput,
            rule.category,
            rule.condition
          );

          results.push({
            rule_id: rule.id,
            connection_id: connectionId,
            breached: evalResult.thresholdBreached,
            current_value: evalResult.currentValue,
            detail: evalResult.details,
          });
        }

        if (results.length > 0) {
          await fetch(BasePath.getURL("/api/alerts/evaluate"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(results),
          });
        }
      } catch (err) {
        console.warn("[AlertEvaluation] evaluation cycle failed:", err);
      } finally {
        evaluatingRef.current = false;
      }
    };

    const initialTimeout = setTimeout(() => {
      void evaluateRules();
    }, 5000);

    intervalRef.current = setInterval(() => {
      void evaluateRules();
    }, EVALUATION_POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isConnectionAvailable, connection]);

  return <>{children}</>;
}

async function queryJsonCompact(
  sql: string,
  connection: Connection
): Promise<JSONCompactFormatResponse> {
  const { response } = connection.query(sql, { default_format: "JSONCompact" });
  const apiResponse = await response;
  return apiResponse.data.json<JSONCompactFormatResponse>();
}

async function collectBasicClusterStatus(
  connection: Connection
): Promise<GetClusterStatusOutput | null> {
  try {
    const categories: GetClusterStatusOutput["categories"] = {};

    // Disk check
    try {
      const diskResult = await queryJsonCompact(
        `SELECT
          hostName() AS host_name,
          name,
          path,
          total_space,
          free_space,
          round((1 - free_space / total_space) * 100, 2) AS used_percent
        FROM system.disks
        WHERE total_space > 0`,
        connection
      );
      const diskRows = diskResult.data || [];
      let maxUsedPercent = 0;
      for (const row of diskRows) {
        const usedPercent = Number(row[5]) || 0;
        maxUsedPercent = Math.max(maxUsedPercent, usedPercent);
      }
      categories.disk = {
        status: maxUsedPercent >= 90 ? "CRITICAL" : maxUsedPercent >= 80 ? "WARNING" : "OK",
        issues: maxUsedPercent >= 80 ? [`Disk usage at ${maxUsedPercent.toFixed(1)}%`] : [],
        metrics: { max_disk_used_percent: maxUsedPercent },
      };
    } catch {
      // Skip if disk query fails
    }

    // Replication check
    try {
      const replResult = await queryJsonCompact(
        `SELECT
          hostName() AS host_name,
          max(absolute_delay) AS max_delay,
          countIf(is_readonly != 0) AS readonly_count
        FROM system.replicas
        GROUP BY host_name`,
        connection
      );
      const replRows = replResult.data || [];
      let maxLag = 0;
      for (const row of replRows) {
        const delay = Number(row[1]) || 0;
        maxLag = Math.max(maxLag, delay);
      }
      categories.replication = {
        status: maxLag >= 300 ? "CRITICAL" : maxLag >= 60 ? "WARNING" : "OK",
        issues: maxLag >= 60 ? [`Max replication lag: ${maxLag}s`] : [],
        metrics: { max_replication_lag_seconds: maxLag },
      };
    } catch {
      // Skip if replication query fails
    }

    // Query performance check (select queries)
    try {
      const queryResult = await queryJsonCompact(
        `SELECT
          quantileExactIf(0.95)(query_duration_ms, type = 'QueryFinish') AS p95_ms,
          countIf(type IN ('ExceptionBeforeStart', 'ExceptionWhileProcessing')) AS failed_queries
        FROM system.query_log
        WHERE event_date >= toDate(now() - INTERVAL 15 MINUTE)
          AND event_time >= now() - INTERVAL 15 MINUTE
          AND query_kind = 'Select'`,
        connection
      );
      const queryRows = queryResult.data || [];
      if (queryRows.length > 0) {
        const p95 = Number(queryRows[0][0]) || 0;
        const failedQueries = Number(queryRows[0][1]) || 0;
        categories.select_queries = {
          status: p95 >= 3000 ? "CRITICAL" : p95 >= 1000 ? "WARNING" : "OK",
          issues: p95 >= 1000 ? [`P95 query duration: ${p95.toFixed(0)}ms`] : [],
          metrics: { max_p95_query_duration_ms: p95, failed_queries: failedQueries },
        };
        categories.errors = {
          status: failedQueries > 500 ? "CRITICAL" : failedQueries > 50 ? "WARNING" : "OK",
          issues: failedQueries > 50 ? [`${failedQueries} failed queries in last 15 minutes`] : [],
          metrics: { failed_queries: failedQueries },
        };
      }
    } catch {
      // Skip if query log fails
    }

    // Memory check
    try {
      const memResult = await queryJsonCompact(
        `SELECT
          hostName() AS host_name,
          value AS memory_tracking
        FROM system.metrics
        WHERE metric = 'MemoryTracking'`,
        connection
      );
      const asyncMemResult = await queryJsonCompact(
        `SELECT
          hostName() AS host_name,
          value AS total_memory
        FROM system.asynchronous_metrics
        WHERE metric = 'OSMemoryTotal'`,
        connection
      );
      const memRows = memResult.data || [];
      const asyncMemRows = asyncMemResult.data || [];

      let maxMemPercent = 0;
      const totalMemByHost = new Map<string, number>();
      for (const row of asyncMemRows) {
        totalMemByHost.set(String(row[0]), Number(row[1]) || 0);
      }
      for (const row of memRows) {
        const host = String(row[0]);
        const tracking = Number(row[1]) || 0;
        const total = totalMemByHost.get(host);
        if (total && total > 0) {
          const percent = (tracking / total) * 100;
          maxMemPercent = Math.max(maxMemPercent, percent);
        }
      }
      categories.memory = {
        status: maxMemPercent >= 90 ? "CRITICAL" : maxMemPercent >= 80 ? "WARNING" : "OK",
        issues: maxMemPercent >= 80 ? [`Memory usage at ${maxMemPercent.toFixed(1)}%`] : [],
        metrics: { max_memory_used_percent: Number(maxMemPercent.toFixed(2)) },
      };
    } catch {
      // Skip if memory query fails
    }

    return {
      success: true,
      status_analysis_mode: "snapshot",
      scope: "cluster",
      node_count: 0,
      summary: { total_nodes: 0, healthy_nodes: 0, nodes_with_issues: 0 },
      categories,
      generated_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
