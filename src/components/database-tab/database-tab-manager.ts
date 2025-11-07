/**
 * Database tab events for event-based communication between components
 */

export interface OpenDatabaseTabEventDetail {
  database: string;
  tabId?: string; // Optional tabId for multi-tab support
}

/**
 * Type-safe event listener for database tab requests
 */
export type OpenDatabaseTabEventHandler = (event: CustomEvent<OpenDatabaseTabEventDetail>) => void;

/**
 * DatabaseTabManager class for handling database tab events
 */
export class DatabaseTabManager {
  private static readonly OPEN_DATABASE_TAB_EVENT = "OPEN_DATABASE_TAB";

  /**
   * Emit an open database tab event
   * @param database Database name
   * @param tabId Optional tab ID to target specific tab (if not provided, all tabs will handle it)
   */
  static sendOpenDatabaseTabRequest(database: string, tabId?: string): void {
    const event = new CustomEvent<OpenDatabaseTabEventDetail>(DatabaseTabManager.OPEN_DATABASE_TAB_EVENT, {
      detail: { database, tabId },
    });
    window.dispatchEvent(event);
  }

  /**
   * Add a listener for open database tab events
   */
  static onOpenDatabaseTab(handler: OpenDatabaseTabEventHandler): () => void {
    const wrappedHandler = (e: Event) => {
      handler(e as CustomEvent<OpenDatabaseTabEventDetail>);
    };
    window.addEventListener(DatabaseTabManager.OPEN_DATABASE_TAB_EVENT, wrappedHandler);
    return () =>
      window.removeEventListener(DatabaseTabManager.OPEN_DATABASE_TAB_EVENT, wrappedHandler);
  }
}

