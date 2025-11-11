import { ThemedSyntaxHighlighter } from "@/components/themed-syntax-highlighter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircleIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { QueryResponseHeaderView } from "./query-response-header-view";
import type { QueryResponseViewModel } from "./query-view-model";

interface QueryResponseViewProps {
  queryResponse: QueryResponseViewModel;
  isLoading?: boolean;
  sql?: string;
}

export interface ApiErrorResponse {
  errorMessage: string;
  data: unknown;
  httpHeaders?: Record<string, string>;
}

interface ErrorLocation {
  lineNumber: number;
  columnNumber: number;
  contextLines: Array<{ lineNum: number; content: string; isErrorLine: boolean }>;
  caretPosition: number;
}

interface ErrorLocationViewProps {
  errorLocation: ErrorLocation;
}

const ErrorLocationView = memo(function ErrorLocationView({ errorLocation }: ErrorLocationViewProps) {
  return (
    <div className="mb-3">
      <div className="my-2 font-medium">
        Error Context: Line {errorLocation.lineNumber}, Col {errorLocation.columnNumber}:
      </div>
      <div className="font-mono text-sm bg-muted/50 dark:bg-muted/30 p-3 rounded border border-yellow-400/40 dark:border-yellow-700/40">
        {errorLocation.contextLines.map((line, index) => (
          <div key={index}>
            <div className="whitespace-pre">
              <span className="text-muted-foreground mr-2 select-none">{String(line.lineNum).padStart(4, " ")} |</span>
              <span className={line.isErrorLine ? "text-destructive" : ""}>{line.content}</span>
            </div>
            {line.isErrorLine && (
              <div className="whitespace-pre text-destructive">
                <span className="text-muted-foreground mr-2 select-none">{"".padStart(4, " ")} |</span>
                <span>{" ".repeat(errorLocation.caretPosition)}^</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

export function ApiErrorView({ error, sql }: { error: ApiErrorResponse; sql?: string }) {
  const clickHouseErrorCode = error.httpHeaders?.["x-clickhouse-exception-code"];

  // Memoize detailMessage computation
  const detailMessage = useMemo(() => {
    if (typeof error.data === "object" && error.data !== null) {
      return JSON.stringify(error.data, null, 2);
    }
    if (typeof error.data === "string") {
      return error.data;
    }
    return null;
  }, [error.data]);

  /*
   * TODO: QueryId = 4199d73a-c844-42dc-9600-eecef6edb804, Check logs for this query at: http://monitor.olap.data-infra.shopee.io/v2/tracing/detail?_sidebar=collapsed&id=019a69245625d13da59307c1bd78f0ec Code: 206. DB::Exception: No alias for subquery or table function in JOIN (set joined_subquery_requires_alias=0 to disable restriction). While processing ' (SELECT * FROM system.tables AS B)'. (ALIAS_REQUIRED) (version vSClickhouse-22.3-011)
   * extract while parsing xxxxx
   */
  // Parse line and column for exception code 62 - memoized to avoid recalculation
  const errorLocation = useMemo(() => {
    if (clickHouseErrorCode !== "62" || !detailMessage || !sql) {
      return null;
    }

    // Extract line and column from pattern: (line 12, col 4)
    let match = detailMessage.match(/\(line\s+(\d+),\s*col\s+(\d+)\)/i);
    let lineNumber: number;
    let columnNumber: number;

    if (match) {
      lineNumber = parseInt(match[1], 10);
      columnNumber = parseInt(match[2], 10);
    } else {
      // Fallback: try pattern "failed at position yyy" where yyy is a number
      match = detailMessage.match(/failed at position\s+(\d+)/i);
      if (!match) {
        return null;
      }
      // For this pattern, line number is 1, column is the captured position
      lineNumber = 1;
      columnNumber = parseInt(match[1], 10);
    }

    if (isNaN(lineNumber) || isNaN(columnNumber) || lineNumber < 1 || columnNumber < 1) {
      return null;
    }

    // Get the SQL lines
    const sqlLines = sql.split("\n");
    if (lineNumber > sqlLines.length) {
      return null;
    }

    // Calculate start line (3 lines before error line, or line 1 if error is too early)
    const startLine = Math.max(1, lineNumber - 3);
    // Calculate end line (3 lines after error line, or last line if error is too late)
    const endLine = Math.min(sqlLines.length, lineNumber + 3);

    // Build context lines with line numbers
    const contextLines: Array<{ lineNum: number; content: string; isErrorLine: boolean }> = [];
    let errorLineContent = "";
    for (let i = startLine; i <= endLine; i++) {
      const lineIndex = i - 1; // Convert to 0-based index
      const lineContent = sqlLines[lineIndex] || "";
      const isErrorLine = i === lineNumber;

      // For error line, show only first 50 characters if column is smaller than 50
      let displayContent = lineContent;
      if (isErrorLine && columnNumber <= 50) {
        displayContent = lineContent.substring(0, 50);
      }

      if (isErrorLine) {
        errorLineContent = displayContent;
      }

      contextLines.push({
        lineNum: i,
        content: displayContent,
        isErrorLine,
      });
    }

    // Calculate caret position for error line - use tracked errorLineContent instead of find
    const caretPosition = Math.min(columnNumber - 1, errorLineContent.length - 1);

    return {
      lineNumber,
      columnNumber,
      contextLines,
      caretPosition,
    };
  }, [clickHouseErrorCode, detailMessage, sql]);

  const [showFullDetailMessage, setShowFullDetailMessage] = useState(false);

  // Memoize truncation logic
  const shouldTruncateDetailMessage = useMemo(
    () => errorLocation && detailMessage && detailMessage.length > 128,
    [errorLocation, detailMessage]
  );

  const displayDetailMessage = useMemo(
    () =>
      shouldTruncateDetailMessage && !showFullDetailMessage && detailMessage
        ? detailMessage.substring(0, 128)
        : detailMessage,
    [shouldTruncateDetailMessage, showFullDetailMessage, detailMessage]
  );

  return (
    <Alert variant="destructive" className="border-0 p-3 text-yellow-900 dark:text-yellow-600">
      <div className="flex items-center gap-2">
        <AlertCircleIcon />
        <AlertTitle>{error.errorMessage}</AlertTitle>
      </div>
      <AlertDescription className="mt-2">
        {clickHouseErrorCode && (
          <div className="mb-2">
            ClickHouse Exception Code: <code className=" font-mono font-semibold">{clickHouseErrorCode}</code>
          </div>
        )}
        {detailMessage && detailMessage.length > 0 && (
          <div className="whitespace-pre-wrap overflow-x-auto font-mono text-sm bg-muted/50 dark:bg-muted/30 p-3 rounded border border-yellow-400/40 dark:border-yellow-700/40">
            {displayDetailMessage}
            {shouldTruncateDetailMessage && !showFullDetailMessage && (
              <>
                {" "}
                <span
                  className="text-primary underline cursor-pointer hover:text-primary/80 font-mono inline"
                  onClick={() => setShowFullDetailMessage(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setShowFullDetailMessage(true);
                    }
                  }}
                >
                  ...
                </span>
              </>
            )}
          </div>
        )}
        {errorLocation && <ErrorLocationView errorLocation={errorLocation} />}
      </AlertDescription>
    </Alert>
  );
}

export function QueryResponseView({ queryResponse, isLoading = false, sql }: QueryResponseViewProps) {
  const [selectedTab, setSelectedTab] = useState("result");

  // Memoize error object creation
  const error: ApiErrorResponse | undefined = useMemo(
    () =>
      queryResponse.errorMessage === null
        ? undefined
        : {
            errorMessage: queryResponse.errorMessage as string,
            data: queryResponse.data,
            httpHeaders: queryResponse.httpHeaders,
          },
    [queryResponse.errorMessage, queryResponse.data, queryResponse.httpHeaders]
  );

  // Memoize response text computation
  const responseText = useMemo(
    () => (typeof queryResponse.data === "string" ? queryResponse.data : JSON.stringify(queryResponse.data, null, 2)),
    [queryResponse.data]
  );

  // Memoize formatted response
  const rawQueryResponse = useMemo(
    () => (queryResponse.formatter ? queryResponse.formatter(responseText) : responseText),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryResponse.formatter, responseText]
  );

  // Memoize response rendering
  const renderResponse = useMemo(() => {
    if (rawQueryResponse.length === 0) {
      return (
        <div className="p-4 text-sm text-muted-foreground">
          Query was executed successfully. No data is returned to show.
        </div>
      );
    }

    if (queryResponse.displayFormat === "sql") {
      return (
        <ThemedSyntaxHighlighter
          customStyle={{ fontSize: "14px", margin: 0, padding: "1rem" }}
          language="sql"
          showLineNumbers={true}
        >
          {rawQueryResponse}
        </ThemedSyntaxHighlighter>
      );
    } else {
      return <pre className="text-sm">{rawQueryResponse}</pre>;
    }
  }, [rawQueryResponse, queryResponse.displayFormat]);

  if (isLoading) {
    return (
      <div className="h-full w-full overflow-auto p-4 flex flex-col items-center justify-center">
        <div className="text-sm text-muted-foreground">Executing query...</div>
      </div>
    );
  }

  return (
    <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mt-2">
      <div className="w-full border-b bg-background">
        <TabsList className="inline-flex min-w-full justify-start rounded-none border-0 h-auto p-0 bg-transparent flex-nowrap">
          <TabsTrigger
            value="result"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Result
          </TabsTrigger>
          {queryResponse.httpHeaders && (
            <TabsTrigger
              value="headers"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Response Headers
            </TabsTrigger>
          )}
        </TabsList>
      </div>

      {error && (
        <TabsContent value="result">
          <ApiErrorView error={error} sql={sql} />
        </TabsContent>
      )}

      {!error && (
        <TabsContent value="result" className="overflow-auto">
          <div className="relative">{renderResponse}</div>
        </TabsContent>
      )}

      {queryResponse.httpHeaders && (
        <TabsContent value="headers" className="overflow-auto">
          <QueryResponseHeaderView headers={queryResponse.httpHeaders} />
        </TabsContent>
      )}
    </Tabs>
  );
}
