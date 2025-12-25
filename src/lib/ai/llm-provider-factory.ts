import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { mockModel } from "./models.mock";

type ModelCreator = (modelId: string, apiKey: string) => LanguageModel;

interface Model {
  creator: ModelCreator;
  free?: boolean;
}

type ModelsType = Record<string, Record<string, Model>>;

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
 * @returns An object with provider name, model ID, and API key
 * @throws Error if no API key is configured
 */
function autoSelectProvider(): { provider: string; modelId: string; apiKey: string } {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;

  if (openaiApiKey) {
    return {
      provider: "OpenAI",
      modelId: "gpt-4o",
      apiKey: getAndValidateApiKey("OpenAI", openaiApiKey),
    };
  }
  if (googleApiKey) {
    return {
      provider: "Google",
      modelId: "gemini-2.5-pro",
      apiKey: getAndValidateApiKey("Google", googleApiKey),
    };
  }
  if (anthropicApiKey) {
    return {
      provider: "Anthropic",
      modelId: "claude-sonnet-4-20250514",
      apiKey: getAndValidateApiKey("Anthropic", anthropicApiKey),
    };
  }
  if (openrouterApiKey) {
    return {
      provider: "OpenRouter",
      modelId: "qwen/qwen3-coder:free",
      apiKey: getAndValidateApiKey("OpenRouter", openrouterApiKey),
    };
  }
  throw new Error(
    "No AI API key configured. Set OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY"
  );
}

/**
 * Global model creator map
 * First level key: provider name (e.g., "OpenAI", "Google", "Anthropic", "OpenRouter")
 * Second level key: model ID
 * Value: Model object containing creator function and free flag
 */
export const MODELS: ModelsType = {
  OpenAI: {
    "gpt-4o": {
      creator: (modelId, apiKey) =>
        createOpenAI({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "gpt-4o-mini": {
      creator: (modelId, apiKey) =>
        createOpenAI({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "gpt-4-turbo": {
      creator: (modelId, apiKey) =>
        createOpenAI({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "gpt-4": {
      creator: (modelId, apiKey) =>
        createOpenAI({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "gpt-3.5-turbo": {
      creator: (modelId, apiKey) =>
        createOpenAI({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "o1-preview": {
      creator: (modelId, apiKey) =>
        createOpenAI({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "o1-mini": {
      creator: (modelId, apiKey) =>
        createOpenAI({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "o3-mini": {
      creator: (modelId, apiKey) =>
        createOpenAI({
          apiKey,
        }).chat(modelId),
      free: false,
    },
  },

  Google: {
    "gemini-2.5-pro": {
      creator: (modelId, apiKey) =>
        createGoogleGenerativeAI({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "gemini-2.0-flash-exp": {
      creator: (modelId, apiKey) =>
        createGoogleGenerativeAI({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "gemini-1.5-pro": {
      creator: (modelId, apiKey) =>
        createGoogleGenerativeAI({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "gemini-1.5-flash": {
      creator: (modelId, apiKey) =>
        createGoogleGenerativeAI({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "gemini-pro": {
      creator: (modelId, apiKey) =>
        createGoogleGenerativeAI({
          apiKey,
        }).chat(modelId),
      free: false,
    },
  },

  Anthropic: {
    "claude-sonnet-4-20250514": {
      creator: (modelId, apiKey) =>
        createAnthropic({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "claude-3-5-sonnet-20241022": {
      creator: (modelId, apiKey) =>
        createAnthropic({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "claude-3-opus-20240229": {
      creator: (modelId, apiKey) =>
        createAnthropic({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "claude-3-sonnet-20240229": {
      creator: (modelId, apiKey) =>
        createAnthropic({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "claude-3-haiku-20240307": {
      creator: (modelId, apiKey) =>
        createAnthropic({
          apiKey,
        }).chat(modelId),
      free: false,
    },
  },

  OpenRouter: {
    "x-ai/grok-code-fast-1": {
      creator: (modelId, apiKey) =>
        createOpenRouter({
          apiKey,
        }).chat(modelId),
      free: false,
    },
    "qwen/qwen3-coder:free": {
      creator: (modelId, apiKey) =>
        createOpenRouter({
          apiKey,
        }).chat(modelId),
      free: true,
    },
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
   * 2. If provider, modelId, and apiKey are provided, uses those values
   * 3. Otherwise, returns real models based on available API keys (auto-select)
   *
   * @param provider - Optional provider name (e.g., "OpenAI", "Google", "Anthropic", "OpenRouter"). If not provided, will auto-select.
   * @param modelId - Optional model ID to use. If not provided, will auto-select based on available API keys.
   * @param apiKey - Optional API key to use. If not provided, will use environment variable or auto-select.
   * @returns A LanguageModel instance
   */
  static createProvider(provider?: string, modelId?: string, apiKey?: string): LanguageModel {
    if (isMockMode) {
      console.log("🤖 Using MOCK LLM models (no API costs)");
      return mockModel;
    }

    // Determine final provider, modelId, and apiKey - use provided values or auto-select
    let finalProvider: string;
    let finalModelId: string;
    let finalApiKey: string;

    if (provider && modelId && apiKey) {
      finalProvider = provider;
      finalModelId = modelId;
      finalApiKey = apiKey;
    } else {
      const autoSelected = autoSelectProvider();
      finalProvider = provider ?? autoSelected.provider;
      finalModelId = modelId ?? autoSelected.modelId;
      finalApiKey = apiKey ?? autoSelected.apiKey;
    }

    // Look up model in the global model creator map
    const providerModels = MODELS[finalProvider];
    if (!providerModels) {
      throw new Error(`Provider ${finalProvider} is not supported`);
    }

    const model = providerModels[finalModelId];
    if (!model) {
      throw new Error(`Model ${finalModelId} is not supported for provider ${finalProvider}`);
    }

    return model.creator(finalModelId, finalApiKey);
  }
}
