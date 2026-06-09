"use client";

import { useSidebar } from "./SidebarContext";
import type { ReactNode } from "react";

export function MainContent({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  // Margin is driven by CSS breakpoints (not JS) so the correct layout paints
  // on first render even on mobile: 0 below `lg`, and the rail width at `lg+`.
  // `collapsed` is a desktop-only toggle (user-initiated), so it can't cause a
  // first-paint flash. lg:ml-16 = 64px rail · lg:ml-55 = 220px rail.
  return (
    <div
      className={`flex-1 flex flex-col min-h-screen min-w-0 transition-[margin] duration-300 ml-0 ${
        collapsed ? "lg:ml-16" : "lg:ml-55"
      }`}
    >
      {children}
    </div>
  );
}
