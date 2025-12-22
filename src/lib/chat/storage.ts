// Central export for chat storage
// This allows easy swapping between localStorage and IndexedDB implementations

export * from './types'
export { chatStorage, LocalStorageChatStorage } from './local-storage'

