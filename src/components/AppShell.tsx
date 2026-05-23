"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { SidebarProvider } from "./SidebarContext";
import { MainContent } from "./MainContent";

/**
 * Renders the app chrome (sidebar + top bar) for normal routes, or just the
 * raw children for /auth/* routes (which have their own centered layout).
 *
 * Client-only because we read pathname; the root layout stays a Server
 * Component and just defers to this.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname?.startsWith("/auth");
  const isLanding = pathname === "/";

  if (isAuth || isLanding) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <Sidebar />
      <MainContent>
        <TopBar />
        <main className="flex-1">{children}</main>
      </MainContent>
    </SidebarProvider>
  );
}
