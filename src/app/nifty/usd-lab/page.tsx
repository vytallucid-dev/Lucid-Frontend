"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { useUsdLab, useUsdLabSubIndicator } from "@/hooks/useUsdLab";
import type {
  Ind9Cluster,
  Ind9CompositionFlag,
  Ind9Category,
  Ind9SubScore,
  UsdLabResponse,
  UsdLabSubIndicator,
} from "@/lib/api/usd-lab";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import { DetailDrawer } from "@/components/DetailDrawer";
import { formatDate, formatDateShort } from "../nifty-utils";

// ─────────────────────────────────────────────────────────────────────────────
// Local helpers
// ─────────────────────────────────────────────────────────────────────────────

const MINUS = "−";

function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${MINUS}${Math.abs(n)}`;
  return "0";
}

function subScoreText(score: Ind9SubScore): string {
  if (score === null) return "—";
  return signed(score);
}

/** USD-strength score pill — INVERTED colors: +1 (USD strong) = red = bad for NIFTY. */
function usdPillStyle(score: Ind9SubScore): React.CSSProperties {
  if (score === null) return { background: "color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", color: "var(--lucid-ink-3)", border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)" };
  if (score > 0) return { background: "color-mix(in srgb, var(--lucid-neg) 15%, transparent)", color: "var(--lucid-neg)", border: "1px solid color-mix(in srgb, var(--lucid-neg) 15%, transparent)" };
  if (score < 0) return { background: "color-mix(in srgb, var(--lucid-pos) 15%, transparent)", color: "var(--lucid-pos)", border: "1px solid color-mix(in srgb, var(--lucid-pos) 15%, transparent)" };
  return { background: "color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", color: "var(--lucid-ink-2)", border: "1px solid color-mix(in srgb, var(--lucid-ctx) 20%, transparent)" };
}

function UsdPill({ score, className }: { score: Ind9SubScore; className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${className ?? ""}`}
      style={usdPillStyle(score)}
    >
      {subScoreText(score)}
    </span>
  );
}

/** NIFTY-facing score color: positive = bullish green, negative = bearish red. */
function niftyColor(score: number | null): string {
  if (score === null) return "var(--lucid-ink-3)";
  if (score > 0) return "var(--positive)";
  if (score < 0) return "var(--negative)";
  return "var(--neutral)";
}

function niftyRead(score: number | null): string {
  if (score === null) return "Suppressed";
  if (score >= 2) return "Strong USD weakness = strong NIFTY tailwind";
  if (score === 1) return "Weak USD = bullish for NIFTY";
  if (score === 0) return "Neutral USD = no directional read";
  if (score === -1) return "Strong USD = bearish for NIFTY";
  return "Very strong USD = strong NIFTY headwind";
}

const CLUSTER_STYLE: Record<Ind9Cluster, { color: string; bg: string; border: string }> = {
  INFLATION: { color: "var(--lucid-accent)", bg: "color-mix(in srgb, var(--lucid-accent) 14%, transparent)", border: "color-mix(in srgb, var(--lucid-accent) 14%, transparent)" },
  GROWTH: { color: "var(--lucid-accent)", bg: "color-mix(in srgb, var(--lucid-accent) 14%, transparent)", border: "color-mix(in srgb, var(--lucid-accent) 14%, transparent)" },
  LABOR: { color: "var(--lucid-warn)", bg: "color-mix(in srgb, var(--lucid-warn) 15%, transparent)", border: "color-mix(in srgb, var(--lucid-warn) 15%, transparent)" },
  SENTIMENT: { color: "var(--lucid-ink-2)", bg: "color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", border: "color-mix(in srgb, var(--lucid-ctx) 20%, transparent)" },
};

const CLUSTER_SUBTITLE: Record<Ind9Cluster, string> = {
  INFLATION: "Drivers of US price-level pressure",
  GROWTH: "Drivers of US economic momentum",
  LABOR: "Drivers of US employment health",
  SENTIMENT: "Confidence & rate-expectations indicators",
};

function flagStyle(flag: Ind9CompositionFlag): { bg: string; color: string; border: string } {
  switch (flag) {
    case "INFLATION_LED": return { bg: "color-mix(in srgb, var(--lucid-pos) 15%, transparent)", color: "var(--lucid-pos)", border: "color-mix(in srgb, var(--lucid-pos) 15%, transparent)" };
    case "DEMAND_DESTRUCTION": return { bg: "color-mix(in srgb, var(--lucid-warn) 15%, transparent)", color: "var(--lucid-warn)", border: "color-mix(in srgb, var(--lucid-warn) 15%, transparent)" };
    case "INFLATION_HOT": return { bg: "color-mix(in srgb, var(--lucid-neg) 15%, transparent)", color: "var(--lucid-neg)", border: "color-mix(in srgb, var(--lucid-neg) 15%, transparent)" };
    case "DEMAND_REACCEL": return { bg: "color-mix(in srgb, var(--lucid-accent) 14%, transparent)", color: "var(--lucid-accent)", border: "color-mix(in srgb, var(--lucid-accent) 14%, transparent)" };
    case "MIXED":
    case "MIXED_HOT": return { bg: "color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", color: "var(--lucid-ink-2)", border: "color-mix(in srgb, var(--lucid-ctx) 20%, transparent)" };
    default: return { bg: "color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", color: "var(--lucid-ink-3)", border: "color-mix(in srgb, var(--lucid-ctx) 12%, transparent)" };
  }
}

function bucketToNiftyScore(raw: number): number {
  if (raw <= -7) return 2;
  if (raw <= -4) return 1;
  if (raw <= 3) return 0;
  if (raw <= 6) return -1;
  return -2;
}

