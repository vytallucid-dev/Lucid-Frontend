"use client";

import { useEffect, useSyncExternalStore } from "react";
import { OracleToolsProvider, useOracleTools } from "@/components/oracle-tools/OracleToolsProvider";
import { subscribe, getSnapshot, clearToolsRequest } from "@/lib/tools-store";

// Bridges the global Dock's tools-store request into this section's own
// drawer state. Must render inside OracleToolsProvider to reach useOracleTools().
function OracleToolsRequestBridge() {
  const requested = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const { openDrawer } = useOracleTools();

  useEffect(() => {
    if (requested === "oracle") {
      openDrawer();
      clearToolsRequest();
    }
  }, [requested, openDrawer]);

  return null;
}

export default function OracleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OracleToolsProvider>
      <OracleToolsRequestBridge />
      <div className="lt-backdrop flex flex-col min-h-[calc(100vh-56px)]">
        {children}
      </div>
    </OracleToolsProvider>
  );
}
