"use client";

import { Wrench } from "lucide-react";
import { useOracleTools } from "./OracleToolsProvider";

export function ToolsButton() {
  const { openDrawer } = useOracleTools();
  return (
    <button
      onClick={openDrawer}
      className="flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-semibold transition-colors shrink-0"
      style={{
        background: "var(--lucid-accent-bg)",
        color: "var(--lucid-accent)",
        border: "1px solid var(--lucid-accent-bd)",
      }}
    >
      <Wrench size={13} />
      Tools
    </button>
  );
}
