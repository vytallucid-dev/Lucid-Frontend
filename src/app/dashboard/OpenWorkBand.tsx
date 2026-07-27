"use client";

import { getDistanceToEntry, type Trade, type PlannedTrade } from "@/lib/demo-data";
import type { ApiPair } from "@/lib/api/trading";
import { useRevealOnScroll } from "./useRevealOnScroll";

// ─── Pill helpers ─────────────────────────────────────────────────────────────
// Moved verbatim from page.tsx.

function ConvictionPill({ conviction }: { conviction: string }) {
  if (conviction === "High")
    return (
      <span className="pill" style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "1px solid var(--lucid-accent-bd)" }}>
        High
      </span>
    );
  if (conviction === "Medium")
    return (
      <span className="pill" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line)" }}>
        Medium
      </span>
    );
  return (
    <span className="pill" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-3)", border: "1px solid var(--lucid-line)" }}>
      Low
    </span>
  );
}

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

// ─── Band 3 — Open work ───────────────────────────────────────────────────────
// Live Trades and Planned Trades, side by side on wide screens, stacked below
// lg. Same columns, same badges, same live pulse indicator, same row clicks as
// the old two-column strip's left card — just its own full band instead of
// sharing a card with Accounts.

export function OpenWorkBand({
  liveTrades,
  activePlanned,
  readyCount,
  pairsConfig,
  newLiveIds,
  newPlannedIds,
  onTradeClick,
  onPlannedClick,
  reducedMotion,
}: {
  liveTrades: Trade[];
  activePlanned: PlannedTrade[];
  readyCount: number;
  pairsConfig: ApiPair[];
  newLiveIds: Set<string>;
  newPlannedIds: Set<string>;
  onTradeClick: (t: Trade) => void;
  onPlannedClick: (p: PlannedTrade) => void;
  reducedMotion: boolean;
}) {
  const { ref, revealed } = useRevealOnScroll<HTMLDivElement>();
  const revealClass = revealed && !reducedMotion ? "lt-rise" : revealed ? "" : "opacity-0";

  return (
    <div ref={ref} className={`lx-grid-two ${revealClass}`}>
      {/* Live Trades */}
      <section>
        <div className="lx-band-head flex items-end justify-between gap-4">
          <div>
            <div className="lx-eyebrow">Open Positions</div>
            <h2 className="lx-heading">Live Trades</h2>
          </div>
          <span className="lx-metric-sm shrink-0" style={{ color: "var(--lucid-ink-3)" }}>
            {liveTrades.length}
          </span>
        </div>

        <div className="lx-card">
        {liveTrades.length === 0 ? (
          <p className="lx-body">No live trades running.</p>
        ) : (
          <div className="lx-rows">
            {liveTrades.map((t) => {
              const pairConf = pairsConfig.find((p) => p.symbol === t.pair);
              return (
                <button
                  key={t.id}
                  onClick={() => onTradeClick(t)}
                  className={`lx-row ${newLiveIds.has(t.id) ? "lt-row-new" : ""}`}
                >
                  <span style={{ fontSize: 15 }}>
                    {pairConf?.flag_a}{pairConf?.flag_b}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--lucid-ink)" }}>
                        {pairConf?.display_name ?? t.pair}
                      </span>
                      <span style={{ fontSize: 12, color: t.direction === "Buy" ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                        {t.direction === "Buy" ? "↑" : "↓"} {t.direction}
                      </span>
                    </div>
                    <span className="lx-micro">Entry {t.entry_price}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <span
                      className="pill"
                      style={{
                        background: "var(--lucid-pos-bg)",
                        color: "var(--lucid-pos)",
                        border: "1px solid var(--lucid-pos-bd)",
                        fontSize: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span
                        className="lt-pulse-dot"
                        style={{
                          width: 6,
                          height: 6,
                          background: "var(--lucid-pos)",
                        }}
                      />
                      Live
                    </span>
                    <ConvictionPill conviction={t.conviction} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
        </div>
      </section>

      {/* Planned Trades */}
      <section>
        <div className="lx-band-head flex items-end justify-between gap-4">
          <div>
            <div className="lx-eyebrow">Watchlist</div>
            <h2 className="lx-heading">Planned Trades</h2>
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

        <div className="lx-card">
        {activePlanned.length === 0 ? (
          <p className="lx-body">No setups planned.</p>
        ) : (
          <div className="lx-rows">
            {activePlanned.map((p) => {
              const pairConf = pairsConfig.find((pc) => pc.symbol === p.pair);
              const dist = getDistanceToEntry(p);
              const distLabel =
                dist.direction === "at"
                  ? "at entry"
                  : `${dist.pips}p ${dist.direction}`;
              const distColor =
                dist.direction === "at"
                  ? "var(--lucid-pos)"
                  : dist.pips <= 10
                  ? "var(--lucid-warn)"
                  : dist.pips <= 50
                  ? "var(--lucid-ink)"
                  : "var(--lucid-ink-3)";
              return (
                <button
                  key={p.id}
                  onClick={() => onPlannedClick(p)}
                  className={`lx-row ${newPlannedIds.has(p.id) ? "lt-row-new" : ""}`}
                >
                  <span style={{ fontSize: 15 }}>{pairConf?.flag_a}{pairConf?.flag_b}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--lucid-ink)" }}>
                        {pairConf?.display_name ?? p.pair}
                      </span>
                      <span style={{ fontSize: 12, color: p.direction === "Buy" ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                        {p.direction === "Buy" ? "↑" : "↓"}
                      </span>
                    </div>
                    <span className="lx-micro">@ {p.planned_entry}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="lx-value" style={{ color: distColor }}>
                      {distLabel}
                    </span>
                    <PlannedStatusPill status={p.status} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
        </div>
      </section>
    </div>
  );
}
