import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { DataSampleView, type DataSampleViewRef } from "./data-sample-view";
import { PartitionSizeView, type PartitionSizeViewRef } from "./partition-view";
import { TableMetadataView, type TableMetadataViewRef } from "./table-metadata-view";
import { TableSizeView, type TableSizeViewRef } from "./table-size-view";

export interface TableTabProps {
  database: string;
  table: string;
  engine?: string;
  tabId?: string;
}

// Map of engine types to their available tabs
const ENGINE_TABS_MAP = new Map<string, Set<string>>([
  ["MaterializedView", new Set(["metadata", "table-size", "partitions"])],
  ["Kafka", new Set(["metadata"])],
  ["URL", new Set(["metadata"])],
  ["Distributed", new Set(["data-sample", "metadata", "query-log"])],
  // Default: all tabs available
]);

export function TableTab({ database, table, engine }: TableTabProps) {
  // Hide Table Size and Partitions tabs if engine starts with "System"
  const isSystemTable = (engine?.startsWith("System") || engine?.startsWith("MySQL")) ?? false;

  // Get available tabs for this engine, or default to all tabs
  const baseAvailableTabs = engine
    ? (ENGINE_TABS_MAP.get(engine) ??
      new Set(["data-sample", "metadata", "table-size", "partitions", "query-log", "part-log"]))
    : new Set(["data-sample", "metadata", "table-size", "partitions", "query-log", "part-log"]);

  // Remove table-size and partitions for System tables
  const availableTabs = isSystemTable
    ? new Set([...baseAvailableTabs].filter((tab) => tab !== "data-sample" && tab !== "table-size" && tab !== "partitions"))
    : baseAvailableTabs;

  const [currentTab, setCurrentTab] = useState<string>(availableTabs.has("data-sample") ? "data-sample" : "metadata");

  // Refs for each tab view
  const dataSampleRef = useRef<DataSampleViewRef>(null);
  const metadataRef = useRef<TableMetadataViewRef>(null);
  const tableSizeRef = useRef<TableSizeViewRef>(null);
  const partitionRef = useRef<PartitionSizeViewRef>(null);

  const handleRefresh = () => {
    switch (currentTab) {
      case "data-sample":
        dataSampleRef.current?.refresh();
        break;
      case "metadata":
        metadataRef.current?.refresh();
        break;
      case "table-size":
        tableSizeRef.current?.refresh();
        break;
      case "partitions":
        partitionRef.current?.refresh();
        break;
      default:
        // Query Log and Part Log tabs don't have refresh functionality yet
        break;
    }
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex flex-col flex-1 overflow-hidden">
        <div className="flex justify-between items-center gap-2 mx-2 mt-2">
          <TabsList>
            {availableTabs.has("data-sample") && <TabsTrigger value="data-sample">Data Sample</TabsTrigger>}
            {availableTabs.has("metadata") && <TabsTrigger value="metadata">Metadata</TabsTrigger>}
            {availableTabs.has("table-size") && <TabsTrigger value="table-size">Table Size</TabsTrigger>}
            {availableTabs.has("partitions") && <TabsTrigger value="partitions">Partitions</TabsTrigger>}
            {availableTabs.has("query-log") && <TabsTrigger value="query-log">Query Log</TabsTrigger>}
            {availableTabs.has("part-log") && <TabsTrigger value="part-log">Part Log</TabsTrigger>}
          </TabsList>
          {(currentTab === "data-sample" ||
            currentTab === "metadata" ||
            currentTab === "table-size" ||
            currentTab === "partitions") && (
            <Button variant="ghost" size="icon" onClick={handleRefresh} className="h-8 w-8">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
        {availableTabs.has("data-sample") && (
          <TabsContent value="data-sample" className="flex-1 overflow-auto p-2 mt-0">
            <DataSampleView ref={dataSampleRef} database={database} table={table} />
          </TabsContent>
        )}
        {availableTabs.has("metadata") && (
          <TabsContent value="metadata" className="flex-1 overflow-auto p-2 space-y-2 mt-0">
            <TableMetadataView ref={metadataRef} database={database} table={table} />
          </TabsContent>
        )}
        {availableTabs.has("table-size") && (
          <TabsContent value="table-size" className="flex-1 overflow-auto p-2 mt-0">
            <TableSizeView ref={tableSizeRef} database={database} table={table} />
          </TabsContent>
        )}
        {availableTabs.has("partitions") && (
          <TabsContent value="partitions" className="flex-1 overflow-auto p-2 mt-0">
            <PartitionSizeView ref={partitionRef} database={database} table={table} />
          </TabsContent>
        )}
        {availableTabs.has("query-log") && (
          <TabsContent value="query-log" className="flex-1 overflow-auto p-4 mt-2">
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Query Log content coming soon
            </div>
          </TabsContent>
        )}
        {availableTabs.has("part-log") && (
          <TabsContent value="part-log" className="flex-1 overflow-auto p-4 mt-2">
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Part Log content coming soon
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
