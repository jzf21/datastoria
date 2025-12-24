import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserProfileImage } from "@/components/user-profile-image";
import {
  CLIENT_TOOL_NAMES,
  type AppUIMessage,
  type TokenUsage,
  type ValidateSqlToolInput,
  type ValidateSqlToolOutput,
} from "@/lib/ai/client-tools";
import { ColorGenerator } from "@/lib/color-generator";
import { DateTimeExtension } from "@/lib/datetime-utils";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronRight, Info, Loader2, Sparkles } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PanelDescriptor, TableDescriptor, TimeseriesDescriptor } from "../shared/dashboard/dashboard-model";
import DashboardPanelTable from "../shared/dashboard/dashboard-panel-table";
import DashboardPanelTimeseries from "../shared/dashboard/dashboard-panel-timeseries";
import { Badge } from "../ui/badge";
import type { ChatMessage } from "./query-list-view";
import { SqlCodeBlock } from "./sql-code-block";

// Create a singleton instance for session colors
const sessionColorGenerator = new ColorGenerator();

/**
 * Display token usage information
 */
const TokenUsageDisplay = memo(function TokenUsageDisplay({ usage }: { usage: TokenUsage }) {
  return (
    <div className="flex gap-1 items-center mt-1 gap-1 bg-muted/30 rounded-md text-[10px] text-muted-foreground">
      <div className="flex-shrink-0 h-6 w-6 flex items-center justify-center">
        <Info className="h-3 w-3" />
      </div>
      <div className="flex items-center gap-1">
        <span className="font-medium">Total Tokens:</span>
        <span className="">{usage.totalTokens.toLocaleString()}, </span>

        <span className="font-medium">Input Tokens:</span>
        <span className="">{usage.inputTokens.toLocaleString()}, </span>

        <span className="font-medium">Output Tokens:</span>
        <span className="">{usage.outputTokens.toLocaleString()}</span>

        {usage.reasoningTokens != null && usage.reasoningTokens > 0 && (
          <>
            <span className="font-medium">| Reasoning Tokens:</span>
            <span className="">{usage.reasoningTokens.toLocaleString()}</span>
          </>
        )}

        {usage.cachedInputTokens != null && usage.cachedInputTokens > 0 && (
          <>
            <span className="font-medium">| Cached Input Tokens:</span>
            <span className="">{usage.cachedInputTokens.toLocaleString()}</span>
          </>
        )}
      </div>
    </div>
  );
});

/**
 * Render a collapsible tool section with timing tracking
 */
