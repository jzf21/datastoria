import { DependencyTab } from "@/components/dependency-tab/dependency-tab";
import {
  DependencyTabManager,
  type OpenDependencyTabEventDetail,
} from "@/components/dependency-tab/dependency-tab-manager";
import { QueryTab } from "@/components/query-tab/query-tab";
import { SchemaTreeView } from "@/components/schema/schema-tree-view";
import { TableTab } from "@/components/table-tab/table-tab";
import { TableTabManager, type OpenTableTabEventDetail } from "@/components/table-tab/table-tab-manager";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConnection } from "@/lib/connection/ConnectionContext";
import { createFileRoute } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

export const Route = createFileRoute("/query")({
  component: RouteComponent,
});

interface TableTabInfo {
  id: string;
  database: string;
  table: string;
  engine?: string;
}

interface DependencyTabInfo {
  id: string;
  database: string;
}

function RouteComponent() {
  const { selectedConnection } = useConnection();
  const [activeTab, setActiveTab] = useState<string>("query");
  const [tableTabs, setTableTabs] = useState<TableTabInfo[]>([]);
  const [dependencyTabs, setDependencyTabs] = useState<DependencyTabInfo[]>([]);
  const [pendingTabId, setPendingTabId] = useState<string | null>(null);
  const tabsScrollContainerRef = useRef<HTMLDivElement>(null);
  const previousConnectionRef = useRef<string | null>(null);

  // Generate a unique tab ID from database and table name
  const getTableTabId = useCallback((database: string, table: string) => {
    return `table:${database}.${table}`;
  }, []);

  // Generate a unique tab ID from database name
  const getDependencyTabId = useCallback((database: string) => {
    return `dependency:${database}`;
  }, []);

  // Handle open table tab events
  useEffect(() => {
    const handler = (event: CustomEvent<OpenTableTabEventDetail>) => {
      const { database, table, engine } = event.detail;
      const tabId = getTableTabId(database, table);

      // Update tabs and active tab in a single batch
      setTableTabs((prevTabs) => {
        const exists = prevTabs.some((t) => t.id === tabId);

        if (!exists) {
          // Set pending tab ID to activate after state update
          setPendingTabId(tabId);
          return [...prevTabs, { id: tabId, database, table, engine }];
        }
        // Tab already exists, activate it immediately
        setActiveTab(tabId);
        return prevTabs;
      });
    };

    const unsubscribe = TableTabManager.onOpenTableTab(handler);
    return unsubscribe;
  }, [getTableTabId]);

  // Handle open dependency tab events
  useEffect(() => {
    const handler = (event: CustomEvent<OpenDependencyTabEventDetail>) => {
      const { database } = event.detail;
      const tabId = getDependencyTabId(database);

      // Update tabs and active tab in a single batch
      setDependencyTabs((prevTabs) => {
        const exists = prevTabs.some((t) => t.id === tabId);

        if (!exists) {
          // Set pending tab ID to activate after state update
          setPendingTabId(tabId);
          return [...prevTabs, { id: tabId, database }];
        }
        // Tab already exists, activate it immediately
        setActiveTab(tabId);
        return prevTabs;
      });
    };

    const unsubscribe = DependencyTabManager.onOpenDependencyTab(handler);
    return unsubscribe;
  }, [getDependencyTabId]);

  // Activate pending tab after it's added to the list
  useEffect(() => {
    if (
      pendingTabId &&
      (tableTabs.some((t) => t.id === pendingTabId) || dependencyTabs.some((t) => t.id === pendingTabId))
    ) {
      setActiveTab(pendingTabId);
      setPendingTabId(null);
    }
  }, [pendingTabId, tableTabs, dependencyTabs]);

  // Scroll active tab into view
  useEffect(() => {
    if (!tabsScrollContainerRef.current) return;

    // Find the active tab trigger element
    const activeTabTrigger = tabsScrollContainerRef.current.querySelector(`[data-state="active"]`) as HTMLElement;

    if (activeTabTrigger) {
      // Scroll the active tab into view with smooth behavior
      activeTabTrigger.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeTab, tableTabs, dependencyTabs]);

  // Helper function to get the previous tab ID
  const getPreviousTabId = useCallback(
    (tabId: string, tableTabsList: TableTabInfo[], dependencyTabsList: DependencyTabInfo[]) => {
      // Check if it's a table tab
      const tableIndex = tableTabsList.findIndex((t) => t.id === tabId);
      if (tableIndex !== -1) {
        // If it's the first table tab
        if (tableIndex === 0) {
          // If there are dependency tabs, return the last one
          if (dependencyTabsList.length > 0) {
            return dependencyTabsList[dependencyTabsList.length - 1].id;
          }
          // Otherwise return query tab
          return "query";
        }
        // Otherwise return the previous table tab
        return tableTabsList[tableIndex - 1].id;
      }

      // Check if it's a dependency tab
      const dependencyIndex = dependencyTabsList.findIndex((t) => t.id === tabId);
      if (dependencyIndex !== -1) {
        // If it's the first dependency tab, return query tab
        if (dependencyIndex === 0) {
          return "query";
        }
        // Otherwise return the previous dependency tab
        return dependencyTabsList[dependencyIndex - 1].id;
      }

      // Fallback to query tab
      return "query";
    },
    []
  );

  // Handle closing a table tab
  const handleCloseTableTab = useCallback(
    (tabId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      // If the closed tab was active, find the previous tab
      if (activeTab === tabId) {
        setTableTabs((prevTabs) => {
          const newTabs = prevTabs.filter((t) => t.id !== tabId);
          const previousTabId = getPreviousTabId(tabId, prevTabs, dependencyTabs);
          setActiveTab(previousTabId);
          return newTabs;
        });
      } else {
        setTableTabs((prevTabs) => prevTabs.filter((t) => t.id !== tabId));
      }
    },
    [activeTab, dependencyTabs, getPreviousTabId]
  );

  // Handle closing a dependency tab
  const handleCloseDependencyTab = useCallback(
    (tabId: string, event: React.MouseEvent) => {
      event.stopPropagation();
      // If the closed tab was active, find the previous tab
      if (activeTab === tabId) {
        setDependencyTabs((prevTabs) => {
          const newTabs = prevTabs.filter((t) => t.id !== tabId);
          const previousTabId = getPreviousTabId(tabId, tableTabs, prevTabs);
          setActiveTab(previousTabId);
          return newTabs;
        });
      } else {
        setDependencyTabs((prevTabs) => prevTabs.filter((t) => t.id !== tabId));
      }
    },
    [activeTab, tableTabs, getPreviousTabId]
  );

  // Handle closing tabs to the right of a given tab
  const handleCloseTabsToRight = useCallback(
    (tabId: string) => {
      // If tabId is "query", close all tabs
      if (tabId === "query") {
        setTableTabs([]);
        setDependencyTabs([]);
        setActiveTab("query");
        return;
      }

      // Check if it's a table tab
      const tableIndex = tableTabs.findIndex((t) => t.id === tabId);
      if (tableIndex !== -1) {
        setTableTabs((prevTabs) => {
          const newTabs = prevTabs.slice(0, tableIndex + 1);
          const closedTabIds = prevTabs.slice(tableIndex + 1).map((t) => t.id);
          // Also close all dependency tabs if closing table tabs to the right
          setDependencyTabs([]);

          // If the active tab is in the closed tabs, switch to the clicked tab
          if (closedTabIds.includes(activeTab)) {
            setActiveTab(tabId);
          }

          return newTabs;
        });
        return;
      }

      // Check if it's a dependency tab
      const dependencyIndex = dependencyTabs.findIndex((t) => t.id === tabId);
      if (dependencyIndex !== -1) {
        setDependencyTabs((prevTabs) => {
          const newTabs = prevTabs.slice(0, dependencyIndex + 1);
          const closedTabIds = prevTabs.slice(dependencyIndex + 1).map((t) => t.id);

          // If the active tab is in the closed tabs, switch to the clicked tab
          if (closedTabIds.includes(activeTab)) {
            setActiveTab(tabId);
          }

          return newTabs;
        });
      }
    },
    [activeTab, tableTabs, dependencyTabs]
  );

  // Handle closing all tabs except the clicked one
  const handleCloseOthers = useCallback(
    (tabId: string) => {
      // If tabId is "query", close all other tabs (but keep query tab)
      if (tabId === "query") {
        setTableTabs([]);
        setDependencyTabs([]);
        setActiveTab("query");
        return;
      }

      // Check if it's a table tab
      const isTableTab = tableTabs.some((t) => t.id === tabId);
      if (isTableTab) {
        setTableTabs((prevTabs) => {
          const newTabs = prevTabs.filter((t) => t.id === tabId);
          // Close all dependency tabs
          setDependencyTabs([]);

          // If the active tab was closed, switch to the clicked tab
          if (activeTab !== tabId && !newTabs.some((t) => t.id === activeTab)) {
            setActiveTab(tabId);
          }

          return newTabs;
        });
        return;
      }

      // Check if it's a dependency tab
      const isDependencyTab = dependencyTabs.some((t) => t.id === tabId);
      if (isDependencyTab) {
        setDependencyTabs((prevTabs) => {
          const newTabs = prevTabs.filter((t) => t.id === tabId);
          // Close all table tabs
          setTableTabs([]);

          // If the active tab was closed, switch to the clicked tab
          if (activeTab !== tabId && !newTabs.some((t) => t.id === activeTab)) {
            setActiveTab(tabId);
          }

          return newTabs;
        });
      }
    },
    [activeTab, tableTabs, dependencyTabs]
  );

  // Handle closing all tabs (but keep Query tab)
  const handleCloseAll = useCallback(() => {
    setTableTabs([]);
    setDependencyTabs([]);
    // Always switch to query tab after closing all
    setActiveTab("query");
  }, []);

  // Close all tabs when connection changes
  useEffect(() => {
    const currentConnectionName = selectedConnection?.name ?? null;
    const previousConnectionName = previousConnectionRef.current;

    // Only close tabs if connection actually changed (not on initial mount)
    if (previousConnectionName !== null && previousConnectionName !== currentConnectionName) {
      handleCloseAll();
    }

    // Update the ref to track the current connection
    previousConnectionRef.current = currentConnectionName;
  }, [selectedConnection?.name, handleCloseAll]);

  return (
    <div className="h-full w-full flex min-w-0 overflow-hidden">
      <PanelGroup direction="horizontal" className="h-full w-full min-w-0">
        {/* Left Panel: Schema Tree View */}
        <Panel defaultSize={20} minSize={10} className="border-r bg-background">
          <SchemaTreeView />
        </Panel>

        <PanelResizeHandle className="w-0.5 bg-border hover:bg-border/80 transition-colors cursor-col-resize" />

        {/* Right Panel Group: Tabs for Query and Table Views */}
        <Panel defaultSize={80} minSize={50} className="bg-background">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full w-full flex flex-col">
            <div ref={tabsScrollContainerRef} className="w-full overflow-x-auto border-b bg-background h-9">
              <TabsList className="inline-flex justify-start rounded-none border-0 h-auto p-0 bg-transparent flex-nowrap">
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div className="inline-flex items-center flex-shrink-0">
                      <TabsTrigger
                        value="query"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                      >
                        Query
                      </TabsTrigger>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => handleCloseTabsToRight("query")}
                      disabled={tableTabs.length === 0 && dependencyTabs.length === 0}
                    >
                      Close to the right
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() => handleCloseOthers("query")}
                      disabled={tableTabs.length === 0 && dependencyTabs.length === 0}
                    >
                      Close others
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={handleCloseAll}
                      disabled={tableTabs.length === 0 && dependencyTabs.length === 0}
                    >
                      Close all
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
                {dependencyTabs.map((tab, index) => (
                  <ContextMenu key={tab.id}>
                    <ContextMenuTrigger asChild>
                      <div className="relative inline-flex items-center flex-shrink-0">
                        <TabsTrigger
                          value={tab.id}
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pr-8"
                        >
                          <span>Dependencies: {tab.database}</span>
                        </TabsTrigger>
                        <button
                          onClick={(e) => handleCloseDependencyTab(tab.id, e)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted z-10"
                          aria-label="Close tab"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onClick={() => {
                          if (activeTab === tab.id) {
                            setDependencyTabs((prevTabs) => {
                              const newTabs = prevTabs.filter((t) => t.id !== tab.id);
                              const previousTabId = getPreviousTabId(tab.id, tableTabs, prevTabs);
                              setActiveTab(previousTabId);
                              return newTabs;
                            });
                          } else {
                            setDependencyTabs((prevTabs) => prevTabs.filter((t) => t.id !== tab.id));
                          }
                        }}
                      >
                        Close this tab
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => handleCloseTabsToRight(tab.id)}
                        disabled={index === dependencyTabs.length - 1 && tableTabs.length === 0}
                      >
                        Close to the right
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onClick={() => handleCloseOthers(tab.id)}
                        disabled={dependencyTabs.length === 1 && tableTabs.length === 0}
                      >
                        Close others
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={handleCloseAll}
                        disabled={dependencyTabs.length === 0 && tableTabs.length === 0}
                      >
                        Close all
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
                {tableTabs.map((tab, index) => (
                  <ContextMenu key={tab.id}>
                    <ContextMenuTrigger asChild>
                      <div className="relative inline-flex items-center flex-shrink-0">
                        <TabsTrigger
                          value={tab.id}
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pr-8"
                        >
                          <span>
                            {tab.database}.{tab.table}
                          </span>
                        </TabsTrigger>
                        <button
                          onClick={(e) => handleCloseTableTab(tab.id, e)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted z-10"
                          aria-label="Close tab"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onClick={() => {
                          if (activeTab === tab.id) {
                            setTableTabs((prevTabs) => {
                              const newTabs = prevTabs.filter((t) => t.id !== tab.id);
                              const previousTabId = getPreviousTabId(tab.id, prevTabs, dependencyTabs);
                              setActiveTab(previousTabId);
                              return newTabs;
                            });
                          } else {
                            setTableTabs((prevTabs) => prevTabs.filter((t) => t.id !== tab.id));
                          }
                        }}
                      >
                        Close this tab
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => handleCloseTabsToRight(tab.id)}
                        disabled={index === tableTabs.length - 1 && dependencyTabs.length === 0}
                      >
                        Close to the right
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onClick={() => handleCloseOthers(tab.id)}
                        disabled={tableTabs.length === 1 && dependencyTabs.length === 0}
                      >
                        Close others
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={handleCloseAll}
                        disabled={tableTabs.length === 0 && dependencyTabs.length === 0}
                      >
                        Close all
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </TabsList>
            </div>
            <div className="flex-1 overflow-hidden relative">
              {/* Query Tab - Always mounted */}
              <div
                className={`h-full ${activeTab === "query" ? "block" : "hidden"}`}
                role="tabpanel"
                aria-hidden={activeTab !== "query"}
              >
                <QueryTab />
              </div>
              {/* Dependency Tabs - Always mounted */}
              {dependencyTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`h-full ${activeTab === tab.id ? "block" : "hidden"}`}
                  role="tabpanel"
                  aria-hidden={activeTab !== tab.id}
                >
                  <DependencyTab database={tab.database} />
                </div>
              ))}
              {/* Table Tabs - Always mounted */}
              {tableTabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`h-full ${activeTab === tab.id ? "block" : "hidden"}`}
                  role="tabpanel"
                  aria-hidden={activeTab !== tab.id}
                >
                  <TableTab database={tab.database} table={tab.table} engine={tab.engine} />
                </div>
              ))}
            </div>
          </Tabs>
        </Panel>
      </PanelGroup>
    </div>
  );
}
