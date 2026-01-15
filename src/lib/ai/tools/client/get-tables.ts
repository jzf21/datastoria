import { escapeSqlString, type ToolExecutor } from "./client-tool-types";

type GetTablesInput = {
  database?: string;
};

type GetTablesOutput = Array<{
  database: string;
  table: string;
  engine: string;
  comment: string | null;
}>;

type JsonCompactResponse = {
  data: unknown[][];
};

export const getTablesExecutor: ToolExecutor<GetTablesInput, GetTablesOutput> = async (
  input,
  connection
) => {
  const { database } = input;

  // Build SQL query to get tables
  let sql = `
SELECT 
  database, table, engine, comment
FROM
  system.tables
WHERE NOT startsWith(table, '.inner')`;
  if (database) {
    sql += ` AND database = '${escapeSqlString(database)}'`;
  }
  sql += ` ORDER BY database, table`;

  try {
    const { response } = connection.query(sql, { default_format: "JSONCompact" });
    const apiResponse = await response;
    const responseData = apiResponse.data.json() as JsonCompactResponse;

    // Validate response structure
    // JSONCompact format returns { data: [[...], [...]] }
    if (!responseData || !Array.isArray(responseData.data)) {
      console.error("Unexpected response format from get_tables:", responseData);
      return [];
    }

    const data = responseData.data;
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
};
