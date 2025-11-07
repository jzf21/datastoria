/**
 * Dashboard tab events for event-based communication between components
 */

export interface OpenDashboardTabEventDetail {
  host: string;
  tabId?: string; // Optional tabId for multi-tab support
}

/**
 * Type-safe event listener for dashboard tab requests
 */
export type OpenDashboardTabEventHandler = (event: CustomEvent<OpenDashboardTabEventDetail>) => void;

/**
 * DashboardTabManager class for handling dashboard tab events
 */
export class DashboardTabManager {
  private static readonly OPEN_DASHBOARD_TAB_EVENT = "OPEN_DASHBOARD_TAB";

  /**
   * Emit an open dashboard tab event
   * @param host Host name
   * @param tabId Optional tab ID to target specific tab (if not provided, all tabs will handle it)
   */
  static sendOpenDashboardTabRequest(host: string, tabId?: string): void {
    const event = new CustomEvent<OpenDashboardTabEventDetail>(DashboardTabManager.OPEN_DASHBOARD_TAB_EVENT, {
      detail: { host, tabId },
    });
    window.dispatchEvent(event);
  }

  /**
   * Add a listener for open dashboard tab events
   */
  static onOpenDashboardTab(handler: OpenDashboardTabEventHandler): () => void {
    const wrappedHandler = (e: Event) => {
      handler(e as CustomEvent<OpenDashboardTabEventDetail>);
    };
    window.addEventListener(DashboardTabManager.OPEN_DASHBOARD_TAB_EVENT, wrappedHandler);
    return () =>
      window.removeEventListener(DashboardTabManager.OPEN_DASHBOARD_TAB_EVENT, wrappedHandler);
  }
}

