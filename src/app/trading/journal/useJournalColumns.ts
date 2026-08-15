"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Journal column preferences — width, visibility and the drag to resize.
//
// A trading journal is a workspace, not a fixed report: which columns matter
// depends on what you are looking for that day. Widths and visibility are the
// user's, persisted locally, and the table simply grows wider and scrolls
// sideways rather than compressing anything to fit.
//
// Preferences are keyed by column key, not by index, so adding or reordering a
// column in the definition never scrambles a stored layout. Unknown keys in
// storage are ignored and new columns arrive at their default — which is what
// makes this survive the next column being added.
//
// localStorage is an external store, so it is read through useSyncExternalStore
// rather than an effect that writes state on mount. That gives a correct server
// snapshot (defaults, so hydration matches), no cascading render, and — for
// free — two tabs staying in step via the `storage` event.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "lucid.journal.columns.v1";

/** Nothing narrower than this stays readable; nothing wider is useful. */
export const MIN_COLUMN_WIDTH = 56;
export const MAX_COLUMN_WIDTH = 420;

export interface ColumnPref {
  width: number;
  visible: boolean;
}
export type ColumnPrefs = Record<string, ColumnPref>;

interface ColumnDef {
  key: string;
  width: number;
  /** Columns the table is unusable without cannot be hidden. */
  required?: boolean;
}

function clampWidth(w: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(w)));
}

// ── The external store ───────────────────────────────────────────────────────
//
// getSnapshot must return a referentially stable value or React re-renders
// forever, so the parsed preferences are cached and the cache is cleared only
// when storage actually changes.

const EMPTY: ColumnPrefs = {};
let cache: ColumnPrefs | null = null;
const listeners = new Set<() => void>();

function parse(raw: string | null): ColumnPrefs {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY;
    const out: ColumnPrefs = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const v = value as { width?: unknown; visible?: unknown };
      out[key] = {
        width: typeof v.width === "number" ? clampWidth(v.width) : 0,
        visible: v.visible !== false,
      };
    }
    return out;
  } catch {
    // A corrupt preference must never take the journal down.
    return EMPTY;
  }
}

function getSnapshot(): ColumnPrefs {
  if (cache === null) {
    try {
      cache = parse(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      cache = EMPTY; // storage disabled or blocked
    }
  }
  return cache;
}

/** The server has no preferences, so it renders the defaults — and so does the
 * client's first paint, which is what keeps hydration in agreement. */
function getServerSnapshot(): ColumnPrefs {
  return EMPTY;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent): void => {
    if (e.key === STORAGE_KEY || e.key === null) {
      cache = null;
      for (const l of listeners) l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function write(next: ColumnPrefs | null): void {
  try {
    if (next === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode, quota, disabled storage — the layout still works for this
    // session, it just will not be remembered.
  }
  cache = next ?? EMPTY;
  for (const l of listeners) l();
}

export interface JournalColumnsApi {
  /** Defaults merged with stored preferences, in definition order. */
  prefs: ColumnPrefs;
  widthOf: (key: string) => number;
  isVisible: (key: string) => boolean;
  visibleKeys: string[];
  hiddenCount: number;
  setWidth: (key: string, width: number) => void;
  toggleVisible: (key: string) => void;
  showAll: () => void;
  reset: () => void;
}

export function useJournalColumns(columns: ColumnDef[]): JournalColumnsApi {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const prefs = useMemo<ColumnPrefs>(() => {
    const out: ColumnPrefs = {};
    for (const c of columns) {
      const s = stored[c.key];
      out[c.key] = {
        width: s && s.width > 0 ? s.width : c.width,
        // A required column ignores a stored hide — the definition wins.
        visible: c.required ? true : s ? s.visible : true,
      };
    }
    return out;
  }, [columns, stored]);

  const setWidth = useCallback(
    (key: string, width: number) => {
      write({ ...prefs, [key]: { ...prefs[key], width: clampWidth(width) } });
    },
    [prefs],
  );

  const toggleVisible = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key);
      if (col?.required) return;
      write({ ...prefs, [key]: { ...prefs[key], visible: !prefs[key].visible } });
    },
    [columns, prefs],
  );

  const showAll = useCallback(() => {
    const next: ColumnPrefs = {};
    for (const c of columns) next[c.key] = { ...prefs[c.key], visible: true };
    write(next);
  }, [columns, prefs]);

  const reset = useCallback(() => write(null), []);

  const visibleKeys = useMemo(
    () => columns.filter((c) => prefs[c.key]?.visible).map((c) => c.key),
    [columns, prefs],
  );

  return {
    prefs,
    widthOf: (key) => prefs[key]?.width ?? MIN_COLUMN_WIDTH,
    isVisible: (key) => prefs[key]?.visible !== false,
    visibleKeys,
    hiddenCount: columns.length - visibleKeys.length,
    setWidth,
    toggleVisible,
    showAll,
    reset,
  };
}

/**
 * Drag-to-resize on a header edge.
 *
 * Pointer events (not mouse) so a trackpad, a pen and a touchscreen all work,
 * with capture so the drag survives the cursor leaving the 5px handle — the
 * usual reason a resize feels like it "slips".
 */
export function beginColumnResize(
  event: React.PointerEvent<HTMLElement>,
  startWidth: number,
  onWidth: (w: number) => void,
): void {
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const target = event.currentTarget;
  target.setPointerCapture(event.pointerId);

  const move = (e: PointerEvent): void => {
    onWidth(Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, startWidth + (e.clientX - startX))));
  };
  const done = (): void => {
    target.releasePointerCapture?.(event.pointerId);
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", done);
    target.removeEventListener("pointercancel", done);
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", done);
  target.addEventListener("pointercancel", done);
}
