"use client";

import { useSidebar } from "./SidebarContext";
import type { ReactNode } from "react";

export function MainContent({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div
      className="flex-1 flex flex-col min-h-screen transition-all duration-300"
      style={{ marginLeft: collapsed ? 64 : 220 }}
    >
      {children}
    </div>
  );
}
