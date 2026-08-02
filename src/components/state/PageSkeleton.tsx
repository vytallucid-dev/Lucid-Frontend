"use client";

// Page-shaped placeholders for the analysis pages (NIFTY and Oracle). They all
// share one frame — page header, a strip of summary cards, then one or two tall
// content blocks — so a single parameterised skeleton covers them without
// pretending to be more precise than it is.
//
// The frame is what causes visible shift: it is what pushes the page down when
// it arrives. Reserving it is the whole job.

import { Skeleton, SkeletonCard } from "./Skeleton";

export function PageSkeleton({
  cards = 3,
  blocks = 1,
  blockHeight = 300,
  rows = 0,
}: {
  cards?: number;
  blocks?: number;
  blockHeight?: number;
  /** Hairline rows inside the first block, for the pages that end in a table. */
  rows?: number;
}) {
  return (
    <div className="p-4 sm:p-6 flex flex-col gap-5" aria-hidden="true">
      <div>
        <Skeleton bare height={26} width={196} />
        <Skeleton bare height={11} width={320} style={{ marginTop: 8 }} />
      </div>

      {cards > 0 && (
        <div className="lx-grid-metrics" style={{ ["--lx-cols" as string]: Math.min(cards, 4) }}>
          {Array.from({ length: cards }).map((_, i) => (
            <SkeletonCard key={i} height={116} />
          ))}
        </div>
      )}

      {Array.from({ length: blocks }).map((_, b) => (
        <div key={b} className="lx-card">
          <Skeleton bare height={9} width={132} />
          {rows > 0 && b === 0 ? (
            <div style={{ marginTop: 16 }}>
              {Array.from({ length: rows }).map((_, r) => (
                <div
                  key={r}
                  className="flex items-center gap-4"
                  style={{
                    height: 42,
                    borderTop: r === 0 ? undefined : "1px solid var(--lucid-line)",
                  }}
                >
                  <Skeleton bare height={11} width={`${26 + ((r * 11) % 24)}%`} />
                  <Skeleton bare height={11} width={64} style={{ marginLeft: "auto" }} />
                  <Skeleton bare height={11} width={40} />
                  <Skeleton bare height={18} width={34} radius={999} />
                </div>
              ))}
            </div>
          ) : (
            <Skeleton bare height={blockHeight} radius={10} style={{ marginTop: 16 }} />
          )}
        </div>
      ))}
    </div>
  );
}

/** For a result panel that sits inside an already-rendered page (Velocity,
 *  V-Bottom): only the panel is unknown, so only the panel is reserved. */
export function PanelSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="lx-card" aria-hidden="true">
      <Skeleton bare height={9} width={124} />
      <Skeleton bare height={height} radius={10} style={{ marginTop: 16 }} />
    </div>
  );
}
