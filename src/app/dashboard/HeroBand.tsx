"use client";

import { ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/demo-data";
import type { ApiPair } from "@/lib/api/trading";
import { AnimatedNumber, AnimatedGreeting, usePrefersReducedMotion } from "@/components/motion";
import { AlignmentField } from "./AlignmentField";
import { HeroAmbience, useRegimeLabel } from "./HeroAmbience";
import type { DashboardMetrics } from "./OverviewStack";
import type { PairBias } from "./dashboard-helpers";

// ─── Band 1 — Hero (Step 6: full viewport) ────────────────────────────────────
// Replaces the Step 5 three-column hero. Layout, wide screens, per B2:
//   Top left:     TOTAL BALANCE (largest number on the page) → Overall P&L
//                 → greeting/status as small supporting text.
//   Top right:    Active Accounts / Rolling Win Rate / adaptive 5th, compact,
//                 hairline-separated stack.
//   Centre:       the alignment field.
//   Bottom left:  "FUNDAMENTAL BIAS · LIVE" label + one explainer line.
//   Bottom right: a quiet scroll affordance.
// Quick Actions and the chat bar moved to their own band below the fold
// (QuickActionsBand) — same behaviour, just relocated, per B2.
//
// Every field/count-up/flash-class here is the same one Step 5's hero used;
// nothing is new copy or a new calculation. The compact top-right stat stack
// below is a hero-local compact rendering of the same three Overview cards
// (Active Accounts / Rolling Win Rate / adaptive 5th) — same fields, same
// AnimatedNumber count-ups, same flash class, same hasProp switching
// condition — just smaller and hairline-separated instead of bordered cards,
// per B2's "compact... they support; they don't compete."

function CompactStat({
  label,
  value,
  sub,
  color,
  flashClass,
  divider = true,
}: {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  color?: string;
  flashClass?: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`${flashClass ?? ""} py-3`}
      style={divider ? { borderTop: "1px solid var(--lucid-line)" } : undefined}
    >
      <span className="lx-eyebrow">{label}</span>
      <div className="lx-metric-sm" style={{ color: color ?? "var(--lucid-ink)", marginTop: 6 }}>
        {value}
      </div>
      <span className="lx-micro" style={{ marginTop: 4, display: "block" }}>{sub}</span>
    </div>
  );
}

