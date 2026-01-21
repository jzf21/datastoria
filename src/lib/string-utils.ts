import { format as formatSQL } from "sql-formatter";

export class StringUtils {
  public static isAllSpace(text: string): boolean {
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) !== 32) {
        return false;
      }
    }
    return true;
  }

  public static prettyFormatQuery(query: string): string {
    try {
      return formatSQL(query);
    } catch {
      return query;
    }
  }

  public static removeComments(sql: string): string {
    return (
      sql
        // Remove single-line comments
        .replace(/^--.*$/gm, "")
        // Remove multiline comments
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim()
    );
  }
}

/**
 * Escape single quotes in SQL strings to reduce SQL injection risk when embedding values into
 * single-quoted SQL literals.
 *
 * Note: Prefer parameterized queries when possible. When interpolating is unavoidable, this
 * follows SQL-standard escaping by doubling single quotes.
 */
export function escapeSqlString(value: string): string {
  return String(value).replaceAll("'", "''");
}

/**
 * Shorten the host name for display
 */
export function shortenHostNameForDisplay(name: string | null): string {
  if (name === null) {
    return "";
  }

  if (name.endsWith(".svc.cluster.local")) {
    return name.substring(0, name.length - ".svc.cluster.local".length);
  }

  return name;
}
