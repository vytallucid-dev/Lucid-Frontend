"use client";

import { usePathname } from "next/navigation";
import { Dock } from "./Dock";
import { TopBar } from "./TopBar";
import { MainContent } from "./MainContent";

/**
 * Renders the app chrome (dock + top bar) for normal routes, or just the
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
    <>
      <MainContent>
        <TopBar />
        <main className="flex-1">{children}</main>
      </MainContent>
      <Dock />
    </>
  );
}
