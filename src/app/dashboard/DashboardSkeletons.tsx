"use client";

// Band-shaped placeholders for the Dashboard. Each mirrors the real band's
// header rhythm (.lx-band-head), card, and content height, so the page stands
// at its final height while the trades/accounts/planned queries are in flight
// and nothing moves when they land.
//
// Replaces the single centred dot-loader that used to stand in for three bands
// at once — which reserved none of their height, so the page jumped twice.

import { Skeleton, SkeletonRows } from "@/components/state/Skeleton";

function BandHead() {
  return (
    <div className="dash-head">
      <div>
        <Skeleton bare height={9} width={92} />
        <Skeleton bare height={27} width={210} style={{ marginTop: 12 }} />
      </div>
    </div>
  );
}

/** NIFTY pulse card — one row of identity + three metrics + sparkline. */
export function NiftyPulseSkeleton() {
  return (
    <div className="lx-card" aria-hidden="true">
      <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
        <div className="flex items-center gap-2.5">
          <Skeleton bare width={22} height={22} radius={999} />
          <div className="flex flex-col gap-1.5">
            <Skeleton bare height={9} width={96} />
            <Skeleton bare height={26} width={132} />
          </div>
        </div>
        <div className="flex items-center gap-10">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton bare height={9} width={58} />
              <Skeleton bare height={i === 0 ? 28 : 22} width={i === 0 ? 76 : 58} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 ml-auto">
          <Skeleton bare width={100} height={32} />
          <Skeleton bare width={96} height={10} />
        </div>
      </div>
    </div>
  );
}

/** Performance band — the stat rail and the 380px chart, at their real sizes. */
export function PerformanceBandSkeleton() {
  return (
    <section aria-hidden="true">
      <div className="dash-head">
        <div>
          <Skeleton bare height={9} width={92} />
          <Skeleton bare height={27} width={210} style={{ marginTop: 12 }} />
        </div>
        <Skeleton width={228} height={32} radius={10} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6">
        <div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ paddingBottom: 20, marginBottom: 20 }}>
              <Skeleton bare height={9} width={96} />
              <Skeleton bare height={30} width="66%" style={{ marginTop: 8 }} />
            </div>
          ))}
        </div>
        <div className="lx-card">
          <Skeleton bare height={380} radius={10} />
        </div>
      </div>
    </section>
  );
}

/** Live positions — two cards at the real card height. */
export function LivePositionsSkeleton() {
  return (
    <section aria-hidden="true">
      <BandHead />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[0, 1].map((i) => (
          <div key={i} className="lx-card" style={{ height: 320 }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Skeleton bare width={3} height={44} radius={3} />
                <div>
                  <Skeleton bare height={24} width={132} />
                  <Skeleton bare height={9} width={104} style={{ marginTop: 8 }} />
                </div>
              </div>
              <div>
                <Skeleton bare height={38} width={78} />
                <Skeleton bare height={9} width={110} style={{ marginTop: 8 }} />
              </div>
            </div>
            <Skeleton bare height={5} radius={5} style={{ marginTop: 44 }} />
            <div className="grid grid-cols-3 gap-4" style={{ marginTop: 40 }}>
              {[0, 1, 2].map((c) => (
                <div key={c}>
                  <Skeleton bare height={9} width={62} />
                  <Skeleton bare height={14} width={54} style={{ marginTop: 8 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Planned — one card of hairline rows. */
export function PlannedBandSkeleton() {
  return (
    <section aria-hidden="true">
      <BandHead />
      <div className="lx-card">
        <SkeletonRows rows={3} height={52} />
      </div>
    </section>
  );
}

/** Accounts — the card grid. */
export function AccountsBandSkeleton() {
  return (
    <section aria-hidden="true">
      <BandHead />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="lx-card" style={{ height: 178 }}>
            <Skeleton bare height={9} width={80} />
            <Skeleton bare height={14} width="62%" style={{ marginTop: 12 }} />
            <Skeleton bare height={28} width="52%" style={{ marginTop: 18 }} />
            <div className="flex items-center gap-2" style={{ marginTop: 22 }}>
              <Skeleton bare height={8} width={40} />
              <Skeleton bare height={5} radius={3} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
