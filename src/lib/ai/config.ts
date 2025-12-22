/**
 * AI Assistant Configuration
 *
 * This file contains configurable settings for the AI chat feature.
 * You can modify these values to customize the AI assistant behavior.
 */

console.warn("🚨🚨🚨 AI CONFIG FILE LOADED"); // This should appear when the module loads

/**
 * The name of the AI assistant that appears in autocomplete suggestions
 * When users type '@', this name will be suggested
 *
 * Default: 'ai'
 *
 * Example: If set to 'assistant', users would type '@assistant' to trigger chat
 */
export const AI_ASSISTANT_NAME = "ai";

// Global error handler for debugging
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    console.error("🚨🚨🚨 GLOBAL ERROR CAUGHT:", event.error, {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("🚨🚨🚨 UNHANDLED PROMISE REJECTION:", event.reason);
  });
}

/**
 * The prefix pattern used to detect AI chat messages
 * Messages starting with this pattern will be routed to the chat API
 *
 * Format: `@${AI_ASSISTANT_NAME}`
 */
export function getAIChatPrefix(): string {
  return `@${AI_ASSISTANT_NAME}`;
}

/**
 * Check if a message starts with the AI chat prefix
 */
export function isAIChatMessage(message: string): boolean {
  if (!message || typeof message !== "string") {
    return false;
  }

  const prefix = getAIChatPrefix();

  const result = message.trim().toLowerCase().startsWith(prefix.toLowerCase());

  return result;
}

/**
 * Remove the AI chat prefix from a message
 * Returns the message without the prefix, trimmed
 */
export function removeAIChatPrefix(message: string): string {
  console.warn("🚨🚨🚨 removeAIChatPrefix CALLED with:", message, "type:", typeof message);

  try {
    if (!message || typeof message !== "string") {
      console.warn("🚨🚨🚨 removeAIChatPrefix: Invalid message, returning empty string");
      return "";
    }

    const prefix = getAIChatPrefix();
    const trimmed = message.trim();
    console.warn("🚨🚨🚨 removeAIChatPrefix: Processing prefix:", prefix, "trimmed:", trimmed);

    if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
      const result = trimmed.slice(prefix.length).trim();
      console.warn("🚨🚨🚨 removeAIChatPrefix result:", result);
      return result;
    }

    console.warn("🚨🚨🚨 removeAIChatPrefix: No prefix found, returning trimmed");
    return trimmed;
  } catch (error) {
    console.error("🚨🚨🚨 CRITICAL ERROR in removeAIChatPrefix:", error, { message, type: typeof message });
    throw error; // Re-throw to see the full stack trace
  }
}
