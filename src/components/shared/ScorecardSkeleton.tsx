"use client";

// First-load placeholder for the Asset and FX scorecards. Same two-column
// geometry, same card stack, same gaps as the real layout — so when the real
// thing arrives it lands exactly where the skeleton stood.
//
// Only ever seen on a genuine first load: once a scorecard has been rendered,
// switching asset holds the previous one instead (see ContentSwap).

import { Skeleton } from "@/components/state/Skeleton";

function CardBlock({ height, lines = 0 }: { height: number; lines?: number }) {
  return (
    <div className="lx-card lx-card-compact" style={{ height }} aria-hidden="true">
      <Skeleton bare height={9} width={110} />
      {lines > 0 && (
        <div className="flex flex-col gap-3" style={{ marginTop: 16 }}>
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <Skeleton bare height={10} width={`${38 + ((i * 11) % 22)}%`} />
              <Skeleton bare height={10} width={46} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionBlock({ rows }: { rows: number }) {
  return (
    <div
      className="lt-card overflow-hidden"
      aria-hidden="true"
      style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--lucid-line)" }}
      >
        <Skeleton bare height={9} width={120} />
        <Skeleton bare height={18} width={44} radius={999} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4"
          style={{ height: 41, borderBottom: "1px solid var(--lucid-line)" }}
        >
          <Skeleton bare height={11} width={`${28 + ((i * 9) % 20)}%`} />
          <Skeleton bare height={11} width={54} style={{ marginLeft: "auto" }} />
          <Skeleton bare height={11} width={54} />
          <Skeleton bare height={11} width={30} />
        </div>
      ))}
    </div>
  );
}

export function ScorecardSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* LEFT PANEL */}
      <div className="w-full lg:w-70 lg:shrink-0 flex flex-col gap-4">
        <div
          className="lx-card flex flex-col items-center justify-center gap-3"
          style={{ height: 232 }}
          aria-hidden="true"
        >
          <Skeleton bare height={104} width={168} radius={12} />
          <Skeleton bare height={22} width={96} radius={999} />
          <Skeleton bare height={12} width={120} />
        </div>
        <CardBlock height={132} lines={3} />
        <CardBlock height={196} lines={4} />
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {Array.from({ length: sections }).map((_, i) => (
          <SectionBlock key={i} rows={4 + (i % 2)} />
        ))}
      </div>
    </div>
  );
}
