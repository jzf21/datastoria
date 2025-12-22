import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useConnection } from "@/lib/connection/connection-context";
import { toastManager } from "@/lib/toast";
import { useChatManager } from "@/hooks/use-chat-manager";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import { QueryExecutor, type QueryRequestEventDetail } from "./query-execution/query-executor";
import { ChatExecutor, type ChatRequestEventDetail } from "./query-execution/chat-executor";
import { QueryListItemView } from "./query-list-item-view";
import { ChatListItemView } from "./chat-list-item-view";
import type { QueryRequestViewModel, QueryViewProps } from "./query-view-model";

export interface QueryListViewProps {
  tabId?: string; // Optional tab ID for multi-tab support
  onExecutionStateChange?: (isExecuting: boolean) => void;
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

interface ChatListItem {
  chatRequest: ChatRequestEventDetail;
  id: string; // Unique ID for the chat item
  timestamp: number; // Timestamp when chat was created
}

export function QueryListView({ tabId, onExecutionStateChange }: QueryListViewProps) {
  const { connection } = useConnection();
  const [queryList, setQueryList] = useState<QueryListItem[]>([]);
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const responseScrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPlaceholderRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(false);
  const executingQueriesRef = useRef<Set<string>>(new Set());
  const executingChatsRef = useRef<Set<string>>(new Set());

  // Manage chat instances at parent level
  const chatListForManager = useMemo(
    () => chatList.map((item) => ({ id: item.id, chatRequest: item.chatRequest })),
    [chatList]
  );
  const { getChatInstance } = useChatManager(chatListForManager, connection?.url + ":" + connection?.name + ":" + connection?.user);

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
      if (!connection) {
        toastManager.show("No connection selected", "error");
        return;
      }

      const queryId = uuid();
      const timestamp = Date.now();

      // Extract original SQL for rawSQL if this is an explain query
      let rawSQL = sql;
      const view = options?.view;
      const isExplainQuery = view && view !== "query";

      if (isExplainQuery) {
        // Remove EXPLAIN prefix to get original SQL
        if (view === "pipeline") {
          // Remove "EXPLAIN pipeline graph = 1\n" or "EXPLAIN pipeline graph = 1 " prefix
          rawSQL = sql.replace(/^EXPLAIN\s+pipeline\s+graph\s*=\s*1[\s\n]+/i, "");
        } else if (view === "plan") {
          // Remove "EXPLAIN plan indexes = 1\n" or "EXPLAIN plan indexes = 1 " prefix
          rawSQL = sql.replace(/^EXPLAIN\s+plan\s+indexes\s*=\s*1[\s\n]+/i, "");
        } else {
          // Remove "EXPLAIN <type>\n" or "EXPLAIN <type> " prefix
          rawSQL = sql.replace(new RegExp(`^EXPLAIN\\s+${view}[\\s\\n]+`, "i"), "");
        }
      }

      setQueryList((responseList) => {
        let newResponseList = responseList;
        if (newResponseList.length >= MAX_QUERY_VIEW_LIST_SIZE) {
          // Clear history
          newResponseList = [];
        }

        // For explain queries, hide the request by default
        // For regular queries, hide if formatter is provided (for formatted queries)
        const showRequest = isExplainQuery
          ? "show"
          : options?.formatter
            ? "hide"
            : "show";

        const queryRequest: QueryRequestViewModel = {
          uuid: queryId,
          sql: sql,
          rawSQL: rawSQL,
          requestServer: "Random Host",
          queryId: queryId,
          traceId: null,
          timestamp: timestamp,
          showRequest: showRequest,
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
    [connection]
  );


  // Auto-scroll to bottom when queryList or chatList changes
  useEffect(() => {
    if (shouldScrollRef.current) {
      shouldScrollRef.current = false;
      scrollToBottom();
    }
  }, [queryList, chatList, scrollToBottom]);

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

  // Listen for chat request events
  useEffect(() => {
    const unsubscribe = ChatExecutor.onChatRequest((event: CustomEvent<ChatRequestEventDetail>) => {
      const { tabId: eventTabId } = event.detail;

      // If tabId is specified, only handle events for this tab
      // If no tabId is specified in event, handle it in all tabs
      if (eventTabId !== undefined && eventTabId !== tabId) {
        return;
      }

      const chatId = uuid();
      const chatTimestamp = Date.now();
      setChatList((prevList) => {
        let newList = prevList;
        if (newList.length >= MAX_QUERY_VIEW_LIST_SIZE) {
          // Clear history
          newList = [];
        }
        shouldScrollRef.current = true;
        return newList.concat({
          chatRequest: event.detail,
          id: chatId,
          timestamp: chatTimestamp,
        });
      });
    });

    return unsubscribe;
  }, [tabId]);

  const handleQueryDelete = useCallback((queryId: string) => {
    setQueryList((prevList) => prevList.filter((q) => q.queryRequest.uuid !== queryId));
  }, []);

  const handleChatDelete = useCallback((chatId: string) => {
    setChatList((prevList) => prevList.filter((c) => c.id !== chatId));
  }, []);

  const handleClearScreen = useCallback(() => {
    setQueryList([]);
    setChatList([]);
    executingQueriesRef.current.clear();
    executingChatsRef.current.clear();
    if (onExecutionStateChange) {
      onExecutionStateChange(false);
    }
  }, [onExecutionStateChange]);

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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div ref={responseScrollContainerRef} className="h-full w-full overflow-auto p-2" style={{ scrollBehavior: 'smooth' }}>
          {queryViewProps.length === 0 && chatList.length === 0 ? (
            <div className="text-sm text-muted-foreground p-1">Input your SQL in the editor below and execute it, then the results will appear here. Or type '@ai' to chat with the AI assistant.</div>
          ) : (
            <>
              {/* Render queries and chats interleaved by timestamp */}
              {[...queryViewProps.map(q => ({ type: 'query' as const, data: q, timestamp: q.queryRequest.timestamp })),
                 ...chatList.map(c => ({ type: 'chat' as const, data: c, timestamp: c.timestamp }))]
                .sort((a, b) => a.timestamp - b.timestamp)
                .map((item, index, allItems) => {
                  if (item.type === 'query') {
                    const query = item.data;
                    return (
                      <QueryListItemView 
                        key={query.queryRequest.uuid} 
                        {...query} 
                        onQueryDelete={handleQueryDelete}
                        isLast={index === allItems.length - 1}
                        onExecutionStateChange={(queryId, isExecuting) => {
                          if (isExecuting) {
                            executingQueriesRef.current.add(queryId);
                          } else {
                            executingQueriesRef.current.delete(queryId);
                          }
                          if (onExecutionStateChange) {
                            const totalExecuting = executingQueriesRef.current.size + executingChatsRef.current.size;
                            onExecutionStateChange(totalExecuting > 0);
                          }
                        }}
                      />
                    );
                  } else {
                    const chat = item.data;
                    const chatInstanceData = getChatInstance(chat.id);
                    return (
                      <ChatListItemView
                        key={chat.id}
                        chatId={chat.id}
                        chatRequest={chat.chatRequest}
                        chatInstance={chatInstanceData?.chat}
                        isLast={index === allItems.length - 1}
                        onChatDelete={handleChatDelete}
                        onExecutionStateChange={(chatId, isExecuting) => {
                          if (isExecuting) {
                            executingChatsRef.current.add(chatId);
                          } else {
                            executingChatsRef.current.delete(chatId);
                          }
                          if (onExecutionStateChange) {
                            const totalExecuting = executingQueriesRef.current.size + executingChatsRef.current.size;
                            onExecutionStateChange(totalExecuting > 0);
                          }
                        }}
                      />
                    );
                  }
                })}
              {/* Placeholder element used for smooth scrolling to the end */}
              <div ref={scrollPlaceholderRef} />
            </>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleClearScreen}>
          <Trash2 className="mr-2 h-4 w-4" />
          Clear screen
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
