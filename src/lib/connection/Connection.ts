import type { ConnectionConfig } from "./connection-config";

// Re-export ConnectionConfig for convenience
export type { ConnectionConfig };

export class QueryError extends Error {
  httpStatus?: number;
  httpHeaders?: any;
  data: any;

  constructor(message: string, httpStatus?: number, httpHeaders?: any, data?: any) {
    super(message);
    this.name = "QueryError";
    this.httpStatus = httpStatus;
    this.httpHeaders = httpHeaders;
    this.data = data;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (typeof (Error as any).captureStackTrace === "function") {
      (Error as any).captureStackTrace(this, QueryError);
    }
  }
}

export interface QueryResponse {
  httpStatus: number;
  httpHeaders: any;
  data: any;
}

export interface Session {
  targetNode?: string;
  internalUser: string;
  timezone: string;
  function_table_has_description_column?: boolean;
}

export class Connection {
  // Static config
  readonly name: string;
  readonly url: string;
  readonly user: string;
  readonly password?: string;
  readonly cluster?: string;

  // Runtime properties
  readonly host: string;
  readonly path: string;
  readonly userParams: Record<string, unknown>;

  // Session information
  session: Session;

  private constructor(config: ConnectionConfig) {
    this.name = config.name;
    this.url = config.url;
    this.user = config.user;
    this.password = config.password;
    this.cluster = config.cluster;

    const urlObj = new URL(config.url);
    this.host = urlObj.origin;
    this.path = urlObj.pathname === "" ? "/" : urlObj.pathname;

    this.userParams = {};
    urlObj.searchParams.forEach((val, key) => {
      this.userParams[key] = val;
    });

    if (this.userParams["max_execution_time"] !== undefined) {
      const maxExecTime = this.userParams["max_execution_time"];
      if (typeof maxExecTime === "string") {
        this.userParams["max_execution_time"] = parseInt(maxExecTime, 10);
      }
    }

    // Initialize session with defaults
    this.session = {
      internalUser: config.user, // Default to external configured user
      timezone: "UTC", // Default timezone
      function_table_has_description_column: false,
    };
  }

  static create(config: ConnectionConfig): Connection {
    return new Connection(config);
  }

  public query(
    sql: string,
    params?: Record<string, unknown>,
    headers?: Record<string, string>
  ): { response: Promise<QueryResponse>; abortController: AbortController } {
    const requestHeaders: Record<string, string> = headers || {};

    // Set default ClickHouse headers if not provided
    if (!requestHeaders["Content-Type"]) {
      requestHeaders["Content-Type"] = "text/plain";
    }

    // Merge user params with request params (request params take precedence)
    const requestParams: Record<string, unknown> = Object.assign({}, this.userParams);
    if (params) {
      Object.assign(requestParams, params);
    }
    // Add default format if not specified
    if (!requestParams["default_format"]) {
      requestParams["default_format"] = "JSONCompact";
    }

    const maxExecutionTime = requestParams["max_execution_time"];
    const timeout = (typeof maxExecutionTime === "number" ? maxExecutionTime : 60) * 1000;

    // Build URL with query parameters
    const url = new URL(this.path, this.host);
    Object.entries(requestParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    // Build Basic Auth header
    const basicAuth = btoa(`${this.user}:${this.password || ""}`);
    requestHeaders["Authorization"] = `Basic ${basicAuth}`;

    // Create abort controller for the caller to use
    const abortController = new AbortController();

    // Create timeout controller
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, timeout);

    // Combine abort signals - create a combined controller
    const combined = new AbortController();
    abortController.signal.addEventListener("abort", () => combined.abort());
    timeoutController.signal.addEventListener("abort", () => combined.abort());

    const response = (async (): Promise<QueryResponse> => {
      try {
        const response = await fetch(url.toString(), {
          method: "POST",
          headers: requestHeaders,
          body: sql,
          signal: combined.signal,
        });

        clearTimeout(timeoutId);

        // Read response body as text first (can only be read once)
        const responseText = await response.text();

        if (!response.ok) {
          throw new QueryError(
            `Error executing query, got HTTP status ${response.status} ${response.statusText} from server`,
            response.status,
            Object.fromEntries(response.headers.entries()),
            responseText
          );
        }

        // Check Content-Type header to determine if response is JSON
        const contentType = response.headers.get("content-type") || "";
        const isJson =
          contentType.toLowerCase().includes("application/json") || contentType.toLowerCase().includes("text/json");

        // Parse as JSON if Content-Type indicates JSON, otherwise use text
        let data: unknown;
        if (isJson) {
          try {
            data = JSON.parse(responseText);
          } catch {
            // If JSON parsing fails, fallback to text
            data = responseText;
          }
        } else {
          data = responseText;
        }

        return {
          httpStatus: response.status,
          httpHeaders: Object.fromEntries(response.headers.entries()),
          data: data,
        };
      } catch (error: unknown) {
        clearTimeout(timeoutId);

        // If it's already an QueryError, re-throw it
        if (error instanceof QueryError) {
          throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
          if (timeoutController.signal.aborted) {
            throw new QueryError(`${timeout / 1000}s timeout to wait for response from ClickHouse server.`);
          }
          throw new QueryError(error.message || "Request aborted");
        }

        // Re-throw as QueryError-like error
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        if (errorMessage === "Failed to fetch") {
          throw new QueryError(
            "Failed to connect to the server. Please check the server URL and network connection."
          );
        }
        throw new QueryError(errorMessage);
      }
    })();

    return { response, abortController };
  }

  public queryOnNode(
    sql: string,
    params?: Record<string, unknown>,
    headers?: Record<string, string>
  ): { response: Promise<QueryResponse>; abortController: AbortController } {
    const node = this.session.targetNode;

    if (node === undefined) {
      return this.query(sql, params, headers);
    }

    if (this.cluster && this.cluster.length > 0 && sql.includes("{cluster}")) {
      // Do replacement
      sql = sql.replaceAll("{cluster}", this.cluster);

      // Since cluster/clusterAllReplica is used, don't use remote function to execute this sql
      return this.query(sql, params, headers);
    }

    return this.query(
      `
SELECT * FROM remote(
  '${node}', 
  view(
        ${sql}
  ), 
  '${this.session.internalUser}', 
  '${this.password}')`,
      params,
      headers
    );
  }
}
