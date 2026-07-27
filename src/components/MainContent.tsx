"use client";

import type { ReactNode } from "react";

export function MainContent({ children }: { children: ReactNode }) {
  // No more horizontal offset now that nav is a floating bottom dock, not a
  // side rail. Bottom padding keeps the dock (plus its raised sub-tab group)
  // from ever covering page content, at any breakpoint.
  return (
    <div className="flex-1 flex flex-col min-h-screen min-w-0 pb-24 sm:pb-28">
      {children}
    </div>
  );
}
