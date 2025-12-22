import type { Connection } from "@/lib/connection/connection";
import type { InferToolInput, InferToolOutput, InferUITools, UIDataTypes, UIMessage } from "ai";
import { tool } from "ai";
import * as z from "zod";

// SQL operators for ClickHouse
export const SQL_OPERATORS = [
  "=",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "LIKE",
  "NOT LIKE",
  "IN",
  "NOT IN",
  "IS NULL",
  "IS NOT NULL",
] as const;

export const tools = {
  get_table_columns: tool({
    description: "Use this tool if you need to get the list of columns in one or more tables. You can query multiple tables at once by providing an array of tables.",
    inputSchema: z.object({
      tablesAndSchemas: z
        .array(
          z.object({
            tableName: z.string(),
            schemaName: z.string(),
          })
        )
        .min(1)
        .describe("An array of tables to query. Can contain one or more tables."),
    }),
    outputSchema: z.array(
      z.object({
        database: z.string(),
        table: z.string(),
        type: z.string(),
        comment: z.string().nullable(),
      })
    ),
  }),
  get_tables: tool({
    description:
      "Use this tool if you need to get the list of tables in a database. Optionally filter by database name.",
    inputSchema: z.object({
      databaseName: z
        .string()
        .optional()
        .describe("The name of the database to query. If not provided, returns tables from all databases."),
    }),
    outputSchema: z.array(
      z.object({
        database: z.string(),
        table: z.string(),
        engine: z.string(),
        comment: z.string().nullable(),
      })
    ),
  }),
  execute_select_query: tool({
    description: [
      "Use this tool to select data from the database to improve your response.",
      "Do not abuse this tool, unless you are 100% sure that the data will help to answer the question.",
      "Do not select any sensitive data, like password, token, secret, card number, etc.",
      "Mask sensitive data with asterisks if need to select to answer the question.",
      "Do not use any tables and schemas that are not provided in the input.",
      'tableName and schemaName will be concatenated to "schemaName.tableName" if schemaName is provided.',
      "For tableName use only table without schema prefix.",
    ].join("\n"),
    inputSchema: z.object({
      whereConcatOperator: z.enum(["AND", "OR"]).describe("The operator to use to concatenate the where clauses"),
      whereFilters: z
        .array(
          z.object({
            column: z.string(),
            operator: z.enum(SQL_OPERATORS).describe("The operator to use in the where clause"),
            values: z
              .array(z.string())
              .describe(
                "The value to use in the where clause. If the operator does not require a value, this should be empty array."
              ),
          })
        )
        .describe("The columns to use in the where clause"),
      select: z
        .array(z.string())
        .optional()
        .describe("The columns to select. If not provided, all columns will be selected"),
      limit: z.number().describe("The number of rows to return."),
      offset: z.number().describe("The number of rows to skip"),
      orderBy: z
        .record(z.string(), z.enum(["ASC", "DESC"]))
        .optional()
        .describe("The columns to order by"),
      tableAndSchema: z
        .object({
          tableName: z.string().describe("The name of the table to query"),
          schemaName: z.string().optional().describe("The name of the schema to query (optional for ClickHouse)"),
        })
        .describe("The name of the table and schema to query"),
    }),
    outputSchema: z.any(),
  }),
};

export type AppUIMessage = UIMessage<
  {
    updatedAt?: Date;
    createdAt?: Date;
  },
  UIDataTypes,
  InferUITools<typeof tools>
>;

export function convertToAppUIMessage(message: UIMessage): AppUIMessage {
  return message as AppUIMessage;
}

/**
 * Escape single quotes in SQL strings to prevent SQL injection
 */
function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * Tool executor function type
 * Takes tool input and connection, returns tool output
 */
type ToolExecutor<TInput, TOutput> = (input: TInput, connection: Connection) => Promise<TOutput>;

/**
 * Tool registry - maps tool names to their executor functions
 */
