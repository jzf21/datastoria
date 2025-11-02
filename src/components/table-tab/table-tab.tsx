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

export function TableTab({ database, table, engine }: TableTabProps) {
  // Hide Table Size and Partitions tabs if engine starts with "System"
  const isSystemTable = engine?.startsWith("System") ?? false;
  // Hide Data Sample tab if engine is MaterializedView
  const isMaterializedView = engine === "MaterializedView";

  const [currentTab, setCurrentTab] = useState<string>(isMaterializedView ? "metadata" : "data-sample");

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
            {!isMaterializedView && <TabsTrigger value="data-sample">Data Sample</TabsTrigger>}
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
            {!isSystemTable && <TabsTrigger value="table-size">Table Size</TabsTrigger>}
            {!isSystemTable && <TabsTrigger value="partitions">Partitions</TabsTrigger>}
            <TabsTrigger value="query-log">Query Log</TabsTrigger>
            <TabsTrigger value="part-log">Part Log</TabsTrigger>
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
        {!isMaterializedView && (
          <TabsContent value="data-sample" className="flex-1 overflow-auto p-2 mt-0">
            <DataSampleView ref={dataSampleRef} database={database} table={table} />
          </TabsContent>
        )}
        <TabsContent value="metadata" className="flex-1 overflow-auto p-2 space-y-2 mt-0">
          <TableMetadataView ref={metadataRef} database={database} table={table} />
        </TabsContent>
        {!isSystemTable && (
          <TabsContent value="table-size" className="flex-1 overflow-auto p-2 mt-0">
            <TableSizeView ref={tableSizeRef} database={database} table={table} />
          </TabsContent>
        )}
        {!isSystemTable && (
          <TabsContent value="partitions" className="flex-1 overflow-auto p-2 mt-0">
            <PartitionSizeView ref={partitionRef} database={database} table={table} />
          </TabsContent>
        )}
        <TabsContent value="query-log" className="flex-1 overflow-auto p-4 mt-2">
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Query Log content coming soon
          </div>
        </TabsContent>
        <TabsContent value="part-log" className="flex-1 overflow-auto p-4 mt-2">
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Part Log content coming soon
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
