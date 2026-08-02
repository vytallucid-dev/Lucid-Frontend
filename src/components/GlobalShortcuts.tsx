"use client";

// ─── Shortcut host ───────────────────────────────────────────────────────────
// Mounted once by AppShell, alongside the Dock. It owns the window listener
// and the two overlays that `n` and `p` reach for.
//
// Why the modals live HERE rather than the shortcut navigating to the journal
// and opening them there: `n` from the Compass should not silently throw away
// the page the trader was reading. Mounting is also the smaller change — the
// modals are already used from a non-trading page (the Dashboard mounts
// AddTradeModal), so nothing about them needed lifting; they just needed one
// more mount point. No component is duplicated.
//
// They are mounted CONDITIONALLY, not with `open={false}`. Both components run
// their account/model/pair queries unconditionally at the top of the function
// body, so a permanent mount would start fetching trading data on every page
// in the app. Rendering them only while open leaves every existing query
// exactly as it was.

import { useCallback, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { AddTradeModal } from "@/app/trading/journal/AddTradeModal";
import { AddPlannedTradeModal } from "@/app/trading/planned/AddPlannedTradeModal";
import { ShortcutHelp } from "./ShortcutHelp";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { helpStore, pendingStore, closeHelp, toggleHelp } from "@/lib/shortcuts-store";
import { requestTools, toolsSectionForPath } from "@/lib/tools-store";
import type { ShortcutAction } from "@/lib/shortcuts";

export function GlobalShortcuts() {
  const [tradeOpen, setTradeOpen] = useState(false);
  const [plannedOpen, setPlannedOpen] = useState(false);
  const pathname = usePathname() ?? "/";

  const helpOpen = useSyncExternalStore(helpStore.subscribe, helpStore.get, () => false);

  // Acting on a shortcut dismisses the panel that told you about it — the
  // trader looked it up, then used it, and the reference has done its job.
  const onAction = useCallback(
    (action: ShortcutAction) => {
      switch (action) {
        case "new-trade":
          closeHelp();
          setTradeOpen(true);
          break;
        case "new-planned":
          closeHelp();
          setPlannedOpen(true);
          break;
        case "open-tools": {
          // `g t` acts on the section you are standing in, so it only means
          // anything inside NIFTY or Oracle — those are the only two layouts
          // that mount a bridge to receive the request and clear it. Anywhere
          // else it is a silent no-op; posting the request regardless would
          // leave it unread in the store and then pop a drawer open by itself
          // the next time the trader walked into that section.
          const section = toolsSectionForPath(pathname);
          if (!section) break;
          closeHelp();
          requestTools(section);
          break;
        }
        case "toggle-help":
          toggleHelp();
          break;
      }
    },
    [pathname],
  );

  const onPendingChange = useCallback((pending: boolean) => {
    pendingStore.set(pending);
  }, []);

  useGlobalShortcuts({ onAction, onNavigate: closeHelp, onPendingChange });

  return (
    <>
      {tradeOpen && <AddTradeModal open onClose={() => setTradeOpen(false)} />}
      {plannedOpen && <AddPlannedTradeModal open onClose={() => setPlannedOpen(false)} />}
      <ShortcutHelp open={helpOpen} onClose={closeHelp} />
    </>
  );
}