export const toolExecutors: {
  [K in keyof typeof tools]: ToolExecutor<InferToolInput<(typeof tools)[K]>, InferToolOutput<(typeof tools)[K]>>;
} = {
  get_table_columns: async (input, connection) => {
    const { tablesAndSchemas } = input;

    // Build SQL query to get columns for multiple tables
    // Group tables by database to optimize the query
    const tablesByDatabase = new Map<string, string[]>();
    for (const { tableName, schemaName } of tablesAndSchemas) {
      const db = schemaName;
      if (!tablesByDatabase.has(db)) {
        tablesByDatabase.set(db, []);
      }
      tablesByDatabase.get(db)!.push(tableName);
    }

    // Build WHERE conditions for each database
    const conditions: string[] = [];
    for (const [database, tables] of tablesByDatabase.entries()) {
      const tableList = tables.map((t) => `'${escapeSqlString(t)}'`).join(", ");
      conditions.push(
        `(database = '${escapeSqlString(database)}' AND table IN (${tableList}))`
      );
    }

    const sql = `
SELECT 
    database, table, type, comment
FROM system.columns 
WHERE 
${conditions.join(" OR ")}
ORDER BY database, table`;

    try {
      const { response } = connection.query(sql, { default_format: "JSONCompact" });
      const apiResponse = await response;

      // Validate response structure
      // JSONCompact format returns { data: [[...], [...]] }
      if (!apiResponse.data || !Array.isArray(apiResponse.data.data)) {
        console.error("Unexpected response format from get_table_columns:", apiResponse.data);
        return [];
      }

      const data = apiResponse.data.data;
      const columns = data.map((row: unknown) => {
        const rowArray = row as unknown[];
        return {
          database: String(rowArray[0] || ""),
          table: String(rowArray[1] || ""),
          type: String(rowArray[2] || ""),
          comment: rowArray[3] ? String(rowArray[3]) : null,
        };
      });

      return columns;
    } catch (error) {
      console.error("Error executing get_table_columns tool:", error);
      return [];
    }
  },

  get_tables: async (input, connection) => {
    const { databaseName } = input;

    // Build SQL query to get tables
    let sql = `
SELECT 
  database, table, engine, comment
FROM
  system.tables
WHERE NOT startsWith(table, '.inner')`;
    if (databaseName) {
      sql += ` AND database = '${escapeSqlString(databaseName)}'`;
    }
    sql += ` ORDER BY database, table`;

    try {
      const { response } = connection.query(sql, { default_format: "JSONCompact" });
      const apiResponse = await response;

      // Validate response structure
      // JSONCompact format returns { data: [[...], [...]] }
      if (!apiResponse.data || !Array.isArray(apiResponse.data.data)) {
        console.error("Unexpected response format from get_tables:", apiResponse.data);
        return [];
      }

      const data = apiResponse.data.data;
      const tables = data.map((row: unknown) => {
        const rowArray = row as unknown[];
        return {
          database: String(rowArray[0] || ""),
          table: String(rowArray[1] || ""),
          engine: String(rowArray[2] || ""),
          comment: rowArray[3] ? String(rowArray[3]) : null,
        };
      });

      return tables;
    } catch (error) {
      console.error("Error executing get_tables tool:", error);
      return [];
    }
  },

  execute_select_query: async (input, connection) => {
    const { tableAndSchema, select, whereFilters, whereConcatOperator, orderBy, limit, offset } = input;

    // Build table name
    // Note: In ClickHouse, identifiers can contain special characters and should be escaped with backticks
    // For security, we validate that identifiers only contain safe characters (alphanumeric, underscore, dot)
    const database = tableAndSchema.schemaName || connection.runtime?.userParams?.database || "default";
    const tableName = tableAndSchema.tableName;

    // Validate identifiers contain only safe characters to prevent SQL injection
    const identifierPattern = /^[a-zA-Z0-9_.]+$/;
    if (!identifierPattern.test(String(database)) || !identifierPattern.test(tableName)) {
      throw new Error("Invalid table or database name: contains unsafe characters");
    }

    const fullTableName = database ? `${database}.${tableName}` : tableName;

    // Build SELECT clause
    const selectClause = select && select.length > 0 ? select.join(", ") : "*";

    // Build WHERE clause
    let whereClause = "";
    if (whereFilters && whereFilters.length > 0) {
      const conditions = whereFilters
        .map((filter) => {
          const { column, operator, values } = filter;

          if (operator === "IS NULL" || operator === "IS NOT NULL") {
            return `${column} ${operator}`;
          }

          if (values.length === 0) {
            return null;
          }

          if (operator === "IN" || operator === "NOT IN") {
            const valueList = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
            return `${column} ${operator} (${valueList})`;
          }

          if (operator === "LIKE" || operator === "NOT LIKE") {
            return `${column} ${operator} '${values[0]?.replace(/'/g, "''") || ""}'`;
          }

          // For other operators, use first value
          if (values.length === 1) {
            const value = values[0]?.replace(/'/g, "''") || "";
            return `${column} ${operator} '${value}'`;
          }

          // Multiple values for =, !=, >, <, etc. - use OR
          if (values.length > 1) {
            const conditions = values.map((v) => `${column} ${operator} '${v.replace(/'/g, "''")}'`);
            return `(${conditions.join(" OR ")})`;
          }

          return null;
        })
        .filter(Boolean);

      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(` ${whereConcatOperator} `)}`;
      }
    }

    // Build ORDER BY clause
    let orderByClause = "";
    if (orderBy && Object.keys(orderBy).length > 0) {
      const orderParts = Object.entries(orderBy).map(([col, dir]) => `${col} ${dir}`);
      orderByClause = `ORDER BY ${orderParts.join(", ")}`;
    }

    // Build LIMIT and OFFSET
    const limitClause = `LIMIT ${limit}`;
    const offsetClause = offset > 0 ? `OFFSET ${offset}` : "";

    // Build final SQL
    const sql = [
      `SELECT ${selectClause}`,
      `FROM ${fullTableName}`,
      whereClause,
      orderByClause,
      limitClause,
      offsetClause,
    ]
      .filter(Boolean)
      .join(" ");

    try {
      const { response } = connection.query(sql, { default_format: "JSONCompact" });
      const apiResponse = await response;

      return apiResponse.data;
    } catch (error) {
      console.error("Error executing execute_select_query tool:", error);
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
