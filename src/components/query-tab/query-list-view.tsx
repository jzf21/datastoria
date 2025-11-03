import { useConnection } from "@/lib/connection/ConnectionContext";
import { toastManager } from "@/lib/toast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import { QueryExecutor, type QueryRequestEventDetail } from "./query-execution/query-executor";
import { QueryListItemView } from "./query-list-item-view";
import type { QueryRequestViewModel, QueryViewProps } from "./query-view-model";

export interface QueryListViewProps {
  tabId?: string; // Optional tab ID for multi-tab support
}

const MAX_QUERY_VIEW_LIST_SIZE = 50;

interface QueryListItem {
  queryRequest: QueryRequestViewModel;
  view: string;
  viewArgs?: {
    displayFormat?: "sql" | "text";
    formatter?: (text: string) => string;
    showRequest?: "show" | "hide" | "collapse";
    params?: Record<string, unknown>;
  };
}

export function QueryListView({ tabId }: QueryListViewProps) {
  const { selectedConnection } = useConnection();
  const [queryList, setQueryList] = useState<QueryListItem[]>([]);
  const responseScrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPlaceholderRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (scrollPlaceholderRef.current) {
      // Use requestAnimationFrame to wait for DOM to render, then scroll smoothly
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollPlaceholderRef.current) {
            scrollPlaceholderRef.current.scrollIntoView({ block: 'end', behavior: 'smooth' });
          }
        });
      });
    }
  }, []);

  const addQuery = useCallback(
    (
      sql: string,
      options?: { displayFormat?: "sql" | "text"; formatter?: (text: string) => string; view?: string },
      params?: Record<string, unknown>
    ) => {
      if (!selectedConnection) {
        toastManager.show("No connection selected", "error");
        return;
      }

      const queryId = uuid();
      const timestamp = Date.now();

      setQueryList((responseList) => {
        let newResponseList = responseList;
        if (newResponseList.length >= MAX_QUERY_VIEW_LIST_SIZE) {
          // Clear history
          newResponseList = [];
        }

        const queryRequest: QueryRequestViewModel = {
          uuid: queryId,
          sql: sql,
          rawSQL: sql,
          requestServer: "Random Host",
          queryId: queryId,
          traceId: null,
          timestamp: timestamp,
          showRequest: options?.formatter ? "hide" : "show",
          params: params,
          onCancel: () => {
            // Cancellation is now handled by the child component
          },
        };

        shouldScrollRef.current = true;
        return newResponseList.concat({
          queryRequest: queryRequest,
          viewArgs: { ...options, params },
          view: options?.view || "query",
        });
      });
    },
    [selectedConnection]
  );


  // Auto-scroll to bottom when queryList changes
  useEffect(() => {
    if (shouldScrollRef.current) {
      shouldScrollRef.current = false;
      scrollToBottom();
    }
  }, [queryList, scrollToBottom]);

  // Listen for query request events
  useEffect(() => {
    const unsubscribe = QueryExecutor.onQueryRequest((event: CustomEvent<QueryRequestEventDetail>) => {
      const { sql, options, tabId: eventTabId } = event.detail;

      // If tabId is specified, only handle events for this tab
      // If no tabId is specified in event, handle it in all tabs
      if (eventTabId !== undefined && eventTabId !== tabId) {
        return;
      }

      addQuery(sql, options, options?.params);
    });

    return unsubscribe;
  }, [tabId, addQuery]);

  const handleQueryDelete = useCallback((queryId: string) => {
    setQueryList((prevList) => prevList.filter((q) => q.queryRequest.uuid !== queryId));
  }, []);

  const queryViewProps: QueryViewProps[] = useMemo(
    () =>
      queryList.map((item) => ({
        queryRequest: item.queryRequest,
        view: item.view,
        viewArgs: item.viewArgs,
      })),
    [queryList]
  );

  return (
    <div ref={responseScrollContainerRef} className="h-full w-full overflow-auto p-2" style={{ scrollBehavior: 'smooth' }}>
      {queryViewProps.length === 0 ? (
        <div className="text-sm text-muted-foreground p-1">Input your SQL in the editor below and execute it, then the results will appear here.</div>
      ) : (
        <>
          {queryViewProps.map((query, index) => (
            <QueryListItemView 
              key={query.queryRequest.uuid} 
              {...query} 
              onQueryDelete={handleQueryDelete}
              isLast={index === queryViewProps.length - 1}
            />
          ))}
          {/* Placeholder element used for smooth scrolling to the end */}
          <div ref={scrollPlaceholderRef} />
        </>
      )}
    </div>
  );
}
