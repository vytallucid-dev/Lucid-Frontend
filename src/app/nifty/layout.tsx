"use client";

import { useEffect, useSyncExternalStore } from "react";
import { NiftyToolsProvider, useNiftyTools } from "@/components/nifty-tools/NiftyToolsProvider";
import { subscribe, getSnapshot, clearToolsRequest } from "@/lib/tools-store";

// Bridges the global Dock's tools-store request into this section's own
// drawer state. Must render inside NiftyToolsProvider to reach useNiftyTools().
function NiftyToolsRequestBridge() {
  const requested = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const { openDrawer } = useNiftyTools();

  useEffect(() => {
    if (requested === "nifty") {
      openDrawer();
      clearToolsRequest();
    }
  }, [requested, openDrawer]);

  return null;
}

export default function NiftyLayout({ children }: { children: React.ReactNode }) {
  return (
    <NiftyToolsProvider>
      <NiftyToolsRequestBridge />
      <div className="lt-backdrop flex flex-col min-h-[calc(100vh-56px)]">
        {children}
      </div>
    </NiftyToolsProvider>
  );
}
