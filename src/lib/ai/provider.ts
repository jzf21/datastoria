import type { LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import {
  mockAnthropicModel,
  mockGoogleModel,
  mockOpenAIModel,
} from "./models.mock";

/**
 * Check if mock mode is enabled
 * Set USE_MOCK_LLM=true in your .env file to enable mock mode
 */
export const isMockMode = process.env.USE_MOCK_LLM === "true";

/**
 * Get the appropriate language model based on available API keys and mock mode
 * 
 * Priority:
 * 1. If USE_MOCK_LLM=true, returns mock models
 * 2. Otherwise, returns real models based on available API keys
 * 
 * @returns A LanguageModel instance
 */
export function getLanguageModel(): LanguageModel {
  if (isMockMode) {
    console.log("🤖 Using MOCK LLM models (no API costs)");
    
    // Check which provider would be used in production
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    
    if (openaiApiKey) {
      return mockOpenAIModel;
    }
    if (googleApiKey) {
      return mockGoogleModel;
    }
    if (anthropicApiKey) {
      return mockAnthropicModel;
    }
    
    // Default to OpenAI mock if no keys are set
    return mockOpenAIModel;
  }
  
  // Production mode - use real providers
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  
  if (openaiApiKey) {
    return openai("gpt-4o");
  }
  if (googleApiKey) {
    return google("gemini-2.5-pro");
  }
  if (anthropicApiKey) {
    return anthropic("claude-sonnet-4-20250514");
  }
  
  throw new Error(
    "No AI API key configured. Set OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or ANTHROPIC_API_KEY"
  );
}

