"use client";

// ─── Band 2 — Live positions ─────────────────────────────────────────────────
// The heaviest band on the page, because an open position is the most
// consequential thing on it. One card per trade, two-up on wide screens.
//
// A note on what these cards can honestly show. The mock's PEAK / WORST columns
// and its live R multiple have no data behind them: the Trade record carries no
// MFE or MAE field, and blended_rr / blended_pnl serialise to 0 while a trade
// is open (they are computed on close). Rather than print a fabricated 0.0R as
// the card's headline, the headline is risk % — a real stored field, and the
// number that actually matters while a position is running. Every field the old
// row showed is still here: flags, pair, direction, entry price, the live pulse
// pill, and the conviction badge.

import { formatDate, type Trade, type Execution } from "@/lib/demo-data";
import type { ApiPair } from "@/lib/api/trading";
import { useRevealOnScroll } from "./useRevealOnScroll";

/** One open execution, with the idea it belongs to. A card is per-execution
 * (per-account open risk) now, not per-idea — the same idea running in two
 * accounts is two cards, since each account carries its own risk/lot/entry. */
export interface LivePosition {
  trade: Trade;
  execution: Execution;
}

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

/** Where entry sits between stop and target, 0–1. Pure geometry for the track —
 *  the axis is normalised so stop is always the left end, which keeps a sell
 *  reading the same way round as a buy. Stop/target are the idea's plan;
 *  entry is this execution's actual fill, which may sit slightly off-plan. */
function entryFraction(trade: Trade, execution: Execution): number {
  const span = Math.abs(trade.planned_main_tp - trade.planned_sl);
  if (!Number.isFinite(span) || span === 0) return 0.3;
  return Math.max(0, Math.min(1, Math.abs(execution.entry_price - trade.planned_sl) / span));
}

function PositionCard({
  trade,
  execution,
  pairConf,
  accountName,
  isNew,
  onClick,
}: {
  trade: Trade;
  execution: Execution;
  pairConf: ApiPair | undefined;
  accountName: string | undefined;
  isNew: boolean;
  onClick: () => void;
}) {
  const isBuy = trade.direction === "Buy";
  const dir = isBuy ? "var(--lucid-pos)" : "var(--lucid-neg)";
  const frac = entryFraction(trade, execution);

  return (
    <button
      onClick={onClick}
      className={`lx-card dash-pos ${isNew ? "lt-row-new" : ""}`}
      style={{ ["--dash-glow" as string]: dir }}
    >
      <span className="dash-pos-glow" aria-hidden="true" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 relative">
        <div className="flex items-center gap-3 min-w-0">
          <span style={{ width: 3, height: 44, borderRadius: 3, background: dir, flexShrink: 0 }} aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 15 }}>
                {pairConf?.flag_a}
                {pairConf?.flag_b}
              </span>
              <span
                className="truncate"
                style={{
                  fontFamily: "var(--lucid-font-serif)",
                  fontSize: 24,
                  fontWeight: 300,
                  letterSpacing: "-0.02em",
                  color: "var(--lucid-ink)",
                }}
              >
                {pairConf?.display_name ?? trade.pair}
              </span>
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
                  flexShrink: 0,
                }}
              >
                <span className="lt-pulse-dot" style={{ width: 6, height: 6, background: "var(--lucid-pos)" }} />
                Live
              </span>
            </div>
            <div className="lx-eyebrow" style={{ marginTop: 5 }}>
              {isBuy ? "↑" : "↓"} {trade.direction} · {trade.model}
              {accountName ? ` · ${accountName}` : ""}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div
            className="lx-tnum"
            style={{
              fontFamily: "var(--lucid-font-mono)",
              fontSize: 38,
              fontWeight: 300,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: dir,
            }}
          >
            {execution.risk_pct}
            <span style={{ fontSize: 18 }}>%</span>
          </div>
          <div className="lx-eyebrow" style={{ marginTop: 6 }}>
            Risk · opened {formatDate(trade.date_opened)}
          </div>
        </div>
      </div>

      {/* Stop → entry → target */}
      <div style={{ marginTop: 30 }}>
        <div className="flex justify-between" style={{ marginBottom: 9 }}>
          <span className="lx-eyebrow">Stop</span>
          <span className="lx-eyebrow">Entry</span>
          <span className="lx-eyebrow">Target</span>
        </div>
        <div className="dash-track">
          <span className="dash-track-fill" style={{ left: 0, width: `${frac * 100}%` }} aria-hidden="true" />
          <span className="dash-track-tick" style={{ left: 0 }} aria-hidden="true" />
          <span className="dash-track-tick" style={{ left: "100%" }} aria-hidden="true" />
          <span className="dash-track-mark" style={{ left: `${frac * 100}%` }} aria-hidden="true" />
        </div>
        <div
          className="flex justify-between lx-tnum"
          style={{ marginTop: 9, fontFamily: "var(--lucid-font-mono)", fontSize: 11, color: "var(--lucid-ink-2)" }}
        >
          <span>{trade.planned_sl}</span>
          <span style={{ color: "var(--lucid-ink)" }}>{execution.entry_price}</span>
          <span>{trade.planned_main_tp}</span>
        </div>
      </div>

      {/* Footer */}
      <div
        className="grid grid-cols-3 gap-4"
        style={{ marginTop: 26, paddingTop: 20, borderTop: "1px solid var(--lucid-line)" }}
      >
        <div>
          <div className="lx-eyebrow">Lot size</div>
          <div className="lx-value" style={{ marginTop: 7, color: "var(--lucid-ink)" }}>
            {execution.lot_size}
          </div>
        </div>
        <div>
          <div className="lx-eyebrow">Session</div>
          <div className="lx-value" style={{ marginTop: 7, color: "var(--lucid-ink)" }}>
            {trade.session}
          </div>
        </div>
        <div>
          <div className="lx-eyebrow">Conviction</div>
          <div style={{ marginTop: 7 }}>
            <ConvictionPill conviction={trade.conviction} />
          </div>
        </div>
      </div>
    </button>
  );
}

export function LivePositionsBand({
  livePositions,
  pairsConfig,
  accountNames,
  newLiveIds,
  openRiskPct,
  onTradeClick,
  reducedMotion,
}: {
  livePositions: LivePosition[];
  pairsConfig: ApiPair[];
  accountNames: Map<string, string>;
  newLiveIds: Set<string>;
  /** Combined risk across the open positions, as a percentage. */
  openRiskPct: number;
  onTradeClick: (t: Trade) => void;
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
          <div className="lx-eyebrow">Open Positions</div>
          <h2 className="dash-title">Live Trades</h2>
        </div>
        <span
          className="lx-micro lx-tnum shrink-0"
          style={{ letterSpacing: "0.14em", whiteSpace: "nowrap" }}
        >
          {livePositions.length} OPEN · {openRiskPct.toFixed(1)}% RISK
        </span>
      </div>

      {livePositions.length === 0 ? (
        <div className="lx-card">
          <p className="lx-body">No live trades running.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {livePositions.map(({ trade, execution }) => (
            <PositionCard
              key={execution.id}
              trade={trade}
              execution={execution}
              pairConf={pairsConfig.find((p) => p.symbol === trade.pair)}
              accountName={accountNames.get(execution.account_id)}
              isNew={newLiveIds.has(execution.id)}
              onClick={() => onTradeClick(trade)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
