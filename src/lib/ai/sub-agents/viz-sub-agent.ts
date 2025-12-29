import { generateObject } from "ai";
import { LanguageModelProviderFactory } from "../llm-provider-factory";
import { vizSubAgentOutputSchema, type VizSubAgentInput, type VizSubAgentOutput } from "./types";

/**
 * Visualization Sub-Agent
 *
 * Specialized sub-agent for determining appropriate visualizations
 */
export async function vizSubAgent(input: VizSubAgentInput): Promise<VizSubAgentOutput> {
  const { userQuestion, sql, modelConfig } = input;

  if (!modelConfig) {
    throw new Error("modelConfig is required for vizSubAgent");
  }

  const systemPrompt = `You are a data visualization expert. Analyze the provided ClickHouse SQL query and the original user question to determine the best visualization.

## CRITICAL: Legend Values Array
When legendOption.placement is "bottom" or "right", you MUST include a "values" array:
- Base: ["min", "max"]
- Add "sum" if SQL uses SUM() or COUNT()
- Add "avg" if SQL uses AVG()
- Add "count" if SQL uses COUNT()

Examples:
- "commits by day" → type: "line", placement: "none"
- "commits by day and author" → type: "line", placement: "bottom", values: ["min", "max", "count", "sum"]
- "query distribution by type" → type: "pie", placement: "right"

## Visualization Type Selection
**Priority: Always prefer charts over tables when data has numeric metrics.**

**"line"** - Time-based data with trends
- SQL has DateTime/Date column + GROUP BY time dimension
- User says: "line chart", "trend", "over time", "by day/hour/month"
- Use even with multiple series (e.g., "by day AND status")

**"bar"** - Time-based data comparisons  
- SQL groups by categories or discrete time periods
- User says: "bar chart", "compare", "by category", "distribution"

**"pie"** - Categorical distribution or composition
- SQL groups by a single categorical dimension (status, type, category, region, etc.)
- Shows proportions or percentages of a whole
- User says: "pie chart", "distribution", "breakdown", "composition", "proportion", "share"
- Query returns 2 columns: category name + numeric value (count/sum)
- Best for 3-15 categories (not too few, not too many)
- Examples:
  * "query distribution by type" → pie chart
  * "database size by table" → pie chart
  * "error breakdown by code" → pie chart
  * "traffic by region" → pie chart

**"table"** - Only when charts don't fit
- No numeric aggregations (SUM/COUNT/AVG)
- User explicitly asks for "table" or "list"
- More than 4-5 non-metric columns

## Legend Rules
- **Line/Bar charts**: Use "bottom" for GROUP BY with non-time dimensions, "none" for single metric
- **Pie charts**: Use "right" for many categories (>8), "bottom" for few categories (3-8), "inside" for very few (2-3)

## Pie Chart Specific Rules
When type is "pie":
- legendOption.placement: "right" | "bottom" | "inside" (no "none" for pie)
- legendOption.values: NOT NEEDED for pie charts (omit this field)
- labelOption: Configure slice labels
  * show: true (default, show labels on slices)
  * format: "name-percent" (default), "name-value", "percent", "value", or "name"
- valueFormat: Format for values in tooltips and labels
  * "short_number" (default): 1.2K, 3.4M
  * "comma_number": 1,234,567
  * "binary_size": 1.2 KB, 3.4 MB (for bytes)
  * "percentage": 25.5%

## Output Format Examples

### Line/Bar Chart:
{
  "type": "line" | "bar",
  "titleOption": {
    "title": "Descriptive chart title",
    "align": "center"
  },
  "width": 6,
  "legendOption": {
    "placement": "bottom" | "none",
    "values": ["min", "max", "sum"]  // REQUIRED when placement="bottom"
  },
  "query": { "sql": "..." }
}

### Pie Chart:
{
  "type": "pie",
  "titleOption": {
    "title": "Distribution by Category",
    "align": "center"
  },
  "width": 6,
  "legendOption": {
    "placement": "right"  // or "bottom" or "inside"
    // NO "values" field for pie charts
  },
  "labelOption": {
    "show": true,
    "format": "name-percent"  // or "name-value", "percent", "value", "name"
  },
  "valueFormat": "short_number",  // or "comma_number", "binary_size", etc.
  "query": { "sql": "..." }
}

Legend values rules (for line/bar only):
- Always include: ["min", "max"]
- SUM() or COUNT() → add "sum"
- AVG() → add "avg"
- COUNT() also needs "count" + "sum"

For timeseries, you can optionally add:
{
  "yAxis": [{ "min": 0, "minInterval": 1 }]
}
`;

  try {
    // Use provided model config
    const [model] = LanguageModelProviderFactory.createModel(
      modelConfig.provider,
      modelConfig.modelId,
      modelConfig.apiKey
    );

    const { object: validated } = await generateObject({
      model,
      schema: vizSubAgentOutputSchema,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `User question: ${userQuestion}\n\nSQL to visualize:\n${sql}` },
      ],
      temperature: 0.1,
    });

    return validated;
  } catch (error) {
    console.error("❌ Viz sub-agent execution or validation error:", error);
    return {
      type: "table",
      query: { sql },
    };
  }
}
