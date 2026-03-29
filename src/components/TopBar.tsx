"use client";

import { usePathname } from "next/navigation";

const sectionNames: Record<string, string> = {
  "/": "Pulse",
  "/ledger": "Ledger",
  "/oracle": "Oracle",
  "/settings": "Settings",
};

export function TopBar() {
  const pathname = usePathname();
  const section = sectionNames[pathname] || sectionNames[Object.keys(sectionNames).find(k => k !== "/" && pathname.startsWith(k)) || "/"] || "Lucid";

  return (
    <header
      className="h-14 flex items-center justify-between px-6 shrink-0"
      style={{
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        background: "rgba(2, 8, 23, 0.6)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold" style={{ color: "#F1F5F9" }}>
          {section}
        </span>
        <span style={{ color: "#334155" }}>/</span>
        <span className="text-sm" style={{ color: "#64748B" }}>
          Overview
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs" style={{ color: "#64748B" }}>
          Last updated: Mar 29, 2026 — 14:32 IST
        </span>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full pulse-live"
            style={{ background: "#10B981" }}
          />
          <span
            className="text-xs font-medium"
            style={{ color: "#10B981" }}
          >
            Live
          </span>
        </div>
      </div>
    </header>
  );
}
