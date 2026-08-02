"use client";

// ─── Global keyboard shortcuts ───────────────────────────────────────────────
// One window listener, one guard, one definition list (src/lib/shortcuts.ts).
// Navigation is a `g` prefix followed by a letter — the convention every
// keyboard-driven web app already uses, and the reason a plain `d` never
// hijacks a page on its own.

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  NAV_SHORTCUTS,
  ACTION_SHORTCUTS,
  SEQUENCE_PREFIX,
  SEQUENCE_TIMEOUT_MS,
  shortcutAllowed,
  type ShortcutAction,
} from "@/lib/shortcuts";

interface GlobalShortcutHandlers {
  onAction: (action: ShortcutAction) => void;
  /** Fired just before a `g` sequence actually navigates. */
  onNavigate?: () => void;
  /** Told when the `g` prefix arms and disarms, for the dock's pending chip. */
  onPendingChange?: (pending: boolean) => void;
}

export function useGlobalShortcuts({
  onAction,
  onNavigate,
  onPendingChange,
}: GlobalShortcutHandlers) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";

  // Everything the listener needs lives in refs, so the listener itself is
  // bound once and never rebound — no window of a few frames after every
  // route change where a keystroke lands on a stale closure, and nothing to
  // leak because there is only ever one registration to tear down.
  const pathnameRef = useRef(pathname);
  const onActionRef = useRef(onAction);
  const onNavigateRef = useRef(onNavigate);
  const onPendingChangeRef = useRef(onPendingChange);

  // Synced in an effect, not during render — refs are initialised with the
  // right values on mount, so the listener is never reading a stale one.
  useEffect(() => {
    pathnameRef.current = pathname;
    onActionRef.current = onAction;
    onNavigateRef.current = onNavigate;
    onPendingChangeRef.current = onPendingChange;
  }, [pathname, onAction, onNavigate, onPendingChange]);

  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function disarm() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pendingRef.current) {
        pendingRef.current = false;
        onPendingChangeRef.current?.(false);
      }
    }

    function arm() {
      if (timerRef.current) clearTimeout(timerRef.current);
      pendingRef.current = true;
      onPendingChangeRef.current?.(true);
      timerRef.current = setTimeout(disarm, SEQUENCE_TIMEOUT_MS);
    }

    function onKey(e: KeyboardEvent) {
      // `?` first, and on its own terms: it is the only binding allowed to
      // carry Shift (it IS Shift+/ on most layouts), and the only one that
      // still fires while a drawer or modal is open — which is precisely the
      // moment somebody forgets a shortcut.
      if (e.key === "?") {
        if (!shortcutAllowed(e, { allowShift: true, scope: "global" })) return;
        e.preventDefault();
        disarm();
        onActionRef.current("toggle-help");
        return;
      }

      if (!shortcutAllowed(e)) {
        // Typing, a modifier, or an overlay — whatever was armed is stale.
        disarm();
        return;
      }

      // Second key of a sequence.
      if (pendingRef.current) {
        const key = e.key.toLowerCase();
        disarm();
        const hit = NAV_SHORTCUTS.find((s) => s.keys[1] === key);
        // An unknown second key does nothing at all — no navigation, no
        // fall-through to the single-key table (so `g` then `n` is NIFTY
        // Pulse, never "new trade"), and no noise.
        if (!hit) return;
        e.preventDefault();
        // A sequence can resolve to an action rather than a route (`g t`).
        // The handler decides whether it applies here; an inapplicable one is
        // a silent no-op, same as an unknown second key.
        if (hit.action) {
          onActionRef.current(hit.action);
          return;
        }
        if (!hit.href) return;
        onNavigateRef.current?.();
        // Already there: a no-op, not a reload.
        if (hit.href === pathnameRef.current) return;
        router.push(hit.href);
        return;
      }

      // Prefix.
      if (e.key === SEQUENCE_PREFIX) {
        e.preventDefault();
        arm();
        return;
      }

      // Single-key actions.
      const action = ACTION_SHORTCUTS.find(
        (s) => !s.handledElsewhere && s.action && s.keys.length === 1 && s.keys[0] === e.key,
      );
      if (!action?.action) return;
      e.preventDefault();
      onActionRef.current(action.action);
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Nothing survives teardown — not the listener, not the pending timer.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingRef.current = false;
    };
  }, [router]);
}
