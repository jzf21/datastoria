import { LocalStorage } from '@/lib/connection/LocalStorage';
import type { QueryContext } from './QueryContext';

const QUERY_CONTEXT_STORAGE_KEY = 'query-context';

class QueryContextManager {
  private static instance: QueryContextManager;
  private defaultContext: QueryContext = {
    isTracingEnabled: false,
    showRowNumber: true,
    maxResultRows: 1000,
    maxExecutionTime: 60,
  };

  public static getInstance(): QueryContextManager {
    if (!QueryContextManager.instance) {
      QueryContextManager.instance = new QueryContextManager();
    }
    return QueryContextManager.instance;
  }

  public getContext(): QueryContext {
    const stored = LocalStorage.getInstance().getAsJSON<QueryContext>(
      QUERY_CONTEXT_STORAGE_KEY,
      () => this.defaultContext
    );
    return { ...this.defaultContext, ...stored };
  }

  public setContext(context: Partial<QueryContext>): void {
    const current = this.getContext();
    const updated = { ...current, ...context };
    LocalStorage.getInstance().setJSON(QUERY_CONTEXT_STORAGE_KEY, updated);
  }

  public updateContext(updates: Partial<QueryContext>): void {
    const current = this.getContext();
    this.setContext({ ...current, ...updates });
  }
}

export { QueryContextManager };

