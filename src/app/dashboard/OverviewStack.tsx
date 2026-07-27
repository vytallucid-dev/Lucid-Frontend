"use client";

import { AnimatedNumber } from "@/components/motion";
import { formatCurrency } from "@/lib/demo-data";

export interface DashboardMetrics {
  managedCapital: number;
  evaluationCapital: number;
  overallPnl: number;
  activeCount: number;
  wr: number;
  tradeCount: number;
  hasProp: boolean;
  challengesActive: number;
  bestName: string;
  bestPct: number;
}

// ─── Band 1 right column — Overview metric stack ──────────────────────────────
// Same three-to-four fields as the old "Overview" grid's remaining cards
// (Total Balance and Overall P&L moved to the hero's left column per B2 —
// Active Accounts, Rolling Win Rate, and the adaptive fifth card stay here),
// stacked vertically instead of gridded. Same AnimatedNumber count-ups, same
// flash classes, same adaptive-card switching condition (metrics.hasProp).

export function OverviewStack({
  metrics,
  allAccountsCount,
  wrFlash,
}: {
  metrics: DashboardMetrics;
  allAccountsCount: number;
  wrFlash: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Active Accounts */}
      <div className="lt-metric p-5 flex flex-col gap-2">
        <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--lucid-ink-3)" }}>
          Active Accounts
        </span>
        <span className="lt-num" style={{ fontSize: 28, fontWeight: 700, color: "var(--lucid-ink)" }}>
          <AnimatedNumber value={metrics.activeCount} format={(n) => `${Math.round(n)}`} />
        </span>
        <span style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>
          {allAccountsCount} total accounts
        </span>
      </div>

      {/* Rolling Win Rate — a neutral stat, not a loss signal, so it stays ink-toned regardless of value */}
      <div className={`lt-metric ${wrFlash} p-5 flex flex-col gap-2`}>
        <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--lucid-ink-3)" }}>
          Rolling Win Rate
        </span>
        <span
          className="lt-num"
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "var(--lucid-ink)",
          }}
        >
          <AnimatedNumber value={metrics.wr} format={(n) => `${Math.round(n)}%`} />
        </span>
        <span style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>Last {metrics.tradeCount} trades</span>
      </div>

      {/* Adaptive: Challenges Active (if prop accounts) else Best Performer */}
      <div className="lt-metric p-5 flex flex-col gap-2">
        {metrics.hasProp ? (
          <>
            <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--lucid-ink-3)" }}>
              Challenges Active
            </span>
            <span className="lt-num" style={{ fontSize: 28, fontWeight: 700, color: "var(--lucid-ctx)" }}>
              <AnimatedNumber value={metrics.challengesActive} format={(n) => `${Math.round(n)}`} />
            </span>
            <span style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>In challenge phase</span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--lucid-ink-3)" }}>
              Best Performing Account
            </span>
            <span className="truncate" style={{ fontSize: 18, fontWeight: 700, color: "var(--lucid-ink)" }}>
              {metrics.bestName}
            </span>
            <span className="lt-num" style={{ fontSize: 11, color: metrics.bestPct >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
              {metrics.bestPct >= 0 ? "+" : ""}{metrics.bestPct.toFixed(2)}%
            </span>
          </>
        )}
      </div>
    </div>
  );
}
