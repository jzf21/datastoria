import { escapeSqlString, type ToolExecutor } from "./client-tool-types";

type GetTableColumnsInput = {
  tablesAndSchemas: Array<{ table: string; database: string }>;
};

type GetTableColumnsOutput = Array<{
  database: string;
  table: string;
  columns: Array<{ name: string; type: string }>;
}>;

type JsonCompactResponse = {
  data: unknown[][];
};

export const getTableColumnsExecutor: ToolExecutor<
  GetTableColumnsInput,
  GetTableColumnsOutput
> = async (input, connection) => {
  const { tablesAndSchemas } = input;

  // Build SQL query to get columns for multiple tables
  // Group tables by database to optimize the query
  const tablesByDatabase = new Map<string, string[]>();
  for (const { table: tableName, database } of tablesAndSchemas) {
    if (!tablesByDatabase.has(database)) {
      tablesByDatabase.set(database, []);
    }
    tablesByDatabase.get(database)!.push(tableName);
  }

  // Build WHERE conditions for each database
  const conditions: string[] = [];
  for (const [database, tables] of tablesByDatabase.entries()) {
    const tableList = tables.map((t) => `'${escapeSqlString(t)}'`).join(", ");
    conditions.push(`(database = '${escapeSqlString(database)}' AND table IN (${tableList}))`);
  }

  const sql = `
SELECT 
    database, table, name, type
FROM system.columns 
WHERE 
${conditions.join(" OR ")}
ORDER BY database, table`;

  try {
    const { response } = connection.query(sql, { default_format: "JSONCompact" });
    const apiResponse = await response;
    const responseData = apiResponse.data.json() as JsonCompactResponse;

    // Validate response structure
    // JSONCompact format returns { data: [[...], [...]] }
    if (!responseData || !Array.isArray(responseData.data)) {
      console.error("Unexpected response format from get_table_columns:", responseData);
      return [];
    }

    const data = responseData.data;

    // Group columns by database and table
    const columnsByTable = new Map<
      string,
      { database: string; table: string; columns: Array<{ name: string; type: string }> }
    >();

    for (const row of data) {
      const rowArray = row as unknown[];
      const database = String(rowArray[0] || "");
      const table = String(rowArray[1] || "");
      const name = String(rowArray[2] || "");
      const type = String(rowArray[3] || "");

      const key = `${database}.${table}`;

      if (!columnsByTable.has(key)) {
        columnsByTable.set(key, {
          database,
          table,
          columns: [],
        });
      }

      columnsByTable.get(key)!.columns.push({ name, type });
    }

    const result = Array.from(columnsByTable.values());

    // Log the result size for monitoring
    const totalColumns = result.reduce((sum, t) => sum + t.columns.length, 0);
    console.log(
      `✅ get_table_columns returned ${result.length} table(s) with ${totalColumns} total columns`
    );

    return result;
  } catch (error) {
    console.error("Error executing get_table_columns tool:", error);
    return [];
  }
};
