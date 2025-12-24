import type { InferUITools, UIDataTypes, UIMessage } from "ai";
import type { ClientTools } from "./client-tools";

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
};

export type AppUIMessage = UIMessage<
  {
    updatedAt?: Date;
    createdAt?: Date;
    usage?: TokenUsage;
  },
  UIDataTypes,
  InferUITools<typeof ClientTools>
> & {
  usage?: TokenUsage;
};

/**
 * Type for tool parts that have input, output, and state properties
 */
export type ToolPart = AppUIMessage["parts"][0] & {
  input?: unknown;
  output?: unknown;
  state?: string;
  toolName?: string;
};

