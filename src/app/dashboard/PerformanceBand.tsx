"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { formatCurrency } from "@/lib/demo-data";
import type { CurvePoint, DateRangePreset } from "./dashboard-helpers";
import { useRevealOnScroll } from "./useRevealOnScroll";

// ─── PnL Tooltip ──────────────────────────────────────────────────────────────
// Moved verbatim from page.tsx.

function PnlTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CurvePoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: "var(--lucid-surface-2)",
        border: "1px solid var(--lucid-line)",
      }}
    >
      <p className="lx-micro" style={{ marginBottom: 5 }}>{d.date}</p>
      <p className="lx-metric-sm" style={{ color: "var(--lucid-ink)" }}>{formatCurrency(d.cumPnl)}</p>
      {d.pair && d.pnl !== 0 && (
        <p className="lx-value" style={{ color: "var(--lucid-ink-2)", marginTop: 4 }}>
          {d.pair} · {d.pnl >= 0 ? "+" : ""}{formatCurrency(d.pnl)}
        </p>
      )}
    </div>
  );
}

// ─── Band 4 — Performance ─────────────────────────────────────────────────────
// The chart absorbs a stat rail down its left side and grows to 380px.
//
// The rail reports the SELECTED RANGE, read straight off the two arrays the
// page already computes for the chart — the series' terminal value, its point
// count, and the number of drawdown windows already being shaded. No trade
// statistic is computed here. Win rate, average R:R and expectancy are
// deliberately absent: win rate already lives in the hero (which is off limits,
// so it cannot move here, and duplicating it was explicitly ruled out), and
// R:R and expectancy do not exist anywhere in the app today — adding either
// would mean adding a calculation, which this pass is not allowed to do.

function RailStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ paddingBottom: 20, marginBottom: 20, borderBottom: "1px solid var(--lucid-line)" }}>
      <div className="lx-eyebrow">{label}</div>
      <div
        className="lx-tnum"
        style={{
          fontFamily: "var(--lucid-font-mono)",
          fontSize: 30,
          fontWeight: 300,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          marginTop: 8,
          color: color ?? "var(--lucid-ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function PerformanceBand({
  curveData,
  drawdownWindows,
  dateRange,
  onDateRangeChange,
  reducedMotion,
}: {
  curveData: CurvePoint[];
  drawdownWindows: { x1: string; x2: string }[];
  dateRange: DateRangePreset;
  onDateRangeChange: (p: DateRangePreset) => void;
  reducedMotion: boolean;
}) {
  const { ref, revealed } = useRevealOnScroll<HTMLDivElement>();

  // Read, not computed: the last plotted point is the range's cumulative P&L,
  // which the chart is already drawing.
  const last = curveData.length > 0 ? curveData[curveData.length - 1].cumPnl : 0;
  const netColor =
    last > 0 ? "var(--lucid-pos)" : last < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";

  return (
    <section
      ref={ref}
      className={`${revealed && !reducedMotion ? "lt-rise" : revealed ? "" : "opacity-0"}`}
    >
      <div className="dash-head">
        <div>
          <div className="lx-eyebrow">Performance</div>
          <h2 className="dash-title">Cumulative P&amp;L</h2>
        </div>

        {/* Date range — segmented control */}
        <div className="lt-segment shrink-0">
          {(["Last 30d", "Last 90d", "All Time"] as const).map((p) => (
            <button
              key={p}
              onClick={() => onDateRangeChange(p)}
              className={`lt-segment-btn ${dateRange === p ? "is-active" : ""}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-6">
        {/* Stat rail — scoped to the selected range, so it moves with the toggle */}
        <div>
          <RailStat label="Net P&L · range" value={formatCurrency(last)} color={netColor} />
          <RailStat label="Points plotted" value={`${curveData.length}`} />
          <RailStat label="Drawdowns shaded" value={`${drawdownWindows.length}`} />
          <div>
            <div className="lx-eyebrow">Range</div>
            <div
              style={{
                fontFamily: "var(--lucid-font-mono)",
                fontSize: 15,
                marginTop: 8,
                color: "var(--lucid-accent)",
              }}
            >
              {dateRange}
            </div>
          </div>
        </div>

        <div className="lx-card">

      <ResponsiveContainer width="100%" height={380}>
        <AreaChart data={curveData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--lucid-accent)" stopOpacity={0.38} />
              <stop offset="55%" stopColor="var(--lucid-accent)" stopOpacity={0.10} />
              <stop offset="100%" stopColor="var(--lucid-accent)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="pnlStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--lucid-accent)" />
              <stop offset="100%" stopColor="var(--lucid-gold-bright)" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--lucid-line)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--lucid-ink-3)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--lucid-ink-3)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
            width={52}
          />
          <Tooltip content={<PnlTooltip />} />
          <ReferenceLine y={0} stroke="var(--lucid-line-2)" strokeDasharray="4 4" />
          {drawdownWindows.map((w, i) => (
            <ReferenceArea
              key={i}
              x1={w.x1}
              x2={w.x2}
              fill="var(--lucid-neg)"
              fillOpacity={0.08}
            />
          ))}
          <Area
            type="monotone"
            dataKey="cumPnl"
            stroke="url(#pnlStroke)"
            strokeWidth={2.5}
            fill="url(#pnlGrad)"
            dot={false}
            activeDot={{ r: 5, fill: "var(--lucid-accent)", stroke: "var(--lucid-bg)", strokeWidth: 2 }}
            isAnimationActive={!reducedMotion}
            animationDuration={1400}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
