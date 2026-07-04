"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { NiftyToolsDrawer } from "./NiftyToolsDrawer";
import { FlowTrackerView } from "./FlowTrackerView";

interface NiftyToolsContextValue {
  openDrawer: () => void;
}

const NiftyToolsContext = createContext<NiftyToolsContextValue | null>(null);

export function useNiftyTools(): NiftyToolsContextValue {
  const ctx = useContext(NiftyToolsContext);
  if (!ctx) throw new Error("useNiftyTools must be used within NiftyToolsProvider");
  return ctx;
}

export function NiftyToolsProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const openFlowTracker = useCallback(() => {
    setDrawerOpen(false);
    setFlowOpen(true);
  }, []);

  const value = useMemo<NiftyToolsContextValue>(() => ({ openDrawer }), [openDrawer]);

  return (
    <NiftyToolsContext.Provider value={value}>
      <div className="relative">
        {children}

        <NiftyToolsDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onOpenFlowTracker={openFlowTracker}
        />

        {flowOpen && <FlowTrackerView onClose={() => setFlowOpen(false)} />}
      </div>
    </NiftyToolsContext.Provider>
  );
}
