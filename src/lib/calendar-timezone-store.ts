"use client";

// The calendar's selected timezone, as an external store.
//
// A store rather than component state because the value is persisted, and a
// persisted value cannot be read during the initial render: the server has no
// localStorage, so `useState(readPreference(...))` would render the default on
// the server and the stored zone on the client — a hydration mismatch. Reading
// it in an effect and calling setState fixes the mismatch but trips this
// codebase's `react-hooks/set-state-in-effect` rule, and for good reason: it
// is a cascading render on every mount.
//
// useSyncExternalStore is the primitive built for exactly this shape — it
// takes a separate server snapshot, so the server renders the default and the
// client reads storage on its first client-side snapshot, with no effect and
// no extra render. Mirrors dashboard/TodayBand.tsx and lib/tools-store.ts.

import {
  DEFAULT_TIMEZONE,
  isKnownTimezone,
} from "./calendar-time";
import { readPreference, writePreference } from "./ui-preference";

const STORAGE_KEY = "lucid.calendar.timezone";

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Cached so `getSnapshot` returns a referentially stable value. Returning a
 * freshly-read string on every call would be fine for a primitive, but the
 * cache also means storage is touched once rather than on every render.
 * `null` means "not yet read from storage".
 */
let current: string | null = null;

export function subscribeTimezone(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Client snapshot — lazily hydrated from storage on first read. */
export function getTimezoneSnapshot(): string {
  if (current === null) {
    current = readPreference(STORAGE_KEY, isKnownTimezone, DEFAULT_TIMEZONE);
  }
  return current;
}

/**
 * Server snapshot — always the default, never storage. This is what makes the
 * server's HTML and the client's first paint agree; React then re-renders with
 * the real client snapshot without a hydration error.
 */
export function getTimezoneServerSnapshot(): string {
  return DEFAULT_TIMEZONE;
}

/** Change the zone and persist it. A no-op if the value is not offered. */
export function setTimezone(next: string): void {
  if (!isKnownTimezone(next)) return;
  if (next === current) return;
  current = next;
  writePreference(STORAGE_KEY, next);
  listeners.forEach((l) => l());
}
