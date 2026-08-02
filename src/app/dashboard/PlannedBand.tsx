"use client";

// ─── Band 5 — Planned ────────────────────────────────────────────────────────
// Lighter than Live Positions on purpose: one card, hairline-separated rows.
// A setup being watched is not the same weight of thing as capital at risk, and
// the page should say so before you read a word of it.
//
// Every field from the old planned row survives — flags, pair, direction,
// planned entry, the distance label with its exact thresholds and colours, and
// the status pill — plus a bar that gives the distance a shape.

import { getDistanceToEntry, type PlannedTrade } from "@/lib/demo-data";
import type { ApiPair } from "@/lib/api/trading";
import { useRevealOnScroll } from "./useRevealOnScroll";

function PlannedStatusPill({ status }: { status: string }) {
  if (status === "Ready")
    return (
      <span className="pill" style={{ background: "var(--lucid-warn-bg)", color: "var(--lucid-warn)", border: "1px solid var(--lucid-warn-bd)" }}>
        Ready
      </span>
    );
  return (
    <span className="pill" style={{ background: "var(--lucid-ctx-bg)", color: "var(--lucid-ctx)", border: "1px solid var(--lucid-ctx-bd)" }}>
      Watching
    </span>
  );
}

export function PlannedBand({
  activePlanned,
  readyCount,
  pairsConfig,
  newPlannedIds,
  onPlannedClick,
  reducedMotion,
}: {
  activePlanned: PlannedTrade[];
  readyCount: number;
  pairsConfig: ApiPair[];
  newPlannedIds: Set<string>;
  onPlannedClick: (p: PlannedTrade) => void;
  reducedMotion: boolean;
}) {
  const { ref, revealed } = useRevealOnScroll<HTMLDivElement>();

  return (
    <section
      ref={ref}
      className={revealed && !reducedMotion ? "lt-rise" : revealed ? "" : "opacity-0"}
    >
      <div className="dash-head">
        <div>
          <div className="lx-eyebrow">Watchlist</div>
          <h2 className="dash-title">Planned Trades</h2>
        </div>
        <span
          className="pill lx-tnum shrink-0"
          style={{
            background: readyCount > 0 ? "var(--lucid-warn-bg)" : "var(--lucid-ctx-bg)",
            color: readyCount > 0 ? "var(--lucid-warn)" : "var(--lucid-ctx)",
            border: readyCount > 0 ? "1px solid var(--lucid-warn-bd)" : "1px solid var(--lucid-ctx-bd)",
            fontSize: 10,
          }}
        >
          {readyCount} ready
        </span>
      </div>

      {activePlanned.length === 0 ? (
        <div className="lx-card">
          <p className="lx-body">No setups planned.</p>
        </div>
      ) : (
        <div className="lx-card" style={{ paddingBlock: 6 }}>
          <div className="lx-rows">
            {activePlanned.map((p) => {
              const pairConf = pairsConfig.find((pc) => pc.symbol === p.pair);
              const dist = getDistanceToEntry(p);
              const distLabel = dist.direction === "at" ? "at entry" : `${dist.pips}p ${dist.direction}`;
              const distColor =
                dist.direction === "at"
                  ? "var(--lucid-pos)"
                  : dist.pips <= 10
                    ? "var(--lucid-warn)"
                    : dist.pips <= 50
                      ? "var(--lucid-ink)"
                      : "var(--lucid-ink-3)";
              const ready = p.status === "Ready";
              // Bar shape only — the authoritative number is the label beside it.
              const fill = Math.max(4, Math.min(100, 100 - dist.pips));

              return (
                <button
                  key={p.id}
                  onClick={() => onPlannedClick(p)}
                  className={`dash-plan-row ${newPlannedIds.has(p.id) ? "lt-row-new" : ""}`}
                >
                  <span style={{ fontSize: 15, flexShrink: 0 }}>
                    {pairConf?.flag_a}
                    {pairConf?.flag_b}
                  </span>

                  <div style={{ width: 108, flexShrink: 0, minWidth: 0 }}>
                    <div className="truncate" style={{ fontSize: 14, color: "var(--lucid-ink)" }}>
                      {pairConf?.display_name ?? p.pair}
                    </div>
                    <div
                      className="lx-eyebrow"
                      style={{ color: p.direction === "Buy" ? "var(--lucid-pos)" : "var(--lucid-neg)", marginTop: 3 }}
                    >
                      {p.direction === "Buy" ? "↑" : "↓"} {p.direction}
                    </div>
                  </div>

                  <span
                    className="lx-value shrink-0 hidden sm:inline"
                    style={{ width: 96, color: "var(--lucid-ink-2)" }}
                  >
                    @ {p.planned_entry}
                  </span>

                  <div className="flex-1 flex items-center gap-3 min-w-0">
                    <div className="dash-plan-track">
                      <div
                        style={{
                          height: 3,
                          width: `${fill}%`,
                          background: ready ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                          borderRadius: 3,
                        }}
                      />
                    </div>
                    <span
                      className="lx-value shrink-0"
                      style={{ color: distColor, minWidth: 76, textAlign: "right" }}
                    >
                      {distLabel}
                    </span>
                  </div>

                  <span className="shrink-0">
                    <PlannedStatusPill status={p.status} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
