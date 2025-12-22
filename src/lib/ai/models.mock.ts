import type { LanguageModel } from "ai";
import { MockLanguageModelV2, simulateReadableStream } from "ai/test";

/**
 * Creates a mock language model that simulates LLM responses without making API calls.
 * Useful for development and testing to avoid API costs.
 *
 * Uses AI SDK's built-in MockLanguageModelV2 for proper compatibility.
 */
const createMockModel = (modelName: string): LanguageModel => {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: "stop",
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      content: [
        {
          type: "text",
          text: "[MOCK RESPONSE] This is a mock response from ${modelName}. \n```sql\nSELECT version();\n```\nIn production, this would be a real AI response. You can customize this in src/lib/ai/models.mock.ts",
        },
      ],
      warnings: [],
    }),
    doStream: async () => {
      const textId = "mock-text-id";
      const mockText =
        "[MOCK] This is a streaming mock response from ${modelName}. \n```sql\nSELECT version();\n```\nThe response is simulated and doesn't make real API calls. Set USE_MOCK_LLM=false in your .env to use real providers.";

      // Split text into words for realistic streaming
      const words = mockText.split(" ");

      return {
        stream: simulateReadableStream({
          chunkDelayInMs: 50,
          initialDelayInMs: 100,
          chunks: [
            // Start text part
            { id: textId, type: "text-start" },
            // Stream text deltas
            ...words.map((word) => ({
              id: textId,
              type: "text-delta" as const,
              delta: word + " ",
            })),
            // End text part
            { id: textId, type: "text-end" },
            // Finish event
            {
              type: "finish",
              finishReason: "stop" as const,
              usage: { inputTokens: 10, outputTokens: words.length, totalTokens: 10 + words.length },
            },
          ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
};

/**
 * Mock models for different providers
 * These can be customized to return specific responses for testing
 *
 * To customize responses, modify the text content in createMockModel above
 * or add more sophisticated logic based on the prompt.
 */
export const mockOpenAIModel = createMockModel("gpt-4o");
export const mockGoogleModel = createMockModel("gemini-2.5-pro");
export const mockAnthropicModel = createMockModel("claude-sonnet-4-20250514");
