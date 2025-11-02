import { showConnectionEditDialog } from "@/components/connection/connection-edit-dialog";
import { Button } from "@/components/ui/button";
import { useConnection } from "@/lib/connection/ConnectionContext";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { LayoutDashboard, Pencil, Terminal } from "lucide-react";
import { ConnectionSelector } from "./connection/connection-selector";
import { ThemeToggle } from "./theme-toggle";
import { Input } from "./ui/input";

export default function NavBar() {
  const matchRoute = useMatchRoute();
  const isDashboardActive = !!matchRoute({ to: "/dashboard" });
  const isQueryActive = !!matchRoute({ to: "/query" });
  const { selectedConnection } = useConnection();

  const handleOpenEditDialog = () => {
    showConnectionEditDialog({
      connection: selectedConnection,
      onSave: () => {
        // Connection saved, dialog closed automatically
      },
      onDelete: () => {
        // Connection deleted, dialog closed automatically
      },
    });
  };

  return (
    <header className="sticky inset-x-0 top-0 w-full border-b h-[49px]">
      <nav className="flex items-center justify-between px-2 py-2 h-full">
        <div className="flex items-center ml-1 gap-2">
          <img src="/logo_clickhouse.svg" alt="ClickHouse" className="h-8 w-8" />
          <ConnectionSelector />
          {selectedConnection && (
            <>
              <div className="relative">
                <Input
                  className="w-[300px] h-9 pr-9"
                  title="Edit Connection"
                  value={`${selectedConnection.name}@${selectedConnection.url}`}
                  readOnly
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-9 rounded-l-none"
                  onClick={handleOpenEditDialog}
                  title="Edit Connection"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>

              <Link to="/query">
                <Button variant={isQueryActive ? "secondary" : "ghost"} size="sm">
                  <Terminal className="h-4 w-4 mr-2" />
                  Query
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant={isDashboardActive ? "secondary" : "ghost"} size="sm">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center mr-1 gap-2">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
