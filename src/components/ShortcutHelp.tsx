"use client";

// ─── Shortcut help overlay ───────────────────────────────────────────────────
// Rendered entirely from SHORTCUT_GROUPS, the same list the dispatcher reads.
// Adding a binding to src/lib/shortcuts.ts is the whole job; this panel picks
// it up with no edit at all.
//
// It portals to <body> for one specific reason: useScrollLock marks every
// branch outside an open drawer inert, so a panel mounted inside the page
// tree would render behind — and inert underneath — the very drawer the
// trader opened it on top of. A portal appended after the drawer opened is
// not in that inert set, and sits above it cleanly.

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { SHORTCUT_GROUPS } from "@/lib/shortcuts";
import { usePrefersReducedMotion } from "./motion";

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="lx-kbd-row">
      {keys.map((k, i) => (
        <kbd key={i} className="lx-kbd">
          {k}
        </kbd>
      ))}
    </span>
  );
}

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reducedMotion = usePrefersReducedMotion();

  // Escape, in the CAPTURE phase. Every other overlay in this codebase closes
  // on a bubble-phase document listener, so capturing here means one Escape
  // closes the topmost thing — this panel — and the drawer underneath keeps
  // its own Escape for the next press, exactly as it behaves today when this
  // panel isn't open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  // `open` is false on the server and on the first client render alike (it only
  // ever becomes true from a keypress), so there is no hydration mismatch here
  // and no need for a mounted flag — createPortal simply never runs server-side.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="lx-overlay-scrim lx-help-scrim"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="lx-help-layer" onClick={onClose}>
        <div
          className={`lx-modal-panel lx-help-panel relative ${reducedMotion ? "lx-no-anim" : ""}`}
          role="dialog"
          aria-modal="false"
          aria-label="Keyboard shortcuts"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="lx-overlay-header">
            <h2 className="lx-overlay-title">Keyboard Shortcuts</h2>
            <button type="button" onClick={onClose} className="lx-overlay-close" title="Close">
              <X size={15} />
            </button>
          </div>

          <div className="lx-overlay-body">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.title} className="lx-help-group">
                <p className="lx-eyebrow">{group.title}</p>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.keys.join("-")} className="lx-help-row">
                      <Keys keys={item.keys} />
                      <span className="lx-help-label">
                        {item.label}
                        {item.scope && <span className="lx-help-scope"> · {item.scope}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <p className="lx-micro lx-help-foot">
              Plain keys only — never while you are typing, and never with a modifier held.
              Press <kbd className="lx-kbd">esc</kbd> to close.
            </p>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
