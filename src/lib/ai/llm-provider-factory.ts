import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { mockModel } from "./models.mock";

type ModelCreator = (modelId: string) => LanguageModel;

interface ModelConfig {
  disabled?: boolean;
  creator: ModelCreator;
}

type ModelCreatorMap = Record<string, ModelConfig>;

/**
 * Get and validate API key from environment variable
 * @param providerName - The provider name (e.g., "OpenAI", "Google", "Anthropic", "OpenRouter")
 * @param apiKey - The API key value from environment variable
 * @returns The validated API key
 * @throws Error if API key is not defined
 */
function getAndValidateApiKey(providerName: string, apiKey: string | undefined): string {
  if (!apiKey) {
    throw new Error(`${providerName} API key is required but not configured`);
  }
  return apiKey;
}

/**
 * Check if mock mode is enabled
 * Set USE_MOCK_LLM=true in your .env file to enable mock mode
 */
export const isMockMode = process.env.USE_MOCK_LLM === "true";

/**
 * Auto-select a provider model based on available API keys
 * Priority: OpenAI > Google > Anthropic > OpenRouter
 * @returns The selected model ID
 * @throws Error if no API key is configured
 */
function autoSelectProvider(): string {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;

  if (openaiApiKey) {
    return "gpt-4o";
  }
  if (googleApiKey) {
    return "gemini-2.5-pro";
  }
  if (anthropicApiKey) {
    return "claude-sonnet-4-20250514";
  }
  if (openrouterApiKey) {
    return "x-ai/grok-code-fast-1";
  }
  throw new Error(
    "No AI API key configured. Set OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY"
  );
}

/**
 * Global model creator map
 * Key: model ID
 * Value: configuration object with optional disabled flag and creator function
 */
export const modelCreator: ModelCreatorMap = {
  // OpenAI models
  "gpt-4o": {
    creator: (modelId) =>
      createOpenAI({
        apiKey: getAndValidateApiKey("OpenAI", process.env.OPENAI_API_KEY),
      }).chat(modelId),
  },
  "gpt-4o-mini": {
    creator: (modelId) =>
      createOpenAI({
        apiKey: getAndValidateApiKey("OpenAI", process.env.OPENAI_API_KEY),
      }).chat(modelId),
  },
  "gpt-4-turbo": {
    creator: (modelId) =>
      createOpenAI({
        apiKey: getAndValidateApiKey("OpenAI", process.env.OPENAI_API_KEY),
      }).chat(modelId),
  },
  "gpt-4": {
    creator: (modelId) =>
      createOpenAI({
        apiKey: getAndValidateApiKey("OpenAI", process.env.OPENAI_API_KEY),
      }).chat(modelId),
  },
  "gpt-3.5-turbo": {
    creator: (modelId) =>
      createOpenAI({
        apiKey: getAndValidateApiKey("OpenAI", process.env.OPENAI_API_KEY),
      }).chat(modelId),
  },
  "o1-preview": {
    creator: (modelId) =>
      createOpenAI({
        apiKey: getAndValidateApiKey("OpenAI", process.env.OPENAI_API_KEY),
      }).chat(modelId),
  },
  "o1-mini": {
    creator: (modelId) =>
      createOpenAI({
        apiKey: getAndValidateApiKey("OpenAI", process.env.OPENAI_API_KEY),
      }).chat(modelId),
  },
  "o3-mini": {
    creator: (modelId) =>
      createOpenAI({
        apiKey: getAndValidateApiKey("OpenAI", process.env.OPENAI_API_KEY),
      }).chat(modelId),
  },

  // Google models
  "gemini-2.5-pro": {
    creator: (modelId) =>
      createGoogleGenerativeAI({
        apiKey: getAndValidateApiKey("Google", process.env.GOOGLE_GENERATIVE_AI_API_KEY),
      }).chat(modelId),
  },
  "gemini-2.0-flash-exp": {
    creator: (modelId) =>
      createGoogleGenerativeAI({
        apiKey: getAndValidateApiKey("Google", process.env.GOOGLE_GENERATIVE_AI_API_KEY),
      }).chat(modelId),
  },
  "gemini-1.5-pro": {
    creator: (modelId) =>
      createGoogleGenerativeAI({
        apiKey: getAndValidateApiKey("Google", process.env.GOOGLE_GENERATIVE_AI_API_KEY),
      }).chat(modelId),
  },
  "gemini-1.5-flash": {
    creator: (modelId) =>
      createGoogleGenerativeAI({
        apiKey: getAndValidateApiKey("Google", process.env.GOOGLE_GENERATIVE_AI_API_KEY),
      }).chat(modelId),
  },
  "gemini-pro": {
    creator: (modelId) =>
      createGoogleGenerativeAI({
        apiKey: getAndValidateApiKey("Google", process.env.GOOGLE_GENERATIVE_AI_API_KEY),
      }).chat(modelId),
  },

  // Anthropic models
  "claude-sonnet-4-20250514": {
    creator: (modelId) =>
      createAnthropic({
        apiKey: getAndValidateApiKey("Anthropic", process.env.ANTHROPIC_API_KEY),
      }).chat(modelId),
  },
  "claude-3-5-sonnet-20241022": {
    creator: (modelId) =>
      createAnthropic({
        apiKey: getAndValidateApiKey("Anthropic", process.env.ANTHROPIC_API_KEY),
      }).chat(modelId),
  },
  "claude-3-opus-20240229": {
    creator: (modelId) =>
      createAnthropic({
        apiKey: getAndValidateApiKey("Anthropic", process.env.ANTHROPIC_API_KEY),
      }).chat(modelId),
  },
  "claude-3-sonnet-20240229": {
    creator: (modelId) =>
      createAnthropic({
        apiKey: getAndValidateApiKey("Anthropic", process.env.ANTHROPIC_API_KEY),
      }).chat(modelId),
  },
  "claude-3-haiku-20240307": {
    creator: (modelId) =>
      createAnthropic({
        apiKey: getAndValidateApiKey("Anthropic", process.env.ANTHROPIC_API_KEY),
      }).chat(modelId),
  },

  // OpenRouter models
  "x-ai/grok-code-fast-1": {
    creator: (modelId) =>
      createOpenRouter({
        apiKey: getAndValidateApiKey("OpenRouter", process.env.OPENROUTER_API_KEY),
      }).chat(modelId),
  },
};

/**
 * Language Model Provider Factory
 * Factory for creating and configuring language models from various providers
 */
export class LanguageModelProviderFactory {
  /**
   * Create a language model based on available API keys and mock mode
   *
   * Priority:
   * 1. If USE_MOCK_LLM=true, returns mock models
   * 2. If modelId is provided, uses that model with the appropriate provider
   * 3. Otherwise, returns real models based on available API keys
   *
   * @param modelId - Optional model ID to use. If not provided, will auto-select based on available API keys.
   * @returns A LanguageModel instance
   */
  static createProvider(modelId?: string): LanguageModel {
    if (isMockMode) {
      console.log("🤖 Using MOCK LLM models (no API costs)");
      return mockModel;
    }

    // Determine final modelId - use provided modelId or auto-select based on available API keys
    const finalModelId = modelId ?? autoSelectProvider();

    // Look up model in the global model creator map
    const modelConfig = modelCreator[finalModelId];
    if (!modelConfig) {
      throw new Error(`Model ${finalModelId} is not supported`);
    }

    if (modelConfig.disabled) {
      throw new Error(`Model ${finalModelId} is disabled`);
    }

    return modelConfig.creator(finalModelId);
  }
}

