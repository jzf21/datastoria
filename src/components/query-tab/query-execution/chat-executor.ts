/**
 * Chat execution events for event-based communication between components
 */

import { isAIChatMessage, removeAIChatPrefix } from '@/lib/ai/config';
import type { ChatRequest } from '@/lib/chat/types';

export interface ChatRequestEventDetail {
  message: string; // The user's message (without @ai prefix)
  originalMessage: string; // The full message including @ai prefix
  context?: {
    currentQuery?: string;
    database?: string;
    tables?: Array<{
      name: string;
      columns: string[];
    }>;
  };
  tabId?: string; // Optional tabId for multi-tab support
}

/**
 * Type-safe event listener for chat requests
 */
export type ChatRequestEventHandler = (event: CustomEvent<ChatRequestEventDetail>) => void;

/**
 * ChatExecutor class for handling chat execution events
 */
export class ChatExecutor {
  private static readonly CHAT_REQUEST_EVENT = 'CHAT_REQUEST';

  /**
   * Emit a chat request event
   * @param message User's message (will be checked for @ai prefix and removed)
   * @param context Optional context for the chat
   * @param tabId Optional tab ID to target specific tab
   */
  static sendChatRequest(
    message: string,
    context?: ChatRequestEventDetail['context'],
    tabId?: string
  ): void {
    try {
      console.log('🚀 ChatExecutor.sendChatRequest called:', { message, hasContext: !!context, tabId })

      // Check if this is an AI chat message
      if (!isAIChatMessage(message)) {
        console.warn('⚠️ ChatExecutor: Message does not start with AI chat prefix, ignoring:', message);
        return;
      }

      // Remove the @ai prefix
      const cleanMessage = removeAIChatPrefix(message);
      console.log('✅ ChatExecutor: Processed message:', { original: message, clean: cleanMessage })

      const event = new CustomEvent<ChatRequestEventDetail>(
        ChatExecutor.CHAT_REQUEST_EVENT,
        {
          detail: {
            message: cleanMessage,
            originalMessage: message,
            context,
            tabId
          },
        }
      );
      window.dispatchEvent(event);
      console.log('📤 ChatExecutor: Event dispatched successfully')
    } catch (error) {
      console.error('❌ Error in ChatExecutor.sendChatRequest:', error, { message, context, tabId })
    }
  }

  /**
   * Add a listener for chat request events
   */
  static onChatRequest(handler: ChatRequestEventHandler): () => void {
    const wrappedHandler = (e: Event) => {
      handler(e as CustomEvent<ChatRequestEventDetail>);
    };
    window.addEventListener(ChatExecutor.CHAT_REQUEST_EVENT, wrappedHandler);
    return () =>
      window.removeEventListener(
        ChatExecutor.CHAT_REQUEST_EVENT,
        wrappedHandler
      );
  }
}

