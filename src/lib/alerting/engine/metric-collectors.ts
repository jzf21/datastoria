import type { AlertCheckCategory, AlertCondition } from "../alert-types";
import type {
  GetClusterStatusOutput,
  HealthCategorySummary,
} from "@/lib/ai/tools/client/status/collect-cluster-status";

export interface MetricEvaluationResult {
  currentValue: number | null;
  thresholdBreached: boolean;
  details: Record<string, unknown>;
}

export function extractMetricFromClusterStatus(
  output: GetClusterStatusOutput,
  category: AlertCheckCategory,
  condition: AlertCondition
): MetricEvaluationResult {
  const categorySummary = output.categories[category as keyof typeof output.categories] as
    | HealthCategorySummary
    | undefined;

  if (!categorySummary) {
    return { currentValue: null, thresholdBreached: false, details: { error: "category_not_found" } };
  }

  const metricField = condition.metric_field;
  const rawValue = categorySummary.metrics[metricField];

  if (rawValue === null || rawValue === undefined) {
    return {
      currentValue: null,
      thresholdBreached: false,
      details: {
        category,
        available_metrics: Object.keys(categorySummary.metrics),
      },
    };
  }

  const currentValue = Number(rawValue);
  if (Number.isNaN(currentValue)) {
    return {
      currentValue: null,
      thresholdBreached: false,
      details: { category, metric_field: metricField, raw_value: rawValue },
    };
  }

  const thresholdBreached = evaluateThreshold(condition, currentValue);

  return {
    currentValue,
    thresholdBreached,
    details: {
      category,
      metric_field: metricField,
      current_value: currentValue,
      threshold: condition.threshold,
      operator: condition.operator,
      category_status: categorySummary.status,
      issues: categorySummary.issues,
    },
  };
}

function evaluateThreshold(condition: AlertCondition, value: number): boolean {
  switch (condition.operator) {
    case "gt":
      return value > condition.threshold;
    case "gte":
      return value >= condition.threshold;
    case "lt":
      return value < condition.threshold;
    case "lte":
      return value <= condition.threshold;
    case "eq":
      return value === condition.threshold;
    case "neq":
      return value !== condition.threshold;
    default:
      return false;
  }
}
