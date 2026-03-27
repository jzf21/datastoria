export type AlertRuleType = "builtin" | "custom";
export type AlertSeverity = "WARNING" | "CRITICAL";
export type AlertStatus = "firing" | "resolved" | "acknowledged";
export type AlertCheckCategory =
  | "cpu"
  | "memory"
  | "disk"
  | "select_queries"
  | "insert_queries"
  | "ddl_queries"
  | "parts"
  | "replication"
  | "merges"
  | "mutations"
  | "errors"
  | "connections"
  | "custom_metric";
export type NotificationChannel = "in_app" | "email" | "slack" | "webhook";

export interface AlertCondition {
  metric_source: "cluster_status" | "system_metrics";
  metric_field: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
  threshold: number;
  historical_metric_type?: string;
  time_window_minutes?: number;
}

export interface PersistedAlertRule {
  id: string;
  user_id: string;
  connection_id: string | null;
  name: string;
  description: string | null;
  rule_type: AlertRuleType;
  category: AlertCheckCategory;
  severity: AlertSeverity;
  enabled: boolean;
  condition: AlertCondition;
  evaluation_interval_seconds: number;
  cooldown_seconds: number;
  channels: NotificationChannel[];
  last_evaluated_at: Date | null;
  last_fired_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PersistedAlertEvent {
  id: string;
  rule_id: string;
  user_id: string;
  connection_id: string | null;
  fingerprint: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  detail: Record<string, unknown> | null;
  fired_at: Date;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PersistedAlertNotification {
  id: string;
  event_id: string;
  user_id: string;
  channel: NotificationChannel;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAlertRuleInput {
  id: string;
  user_id: string;
  connection_id?: string | null;
  name: string;
  description?: string | null;
  rule_type: AlertRuleType;
  category: AlertCheckCategory;
  severity: AlertSeverity;
  enabled?: boolean;
  condition: AlertCondition;
  evaluation_interval_seconds?: number;
  cooldown_seconds?: number;
  channels?: NotificationChannel[];
}

export interface UpdateAlertRuleInput {
  id: string;
  user_id: string;
  name?: string;
  description?: string | null;
  severity?: AlertSeverity;
  enabled?: boolean;
  condition?: AlertCondition;
  evaluation_interval_seconds?: number;
  cooldown_seconds?: number;
  channels?: NotificationChannel[];
}

export interface CreateAlertEventInput {
  id: string;
  rule_id: string;
  user_id: string;
  connection_id?: string | null;
  fingerprint: string;
  severity: AlertSeverity;
  title: string;
  detail?: Record<string, unknown> | null;
}

export interface ListEventsOptions {
  status?: AlertStatus;
  limit?: number;
}

export interface ListNotificationsOptions {
  unreadOnly?: boolean;
  limit?: number;
}
