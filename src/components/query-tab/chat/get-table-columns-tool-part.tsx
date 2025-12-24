import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CLIENT_TOOL_NAMES } from "@/lib/ai/client-tools";
import type { AppUIMessage, ToolPart } from "@/lib/ai/common-types";
import { memo } from "react";
import { CollapsiblePart } from "./collapsible-part";

type TableInput = {
  database: string;
  table: string;
};

type TableColumnOutput = Array<{
  database: string;
  table: string;
  columns: Array<{ name: string; type: string }>;
}>;

export const GetTableColumnsPart = memo(function GetTableColumnsPart({ part }: { part: AppUIMessage["parts"][0] }) {
  const toolPart = part as ToolPart & {
    input?: { tablesAndSchemas: TableInput[] };
    output?: TableColumnOutput;
  };
  const state = toolPart.state;
  const input = toolPart.input;
  const output = toolPart.output;
  const inputTables = input?.tablesAndSchemas ?? null;

  return (
    <CollapsiblePart toolName={CLIENT_TOOL_NAMES.GET_TABLE_COLUMNS} state={state}>
      {inputTables && (
        <div className="mt-1">
          <div className="mb-0.5 text-[10px] text-muted-foreground">input:</div>
          <div className="border rounded-md overflow-hidden bg-background">
            <Table className="text-[11px]">
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="h-7 px-2 font-bold text-muted-foreground">database</TableHead>
                  <TableHead className="h-7 px-2 font-bold text-muted-foreground">table</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inputTables.map((t: TableInput, idx: number) => (
                  <TableRow key={idx} className="hover:bg-muted/30 border-b last:border-0">
                    <TableCell className="py-1 px-2 font-mono whitespace-nowrap">{t.database}</TableCell>
                    <TableCell className="py-1 px-2 font-mono whitespace-nowrap">{t.table}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {output && Array.isArray(output) && (
        <>
          <div className="mt-2 text-[10px] text-muted-foreground">output:</div>
          <div className="border rounded-md overflow-hidden bg-background">
            <div className="max-h-[300px] overflow-auto">
              {output.map((tableGroup, tableIdx: number) => (
                <div key={tableIdx} className="mb-2 last:mb-0">
                  <div className="bg-muted/50 px-2 py-1 font-mono text-[10px] font-bold border-b">
                    {tableGroup.database}.{tableGroup.table} ({tableGroup.columns?.length || 0} columns)
                  </div>
                  <Table className="text-[11px]">
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-transparent border-b">
                        <TableHead className="h-7 px-2 font-bold text-muted-foreground">name</TableHead>
                        <TableHead className="h-7 px-2 font-bold text-muted-foreground">type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableGroup.columns?.map((col, colIdx: number) => (
                        <TableRow key={colIdx} className="hover:bg-muted/30 border-b last:border-0">
                          <TableCell className="py-1 px-2 font-mono font-medium whitespace-nowrap">
                            {col.name}
                          </TableCell>
                          <TableCell className="py-1 px-2 font-mono whitespace-nowrap">{col.type}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </CollapsiblePart>
  );
});

