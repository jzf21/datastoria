import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./components/theme-provider";
import { ToastProvider } from "./components/toast-provider";
import "./index.css";
import "./lib/number-utils"; // Import to register Number prototype extensions early
import { ConnectionProvider } from "./lib/connection/ConnectionContext";
import { AppSidebar } from "./components/app-sidebar";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { MainPage } from "./components/main-page";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="dark" storageKey="app-ui-theme">
    <ConnectionProvider>
      <ToastProvider />
      <SidebarProvider open={false}>
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-hidden h-screen">
          <MainPage />
        </SidebarInset>
      </SidebarProvider>
    </ConnectionProvider>
  </ThemeProvider>
);
