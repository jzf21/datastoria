import type { AlertCheckCategory, AlertCondition, AlertSeverity } from "../alert-types";

export interface DefaultRuleTemplate {
  name: string;
  description: string;
  category: AlertCheckCategory;
  severity: AlertSeverity;
  condition: AlertCondition;
  evaluation_interval_seconds: number;
  cooldown_seconds: number;
}

/**
 * Default alert rules that are automatically created for new users.
 * Once created, they are fully editable like any other rule.
 */
export const DEFAULT_ALERT_RULES: DefaultRuleTemplate[] = [
  {
    name: "Disk Usage Critical",
    description: "Fires when any node's disk usage exceeds 90%",
    category: "disk",
    severity: "CRITICAL",
    condition: {
      metric_source: "cluster_status",
      metric_field: "max_disk_used_percent",
      operator: "gte",
      threshold: 90,
    },
    evaluation_interval_seconds: 300,
    cooldown_seconds: 1800,
  },
  {
    name: "Disk Usage Warning",
    description: "Fires when any node's disk usage exceeds 80%",
    category: "disk",
    severity: "WARNING",
    condition: {
      metric_source: "cluster_status",
      metric_field: "max_disk_used_percent",
      operator: "gte",
      threshold: 80,
    },
    evaluation_interval_seconds: 300,
    cooldown_seconds: 1800,
  },
  {
    name: "High Memory Usage",
    description: "Fires when memory usage exceeds 80%",
    category: "memory",
    severity: "WARNING",
    condition: {
      metric_source: "cluster_status",
      metric_field: "max_memory_used_percent",
      operator: "gte",
      threshold: 80,
    },
    evaluation_interval_seconds: 300,
    cooldown_seconds: 1800,
  },
  {
    name: "Replication Lag Critical",
    description: "Fires when replication lag exceeds 300 seconds",
    category: "replication",
    severity: "CRITICAL",
    condition: {
      metric_source: "cluster_status",
      metric_field: "max_replication_lag_seconds",
      operator: "gte",
      threshold: 300,
    },
    evaluation_interval_seconds: 120,
    cooldown_seconds: 900,
  },
  {
    name: "Query Failures",
    description: "Fires when more than 50 queries fail in 15 minutes",
    category: "errors",
    severity: "WARNING",
    condition: {
      metric_source: "cluster_status",
      metric_field: "failed_queries",
      operator: "gt",
      threshold: 50,
    },
    evaluation_interval_seconds: 300,
    cooldown_seconds: 900,
  },
  {
    name: "Slow Queries",
    description: "Fires when P95 select query duration exceeds 3 seconds",
    category: "select_queries",
    severity: "WARNING",
    condition: {
      metric_source: "cluster_status",
      metric_field: "max_p95_query_duration_ms",
      operator: "gte",
      threshold: 3000,
    },
    evaluation_interval_seconds: 300,
    cooldown_seconds: 900,
  },
];
