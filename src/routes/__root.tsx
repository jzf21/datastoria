import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <SidebarProvider open={false}>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden h-screen">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
