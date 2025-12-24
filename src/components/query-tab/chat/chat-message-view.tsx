import { UserProfileImage } from "@/components/user-profile-image";
import { CLIENT_TOOL_NAMES } from "@/lib/ai/client-tools";
import type { AppUIMessage, TokenUsage, ToolPart } from "@/lib/ai/common-types";
import { ColorGenerator } from "@/lib/color-generator";
import { DateTimeExtension } from "@/lib/datetime-utils";
import { Info, Sparkles } from "lucide-react";
import { memo } from "react";
import type { ChatMessage } from "../query-list-view";
import { ExecuteSqlPart } from "./execute-sql-tool-part";
import { GeneralToolPart } from "./general-tool-part";
import { GenerateSqlPart } from "./generate-sql-tool-part";
import { GenerateVisualizationPart } from "./generate-visualization-tool-part";
import { GetTableColumnsPart } from "./get-table-columns-tool-part";
import { GetTablesPart } from "./get-tables-tool-part";
import { MarkdownPart } from "./markdown-part";
import { ReasoningPart } from "./reasoning-part";
import { ValidateSqlPart } from "./validate-sql-tool-part";

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
 * Render a single message part
 */
function ChatMessagePart({ part }: { part: AppUIMessage["parts"][0] }) {
  if (part.type === "text") {
    return <MarkdownPart text={part.text} />;
  }
  if (part.type === "reasoning") {
    return <ReasoningPart part={part} />;
  }

  // Handle tool calls and responses
  let toolName: string | undefined;
  if (part.type === "dynamic-tool") {
    toolName = (part as ToolPart).toolName;
  } else if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    toolName = part.type.replace("tool-", "");
  }

  if (toolName === CLIENT_TOOL_NAMES.GENERATE_SQL) {
    return <GenerateSqlPart part={part} />;
  } else if (toolName === CLIENT_TOOL_NAMES.GENEREATE_VISUALIZATION) {
    return <GenerateVisualizationPart part={part} />;
  } else if (toolName === CLIENT_TOOL_NAMES.EXECUTE_SQL) {
    return <ExecuteSqlPart part={part} />;
  } else if (toolName === CLIENT_TOOL_NAMES.VALIDATE_SQL) {
    return <ValidateSqlPart part={part} />;
  } else if (toolName === CLIENT_TOOL_NAMES.GET_TABLE_COLUMNS) {
    return <GetTableColumnsPart part={part} />;
  } else if (toolName === CLIENT_TOOL_NAMES.GET_TABLES) {
    return <GetTablesPart part={part} />;
  } else if (toolName) {
    return <GeneralToolPart toolName={toolName} part={part} />;
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
