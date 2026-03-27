import type { AlertCheckCategory, AlertCondition, AlertSeverity, PersistedAlertRule } from "@/lib/alerting/alert-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

const CATEGORIES: { value: AlertCheckCategory; label: string }[] = [
  { value: "cpu", label: "CPU" },
  { value: "memory", label: "Memory" },
  { value: "disk", label: "Disk" },
  { value: "select_queries", label: "Select Queries" },
  { value: "insert_queries", label: "Insert Queries" },
  { value: "ddl_queries", label: "DDL Queries" },
  { value: "parts", label: "Parts" },
  { value: "replication", label: "Replication" },
  { value: "merges", label: "Merges" },
  { value: "mutations", label: "Mutations" },
  { value: "errors", label: "Errors" },
  { value: "connections", label: "Connections" },
];

const OPERATORS: { value: AlertCondition["operator"]; label: string }[] = [
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" },
];

const COMMON_METRICS: Record<string, { value: string; label: string }[]> = {
  disk: [{ value: "max_disk_used_percent", label: "Max Disk Used %" }],
  memory: [{ value: "max_memory_used_percent", label: "Max Memory Used %" }],
  cpu: [{ value: "max_cpu_cores_used", label: "Max CPU Cores Used" }],
  replication: [{ value: "max_replication_lag_seconds", label: "Max Replication Lag (s)" }],
  select_queries: [
    { value: "max_p95_query_duration_ms", label: "P95 Query Duration (ms)" },
    { value: "failed_queries", label: "Failed Queries" },
  ],
  insert_queries: [
    { value: "max_p95_query_duration_ms", label: "P95 Insert Duration (ms)" },
    { value: "failed_queries", label: "Failed Inserts" },
  ],
  errors: [{ value: "failed_queries", label: "Failed Queries" }],
  parts: [{ value: "total_active_parts", label: "Total Active Parts" }],
  merges: [{ value: "max_current_merges", label: "Current Merges" }],
  mutations: [{ value: "max_current_mutations", label: "Current Mutations" }],
  connections: [{ value: "max_total_connections", label: "Total Connections" }],
  ddl_queries: [{ value: "failed_queries", label: "Failed DDL Queries" }],
};

interface AlertRuleFormProps {
  initialValues?: PersistedAlertRule;
  submitLabel?: string;
  onSubmit: (input: {
    name: string;
    description: string | null;
    category: AlertCheckCategory;
    severity: AlertSeverity;
    condition: AlertCondition;
    evaluation_interval_seconds: number;
    cooldown_seconds: number;
  }) => void;
  onCancel: () => void;
}

export function AlertRuleForm({ initialValues, submitLabel = "Create Rule", onSubmit, onCancel }: AlertRuleFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [category, setCategory] = useState<AlertCheckCategory>(initialValues?.category ?? "disk");
  const [severity, setSeverity] = useState<AlertSeverity>(initialValues?.severity ?? "WARNING");
  const [metricField, setMetricField] = useState(initialValues?.condition.metric_field ?? "max_disk_used_percent");
  const [operator, setOperator] = useState<AlertCondition["operator"]>(initialValues?.condition.operator ?? "gte");
  const [threshold, setThreshold] = useState(initialValues?.condition.threshold?.toString() ?? "");
  const [intervalSeconds, setIntervalSeconds] = useState(
    (initialValues?.evaluation_interval_seconds ?? 300).toString()
  );
  const [cooldownSeconds, setCooldownSeconds] = useState(
    (initialValues?.cooldown_seconds ?? 900).toString()
  );

  const availableMetrics = COMMON_METRICS[category] ?? [];

  const handleCategoryChange = (newCategory: AlertCheckCategory) => {
    setCategory(newCategory);
    const metrics = COMMON_METRICS[newCategory];
    if (metrics && metrics.length > 0) {
      setMetricField(metrics[0].value);
    } else {
      setMetricField("");
    }
  };

  const handleSubmit = () => {
    if (!name.trim() || !metricField || !threshold) return;

    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      category,
      severity,
      condition: {
        metric_source: "cluster_status",
        metric_field: metricField,
        operator,
        threshold: Number(threshold),
      },
      evaluation_interval_seconds: Number(intervalSeconds) || 300,
      cooldown_seconds: Number(cooldownSeconds) || 900,
    });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Alert rule name"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          className="h-8 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Category</Label>
          <select
            className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value as AlertCheckCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Severity</Label>
          <select
            className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
          >
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Metric</Label>
        <select
          className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
          value={metricField}
          onChange={(e) => setMetricField(e.target.value)}
        >
          {availableMetrics.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Operator</Label>
          <select
            className="w-full h-8 text-sm rounded-md border border-input bg-background px-2"
            value={operator}
            onChange={(e) => setOperator(e.target.value as AlertCondition["operator"])}
          >
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Threshold</Label>
          <Input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="e.g. 80"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Check interval (seconds)</Label>
          <Input
            type="number"
            value={intervalSeconds}
            onChange={(e) => setIntervalSeconds(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Cooldown (seconds)</Label>
          <Input
            type="number"
            value={cooldownSeconds}
            onChange={(e) => setCooldownSeconds(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || !threshold}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
