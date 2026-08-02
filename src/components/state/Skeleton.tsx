"use client";

// ─── Loading system ──────────────────────────────────────────────────────────
// Extends the existing state/ family (LoadingState, ErrorState, EmptyState)
// rather than replacing it. The rule this system encodes:
//
//   • Content that has a known shape gets a SKELETON of that shape, so the page
//     occupies its final geometry before the data lands and nothing moves when
//     it does.
//   • Content already on screen never gets blanked. A key switch holds the old
//     content, softened; a background refetch shows a pip and nothing else.
//   • Nothing is shown at all for the first ~100ms, because React Query serves
//     cached data instantly and a skeleton that flashes for 40ms is worse than
//     no skeleton.
//   • A spinner is correct only where there is no shape to promise — an action
//     in flight (saving, uploading, triggering a job). Those keep Loader2.
//
// Motion: the sheen is pure CSS and is removed entirely under
// prefers-reduced-motion (see .lx-skeleton in lucid-theme.css), so a static
// block is what a reduced-motion user gets. No JS motion gate is needed here.

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/** True only once `active` has held for `delayMs`. Keeps an instant cache hit
 *  from flashing a loader, and resets the moment the wait ends. */
export function useDelayedFlag(active: boolean, delayMs: number): boolean {
  const [on, setOn] = useState(false);

  // Clearing happens during render, not in an effect: the instant the wait ends
  // the flag must already be false, or the loader paints for one extra frame
  // after the data landed — the exact flash this hook exists to prevent.
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    if (!active) setOn(false);
  }

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setOn(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);

  return on;
}

export function Skeleton({
  width,
  height,
  radius,
  className = "",
  style,
  bare = false,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
  /** Drop the hairline edge — for lines inside an already-bordered card. */
  bare?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`lx-skeleton ${bare ? "lx-skeleton-bare" : ""} ${className}`}
      style={{
        display: "block",
        width: width ?? "100%",
        height: height ?? 12,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

/** A paragraph's worth of lines. The last line is short, the way text is. */
export function SkeletonText({
  lines = 3,
  height = 11,
  gap = 8,
  width = "100%",
}: {
  lines?: number;
  height?: number;
  gap?: number;
  width?: number | string;
}) {
  return (
    <span style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          bare
          height={height}
          width={i === lines - 1 && lines > 1 ? "62%" : width}
        />
      ))}
    </span>
  );
}