function CollapsibleTool({
  toolName,
  children,
  defaultExpanded = false,
  state,
}: {
  toolName: string;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
  state?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [duration, setDuration] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const prevStateRef = useRef<string | undefined>(state);

  // Track timing when state changes
  useEffect(() => {
    const prevState = prevStateRef.current;
    prevStateRef.current = state;

    // Start timing when tool becomes available (input-available means tool is running)
    if (prevState !== "input-available" && state === "input-available") {
      startTimeRef.current = Date.now();
      setDuration(null);
    }

    // Calculate duration when tool completes
    if (state === "output-available" && startTimeRef.current !== null) {
      const endTime = Date.now();
      const durationMs = endTime - startTimeRef.current;
      setDuration(durationMs);
      startTimeRef.current = null;
    }
  }, [state]);

  // Determine if tool is complete
  const isComplete = state === "output-available";

  // Get status text based on state
  const getStatusText = () => {
    if (state === "input-streaming") return "receiving input...";
    if (state === "input-available") return "running tool...";
    if (state === "output-available" && duration !== null) {
      // Format duration
      if (duration < 1000) {
        return `${duration}ms`;
      }
      return `${(duration / 1000).toFixed(2)}s`;
    }
    return null;
  };

  const statusText = getStatusText();

  return (
    <div className="flex flex-col mt-0 overflow-hidden">
      <div
        className={cn(
          "flex items-center hover:bg-muted/50 transition-colors w-fit pr-2 rounded-sm",
          isExpanded ? "bg-muted/50" : "",
          children ? "cursor-pointer" : ""
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 py-0.5 text-[10px]">
          {isComplete ? <Check className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
          <Badge className="flex items-center gap-0.5 rounded-sm border-none pl-1 pr-2 h-4 py-0 font-normal text-[10px]">
            {children && (isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
            {toolName}
          </Badge>
          {statusText && <span className="text-muted-foreground">- {statusText}</span>}
        </div>
      </div>
      {isExpanded && (
        <div className="pl-3 border-l ml-2.5 border-muted/50 transition-all">
          {isComplete ? children : "running..."}
        </div>
      )}
    </div>
  );
}

const SqlGenerateTool = memo(function SqlGenerateTool({ part }: { part: AppUIMessage["parts"][0] }) {
  const output = (part as any).output;
  const state = (part as any).state;

  return (
    <CollapsibleTool toolName={CLIENT_TOOL_NAMES.GENERATE_SQL} state={state}>
      {output?.sql && (
        <SqlCodeBlock
          code={output.sql}
          showExecuteButton={false}
          customStyle={{
            margin: 0,
            borderRadius: "0.375rem",
            fontSize: "10px",
          }}
        />
      )}
      {output?.notes && <div className="text-xs text-muted-foreground leading-relaxed px-1">{output.notes}</div>}
    </CollapsibleTool>
  );
});

const GenerateVisualizationTool = memo(function VisualizationTool({ part }: { part: AppUIMessage["parts"][0] }) {
  const panelDescriptor = (part as any).output as PanelDescriptor;
  const state = (part as any).state;
  const isComplete = state === "output-available";

  if (isComplete && (!panelDescriptor || panelDescriptor.type === "none")) return null;
  if (panelDescriptor) {
    if (panelDescriptor.titleOption === undefined) {
      // Defensive programming
      panelDescriptor.titleOption = {
        title: "",
      };
    }
    panelDescriptor.titleOption.showRefreshButton = true;
    if (panelDescriptor.height === undefined) {
      panelDescriptor.height = 300;
    }
  }

  return (
    <>
      <CollapsibleTool
        toolName={CLIENT_TOOL_NAMES.GENEREATE_VISUALIZATION}
        state={state}
        defaultExpanded={false}
      ></CollapsibleTool>
      {panelDescriptor?.type === "table" ? (
        // The height is hard coded here, and in future we can optimize it
        <div className="h-[300px]">
          <DashboardPanelTable className="mt-1" descriptor={panelDescriptor as TableDescriptor} />
        </div>
      ) : panelDescriptor?.type === "line" || panelDescriptor?.type === "bar" || panelDescriptor?.type === "area" ? (
        <div className="h-[300px]">
          <DashboardPanelTimeseries className="mt-1" descriptor={panelDescriptor as TimeseriesDescriptor} />
        </div>
      ) : null}
    </>
  );
});

const ValidateSqlTool = memo(function ValidateSqlTool({ part }: { part: AppUIMessage["parts"][0] }) {
  const input = (part as any).input as ValidateSqlToolInput;
  const output = (part as any).output as ValidateSqlToolOutput;
  const state = (part as any).state;

  return (
    <CollapsibleTool toolName={CLIENT_TOOL_NAMES.VALIDATE_SQL} state={state}>
      {input?.sql && (
        <>
          <div className="text-[10px] text-muted-foreground">input:</div>
          <SqlCodeBlock
            code={input.sql}
            showExecuteButton={false}
            customStyle={{
              margin: 0,
              borderRadius: "0.375rem",
              fontSize: "10px",
            }}
          />
        </>
      )}
      {output && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          output: {output.success ? "success" : output.error}
        </div>
      )}
    </CollapsibleTool>
  );
});

const ExecuteSqlTool = memo(function ExecuteSqlTool({ part }: { part: AppUIMessage["parts"][0] }) {
  const input = (part as any).input as { sql?: string };
  const state = (part as any).state;

  return (
    <CollapsibleTool toolName={CLIENT_TOOL_NAMES.EXECUTE_SQL} state={state}>
      {input?.sql && (
        <>
          <div className="text-[10px] text-muted-foreground">input:</div>
          <SqlCodeBlock
            code={input.sql}
            showExecuteButton={false}
            customStyle={{
              margin: 0,
              borderRadius: "0.375rem",
              fontSize: "10px",
            }}
          />
        </>
      )}
    </CollapsibleTool>
  );
});

const GetTableColumnsTool = memo(function GetTableColumnsTool({ part }: { part: AppUIMessage["parts"][0] }) {
  const state = (part as any).state;
  const input = (part as any).input;
  const output = (part as any).output;
  const inputTables = input?.tablesAndSchemas || (Array.isArray(input) ? input : null);

  return (
    <CollapsibleTool toolName={CLIENT_TOOL_NAMES.GET_TABLE_COLUMNS} state={state}>
      {inputTables && (
        <div className="mt-1">
          <div className="mb-0.5 text-[10px] text-muted-foreground">input:</div>
          <div className="border rounded-md overflow-hidden bg-background">
            <Table className="text-[11px]">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="h-7 px-2 font-bold text-muted-foreground">database</TableHead>
                  <TableHead className="h-7 px-2 font-bold text-muted-foreground">table</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inputTables.map((t: any, idx: number) => (
                  <TableRow key={idx} className="hover:bg-muted/30 border-b last:border-0">
                    <TableCell className="py-1 px-2 font-mono whitespace-nowrap">{t.database}</TableCell>
                    <TableCell className="py-1 px-2 font-mono whitespace-nowrap">{t.table}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {output && Array.isArray(output) && (
        <>
          <div className="mt-2 text-[10px] text-muted-foreground">output:</div>
          <div className="border rounded-md overflow-hidden bg-background">
            <div className="max-h-[300px] overflow-auto">
              {output.map((tableGroup: any, tableIdx: number) => (
                <div key={tableIdx} className="mb-2 last:mb-0">
                  <div className="bg-muted/50 px-2 py-1 font-mono text-[10px] font-bold border-b">
                    {tableGroup.database}.{tableGroup.table} ({tableGroup.columns?.length || 0} columns)
                  </div>
                  <Table className="text-[11px]">
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="h-7 px-2 font-bold text-muted-foreground">name</TableHead>
                        <TableHead className="h-7 px-2 font-bold text-muted-foreground">type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableGroup.columns?.map((col: any, colIdx: number) => (
                        <TableRow key={colIdx} className="hover:bg-muted/30 border-b last:border-0">
                          <TableCell className="py-1 px-2 font-mono font-medium whitespace-nowrap">
                            {col.name}
                          </TableCell>
                          <TableCell className="py-1 px-2 font-mono whitespace-nowrap">{col.type}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </CollapsibleTool>
  );
});

const GetTablesTool = memo(function GetTablesTool({ part }: { part: AppUIMessage["parts"][0] }) {
  const state = (part as any).state;
  const input = (part as any).input;
  const output = (part as any).output;

  return (
    <CollapsibleTool toolName={CLIENT_TOOL_NAMES.GET_TABLES} state={state}>
      {input && (
        <div className="mt-1">
          <div className="mb-0.5 text-[10px] text-muted-foreground">input: {input.database}</div>
        </div>
      )}
      {output && Array.isArray(output) && (
        <>
          <div className="mt-1 text-[10px] text-muted-foreground">output: {output.length} tables</div>
          <div className="border rounded-md overflow-hidden bg-background">
            <div className="max-h-[300px] overflow-auto">
              <Table className="text-[11px]">
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="h-7 px-2 font-bold text-muted-foreground">database</TableHead>
                    <TableHead className="h-7 px-2 font-bold text-muted-foreground">table</TableHead>
                    <TableHead className="h-7 px-2 font-bold text-muted-foreground">engine</TableHead>
                    <TableHead className="h-7 px-2 font-bold text-muted-foreground">comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {output.map((row: any, idx: number) => (
                    <TableRow key={idx} className="hover:bg-muted/30 border-b last:border-0">
                      <TableCell className="py-1 px-2 font-mono whitespace-nowrap">{row.database}</TableCell>
                      <TableCell className="py-1 px-2 font-mono whitespace-nowrap">{row.table}</TableCell>
                      <TableCell className="py-1 px-2 font-mono whitespace-nowrap text-muted-foreground">
                        {row.engine}
                      </TableCell>
                      <TableCell className="py-1 px-2 text-muted-foreground min-w-[100px]">
                        {row.comment || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </CollapsibleTool>
  );
});

const GeneralTool = memo(function GeneralTool({
  toolName,
  part,
}: {
  toolName: string;
  part: AppUIMessage["parts"][0];
}) {
  const state = (part as any).state;

  return (
    <CollapsibleTool toolName={toolName} state={state}>
      {(part as any).input && (
        <div className="mt-1 max-h-[300px] overflow-auto text-[10px] text-muted-foreground">
          <div className="mb-0.5">input:</div>
          <pre className="bg-muted/30 rounded p-2 overflow-x-auto shadow-sm leading-tight border border-muted/20">
            {JSON.stringify((part as any).input, null, 2)}
          </pre>
        </div>
      )}
      {(part as any).output && (
        <div className="mt-1 max-h-[300px] overflow-auto text-[10px] text-muted-foreground">
          <div className="mb-0.5">output:</div>
          <pre className="bg-muted/30 rounded p-2 overflow-x-auto shadow-sm leading-tight border border-muted/20">
            {JSON.stringify((part as any).output, null, 2)}
          </pre>
        </div>
      )}
    </CollapsibleTool>
  );
});

/**
 * Render text message with markdown support
 */
const TextMessage = memo(function TextMessage({ text }: { text: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none mt-1 text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }: React.ComponentProps<"code">) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            const isInline = !className || !className.includes("language-");

            // Use SqlCodeBlock for SQL code blocks (non-inline)
            if (!isInline && (language === "sql" || language === "")) {
              const codeString = String(children).replace(/\n$/, "");
              return (
                <SqlCodeBlock
                  code={codeString}
                  showExecuteButton={true}
                  customStyle={{
                    margin: 0,
                    borderRadius: "0.375rem",
                    fontSize: "10px",
                  }}
                />
              );
            }

            // Default inline code rendering
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          table: ({ children, ...props }) => (
            <div className="my-4 overflow-x-auto border rounded-lg">
              <table className="w-full border-collapse text-sm" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-muted/50 border-b" {...props}>
              {children}
            </thead>
          ),
          tbody: ({ children, ...props }) => (
            <tbody className="divide-y divide-border" {...props}>
              {children}
            </tbody>
          ),
          tr: ({ children, ...props }) => (
            <tr className="hover:bg-muted/30 transition-colors" {...props}>
              {children}
            </tr>
          ),
          th: ({ children, ...props }) => (
            <th className="px-4 py-2 text-left font-bold text-muted-foreground border-r last:border-r-0" {...props}>
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="px-4 py-2 border-r last:border-r-0" {...props}>
              {children}
            </td>
          ),
          h1: ({ children, ...props }) => (
            <h1 className="pt-4 pb-2" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="pt-3 pb-2" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="pt-3 pb-1.5" {...props}>
              {children}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4 className="pt-2 pb-1.5" {...props}>
              {children}
            </h4>
          ),
          h5: ({ children, ...props }) => (
            <h5 className="pt-2 pb-1" {...props}>
              {children}
            </h5>
          ),
          h6: ({ children, ...props }) => (
            <h6 className="pt-2 pb-1" {...props}>
              {children}
            </h6>
          ),
          ul: ({ children, ...props }) => (
            <ul className="list-disc my-2 pl-4" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal my-2 pl-4" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="my-1" {...props}>
              {children}
            </li>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

/**
 * Render a single message part
 */
function ChatMessagePart({ part }: { part: AppUIMessage["parts"][0] }) {
  if (part.type === "text") {
    return <TextMessage text={part.text} />;
  }
  // Handle tool calls and responses
  let toolName: string | undefined;
  if (part.type === "dynamic-tool") {
    toolName = (part as any).toolName;
  } else if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    toolName = part.type.replace("tool-", "");
  }

  if (toolName === CLIENT_TOOL_NAMES.GENERATE_SQL) {
    return <SqlGenerateTool part={part} />;
  } else if (toolName === CLIENT_TOOL_NAMES.GENEREATE_VISUALIZATION) {
    return <GenerateVisualizationTool part={part} />;
  } else if (toolName === CLIENT_TOOL_NAMES.EXECUTE_SQL) {
    return <ExecuteSqlTool part={part} />;
  } else if (toolName === CLIENT_TOOL_NAMES.VALIDATE_SQL) {
    return <ValidateSqlTool part={part} />;
  } else if (toolName === CLIENT_TOOL_NAMES.GET_TABLE_COLUMNS) {
    return <GetTableColumnsTool part={part} />;
  } else if (toolName === CLIENT_TOOL_NAMES.GET_TABLES) {
    return <GetTablesTool part={part} />;
  } else if (toolName) {
    return <GeneralTool toolName={toolName} part={part} />;
  }

  return null;
}

interface ChatMessageViewProps {
  message: ChatMessage;
  isFirst?: boolean; // Whether this is a new user request (needs top spacing)
  isLast?: boolean; // Whether this is the last message in a sequence
}
/**
 * Render a single message with session styling and visualization
 */
export const ChatMessageView = memo(function ChatMessageView({
  message,
  isFirst = false,
  isLast = false,
}: ChatMessageViewProps) {
  // Get session colors from color generator
  const sessionColor = message.sessionId ? sessionColorGenerator.getColor(message.sessionId) : null;
  const sessionStyles = sessionColor
    ? {
        borderLeftColor: sessionColor.foreground,
      }
    : {};

  const isUser = message.role === "user";

  return (
    <div className="border-l-4 transition-colors" style={sessionStyles}>
      {/* Separator for new user requests */}
      {isUser && !isFirst && (
        <div className="flex items-center h-4">
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      <div className="pl-2 py-1">
        {/* Timestamp above profile for user messages - reserve space for alignment */}
        {isUser && message.timestamp && (
          <div className="text-[10px] text-muted-foreground font-medium whitespace-nowrap pl-1">
            {DateTimeExtension.toYYYYMMddHHmmss(new Date(message.timestamp))}
          </div>
        )}

        {/* Profile and message row - aligned at top */}
        <div className="flex gap-1 items-start">
          <div className="flex-shrink-0">
            {isUser ? (
              <UserProfileImage />
            ) : (
              <div className="h-6 w-6 flex items-center justify-center">
                <Sparkles
                  className={`h-4 w-4 ${isLast && message.isLoading ? "animate-spin" : ""}`}
                  style={isLast && message.isLoading ? { animationDuration: "2s" } : undefined}
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-hidden min-w-0">
            <div className="text-sm">
              {message.parts.length === 0 && message.isLoading && "Thinking..."}
              {message.parts.length === 0 && !message.isLoading && "Nothing returned"}
              {message.parts.map((part, i) => (
                <ChatMessagePart key={i} part={part} />
              ))}
            </div>
          </div>
        </div>

        {!isUser && message.usage && !message.isLoading && <TokenUsageDisplay usage={message.usage} />}
      </div>
    </div>
  );
});
