import { streamText, tool } from "ai";
import { z } from "zod";
import type { DatabaseContext } from "../../../components/chat/chat-context";
import type { EvidenceContext, EvidenceRequest } from "../common-types";
import { isMockMode, LanguageModelProviderFactory } from "../llm/llm-provider-factory";
import type { InputModel } from "./orchestrator-agent";
import { mockSqlOptimizationAgent } from "./sql-optimization-agent.mock";

/**
 * SQL Optimization Agent Input
 */
export interface SQLOptimizationAgentInput {
  relevant_chat?: Array<{ role: string; content: string }>;
  evidenceContext?: EvidenceContext;
  inputModel: InputModel;
}

/**
 * SQL Optimization Agent Output
 * Can be either an EvidenceRequest or final recommendations (markdown string)
 */
export type SQLOptimizationAgentOutput = EvidenceRequest | string;

/**
 * Server-side tool name for SQL optimization
 */
export const SERVER_TOOL_OPTIMIZE_SQL = "optimize_sql" as const;

/**
 * Server-side tool: SQL Optimization
 * Calls the SQL optimization sub-agent to analyze and optimize queries
 * @param inputModel - Model configuration to use for the sub-agent
 * @param context - Database context (user, database, tables, currentQuery) to pass to sub-agent
 */
export function createSqlOptimizationTool(inputModel: InputModel, _context?: DatabaseContext) {
  return tool({
    description:
      "Optimize ClickHouse SQL queries based on evidence. This tool analyzes query performance and provides ranked recommendations.",
    inputSchema: z.object({
      relevant_chat: z
        .array(
          z.object({
            role: z.string(),
            content: z.string(),
          })
        )
        .optional()
        .describe("Relevant conversation slice for context"),
      evidenceContext: z
        .custom<EvidenceContext>()
        .optional()
        .describe("EvidenceContext with evidence (may be empty on first call)"),
    }),
    execute: async ({ relevant_chat, evidenceContext }) => {
      const result = isMockMode
        ? await mockSqlOptimizationAgent({
            relevant_chat,
            evidenceContext,
            inputModel: inputModel,
          })
        : await sqlOptimizationAgent({
            relevant_chat,
            evidenceContext,
            inputModel: inputModel,
          });
      return result;
    },
  });
}

/**
 * SQL Optimization Agent
 *
 * Specialized agent for optimizing ClickHouse SQL queries based on evidence.
 * Follows evidence-driven workflow: requests evidence when needed, analyzes when sufficient.
 */