/** Hairline-separated rows, matching the .lx-rows / .lx-row rhythm. */
export function SkeletonRows({
  rows = 4,
  height = 44,
  className = "",
}: {
  rows?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div className={`lx-rows ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3" style={{ height }}>
          <Skeleton bare height={11} width={`${34 + ((i * 13) % 26)}%`} />
          <Skeleton bare height={11} width={62} style={{ marginLeft: "auto" }} />
        </div>
      ))}
    </div>
  );
}

/**
 * A table's skeleton, built from the same `<colgroup>` widths as the real
 * table. That is the whole point: same columns, same row height, same shell —
 * so when the rows arrive, not one pixel moves.
 */
export function SkeletonTable({
  columns,
  rows = 8,
  rowHeight = 44,
  headHeight = 33,
  minWidth,
  shell = true,
}: {
  /** Column widths in px, in order. `undefined` for a fluid column. */
  columns: (number | undefined)[];
  rows?: number;
  rowHeight?: number;
  headHeight?: number;
  minWidth?: number;
  /** Wrap in the bordered card shell tables normally sit in. */
  shell?: boolean;
}) {
  const table = (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ tableLayout: "fixed", minWidth }}>
        <colgroup>
          {columns.map((w, i) => (
            <col key={i} style={w === undefined ? undefined : { width: w }} />
          ))}
        </colgroup>
        <tbody>
          <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
            {columns.map((_, i) => (
              <td key={i} style={{ height: headHeight, padding: "0 12px" }}>
                {i > 0 && <Skeleton bare height={8} width="58%" />}
              </td>
            ))}
          </tr>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} style={{ borderBottom: "1px solid var(--lucid-line)" }}>
              {columns.map((_, c) => (
                <td key={c} style={{ height: rowHeight, padding: "0 12px" }}>
                  {c > 0 && (
                    <Skeleton
                      bare
                      height={11}
                      width={`${52 + ((r * 7 + c * 11) % 36)}%`}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!shell) return table;
  return (
    <div
      aria-hidden="true"
      className="rounded-xl overflow-hidden"
      style={{
        border: "1px solid var(--lucid-line)",
        background: "var(--lucid-grad-surface)",
        boxShadow: "var(--lucid-elev-1)",
      }}
    >
      {table}
    </div>
  );
}

/**
 * The same idea as SkeletonTable for the tables built from CSS grid rather than
 * <table> (accounts). Pass the page's own `grid-template-columns` string and the
 * columns line up to the pixel.
 */
export function SkeletonGridRows({
  columns,
  rows = 8,
  rowHeight = 48,
  headHeight = 41,
  minWidth,
  columnCount,
}: {
  columns: string;
  rows?: number;
  rowHeight?: number;
  headHeight?: number;
  minWidth?: number;
  columnCount: number;
}) {
  return (
    <div
      aria-hidden="true"
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--lucid-line)", background: "var(--lucid-surface)" }}
    >
      <div className="overflow-x-auto">
        <div
          className="grid px-4 items-center"
          style={{
            gridTemplateColumns: columns,
            minWidth,
            height: headHeight,
            borderBottom: "1px solid var(--lucid-line)",
            background: "var(--lucid-surface-2)",
          }}
        >
          {Array.from({ length: columnCount }).map((_, i) => (
            <Skeleton key={i} bare height={8} width="56%" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid px-4 items-center"
            style={{
              gridTemplateColumns: columns,
              minWidth,
              height: rowHeight,
              borderBottom: "1px solid var(--lucid-line)",
              background: r % 2 === 0 ? "var(--lucid-surface)" : "var(--lucid-surface-2)",
            }}
          >
            {Array.from({ length: columnCount }).map((_, c) => (
              <Skeleton key={c} bare height={11} width={`${48 + ((r * 7 + c * 13) % 38)}%`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A card-shaped placeholder, for grids of cards (accounts, metric tiles). */
export function SkeletonCard({
  height = 132,
  className = "",
  padded = true,
}: {
  height?: number;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`lx-card ${padded ? "lx-card-compact" : ""} ${className}`}
      style={{ height }}
    >
      <Skeleton bare height={9} width={92} />
      <Skeleton bare height={24} width="58%" style={{ marginTop: 14 }} />
      <Skeleton bare height={10} width="40%" style={{ marginTop: 12 }} />
    </div>
  );
}

/** Background-refetch indicator. Subtle by design — it must never look like
 *  the page is unavailable, because it isn't. */
export function RefetchPip({ label = "Updating" }: { label?: string }) {
  return (
    <span className="lx-refetch" role="status" aria-live="polite">
      <span className="lx-refetch-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Continuity boundary. Renders `children` when they exist; while `busy`, holds
 * the last children it saw at reduced opacity (no collapse, no flash, no
 * shift); falls back to `skeleton` only when there is nothing to hold — the
 * genuine first load.
 *
 * This is what makes switching asset on a scorecard feel continuous without
 * touching the query: nothing about the fetch changes, only what is on screen
 * while it is in flight.
 */
export function ContentSwap<T>({
  data,
  busy,
  skeleton,
  empty = null,
  children,
  minHeight,
  className = "",
}: {
  /** The query's data. `undefined` while a new key is in flight. */
  data: T | undefined;
  busy: boolean;
  skeleton: ReactNode;
  /** Shown when the query resolved with nothing. */
  empty?: ReactNode;
  /** Receives the held data plus whether it is currently being replaced, so a
   *  caller can show the INCOMING selection's name while the old numbers are
   *  still on screen. Without this the card contradicts the picker for the whole
   *  load — it keeps naming the thing you just navigated away from. */
  children: (data: T, holding: boolean) => ReactNode;
  minHeight?: number;
  className?: string;
}) {
  // Hold the last data we were given, so a key switch renders the previous
  // scorecard instead of collapsing to nothing. This is the documented
  // "adjust state during render" pattern, and it is safe because query data has
  // a stable identity between renders — it only reassigns when the data itself
  // actually changes, never every render.
  const [held, setHeld] = useState<T | undefined>(data);
  if (data !== undefined && data !== held) setHeld(data);

  const shown = data ?? held;
  const holding = busy && shown !== undefined;
  // 90ms, down from 140. A cached switch never reaches this code at all (the
  // query resolves synchronously, so `busy` is false and no timer starts), which
  // means this threshold's only job is suppressing a flash on a very fast
  // network round-trip — and at 140ms it was also suppressing the entire signal
  // for ordinary ones.
  const softened = useDelayedFlag(holding, 90);
  const showSkeleton = useDelayedFlag(busy && shown === undefined, 100);

  if (shown !== undefined) {
    const dim = holding && softened;
    // The dim is NOT applied here. CSS opacity composites a whole subtree, so a
    // child can never be crisper than its dimmed parent — and part of this
    // subtree (the name of what you just selected) must stay crisp while the
    // rest ghosts. So this reports the state and the caller decides which
    // regions wear `.lx-swap-busy`.
    return (
      <div className={className} aria-busy={holding || undefined}>
        {children(shown, dim)}
      </div>
    );
  }

  return (
    <div className={className} style={minHeight ? { minHeight } : undefined} aria-busy={busy}>
      {busy ? (showSkeleton ? skeleton : null) : empty}
    </div>
  );
}
