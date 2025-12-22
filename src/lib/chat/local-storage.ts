import type { Chat, ChatStorage, Message } from './types'

/**
 * LocalStorage-based implementation of ChatStorage
 * Phase 1: Simple localStorage implementation
 * Phase 2: Will be migrated to IndexedDB for better performance
 */
export class LocalStorageChatStorage implements ChatStorage {
  private readonly CHATS_KEY = 'clickhouse-console:chats'
  private readonly MESSAGES_KEY = 'clickhouse-console:messages'

  // Chat operations
  async getChat(id: string): Promise<Chat | null> {
    const data = localStorage.getItem(this.CHATS_KEY)
    if (!data) return null
    
    const chats = JSON.parse(data) as Record<string, Chat>
    const chat = chats[id]
    
    if (!chat) return null
    
    // Parse dates back from JSON
    return {
      ...chat,
      createdAt: new Date(chat.createdAt),
      updatedAt: new Date(chat.updatedAt),
    }
  }

  async saveChat(chat: Chat): Promise<void> {
    const data = localStorage.getItem(this.CHATS_KEY)
    const chats = data ? JSON.parse(data) : {}
    
    chats[chat.id] = {
      ...chat,
      updatedAt: new Date(),
    }
    
    localStorage.setItem(this.CHATS_KEY, JSON.stringify(chats))
  }

  async deleteChat(id: string): Promise<void> {
    // Delete chat
    const chatData = localStorage.getItem(this.CHATS_KEY)
    if (chatData) {
      const chats = JSON.parse(chatData) as Record<string, Chat>
      delete chats[id]
      localStorage.setItem(this.CHATS_KEY, JSON.stringify(chats))
    }
    
    // Delete all messages for this chat
    await this.clearMessages(id)
  }

  async listChats(): Promise<Chat[]> {
    const data = localStorage.getItem(this.CHATS_KEY)
    if (!data) return []
    
    const chats = JSON.parse(data) as Record<string, Chat>
    
    return Object.values(chats)
      .map(chat => ({
        ...chat,
        createdAt: new Date(chat.createdAt),
        updatedAt: new Date(chat.updatedAt),
      }))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  }

  // Message operations
  async getMessages(chatId: string): Promise<Message[]> {
    const data = localStorage.getItem(this.MESSAGES_KEY)
    if (!data) return []
    
    const messages = JSON.parse(data) as Record<string, Message>
    
    return Object.values(messages)
      .filter(m => m.chatId === chatId)
      .map(message => ({
        ...message,
        createdAt: new Date(message.createdAt),
        updatedAt: new Date(message.updatedAt),
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  async saveMessage(message: Message): Promise<void> {
    const data = localStorage.getItem(this.MESSAGES_KEY)
    const messages = data ? JSON.parse(data) : {}
    
    messages[message.id] = {
      ...message,
      createdAt: message.createdAt || new Date(),
      updatedAt: new Date(),
    }
    
    localStorage.setItem(this.MESSAGES_KEY, JSON.stringify(messages))
  }

  async deleteMessage(id: string): Promise<void> {
    const data = localStorage.getItem(this.MESSAGES_KEY)
    if (!data) return
    
    const messages = JSON.parse(data) as Record<string, Message>
    delete messages[id]
    
    localStorage.setItem(this.MESSAGES_KEY, JSON.stringify(messages))
  }

  async clearMessages(chatId: string): Promise<void> {
    const data = localStorage.getItem(this.MESSAGES_KEY)
    if (!data) return
    
    const messages = JSON.parse(data) as Record<string, Message>
    
    // Remove all messages for this chat
    Object.keys(messages).forEach(key => {
      if (messages[key].chatId === chatId) {
        delete messages[key]
      }
    })
    
    localStorage.setItem(this.MESSAGES_KEY, JSON.stringify(messages))
  }
}

// Export singleton instance
export const chatStorage = new LocalStorageChatStorage()