export function HeroBand({
  greeting,
  firstName,
  statusLine,
  metrics,
  pnlFlash,
  wrFlash,
  allAccountsCount,
  pairsConfig,
  biasByPair,
  niftyNetScore,
  livePairSymbols,
  biasLoading,
  onNavigate,
}: {
  greeting: string;
  firstName: string;
  statusLine: string;
  metrics: DashboardMetrics;
  pnlFlash: string;
  wrFlash: string;
  allAccountsCount: number;
  pairsConfig: ApiPair[];
  biasByPair: Map<string, PairBias>;
  niftyNetScore: number | null;
  livePairSymbols: Set<string>;
  biasLoading: boolean;
  onNavigate: (href: string) => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const regimeLabel = useRegimeLabel();

  return (
    // No `overflow-hidden` here: orb halos extend well past their orbs and
    // clipping them at the hero's edge is exactly what flattens the field back
    // into circles on a page. HeroAmbience clips its own blobs internally, so
    // nothing else needs the hero to clip.
    <section
      className="relative w-full flex flex-col justify-between"
      style={{ minHeight: "max(640px, 100vh)" }}
    >
      {/* Ambient background — drifting blobs, regime-tinted, never interactive */}
      <HeroAmbience />

      {/* Top row: Total Balance / Overall P&L / greeting (left) — compact Overview stack (right) */}
      <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)] gap-8 pt-2">
        <div>
          <div className="lx-eyebrow" style={{ marginBottom: 10 }}>
            Managed Capital
          </div>
          <div className="lx-hero-num" style={{ color: "var(--lucid-ink)" }}>
            <AnimatedNumber value={metrics.managedCapital} format={formatCurrency} />
          </div>

          {metrics.evaluationCapital > 0 && (
            <div className="lx-micro" style={{ color: "var(--lucid-ink-3)", marginTop: 8 }}>
              <AnimatedNumber value={metrics.evaluationCapital} format={formatCurrency} /> in evaluation
            </div>
          )}

          <div className={pnlFlash} style={{ marginTop: 18 }}>
            <span
              className="lx-metric-sm"
              style={{
                color: metrics.overallPnl > 0 ? "var(--lucid-pos)" : metrics.overallPnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)",
              }}
            >
              <AnimatedNumber value={metrics.overallPnl} format={(n) => `${n >= 0 ? "+" : ""}${formatCurrency(n)}`} />
            </span>
            <span className="lx-micro" style={{ marginLeft: 10 }}>Overall P&amp;L · across all accounts</span>
          </div>

          <div style={{ marginTop: 24 }}>
            <p className="lt-serif" style={{ fontSize: 15, fontWeight: 300, letterSpacing: "-0.01em", color: "var(--lucid-ink-2)", marginBottom: 5 }}>
              <AnimatedGreeting text={`${greeting}${firstName ? `, ${firstName}` : ""}.`} />
            </p>
            <p className="lx-body" style={{ maxWidth: 460 }}>{statusLine}</p>
          </div>
        </div>

        {/* Compact Overview stack — Active Accounts / Rolling Win Rate / adaptive 5th */}
        <div className="flex flex-col">
          <CompactStat
            label="Active Accounts"
            value={<AnimatedNumber value={metrics.activeCount} format={(n) => `${Math.round(n)}`} />}
            sub={`${allAccountsCount} total accounts`}
            divider={false}
          />
          <CompactStat
            label="Rolling Win Rate"
            value={<AnimatedNumber value={metrics.wr} format={(n) => `${Math.round(n)}%`} />}
            sub={`Last ${metrics.tradeCount} trades`}
            flashClass={wrFlash}
          />
          {metrics.hasProp ? (
            <CompactStat
              label="Challenges Active"
              value={<AnimatedNumber value={metrics.challengesActive} format={(n) => `${Math.round(n)}`} />}
              sub="In challenge phase"
              color="var(--lucid-ctx)"
            />
          ) : (
            <CompactStat
              label="Best Performing Account"
              value={<span className="truncate" style={{ display: "block", fontSize: 16 }}>{metrics.bestName}</span>}
              sub={
                <span className="lt-num" style={{ color: metrics.bestPct >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                  {metrics.bestPct >= 0 ? "+" : ""}{metrics.bestPct.toFixed(2)}%
                </span>
              }
            />
          )}
        </div>
      </div>

      {/* Centre — the alignment field. The empty space around it is the point. */}
      <div className="relative flex-1 min-h-0 my-12">
        <AlignmentField
          pairsConfig={pairsConfig}
          biasByPair={biasByPair}
          niftyNetScore={niftyNetScore}
          livePairSymbols={livePairSymbols}
          onNavigate={onNavigate}
          reducedMotion={reducedMotion}
        />
      </div>

      {/* Bottom row: Fundamental Bias · Live (left) — scroll affordance (right) */}
      <div className="relative flex items-end justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3 mb-2.5">
            <span className="lx-eyebrow">Fundamental Bias</span>
            <span
              className="pill"
              style={{ background: "var(--lucid-pos-bg)", color: "var(--lucid-pos)", border: "1px solid var(--lucid-pos-bd)", fontSize: 10, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
            >
              <span className="lt-pulse-dot" style={{ width: 6, height: 6, background: "var(--lucid-pos)" }} />
              Live
            </span>
          </div>
          <p className="lx-body" style={{ maxWidth: 480, color: "var(--lucid-ink-3)" }}>
            {biasLoading
              ? "Loading fundamental bias…"
              : "Each orb is a tracked pair — it drifts right as its fundamental score turns long, left as it turns short, and its glow is how strongly it leans."}
            {!biasLoading && regimeLabel && (
              <span style={{ color: "var(--lucid-ink-2)" }}> Regime: {regimeLabel}.</span>
            )}
          </p>
        </div>

        <div className="hidden sm:flex flex-col items-center gap-1 shrink-0" style={{ color: "var(--lucid-ink-3)" }}>
          <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em" }}>Scroll</span>
          <ChevronDown size={14} />
        </div>
      </div>
    </section>
  );
}