export async function sqlOptimizationAgent(
  input: SQLOptimizationAgentInput
): Promise<SQLOptimizationAgentOutput> {
  const { relevant_chat, evidenceContext, inputModel: modelConfig } = input;

  if (!modelConfig) {
    throw new Error("modelConfig is required for sqlOptimizationAgent");
  }

  // Use model-specific default temperature
  const temperature = LanguageModelProviderFactory.getDefaultTemperature(modelConfig.modelId);

  const systemPrompt = `SYSTEM: ClickHouse SQL Optimization Sub-Agent (Evidence-Driven)

You optimize ClickHouse SQL based on provided evidence. You do NOT call tools directly.
If evidence is insufficient, you MUST request evidence via a structured EvidenceRequest.

INPUTS YOU MAY RECEIVE:
- relevant_chat: minimal conversation slice
- EvidenceContext (may be empty):
  {
    goal, sql, query_id, symptoms, tables,
    table_schema, table_stats, explain_index, explain_pipeline, query_log,
    settings, constraints, cluster
  }

RULES:
1) Do NOT ask free-form questions to the user.
2) If missing critical evidence, output ONLY an EvidenceRequest JSON block (and nothing else).
3) Base recommendations on evidence provided; if you infer, label it as "Assumption".
4) Rank recommendations by Impact/Risk/Effort.
5) Prefer low-risk query rewrites first, then table/layout changes, then settings/ops.
6) If you propose rewritten SQL, keep it minimal and compatible with ClickHouse.

CRITICAL EVIDENCE REQUIREMENTS:
- Must have (sql OR query_id).
- Must have goal.
- Must have at least ONE of:
  - explain_index OR explain_pipeline
  - query_log summary (duration/read_rows/read_bytes/memory/error)
  - table_schema for primary table
If not met → EvidenceRequest.

EVIDENCE REQUEST FORMAT (STRICT JSON, single code block):
\`\`\`json
{
  "type": "EvidenceRequest",
  "mode": "light",
  "required": ["goal", "sql_or_query_id", "query_log", "explain"],
  "optional": ["tables", "table_schema", "table_stats", "settings", "cluster", "constraints"],
  "notes": "Prefer query_log fields: duration_ms, read_rows, read_bytes, memory_usage, result_rows, error."
}
\`\`\`

FINAL RESPONSE FORMAT (markdown):
## Findings (evidence-based)
- ...
## Recommendations (ranked)
1. **Title** (Impact: H/M/L, Risk: H/M/L, Effort: H/M/L)
   - Why (tie to evidence)
   - Change (steps)
   - Verify (what metric improves)
## Proposed SQL (optional)
\`\`\`sql
...
\`\`\``;

  try {
    // Use provided model config
    const [model] = LanguageModelProviderFactory.createModel(
      modelConfig.provider,
      modelConfig.modelId,
      modelConfig.apiKey
    );

    // Build messages from relevant_chat or create a user message
    const messages: Array<{ role: string; content: string }> = relevant_chat || [
      { role: "user", content: "Optimize this SQL query" },
    ];

    // Add evidence context to the last user message if available
    // Exclude 'tables' property as it's redundant - table_schema already contains all table information
    let userMessage = messages[messages.length - 1]?.content || "";
    if (evidenceContext) {
      const { ...evidenceContextWithoutTables } = evidenceContext;
      userMessage += `\n\nEvidenceContext:\n${JSON.stringify(evidenceContextWithoutTables, null, 2)}`;
      messages[messages.length - 1] = { ...messages[messages.length - 1]!, content: userMessage };
    }

    // Use streamText to get the response
    const result = streamText({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
      ],
      temperature,
    });

    // Wait for the complete output from the stream
    const allSteps = await result.steps;
    const lastStep = allSteps[allSteps.length - 1];
    const responseText = lastStep.text || "";

    // Check if the response is an EvidenceRequest (JSON block)
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]) as EvidenceRequest;
        if (parsed.type === "EvidenceRequest") {
          return parsed;
        }
      } catch {
        // Not valid JSON, continue to treat as markdown
      }
    }

    // Also check for JSON without code blocks
    const directJsonMatch = responseText.match(/\{[\s\S]*"type"\s*:\s*"EvidenceRequest"[\s\S]*\}/);
    if (directJsonMatch) {
      try {
        const parsed = JSON.parse(directJsonMatch[0]) as EvidenceRequest;
        if (parsed.type === "EvidenceRequest") {
          return parsed;
        }
      } catch {
        // Not valid JSON, continue to treat as markdown
      }
    }

    // Return markdown recommendations
    return responseText;
  } catch (error) {
    // Check if error is non-retryable and convert to AbortError to prevent retries
    if (
      error &&
      typeof error === "object" &&
      "isRetryable" in error &&
      error.isRetryable === false
    ) {
      console.error(
        "⚠️ Non-retryable error detected - converting to AbortError to prevent retries"
      );
      const abortError = new Error(
        `SQL optimization agent failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
      abortError.name = "AbortError";
      throw abortError;
    }

    console.error("❌ SQL optimization agent failed:", {
      error,
      evidenceContext: evidenceContext ? "provided" : "missing",
    });

    // Re-throw with additional context
    throw new Error(
      `SQL optimization agent failed: ${error instanceof Error ? error.message : String(error)}`,
      {
        cause: error,
      }
    );
  }
}
