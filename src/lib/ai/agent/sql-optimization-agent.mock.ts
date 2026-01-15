import type { EvidenceRequest } from "../common-types";
import type {
  SQLOptimizationAgentInput,
  SQLOptimizationAgentOutput,
} from "./sql-optimization-agent";

/**
 * Mock SQL Optimization Agent
 * Returns mock responses for testing without LLM calls
 */
export async function mockSqlOptimizationAgent(
  input: SQLOptimizationAgentInput
): Promise<SQLOptimizationAgentOutput> {
  const { evidenceContext } = input;

  // If no context or missing critical evidence, return EvidenceRequest
  if (!evidenceContext || (!evidenceContext.sql && !evidenceContext.query_id)) {
    const evidenceRequest: EvidenceRequest = {
      type: "EvidenceRequest",
      mode: "light",
      required: ["goal", "sql_or_query_id", "query_log", "explain"],
      optional: ["tables", "table_schema", "table_stats", "settings"],
      notes: "Need SQL or query_id to proceed with optimization",
    };
    return evidenceRequest;
  }

  // If context is provided but missing explain/query_log/table_schema, request evidence
  if (
    !evidenceContext.explain_index &&
    !evidenceContext.explain_pipeline &&
    !evidenceContext.query_log &&
    !evidenceContext.table_schema
  ) {
    const evidenceRequest: EvidenceRequest = {
      type: "EvidenceRequest",
      mode: "light",
      required: ["query_log", "explain"],
      optional: ["table_schema", "table_stats"],
      notes: "Need query execution metrics and explain plan",
    };
    return evidenceRequest;
  }

  // Return mock recommendations
  return `## Findings (evidence-based)
- Query reads ${evidenceContext.query_log?.read_rows || "unknown"} rows
- Duration: ${evidenceContext.query_log?.duration_ms || "unknown"} ms
- Memory usage: ${evidenceContext.query_log?.memory_usage || "unknown"} bytes

## Recommendations (ranked)
1. **Add LIMIT clause** (Impact: M, Risk: L, Effort: L)
   - Why: Reduces result set size and memory usage
   - Change: Add LIMIT 1000 to the query
   - Verify: Check result_rows and memory_usage decrease

2. **Add WHERE clause filter** (Impact: H, Risk: L, Effort: M)
   - Why: Reduces scanned rows based on evidence
   - Change: Add time-based filter if applicable
   - Verify: Check read_rows decreases significantly

## Proposed SQL (optional)
\`\`\`sql
${evidenceContext.sql || "SELECT ... LIMIT 1000"}
\`\`\``;
}
