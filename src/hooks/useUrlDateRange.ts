"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * A YYYY-MM-DD date-range pair, synced with `?from=&to=` — Fix 4's
 * deep-linkable history view. Mirrors useUrlSelectedKey's design exactly
 * (read-once on mount via useState's lazy initializer, write via
 * history.replaceState rather than router.replace so paging back a week
 * never triggers a Next.js RSC refetch) — see that hook's own doc for the
 * full reasoning; this is the same shape widened to two params instead of
 * one, because a range needs both edges to be deep-linkable, not just a
 * single selection.
 *
 * Replace, not push: paging back through six weeks must not leave six
 * history entries.
 */
export function useUrlDateRange(
  defaultFrom: string,
  defaultTo: string,
): [{ from: string; to: string }, (next: { from: string; to: string }) => void] {
  const searchParams = useSearchParams();
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  const [range, setRange] = useState(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    return {
      from: from && dateRe.test(from) ? from : defaultFrom,
      to: to && dateRe.test(to) ? to : defaultTo,
    };
  });

  const setUrlRange = useCallback((next: { from: string; to: string }) => {
    setRange(next);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set('from', next.from);
    url.searchParams.set('to', next.to);
    window.history.replaceState(null, "", url);
  }, []);

  return [range, setUrlRange];
}