const CATEGORY_RULE: Record<Ind9Category, string[]> = {
  "Absolute Threshold": [
    "Value > 50.0   →  +1   (USD strong — expansion)",
    "Value = 50.0   →   0",
    "Value < 50.0   →  −1   (USD weak — contraction)",
  ],
  "vs Forecast": [
    "Actual > Forecast   →  +1   (USD strong)",
    "Actual = Forecast   →   0",
    "Actual < Forecast   →  −1   (USD weak)",
    "Fallback: if Forecast missing, compare vs Prior.",
  ],
  "Direction vs Prior": [
    "Actual > Prior   →  +1   (rising = USD strong)",
    "Actual = Prior   →   0",
    "Actual < Prior   →  −1   (falling = USD weak)",
  ],
  "Direction vs Prior (INVERTED)": [
    "Actual > Prior   →  −1   (rising = USD weak; inverted)",
    "Actual = Prior   →   0",
    "Actual < Prior   →  +1   (falling = USD strong; inverted)",
  ],
  "SMA Direction": [
    "SMA > SMA(5d ago)   →  +1   (rising = USD strong)",
    "SMA = SMA(5d ago)   →   0",
    "SMA < SMA(5d ago)   →  −1   (falling = USD weak)",
  ],
};

const FILTERS = ["All", "Driving +1", "Driving −1", "Neutral (0)", "Stale"] as const;
type FilterKey = (typeof FILTERS)[number];

