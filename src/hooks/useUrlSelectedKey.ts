"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Selection state that starts from a URL search param and keeps the URL in
 * sync as it changes — so a page like a scorecard is linkable (share the URL,
 * land on the right instrument) and the back button behaves, without the
 * param fighting the picker on every render.
 *
 * Read-once semantics come from React itself: `useState`'s lazy initializer
 * runs exactly once, on mount. There is no effect re-applying the param when
 * the query invalidates or refetches — the failure mode this exists to avoid
 * (see the NIFTY scorecard's `?date=` handling, which re-syncs on every
 * `historyLite` change and can fight a selection made after arrival).
 *
 * Writes go through `history.replaceState` directly, NOT `router.replace()`.
 * The two look interchangeable but are not: `router.replace()` goes through
 * Next's App Router navigation lifecycle, which can re-request the route's
 * RSC payload even when only the query string changed. That is a refetch,
 * and this hook exists specifically so selecting an instrument never causes
 * one. Calling the native History API bypasses Next's router entirely — nothing
 * subscribes to it, so nothing refetches or remounts. The trade-off is that
 * `useSearchParams()` won't reactively reflect the new value; this hook never
 * reads it again after mount, so that trade-off costs nothing here.
 *
 * Replace, not push: selecting six instruments in a row must not leave six
 * history entries — one instrument-scorecard visit should be one back-button
 * step, same as it was before instrument selection was linkable at all.
 */
export function useUrlSelectedKey<T extends string>(
  paramName: string,
  isValidKey: (value: string) => value is T,
  fallback: T,
): [T, (next: T) => void] {
  const searchParams = useSearchParams();

  const [value, setValue] = useState<T>(() => {
    const raw = searchParams.get(paramName);
    return raw && isValidKey(raw) ? raw : fallback;
  });

  const setSelection = useCallback(
    (next: T) => {
      setValue(next);
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      url.searchParams.set(paramName, next);
      window.history.replaceState(null, "", url);
    },
    [paramName],
  );

  return [value, setSelection];
}
