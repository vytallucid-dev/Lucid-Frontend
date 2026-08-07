"use client";

/**
 * Narrow, typed localStorage persistence for a single UI preference.
 *
 * This codebase had no UI-preference persistence before the calendar needed a
 * timezone that survives a reload. Rather than invent a general settings
 * framework for one value, this follows the only existing precedent —
 * ScorecardPicker's recently-viewed list — and generalises it exactly as far
 * as "one key, one validated value" and no further.
 *
 * Every path is defensive because a preference is a convenience, never a
 * requirement:
 *   - SSR / no `window`  → the fallback, no throw
 *   - storage unavailable (private mode, quota, disabled) → the fallback
 *   - corrupt or unrecognised stored value → the fallback
 *
 * A preference that cannot be read must never be able to break the page that
 * reads it.
 */

/**
 * Read a persisted preference, validating it before trusting it.
 *
 * `isValid` is required rather than optional: a stored string that is no
 * longer a legal value (an IANA zone dropped from the options list, a value
 * written by an older build, a hand-edited entry) must degrade to the
 * fallback rather than flow into the app as a valid-looking preference. For
 * the timezone this is load-bearing — an unknown zone reaching `Intl` throws
 * a RangeError during render.
 */
export function readPreference(
  key: string,
  isValid: (value: string) => boolean,
  fallback: string,
): string {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return isValid(raw) ? raw : fallback;
  } catch {
    return fallback;
  }
}

/** Persist a preference. Silently a no-op when storage is unavailable. */
export function writePreference(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode / quota exceeded — the in-memory state still holds for
    // this session, it just will not survive a reload.
  }
}
