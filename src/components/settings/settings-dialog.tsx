import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { X } from "lucide-react";
import React, { useCallback, useState } from "react";
import ReactDOM from "react-dom/client";
import { QueryContextEdit } from "./query-context-edit";
import { ModelsEdit } from "./models-edit";

type SettingsSection = "query-context" | "models";

export interface ShowSettingsDialogOptions {
  onCancel?: () => void;
}

function SettingsDialogWrapper({ onCancel }: { onCancel?: () => void }) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("query-context");

  const handleClose = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  // Handle ESC key to close
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [handleClose]);

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
      <SidebarProvider>
        <div className="flex-1 overflow-hidden flex">
          {/* Inner Sidebar */}
          <Sidebar collapsible="none" variant="inset" className="border-r">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Settings</SidebarGroupLabel>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setActiveSection("query-context")}
                      isActive={activeSection === "query-context"}
                    >
                      Query Context
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setActiveSection("models")} isActive={activeSection === "models"}>
                      Models
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 border-b px-4 py-2 flex items-center justify-between">
              <div className="text-sm ">
                {activeSection === "query-context"
                  ? "Configure query execution settings and parameters."
                  : "Configure AI model settings and API keys."}
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content Area - Fills remaining space */}
            <div className="flex-1 overflow-y-auto px-0 py-0">
              {activeSection === "query-context" && <QueryContextEdit />}
              {activeSection === "models" && <ModelsEdit />}
            </div>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}

export function showSettingsDialog(options: ShowSettingsDialogOptions = {}) {
  const { onCancel } = options;

  // Create a container div to mount the full-screen component
  const container = document.createElement("div");
  document.body.appendChild(container);

  // Create React root
  const root = ReactDOM.createRoot(container);

  // Function to cleanup and close
  const cleanup = () => {
    if (container.parentNode) {
      root.unmount();
      document.body.removeChild(container);
    }
    if (onCancel) {
      onCancel();
    }
  };

  // Render the full-screen component
  root.render(<SettingsDialogWrapper onCancel={cleanup} />);
}
