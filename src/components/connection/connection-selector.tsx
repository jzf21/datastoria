import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Connection } from "@/lib/connection/Connection";
import { useConnection } from "@/lib/connection/ConnectionContext";
import { ConnectionManager } from "@/lib/connection/ConnectionManager";
import { cn } from "@/lib/utils";
import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { showConnectionEditDialog } from "./connection-edit-dialog";
import { Separator } from "../ui/separator";
import { useCommandState } from "cmdk";
import { TextHighlighter } from "@/lib/text-highlighter";

interface HighlightItemProps {
  text: string;
}

export const HighlightableCommandItem: React.FC<HighlightItemProps> = ({ text }) => {
  const search = useCommandState((state) => state.search);
  return TextHighlighter.highlight(text, search, "text-yellow-500");
};

export function ConnectionSelector() {
  const { selectedConnection, setSelectedConnection } = useConnection();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);

  // Load connections
  useEffect(() => {
    const manager = ConnectionManager.getInstance();
    setConnections(manager.getConnections());
  }, []); // Load connections on mount

  const handleOpenAddDialog = () => {
    showConnectionEditDialog({
      connection: null,
      onSave: () => {
        // Reload connections after save
        const manager = ConnectionManager.getInstance();
        setConnections(manager.getConnections());
      },
    });
    setIsCommandOpen(false);
  };

  const handleConnectionSelect = (connection: Connection) => {
    setSelectedConnection(connection);
    setIsCommandOpen(false);
  };

  // Get connection display text for command items
  const getConnectionItemText = (conn: Connection) => {
    try {
      const hostname = new URL(conn.url).hostname;
      return `${conn.user}@${hostname}`;
    } catch {
      return conn.url;
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <Popover open={isCommandOpen} onOpenChange={setIsCommandOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="max-w-[300px]">
              <span className="truncate">{selectedConnection?.name}</span>
              <ChevronDown className="h-4 w-4 ml-2 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start" sideOffset={0}>
            <Command
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]]:!rounded-none [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
              filter={(value, search) => {
                // Default filtering for items
                if (!search) return 1;
                const lowerSearch = search.toLowerCase();
                const lowerValue = value.toLowerCase();
                return lowerValue.includes(lowerSearch) ? 1 : 0;
              }}
            >
              <CommandInput placeholder="Search connections..." className="!h-10" />
              <CommandList className="!rounded-none">
                <CommandEmpty>No connections found.</CommandEmpty>
                {connections.length > 0 && (
                  <CommandGroup className="!py-1 !px-1 !rounded-none">
                    {connections.map((conn) => {
                      const isSelected = selectedConnection?.name === conn.name;
                      return (
                        <CommandItem
                          key={conn.name}
                          value={conn.name}
                          onSelect={() => handleConnectionSelect(conn)}
                          className={cn(
                            "flex items-center justify-between !rounded-none cursor-pointer !py-1 mb-1",
                            isSelected && "bg-accent"
                          )}
                          style={{ borderRadius: 0 }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              <HighlightableCommandItem text={conn.name} />
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{getConnectionItemText(conn)}</div>
                          </div>
                          {isSelected && <span className="ml-2 text-xs text-primary">✓</span>}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>

            <Separator />
            <div className="p-1">
              <Button variant="ghost" className="w-full justify-start rounded-none h-10" onClick={handleOpenAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Connection
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
