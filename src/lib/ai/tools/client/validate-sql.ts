import { QueryError } from "@/lib/connection/connection";
import type { ToolExecutor } from "./client-tool-types";

type ValidateSqlInput = {
  sql: string;
};

type ValidateSqlOutput = {
  success: boolean;
  error?: string;
};

export const validateSqlExecutor: ToolExecutor<ValidateSqlInput, ValidateSqlOutput> = async (
  input,
  connection
) => {
  try {
    const { sql } = input;

    const { response } = connection.query("EXPLAIN SYNTAX " + sql);
    await response;

    return {
      success: true,
    };
  } catch (error) {
    if (error instanceof QueryError && (error as QueryError).data) {
      return {
        error: (error as QueryError).data,
        success: false,
      };
    }
    console.error("Error executing validate_sql tool:", error);
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      success: false,
    };
  }
};