function passesFilter(s: UsdLabSubIndicator, f: FilterKey): boolean {
  switch (f) {
    case "Driving +1": return s.score === 1;
    case "Driving −1": return s.score === -1;
    case "Neutral (0)": return s.score === 0;
    case "Stale": return s.isStale;
    default: return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function USDLabPage() {
  const { data, isLoading, error, refetch } = useUsdLab();
  const [filter, setFilter] = useState<FilterKey>("All");
  const [selected, setSelected] = useState<UsdLabSubIndicator | null>(null);

  if (isLoading) return <div className="p-4 sm:p-6"><LoadingState stages={["Loading USD Lab…", "Decomposing Indicator 9…", "Mapping clusters…"]} /></div>;
  if (error) return <div className="p-4 sm:p-6"><ErrorState error={error} onRetry={() => refetch()} /></div>;
  if (!data) return <div className="p-4 sm:p-6"><EmptyState title="No Ind 9 data available" /></div>;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-350">
      <Header data={data} />
      {data.dataQuality.suppressed && <SuppressedBanner />}
      <HeroStrip data={data} />
      <MathSection data={data} />
      <SubIndicatorTable data={data} filter={filter} setFilter={setFilter} onSelect={setSelected} />
      <ClusterCards data={data} />
      <CompositionFlagCard data={data} />
      <HistoryChart data={data} />
      <DataQualityPanel data={data} />

      <DetailDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.id}. ${selected.name}` : ""}
      >
        {selected && <SubIndicatorDrawer sub={selected} rawComposite={data.rawComposite} />}
      </DetailDrawer>
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────────

function Header({ data }: { data: UsdLabResponse }) {
  return (
    <div className="lt-rise lt-stagger-1 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="lt-serif text-2xl font-bold" style={{ color: "var(--lucid-ink)" }}>USD Lab</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>
          The texture behind Indicator 9 — every sub-indicator, every cluster, every threshold.
        </p>
      </div>
      <div
        className="text-xs px-3 py-1.5 rounded-lg shrink-0"
        style={{ background: "color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", color: "var(--lucid-ink-2)", border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)" }}
      >
        As of <span className="font-semibold text-white">{formatDate(data.asOf)}</span>
      </div>
    </div>
  );
}

function SuppressedBanner() {
  return (
    <div
      className="rounded-xl p-4 text-sm"
      style={{ background: "color-mix(in srgb, var(--lucid-warn) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--lucid-warn) 15%, transparent)", color: "var(--lucid-warn)" }}
    >
      ⚠ Ind 9 currently suppressed — insufficient sub-indicator data (3+ stale or missing).
      See the Data Quality panel below.
    </div>
  );
}

// ─── Section 1: Hero Strip ──────────────────────────────────────────────────────

function HeroStrip({ data }: { data: UsdLabResponse }) {
  const raw = data.rawComposite;
  const sliderPct = raw === null ? 50 : ((raw + 14) / 28) * 100;
  const markers = [-7, -4, 0, 4, 7];
  const fs = flagStyle(data.composition.flag);

  const flagClusters = data.clusters.filter((c) => c.includedInFlag);
  const side = data.composition.side;

  return (
    <div
      className="lt-card lt-edge lt-rise lt-stagger-2 p-4 sm:p-5"
      style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
        {/* Col 1 — NIFTY-facing score */}
        <div className="md:pr-6 pb-4 md:pb-0">
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--lucid-ink-3)" }}>
            Ind 9 (NIFTY-facing)
          </div>
          <div className="text-5xl font-bold tabular-nums" style={{ color: niftyColor(data.niftyScore) }}>
            {data.niftyScore === null ? "—" : signed(data.niftyScore)}
          </div>
          <div className="text-xs mt-2" style={{ color: "var(--lucid-ink-2)" }}>{niftyRead(data.niftyScore)}</div>
        </div>

        {/* Col 2 — Raw composite */}
        <div className="md:px-6 py-4 md:py-0 border-t md:border-t-0 md:border-l md:border-r" style={{ borderColor: "color-mix(in srgb, var(--lucid-ctx) 12%, transparent)" }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--lucid-ink-3)" }}>
            Raw composite
          </div>
          <div className="text-[10px] mb-2" style={{ color: "var(--lucid-ink-3)" }}>(USD-strength convention)</div>
          <div className="text-4xl font-bold tabular-nums font-mono" style={{ color: raw === null ? "var(--lucid-ink-3)" : raw > 0 ? "var(--negative)" : raw < 0 ? "var(--positive)" : "var(--neutral)" }}>
            {raw === null ? "—" : signed(raw)} <span className="text-sm font-normal" style={{ color: "var(--lucid-ink-3)" }}>of ±14</span>
          </div>
          {raw !== null && (
            <div className="relative h-5 mt-3">
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
              {markers.map((m) => (
                <div key={m} className="absolute top-1/2 -translate-y-1/2 w-px h-3" style={{ left: `${((m + 14) / 28) * 100}%`, background: "color-mix(in srgb, var(--lucid-ctx) 20%, transparent)" }} />
              ))}
              <div
                className="absolute top-1/2 w-3.5 h-3.5 rounded-full"
                style={{
                  left: `${sliderPct}%`,
                  transform: "translate(-50%, -50%)",
                  background: raw > 0 ? "var(--negative)" : raw < 0 ? "var(--positive)" : "var(--neutral)",
                  boxShadow: `0 0 8px ${raw > 0 ? "color-mix(in srgb, var(--lucid-neg) 15%, transparent)" : raw < 0 ? "color-mix(in srgb, var(--lucid-pos) 15%, transparent)" : "transparent"}`,
                }}
              />
            </div>
          )}
          <div className="flex justify-between text-[10px] mt-1" style={{ color: "var(--lucid-line-3)" }}>
            <span>{MINUS}14 weak</span><span>0</span><span>+14 strong</span>
          </div>
        </div>

        {/* Col 3 — Composition flag */}
        <div className="md:pl-6 pt-4 md:pt-0 border-t md:border-t-0" style={{ borderColor: "color-mix(in srgb, var(--lucid-ctx) 12%, transparent)" }}>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--lucid-ink-3)" }}>
            Composition flag
          </div>
          {data.composition.flag ? (
            <span className="inline-flex px-3 py-1 rounded-lg text-sm font-bold" style={{ background: fs.bg, color: fs.color, border: `1px solid ${fs.border}` }}>
              {data.composition.flag.replace(/_/g, " ")}
            </span>
          ) : (
            <span className="text-sm" style={{ color: "var(--lucid-ink-3)" }}>Inactive</span>
          )}
          <div className="text-xs mt-3 space-x-1" style={{ color: "var(--lucid-ink-3)" }}>
            {flagClusters.map((c, i) => (
              <span key={c.cluster}>
                {i > 0 && <span style={{ color: "var(--lucid-line-3)" }}> • </span>}
                <span style={{ color: CLUSTER_STYLE[c.cluster].color }}>{c.cluster.slice(0, 4)}</span>:{" "}
                {side === "strong" ? `${c.posCount}+` : `${c.negCount}${MINUS}`}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 text-center text-xs" style={{ borderTop: "1px solid var(--lucid-line)", color: "var(--lucid-ink-3)" }}>
        ↓ How we got here — full breakdown below
      </div>
    </div>
  );
}

// ─── Section 2: The Math ────────────────────────────────────────────────────────

function MathSection({ data }: { data: UsdLabResponse }) {
  const raw = data.rawComposite;
  const usdStrengthTier = data.niftyScore === null ? null : -data.niftyScore;
  return (
    <div className="lt-card p-4 sm:p-5">
      <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--lucid-ink-3)" }}>
        How Ind 9 is computed
      </div>

      {/* Step 1 */}
      <StepCard title="STEP 1 — Score each of 14 sub-indicators (USD-strength)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
          {data.subIndicators.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-xs">
              <span style={{ color: "var(--lucid-ink-2)" }}>{s.name}</span>
              <div className="flex items-center gap-2">
                {s.score !== 0 && s.score !== null && (
                  <span className="text-[10px] hidden md:inline" style={{ color: "var(--lucid-ink-3)" }}>{s.score > 0 ? "USD strong" : "USD weak"}</span>
                )}
                <UsdPill score={s.score} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 flex items-center justify-between text-sm font-semibold" style={{ borderTop: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)" }}>
          <span style={{ color: "var(--lucid-ink-2)" }}>SUM = raw composite</span>
          <span className="font-mono tabular-nums" style={{ color: "var(--lucid-ink)" }}>{raw === null ? "—" : signed(raw)}</span>
        </div>
      </StepCard>

      <ArrowDown />

      {/* Step 2 */}
      <StepCard title="STEP 2 — Bucket raw composite into 5-tier (USD-strength → NIFTY-facing)">
        <div className="space-y-1">
          {data.tiers.map((t, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-xs px-3 py-1.5 rounded-md"
              style={{
                background: t.current ? "color-mix(in srgb, var(--lucid-accent) 14%, transparent)" : "transparent",
                borderLeft: t.current ? "3px solid var(--lucid-accent)" : "3px solid transparent",
              }}
            >
              <span className="font-mono" style={{ color: t.current ? "var(--lucid-ink)" : "var(--lucid-ink-3)" }}>
                {tierRangeLabel(t.min, t.max)}
              </span>
              <span className="flex items-center gap-3">
                <span style={{ color: t.current ? "var(--lucid-ink-2)" : "var(--lucid-ink-3)" }}>{t.read}</span>
                <span className="font-semibold tabular-nums" style={{ color: niftyColor(t.niftyScore), minWidth: 24, textAlign: "right" }}>{signed(t.niftyScore)}</span>
                {t.current && <span style={{ color: "var(--lucid-accent)" }}>◄ {raw === null ? "" : signed(raw)}</span>}
              </span>
            </div>
          ))}
        </div>
      </StepCard>

      <ArrowDown />

      {/* Step 3 */}
      <StepCard title="STEP 3 — Flip to NIFTY-facing convention">
        <div className="flex items-center justify-center gap-4 py-2">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--lucid-ink-3)" }}>USD-strength</div>
            <div className="px-3 py-2 rounded-lg font-mono font-bold tabular-nums" style={{ background: "var(--lucid-surface-2)", color: raw !== null && raw > 0 ? "var(--negative)" : raw !== null && raw < 0 ? "var(--positive)" : "var(--lucid-ink-2)" }}>
              {usdStrengthTier === null ? "—" : signed(usdStrengthTier)}
            </div>
            <div className="text-[10px] mt-1" style={{ color: "var(--lucid-ink-3)" }}>{raw !== null && raw > 0 ? "strong USD" : raw !== null && raw < 0 ? "weak USD" : "neutral"}</div>
          </div>
          <div className="text-2xl" style={{ color: "var(--lucid-ink-3)" }}>⇄</div>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--lucid-ink-3)" }}>NIFTY-facing</div>
            <div className="px-3 py-2 rounded-lg font-mono font-bold tabular-nums" style={{ background: "var(--lucid-surface-2)", color: niftyColor(data.niftyScore) }}>
              {data.niftyScore === null ? "—" : signed(data.niftyScore)}
            </div>
            <div className="text-[10px] mt-1" style={{ color: "var(--lucid-ink-3)" }}>{data.niftyScore !== null && data.niftyScore > 0 ? "bullish NIFTY" : data.niftyScore !== null && data.niftyScore < 0 ? "bearish NIFTY" : "neutral"}</div>
          </div>
        </div>
        <div className="text-center mt-3 pt-3 text-sm font-bold" style={{ borderTop: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", color: "var(--lucid-ink)" }}>
          FINAL IND 9 = <span style={{ color: niftyColor(data.niftyScore) }}>{data.niftyScore === null ? "—" : signed(data.niftyScore)}</span>
        </div>
      </StepCard>
    </div>
  );
}

function StepCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--lucid-surface-2)", border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)" }}>
      <div className="text-xs font-semibold mb-3" style={{ color: "var(--lucid-ink)" }}>{title}</div>
      {children}
    </div>
  );
}

function ArrowDown() {
  return <div className="flex justify-center py-1.5 text-lg" style={{ color: "var(--lucid-ink-3)" }}>↓</div>;
}

function tierRangeLabel(min: number | null, max: number | null): string {
  if (min === null) return `≤ ${max}`;
  if (max === null) return `≥ ${min}`;
  return `${signed(min)} to ${signed(max)}`;
}

// ─── Section 3: Sub-indicator table ─────────────────────────────────────────────

function SubIndicatorTable({
  data, filter, setFilter, onSelect,
}: {
  data: UsdLabResponse;
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  onSelect: (s: UsdLabSubIndicator) => void;
}) {
  const rows = data.subIndicators.filter((s) => passesFilter(s, filter));
  const negCount = data.subIndicators.filter((s) => s.score === -1).length;
  const posCount = data.subIndicators.filter((s) => s.score === 1).length;
  const zeroCount = data.subIndicators.filter((s) => s.score === 0).length;
  const staleCount = data.subIndicators.filter((s) => s.isStale).length;

  return (
    <div className="lt-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--lucid-ink-3)" }}>
          14 Sub-Indicators — Detailed
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-xs px-2.5 py-1 rounded-md transition-colors"
              style={{
                background: filter === f ? "color-mix(in srgb, var(--lucid-accent) 14%, transparent)" : "var(--lucid-line)",
                color: filter === f ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                border: `1px solid ${filter === f ? "color-mix(in srgb, var(--lucid-accent) 14%, transparent)" : "transparent"}`,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 700 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)" }}>
              {["#", "Indicator", "Category", "Cluster", "Actual", "Reference", "Score", "Reasoning", "Last release", "Status"].map((h) => (
                <th key={h} className="text-left font-semibold uppercase tracking-wide py-2 px-2 whitespace-nowrap" style={{ color: "var(--lucid-ink-3)" }}>
                  {h}
                  {h === "Score" && (
                    <span
                      className="ml-1 cursor-help"
                      title="USD-strength convention: +1 = USD strong, −1 = USD weak. Flipped to NIFTY-facing in the final Ind 9 score."
                      style={{ color: "var(--lucid-accent)" }}
                    >ⓘ</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr
                key={s.id}
                onClick={() => onSelect(s)}
                className="cursor-pointer transition-colors hover:bg-white/5"
                style={{ borderBottom: "1px solid var(--lucid-line)", background: i % 2 === 1 ? "var(--lucid-line)" : "transparent" }}
              >
                <td className="py-2 px-2 tabular-nums" style={{ color: "var(--lucid-ink-3)" }}>{s.id}</td>
                <td className="py-2 px-2 whitespace-nowrap font-medium" style={{ color: "var(--lucid-ink)" }}>{s.name}</td>
                <td className="py-2 px-2 whitespace-nowrap" style={{ color: "var(--lucid-ink-3)" }}>{s.category}</td>
                <td className="py-2 px-2"><ClusterPill cluster={s.cluster} /></td>
                <td className="py-2 px-2 text-right tabular-nums font-mono" style={{ color: "var(--lucid-ink)" }}>{s.actual ?? "—"}</td>
                <td className="py-2 px-2 text-right tabular-nums font-mono" style={{ color: "var(--lucid-ink-3)" }}>{s.reference ?? "—"}</td>
                <td className="py-2 px-2"><UsdPill score={s.score} /></td>
                <td className="py-2 px-2" style={{ color: "var(--lucid-ink-3)", minWidth: 220 }}>{s.reasoning}</td>
                <td className="py-2 px-2 whitespace-nowrap tabular-nums" style={{ color: "var(--lucid-ink-3)" }}>{s.lastReleaseDate ? formatDateShort(s.lastReleaseDate) : "—"}</td>
                <td className="py-2 px-2"><StatusBadge stale={s.isStale} days={s.staleDays} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="py-6 text-center" style={{ color: "var(--lucid-ink-3)" }}>No sub-indicators match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-3 text-xs" style={{ borderTop: "1px solid var(--lucid-line)", color: "var(--lucid-ink-3)" }}>
        14 sub-indicators · {negCount} driving USD weak · {posCount} driving USD strong · {zeroCount} neutral · {staleCount} stale
        <span className="ml-2" style={{ color: "var(--lucid-ink-3)" }}>
          Sum: <span className="font-mono" style={{ color: "var(--lucid-ink-2)" }}>{data.rawComposite === null ? "—" : signed(data.rawComposite)}</span> (raw composite)
        </span>
      </div>
    </div>
  );
}

function ClusterPill({ cluster }: { cluster: Ind9Cluster }) {
  const st = CLUSTER_STYLE[cluster];
  return (
    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
      {cluster}
    </span>
  );
}

function StatusBadge({ stale, days }: { stale: boolean; days: number | null }) {
  if (stale) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--lucid-warn)" }} title={days !== null ? `${days} days since last release` : undefined}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--lucid-warn)" }} />Stale
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--lucid-ink-3)" }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--lucid-pos)" }} />Fresh
    </span>
  );
}

// ─── Section 4: Cluster cards ───────────────────────────────────────────────────

function ClusterCards({ data }: { data: UsdLabResponse }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {data.clusters.map((cluster) => {
        const members = data.subIndicators.filter((s) => s.cluster === cluster.cluster);
        const st = CLUSTER_STYLE[cluster.cluster];
        return (
          <div key={cluster.cluster} className="lt-card p-4" style={{ borderLeft: `3px solid ${st.color}` }}>
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold uppercase tracking-wide" style={{ color: st.color }}>{cluster.cluster}</span>
                  {!cluster.includedInFlag && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", color: "var(--lucid-ink-3)" }}>
                      Excluded from Composition Flag
                    </span>
                  )}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>{CLUSTER_SUBTITLE[cluster.cluster]}</div>
              </div>
            </div>

            <div className="space-y-1.5 mt-3">
              {members.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <span style={{ color: "var(--lucid-ink-2)" }}>{s.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--lucid-ink-3)" }}>
                      {s.actual ?? "—"}{s.reference ? ` vs ${s.reference}` : ""}
                    </span>
                    <UsdPill score={s.score} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-2.5 flex items-center justify-between text-xs" style={{ borderTop: "1px solid var(--lucid-line)" }}>
              <span style={{ color: "var(--lucid-ink-2)" }}>
                Cluster sum: <span className="font-bold font-mono" style={{ color: cluster.sum > 0 ? "var(--negative)" : cluster.sum < 0 ? "var(--positive)" : "var(--lucid-ink-2)" }}>{signed(cluster.sum)}</span>
              </span>
              <span style={{ color: "var(--lucid-ink-3)" }}>
                Contribution to raw: <span className="font-mono">{signed(cluster.sum)}</span> / {data.rawComposite === null ? "—" : signed(data.rawComposite)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section 5: Composition flag breakdown ──────────────────────────────────────

function CompositionFlagCard({ data }: { data: UsdLabResponse }) {
  const c = data.composition;
  const fs = flagStyle(c.flag);
  const weak = c.side === "weak";
  const strong = c.side === "strong";

  return (
    <div className="lt-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--lucid-ink-3)" }}>Composition Flag</div>
        <div className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>Active: {formatDate(data.asOf)}</div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>Current state:</span>
        {c.flag ? (
          <span className="px-3 py-1 rounded-lg text-sm font-bold" style={{ background: fs.bg, color: fs.color, border: `1px solid ${fs.border}` }}>
            {c.flag.replace(/_/g, " ")}
          </span>
        ) : <span className="text-sm" style={{ color: "var(--lucid-ink-3)" }}>Inactive</span>}
      </div>

      {/* Activation */}
      <div className="text-xs mb-4 p-3 rounded-lg" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-2)" }}>
        <div className="font-semibold mb-1" style={{ color: "var(--lucid-ink)" }}>Activation</div>
        Composition flag computes when |Ind 9 raw| ≥ 4.
        {" "}Current raw = <span className="font-mono" style={{ color: "var(--lucid-ink)" }}>{data.rawComposite === null ? "—" : signed(data.rawComposite)}</span>.{" "}
        {c.activated
          ? <span style={{ color: "var(--lucid-pos)" }}>Activated ✓ ({strong ? "USD-strong / mirror side" : "USD-weak side"})</span>
          : <span style={{ color: "var(--lucid-ink-3)" }}>Not in trigger range.</span>}
      </div>

      {c.activated && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Resolution */}
          <div className="text-xs p-3 rounded-lg font-mono leading-relaxed" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-2)" }}>
            <div className="font-semibold mb-2" style={{ color: "var(--lucid-ink)", fontFamily: "system-ui" }}>Resolution (computed from 14 sub-indicators)</div>
            {data.clusters.filter((cl) => cl.includedInFlag).map((cl) => (
              <div key={cl.cluster} style={{ color: CLUSTER_STYLE[cl.cluster].color }}>
                {cl.cluster}: {strong ? `${cl.posCount} positive` : `${cl.negCount} negative`}
              </div>
            ))}
            <div className="mt-2" style={{ color: "var(--lucid-ink)" }}>
              {weak ? `I_neg = ${c.iNeg}` : `I_pos = ${c.iPos}`} ·{" "}
              {weak ? `GL_neg = ${c.glNeg}` : `GL_pos = ${c.glPos}`}
            </div>
          </div>

          {/* Decision path */}
          <div className="text-xs p-3 rounded-lg" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-2)" }}>
            <div className="font-semibold mb-2" style={{ color: "var(--lucid-ink)" }}>Decision path</div>
            <div className="space-y-1.5">
              {c.checks.map((chk) => (
                <div key={chk.flag} className="flex items-start gap-2">
                  <span style={{ color: chk.passed ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>{chk.passed ? "✓" : "✗"}</span>
                  <span>
                    <span className="font-semibold" style={{ color: chk.passed ? "var(--lucid-ink)" : "var(--lucid-ink-3)" }}>{chk.flag.replace(/_/g, " ")}</span>
                    <span className="font-mono ml-1" style={{ color: "var(--lucid-ink-3)" }}>— {chk.detail}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2" style={{ borderTop: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)" }}>
              → <span className="font-bold" style={{ color: fs.color }}>{c.flag?.replace(/_/g, " ")}</span>
              <div className="mt-1" style={{ color: "var(--lucid-ink-3)" }}>{c.read}</div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-[11px]" style={{ color: "var(--lucid-ink-3)" }}>
        Composition flag is observational — informs context, no scoring impact. UI-only badge displayed alongside Ind 9.
      </div>

      {/* Mirror flags subcard */}
      <div className="mt-4 rounded-xl p-4" style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}>
        <div className="text-xs font-semibold mb-2" style={{ color: "var(--lucid-ink-3)" }}>
          {strong ? "Primary rules (USD-weak side, raw ≤ −4)" : "Mirror flags (USD-strong side, raw ≥ +4)"}
        </div>
        <div className="text-xs space-y-1 font-mono" style={{ color: "var(--lucid-ink-3)" }}>
          {strong ? (
            <>
              <div>INFLATION_LED       if  I_neg ≥ 2</div>
              <div>DEMAND_DESTRUCTION  if  GL_neg ≥ 6  AND  I_neg ≤ 1</div>
              <div>MIXED               otherwise</div>
            </>
          ) : (
            <>
              <div>INFLATION_HOT       if  I_pos ≥ 2</div>
              <div>DEMAND_REACCEL      if  GL_pos ≥ 6  AND  I_pos ≤ 1</div>
              <div>MIXED_HOT           otherwise</div>
            </>
          )}
        </div>
        <div className="text-[11px] mt-2" style={{ color: "var(--lucid-ink-3)" }}>
          Same cluster logic, opposite direction. {c.activated ? `Not active currently (Ind 9 raw ${data.rawComposite === null ? "" : signed(data.rawComposite)}, ${strong ? "USD-strong" : "USD-weak"} side).` : ""}
        </div>
      </div>
    </div>
  );
}

// ─── Section 6: Raw composite history chart ─────────────────────────────────────

interface ChartPoint {
  date: string;
  raw: number;
  niftyScore: number;
  flag: Ind9CompositionFlag;
  isCurrent: boolean;
}

function HistoryChart({ data }: { data: UsdLabResponse }) {
  const points: ChartPoint[] = useMemo(
    () =>
      data.history.map((h, i) => ({
        date: formatDateShort(h.date),
        raw: h.rawComposite,
        niftyScore: h.niftyScore,
        flag: h.compositionFlag,
        isCurrent: i === data.history.length - 1,
      })),
    [data.history],
  );

  const range = useMemo(() => {
    if (points.length === 0) return null;
    let lo = points[0], hi = points[0];
    for (const p of points) {
      if (p.raw < lo.raw) lo = p;
      if (p.raw > hi.raw) hi = p;
    }
    return { lo, hi };
  }, [points]);

  return (
    <div className="lt-card p-4 sm:p-5">
      <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--lucid-ink-3)" }}>
        Ind 9 Raw Composite History — last {points.length} scorecards
      </div>
      {range && (
        <p className="text-xs mb-4" style={{ color: "var(--lucid-ink-3)" }}>
          Range over period: {signed(range.lo.raw)} ({range.lo.date}) to {signed(range.hi.raw)} ({range.hi.date}).
          {" "}Full-cycle swings (≥10 pts peak-to-trough) signal USD regime turns.
        </p>
      )}
      <div style={{ height: 300 }}>
        {points.length === 0 ? (
          <EmptyState title="No historical Ind 9 data available" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 110, bottom: 4, left: 0 }}>
              {/* Tier background bands */}
              <ReferenceArea y1={7} y2={14} fill="var(--lucid-neg)" fillOpacity={0.05} />
              <ReferenceArea y1={4} y2={7} fill="var(--lucid-scale-1)" fillOpacity={0.05} />
              <ReferenceArea y1={-4} y2={4} fill="var(--lucid-ink-2)" fillOpacity={0.04} />
              <ReferenceArea y1={-7} y2={-4} fill="var(--lucid-pos)" fillOpacity={0.05} />
              <ReferenceArea y1={-14} y2={-7} fill="var(--lucid-pos)" fillOpacity={0.08} />

              <XAxis dataKey="date" tick={{ fill: "var(--lucid-ink-3)", fontSize: 10 }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(points.length / 10))} />
              <YAxis domain={[-14, 14]} ticks={[-14, -7, -4, 0, 4, 7, 14]} tick={{ fill: "var(--lucid-ink-3)", fontSize: 10 }} tickLine={false} axisLine={false} width={28} />

              <ReferenceLine y={7} stroke="var(--lucid-neg)" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: "+7 → Ind 9 = −2", position: "right", fill: "var(--lucid-neg)", fontSize: 9 }} />
              <ReferenceLine y={4} stroke="var(--lucid-scale-1)" strokeDasharray="3 3" strokeOpacity={0.4} label={{ value: "+4 → −1", position: "right", fill: "var(--lucid-scale-1)", fontSize: 9 }} />
              <ReferenceLine y={0} stroke="color-mix(in srgb, var(--lucid-ctx) 20%, transparent)" label={{ value: "0", position: "right", fill: "var(--lucid-ink-2)", fontSize: 9 }} />
              <ReferenceLine y={-4} stroke="var(--lucid-pos)" strokeDasharray="3 3" strokeOpacity={0.4} label={{ value: "−4 → +1", position: "right", fill: "var(--lucid-pos)", fontSize: 9 }} />
              <ReferenceLine y={-7} stroke="var(--lucid-pos)" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: "−7 → Ind 9 = +2", position: "right", fill: "var(--lucid-pos)", fontSize: 9 }} />

              <Tooltip content={<ChartTooltip />} />
              <Line
                dataKey="raw"
                stroke="var(--lucid-accent)"
                strokeWidth={2}
                isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; index?: number }) => {
                  const item = points[props.index ?? 0];
                  const cur = item?.isCurrent;
                  return (
                    <circle
                      key={props.index}
                      cx={props.cx}
                      cy={props.cy}
                      r={cur ? 5 : 2.5}
                      fill={cur ? "var(--lucid-accent)" : "var(--lucid-line-3)"}
                      stroke={cur ? "var(--lucid-accent)" : "transparent"}
                      strokeWidth={cur ? 2 : 0}
                    />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div className="text-xs p-2.5 rounded-md" style={{ background: "var(--lucid-surface-2)", border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)" }}>
      <div className="font-semibold mb-1" style={{ color: "var(--lucid-ink)" }}>{p.date}</div>
      <div style={{ color: "var(--lucid-ink-2)" }}>Raw composite: <span className="font-mono" style={{ color: "var(--lucid-ink)" }}>{signed(p.raw)}</span></div>
      <div style={{ color: "var(--lucid-ink-2)" }}>Ind 9 score: <span className="font-mono" style={{ color: niftyColor(p.niftyScore) }}>{signed(p.niftyScore)}</span> (NIFTY-facing)</div>
      <div style={{ color: "var(--lucid-ink-2)" }}>Composition: <span style={{ color: flagStyle(p.flag).color }}>{p.flag ? p.flag.replace(/_/g, " ") : "—"}</span></div>
    </div>
  );
}

// ─── Section 8: Data quality panel ──────────────────────────────────────────────

function DataQualityPanel({ data }: { data: UsdLabResponse }) {
  const dq = data.dataQuality;
  const stale = data.subIndicators.filter((s) => s.isStale);
  const compColor = dq.computability === "FULL" ? "var(--lucid-pos)" : dq.computability === "DEGRADED" ? "var(--lucid-warn)" : "var(--lucid-neg)";
  return (
    <div className="lt-card p-4 sm:p-5">
      <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--lucid-ink-3)" }}>Data Quality</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <Stat label="Sub-indicators with data" value={`${dq.dataCount} / 14`} ok={dq.dataCount >= 12} />
        <Stat label="Currently stale" value={`${dq.staleCount} / 14`} ok={dq.staleCount === 0} warn={dq.staleCount > 0 && dq.staleCount < 3} />
        <div className="p-3 rounded-lg" style={{ background: "var(--lucid-surface-2)" }}>
          <div style={{ color: "var(--lucid-ink-3)" }}>Composite computability</div>
          <div className="text-lg font-bold mt-0.5" style={{ color: compColor }}>{dq.computability}</div>
        </div>
      </div>

      {stale.length > 0 && (
        <div className="mt-4 text-xs">
          <div className="font-semibold mb-1.5" style={{ color: "var(--lucid-warn)" }}>Stale sub-indicators</div>
          {stale.map((s) => (
            <div key={s.id} className="mb-1" style={{ color: "var(--lucid-ink-2)" }}>
              • <span className="font-medium text-white">{s.name}</span> — last release {s.lastReleaseDate ? formatDate(s.lastReleaseDate) : "—"}
              {s.staleDays !== null && <span style={{ color: "var(--lucid-ink-3)" }}> ({s.staleDays} days ago, {s.cadence.toLowerCase()} cadence)</span>}
              <span style={{ color: "var(--lucid-ink-3)" }}> → score persists from last release ({subScoreText(s.score)}).</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 text-[11px] leading-relaxed" style={{ borderTop: "1px solid var(--lucid-line)", color: "var(--lucid-ink-3)" }}>
        Composite suppression: if fewer than 12 sub-indicators have data AND 3+ are stale, Ind 9 is suppressed entirely.
        {" "}Current: {dq.dataCount}/14 with data, {dq.staleCount} stale — {dq.suppressed ? "suppressed." : "below threshold, Ind 9 computes normally."}
      </div>
    </div>
  );
}

function Stat({ label, value, ok, warn }: { label: string; value: string; ok?: boolean; warn?: boolean }) {
  const color = ok ? "var(--lucid-pos)" : warn ? "var(--lucid-warn)" : "var(--lucid-neg)";
  return (
    <div className="p-3 rounded-lg" style={{ background: "var(--lucid-surface-2)" }}>
      <div style={{ color: "var(--lucid-ink-3)" }}>{label}</div>
      <div className="text-lg font-bold mt-0.5 tabular-nums" style={{ color }}>{value} <span className="text-sm">{ok ? "✓" : warn ? "⚠" : "✗"}</span></div>
    </div>
  );
}

// ─── Section 7: Sub-indicator detail drawer ─────────────────────────────────────

function SubIndicatorDrawer({ sub, rawComposite }: { sub: UsdLabSubIndicator; rawComposite: number | null }) {
  const { data: detail, isLoading, error } = useUsdLabSubIndicator(sub.code);

  const thisScore = sub.score ?? 0;
  const othersSum = rawComposite === null ? null : rawComposite - thisScore;
  const currentTier = rawComposite === null ? null : bucketToNiftyScore(rawComposite);
  const newTier = othersSum === null ? null : bucketToNiftyScore(othersSum);
  const tierChanges = currentTier !== null && newTier !== null && currentTier !== newTier;

  return (
    <div className="space-y-5 text-xs">
      {/* A — Current reading */}
      <Section title="Current Reading">
        <Row label="Current score" value={<UsdPill score={sub.score} />} />
        <Row label="Actual" value={<span className="font-mono" style={{ color: "var(--lucid-ink)" }}>{sub.actual ?? "—"}</span>} />
        {sub.forecast && <Row label="Forecast" value={<span className="font-mono" style={{ color: "var(--lucid-ink)" }}>{sub.forecast}</span>} />}
        {sub.prior && <Row label="Prior" value={<span className="font-mono" style={{ color: "var(--lucid-ink)" }}>{sub.prior}</span>} />}
        {sub.threshold && <Row label="Threshold" value={<span className="font-mono" style={{ color: "var(--lucid-ink)" }}>{sub.threshold}</span>} />}
        <div className="mt-2 p-2 rounded" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-2)" }}>{sub.reasoning}</div>
        <div className="mt-2 space-y-1">
          <Row label="Category" value={<span style={{ color: "var(--lucid-ink)" }}>{sub.category}</span>} />
          <Row label="Cluster" value={<ClusterPill cluster={sub.cluster} />} />
          <Row label="Cadence" value={<span style={{ color: "var(--lucid-ink)" }}>{sub.cadence}</span>} />
          <Row label="Last release" value={<span style={{ color: "var(--lucid-ink)" }}>{sub.lastReleaseDate ? formatDate(sub.lastReleaseDate) : "—"}</span>} />
          <Row label="Data source" value={<span style={{ color: "var(--lucid-ink)" }}>{sub.dataSource}</span>} />
        </div>
      </Section>

      {/* B — Scoring rule */}
      <Section title={`Scoring Rule — ${sub.category}`}>
        <div className="font-mono space-y-0.5 p-2 rounded" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-2)" }}>
          {CATEGORY_RULE[sub.category].map((line, i) => <div key={i}>{line}</div>)}
        </div>
      </Section>

      {/* C — Last 12 releases */}
      <Section title="Last 12 Releases">
        {isLoading ? (
          <LoadingState message="Loading history..." />
        ) : error ? (
          <ErrorState error={error} title="Couldn't load history" />
        ) : !detail || detail.releases.length === 0 ? (
          <div style={{ color: "var(--lucid-ink-3)" }}>No release history available.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)" }}>
                {["Date", "Actual", "Reference", "Score"].map((h) => (
                  <th key={h} className="text-left font-semibold uppercase tracking-wide py-1.5" style={{ color: "var(--lucid-ink-3)", fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.releases.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--lucid-line)" }}>
                  <td className="py-1.5 tabular-nums" style={{ color: "var(--lucid-ink-2)" }}>{formatDateShort(r.date)}</td>
                  <td className="py-1.5 font-mono" style={{ color: "var(--lucid-ink)" }}>{r.actual ?? "—"}</td>
                  <td className="py-1.5 font-mono" style={{ color: "var(--lucid-ink-3)" }}>
                    {r.reference ?? "—"}{r.reference ? ` ${refKindTag(r.referenceKind)}` : ""}
                  </td>
                  <td className="py-1.5"><UsdPill score={r.score} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* D — Composite contribution */}
      <Section title="Composite Contribution (what-if)">
        <div className="font-mono space-y-1 p-2 rounded" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-2)" }}>
          <div>This sub-indicator: <span style={{ color: "var(--lucid-ink)" }}>{signed(thisScore)}</span></div>
          <div>Other 13 sum: <span style={{ color: "var(--lucid-ink)" }}>{othersSum === null ? "—" : signed(othersSum)}</span></div>
          <div>Raw composite: <span style={{ color: "var(--lucid-ink)" }}>{rawComposite === null ? "—" : signed(rawComposite)}</span></div>
          <div className="pt-1.5 mt-1" style={{ borderTop: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", color: "var(--lucid-ink-3)" }}>
            → Removing it shifts raw to {othersSum === null ? "—" : signed(othersSum)}
          </div>
          <div style={{ color: tierChanges ? "var(--lucid-warn)" : "var(--lucid-ink-3)" }}>
            → Final Ind 9 would {tierChanges ? `change to ${newTier === null ? "—" : signed(newTier)}` : "not change"}
            {!tierChanges && currentTier !== null ? ` (still ${signed(currentTier)} tier)` : ""}
          </div>
        </div>
      </Section>
    </div>
  );
}

function refKindTag(kind: string): string {
  switch (kind) {
    case "forecast": return "(F)";
    case "prior": return "(P)";
    case "threshold": return "(T)";
    case "sma_5d": return "(SMA)";
    default: return "";
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--lucid-ink-3)" }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span style={{ color: "var(--lucid-ink-3)" }}>{label}</span>
      {value}
    </div>
  );
}
