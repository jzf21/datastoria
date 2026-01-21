import { appLocalStorage } from "@/lib/local-storage";
import type { Chat, Message } from "../chat-message-types";
import type { ChatStorage } from "./chat-storage";

/**
 * LocalStorage-based implementation of ChatStorage for simplicity
 */
export class ChatStorageLocal implements ChatStorage {
  //
  // The chats and messages are stored separated
  //
  // All chats are stored in one object
  private readonly chatsStorage = appLocalStorage.subStorage("chats");

  // Messages are stored per chatId
  private readonly messagesStorage = appLocalStorage.subStorage("messages");

  /**
   * Get messages for a specific chat as a Map (object) keyed by message ID
   * This allows O(1) lookups instead of O(n) array searches
   */
  private getMessagesForChat(chatId: string): Record<string, Message> {
    return this.messagesStorage.getChildAsJSON<Record<string, Message>>(chatId, () => ({}));
  }

  /**
   * Save messages for a specific chat as a Map (object) keyed by message ID
   */
  private saveMessagesForChat(chatId: string, messages: Record<string, Message>): void {
    this.messagesStorage.setChildJSON(chatId, messages);
  }

  // Chat operations
  async getChat(id: string): Promise<Chat | null> {
    const chats = this.chatsStorage.getAsJSON<Record<string, Chat>>(() => ({}));
    const chat = chats[id];

    if (!chat) return null;

    // Parse dates back from JSON
    return {
      ...chat,
      createdAt: new Date(chat.createdAt),
      updatedAt: new Date(chat.updatedAt),
    };
  }

  async saveChat(chat: Chat): Promise<void> {
    const chats = this.chatsStorage.getAsJSON<Record<string, Chat>>(() => ({}));

    chats[chat.chatId] = {
      ...chat,
      updatedAt: new Date(),
    };

    this.chatsStorage.setJSON(chats);
  }

  async updateChatTitle(id: string, title: string): Promise<void> {
    const chats = this.chatsStorage.getAsJSON<Record<string, Chat>>(() => ({}));
    if (chats[id]) {
      chats[id] = {
        ...chats[id],
        title,
        updatedAt: new Date(),
      };
      this.chatsStorage.setJSON(chats);
    }
  }

  async deleteChat(id: string): Promise<void> {
    // Delete chat
    const chats = this.chatsStorage.getAsJSON<Record<string, Chat>>(() => ({}));
    delete chats[id];
    this.chatsStorage.setJSON(chats);

    // Delete all messages for this chat
    await this.clearMessages(id);
  }

  async getCharts(): Promise<Chat[]> {
    const chats = this.chatsStorage.getAsJSON<Record<string, Chat>>(() => ({}));

    return Object.values(chats)
      .map((chat) => ({
        ...chat,
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt),
      }))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getLatestChatId(): Promise<string | undefined> {
    const chats = await this.getCharts();
    return chats[0]?.chatId;
  }

  async getChatsForConnection(connectionId: string): Promise<Chat[]> {
    const allChats = await this.getCharts();
    return allChats.filter((chat) => chat.databaseId === connectionId);
  }

  async getLatestChatIdForConnection(connectionId: string): Promise<Chat | undefined> {
    const chats = await this.getChatsForConnection(connectionId);
    return chats.length > 0 ? chats[0] : undefined;
  }

  // Message operations
  async getMessages(chatId: string): Promise<Message[]> {
    const messagesMap = this.getMessagesForChat(chatId);

    // Convert object to array, parse dates, and sort by message id.
    // Message ids are UUIDv7, which are lexicographically sortable in chronological order.
    return (
      Object.values(messagesMap)
        .map((message) => ({
          ...message,
          createdAt: new Date(message.createdAt),
          updatedAt: new Date(message.updatedAt),
        }))
        // Sort by UUIDv7 id to ensure stable chronological ordering
        .sort((a, b) => a.id.localeCompare(b.id))
    );
  }

  async saveMessage(message: Message): Promise<void> {
    const chatId = message.chatId;
    const messagesMap = this.getMessagesForChat(chatId);

    const messageToSave: Message = {
      ...message,
      createdAt: message.createdAt || new Date(),
      updatedAt: new Date(),
    };

    // O(1) update or add using object property access
    messagesMap[message.id] = messageToSave;

    this.saveMessagesForChat(chatId, messagesMap);
  }

  /**
   * Save multiple messages in batch
   * Uses O(1) object property access for efficient updates
   */
  async saveMessages(chatId: string, messagesToSave: Message[]): Promise<void> {
    const messagesMap = this.getMessagesForChat(chatId);

    // O(1) updates for each message using object property access
    for (const message of messagesToSave) {
      const messageToSave: Message = {
        ...message,
        createdAt: message.createdAt || new Date(),
        updatedAt: new Date(),
      };
      messagesMap[message.id] = messageToSave;
    }

    this.saveMessagesForChat(chatId, messagesMap);
  }

  async deleteMessage(id: string): Promise<void> {
    // We need to find which chat this message belongs to
    // Since we don't have chatId, we need to search through all chats
    const chats = await this.getCharts();

    for (const chat of chats) {
      const messagesMap = this.getMessagesForChat(chat.chatId);
      if (id in messagesMap) {
        // O(1) delete using object property deletion
        delete messagesMap[id];
        if (Object.keys(messagesMap).length === 0) {
          // Remove the key if no messages left
          this.messagesStorage.removeChild(chat.chatId);
        } else {
          this.saveMessagesForChat(chat.chatId, messagesMap);
        }
        return;
      }
    }
  }

  async clearMessages(chatId: string): Promise<void> {
    this.messagesStorage.removeChild(chatId);
  }

  async clearAll(): Promise<void> {
    // Remove chats
    this.chatsStorage.remove();

    // Remove all per-chat message keys
    this.messagesStorage.clear();
  }
}
