"use client";

// ─── Keyboard shortcuts: the single definition ───────────────────────────────
// One list, two consumers — useGlobalShortcuts reads it to decide what a
// keypress does, and ShortcutHelp renders the very same entries. A hand-kept
// help panel drifts from the real bindings; this one cannot.
//
// Everything here is a PLAIN key. No Ctrl/Cmd (cut, select-all, find, new
// window — some of which the browser will not even hand us), no Alt (dead
// keys and special characters on macOS). Plain keys are only safe because the
// guard below is strict, so the guard is the important half of this file.

/** What a shortcut asks the app to do when it isn't a plain route change. */
export type ShortcutAction = "new-trade" | "new-planned" | "open-tools" | "toggle-help";

export interface ShortcutDef {
  /** The sequence, in order. `["g", "d"]` = press g, then d. */
  keys: string[];
  label: string;
  /** Navigation target. Mutually exclusive with `action`. */
  href?: string;
  action?: ShortcutAction;
  /**
   * Listed in the help overlay but handled by somebody else — currently only
   * the scorecard picker's own `/`, which is page-local by design. The
   * dispatcher skips these; the overlay still shows them, because from the
   * trader's side it is one keyboard, not two implementations.
   */
  handledElsewhere?: boolean;
  /** Where it applies, shown in the overlay when it isn't everywhere. */
  scope?: string;
}

/** The prefix that opens a two-key navigation sequence. */
export const SEQUENCE_PREFIX = "g";

/**
 * How long the prefix stays armed. 1000ms — long enough to be a deliberate
 * two-key phrase rather than a chord, short enough that a stray `g` never
 * swallows the next real keystroke. Timing out does nothing, silently.
 */
export const SEQUENCE_TIMEOUT_MS = 1000;

export const NAV_SHORTCUTS: ShortcutDef[] = [
  { keys: ["g", "d"], label: "Dashboard", href: "/dashboard" },
  { keys: ["g", "j"], label: "Trading Journal", href: "/trading/journal" },
  { keys: ["g", "a"], label: "Oracle → Asset Scorecard", href: "/oracle/scorecard" },
  { keys: ["g", "f"], label: "Oracle → FX Scorecard", href: "/oracle/fx-scorecard" },
  { keys: ["g", "o"], label: "Oracle → Top Setups", href: "/oracle" },
  { keys: ["g", "c"], label: "Oracle → Compass", href: "/oracle/compass" },
  { keys: ["g", "n"], label: "NIFTY → Pulse", href: "/nifty/pulse" },
  { keys: ["g", "s"], label: "NIFTY → Scorecard", href: "/nifty/scorecard" },
  // `e` for Economic calendar — `c` is already Compass, and the calendar is a
  // top-level surface rather than an Oracle sub-tab, so it reads as its own
  // destination rather than "Oracle → something".
  { keys: ["g", "e"], label: "Economic Calendar", href: "/calendar" },
  // Not a route — the only `g` sequence that acts on the page you are already
  // on, which is why it is the only one carrying a scope. Grouped with the
  // rest because what a trader wants to scan is "everything `g` does".
  {
    keys: ["g", "t"],
    label: "Tools drawer",
    action: "open-tools",
    scope: "NIFTY & Oracle only",
  },
];

export const ACTION_SHORTCUTS: ShortcutDef[] = [
  { keys: ["n"], label: "New trade", action: "new-trade" },
  { keys: ["p"], label: "New planned trade", action: "new-planned" },
  { keys: ["?"], label: "Toggle this panel", action: "toggle-help" },
  {
    keys: ["/"],
    label: "Open the picker",
    handledElsewhere: true,
    scope: "Asset & FX scorecards",
  },
];

export const SHORTCUT_GROUPS: { title: string; items: ShortcutDef[] }[] = [
  { title: "Navigation", items: NAV_SHORTCUTS },
  { title: "Actions", items: ACTION_SHORTCUTS },
];

// ─── The guard ───────────────────────────────────────────────────────────────

/**
 * Anything that renders as a modal, a drawer, or a full-screen tool view.
 *
 * Every overlay in this codebase paints an `.lx-overlay-scrim` or is a
 * `[aria-modal="true"]` dialog, which covers the six real modals and drawers.
 * The three full-screen tool views (Flow Tracker, Pair Correlation, Full
 * Screen Analysis) have neither, so they carry `data-lucid-overlay` — an
 * explicit opt-in that also gives any future overlay one attribute to set.
 *
 * The help panel is the deliberate exception. It borrows the scrim's styling
 * but is excluded here, because a panel that lists `g d → Dashboard` and then
 * refuses to let you press `g d` is worse than useless.
 */
const OVERLAY_SELECTOR =
  '[aria-modal="true"], .lx-overlay-scrim:not(.lx-help-scrim), .lx-drawer-panel, [data-lucid-overlay]';

/** True while focus is somewhere the keystroke is a character, not a command. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true
  );
}

/** True while any modal, drawer, or full-screen tool view is mounted. */
export function isOverlayOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(OVERLAY_SELECTOR) !== null;
}

export interface GuardOptions {
  /**
   * `?` is Shift+/ on most layouts, so a blanket "no modifiers" rule would
   * mean it never fires. Exactly one binding opts out of the Shift half of
   * the rule; Ctrl/Cmd/Alt stay forbidden for it too.
   */
  allowShift?: boolean;
  /**
   * "page" (default) — suppressed while an overlay is open, because inside a
   * modal the trader is working, not navigating. "global" — survives an open
   * overlay, which is exactly when someone reaches for the help panel.
   */
  scope?: "page" | "global";
}

/**
 * The one guard every plain-key shortcut in the app runs through, including
 * the scorecard picker's `/`. A shortcut fires only when the trader is not
 * typing, is not holding a modifier, and — unless the binding is explicitly
 * global — is not inside an overlay.
 */
export function shortcutAllowed(e: KeyboardEvent, opts: GuardOptions = {}): boolean {
  // Mid-composition (IME) keystrokes belong to the text being composed.
  if (e.isComposing || e.keyCode === 229) return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (e.shiftKey && !opts.allowShift) return false;
  if (e.repeat) return false;
  if (isTypingTarget(e.target)) return false;
  if ((opts.scope ?? "page") === "page" && isOverlayOpen()) return false;
  return true;
}
