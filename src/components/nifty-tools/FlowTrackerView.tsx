"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, BarChart3, Activity } from "lucide-react";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import { loadFlowTrackerData, IND13_LONG_BULLISH, IND13_LONG_BEARISH } from "./flowTrackerData";
import { FlowTrackerChart, type FlowChartType } from "./FlowTrackerChart";

interface FlowTrackerViewProps {
  onClose: () => void;
}

const TIMEFRAMES: { label: string; limit: number }[] = [
  { label: "30d", limit: 30 },
  { label: "60d", limit: 60 },
  { label: "90d", limit: 90 },
  { label: "180d", limit: 180 },
];

function fmtCr(v: number | null): string {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}₹${Math.abs(Math.round(v)).toLocaleString("en-IN")} cr`;
}

function fmtDateFull(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function FlowTrackerView({ onClose }: FlowTrackerViewProps) {
  const [timeframe, setTimeframe] = useState(TIMEFRAMES[2]); // 90d default
  const [chartType, setChartType] = useState<FlowChartType>("bar");
  const [showDii, setShowDii] = useState(true);
  const [showInd13, setShowInd13] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["nifty", "flow-tracker", timeframe.limit],
    queryFn: () => loadFlowTrackerData(timeframe.limit),
  });

  const hoverPoint = useMemo(() => {
    if (!data || hoverIndex == null) return null;
    return data.points[hoverIndex] ?? null;
  }, [data, hoverIndex]);

  // Latest non-null point per series drives the "reads at a glance" summary line.
  const latest = useMemo(() => {
    if (!data) return null;
    const pts = data.points;
    const lastFii = [...pts].reverse().find((p) => p.fiiFlow != null) ?? null;
    const lastDii = [...pts].reverse().find((p) => p.diiAbsorption != null) ?? null;
    const lastLs = [...pts].reverse().find((p) => p.fiiLongPct != null) ?? null;
    return { lastFii, lastDii, lastLs };
  }, [data]);

  const insight = useMemo(() => {
    if (!latest?.lastFii || latest.lastFii.fiiFlow == null) return null;
    const fii = latest.lastFii.fiiFlow;
    if (fii >= 0) {
      const ls = latest.lastLs?.fiiLongPct;
      const pos = ls == null ? "" : ls > IND13_LONG_BULLISH ? " and holding a long futures tilt" : ls < IND13_LONG_BEARISH ? " while running short in futures" : "";
      return `FII were net buyers on the latest print${pos}.`;
    }
    // FII sold — did DII absorb?
    const absorb = latest.lastDii?.diiAbsorption;
    if (absorb == null) return "FII were net sellers on the latest print. No DII absorption reading aligned to that day.";
    if (absorb >= 1) return `FII sold, and DII more than absorbed it (${absorb.toFixed(2)}× the FII sell).`;
    if (absorb >= 0.5) return `FII sold; DII partially absorbed it (${absorb.toFixed(2)}× the FII sell).`;
    return `FII sold and DII barely stepped in (${absorb.toFixed(2)}× the FII sell) — thin domestic support.`;
  }, [latest]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--lucid-bg)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 sm:px-6 h-14 shrink-0"
        style={{ borderBottom: "1px solid var(--lucid-line)" }}
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className="lt-serif text-lg font-semibold truncate" style={{ color: "var(--lucid-ink)" }}>
            Flow Tracker
          </h2>
          <span className="text-xs hidden sm:block" style={{ color: "var(--lucid-ink-3)" }}>
            FII cash flow · DII absorption · FII futures positioning
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md transition-colors hover:bg-white/5"
          style={{ color: "var(--lucid-ink-3)" }}
          title="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-5">
          {isLoading ? (
            <LoadingState message="Loading flow data…" />
          ) : error ? (
            <ErrorState error={error as Error} onRetry={() => refetch()} />
          ) : !data || data.points.length === 0 ? (
            <EmptyState title="No flow data" description="No FII/DII flow readings are available yet." />
          ) : (
            <>
              {/* Insight line */}
              {insight && (
                <div className="lt-card lt-edge p-4">
                  <p className="lt-serif text-sm sm:text-base" style={{ color: "var(--lucid-ink)" }}>
                    {insight}
                  </p>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Timeframe */}
                <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}>
                  {TIMEFRAMES.map((tf) => {
                    const active = tf.limit === timeframe.limit;
                    return (
                      <button
                        key={tf.label}
                        onClick={() => setTimeframe(tf)}
                        className="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors"
                        style={{
                          background: active ? "var(--lucid-accent-bg)" : "transparent",
                          color: active ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                        }}
                      >
                        {tf.label}
                      </button>
                    );
                  })}
                </div>

                {/* Bar / line toggle */}
                <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}>
                  {(["bar", "line"] as FlowChartType[]).map((ct) => {
                    const active = ct === chartType;
                    const Icon = ct === "bar" ? BarChart3 : Activity;
                    return (
                      <button
                        key={ct}
                        onClick={() => setChartType(ct)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-colors"
                        style={{
                          background: active ? "var(--lucid-accent-bg)" : "transparent",
                          color: active ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                        }}
                      >
                        <Icon size={13} />
                        {ct}
                      </button>
                    );
                  })}
                </div>

                {/* Series toggles */}
                <div className="flex items-center gap-2 ml-auto">
                  <SeriesToggle label="DII absorption" color="var(--lucid-warn)" on={showDii} onClick={() => setShowDii((v) => !v)} />
                  <SeriesToggle label="FII long %" color="var(--lucid-cool)" on={showInd13} onClick={() => setShowInd13((v) => !v)} />
                </div>
              </div>

              {/* Chart + hover rail */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4">
                <div className="lt-card p-4" style={{ height: 420 }}>
                  <FlowTrackerChart
                    points={data.points}
                    chartType={chartType}
                    showDii={showDii}
                    showInd13={showInd13}
                    onHoverIndex={setHoverIndex}
                  />
                </div>

                {/* Hover rail — that date's RAW values with correct units */}
                <div className="lt-card-2 p-4 flex flex-col gap-3">
                  <div className="lt-eyebrow">
                    {hoverPoint ? fmtDateFull(hoverPoint.date) : "Hover the chart"}
                  </div>
                  <RailRow
                    label="FII net flow"
                    value={fmtCr(hoverPoint?.fiiFlow ?? null)}
                    color={
                      hoverPoint?.fiiFlow == null
                        ? "var(--lucid-ink-3)"
                        : hoverPoint.fiiFlow >= 0
                          ? "var(--lucid-pos)"
                          : "var(--lucid-neg)"
                    }
                    note={hoverPoint?.fiiFlow == null ? "no reading" : hoverPoint.fiiFlow >= 0 ? "net inflow" : "net outflow"}
                  />
                  <RailRow
                    label="DII absorption"
                    value={hoverPoint?.diiAbsorption == null ? "n/a" : `${hoverPoint.diiAbsorption.toFixed(2)}×`}
                    color={hoverPoint?.diiAbsorption == null ? "var(--lucid-ink-3)" : "var(--lucid-warn)"}
                    note={
                      hoverPoint?.diiAbsorption == null
                        ? "FII not a net seller"
                        : hoverPoint.diiAbsorption >= 1
                          ? "fully absorbed"
                          : "partial"
                    }
                  />
                  <RailRow
                    label="FII long %"
                    value={hoverPoint?.fiiLongPct == null ? "n/a" : `${hoverPoint.fiiLongPct.toFixed(1)}%`}
                    color={hoverPoint?.fiiLongPct == null ? "var(--lucid-ink-3)" : "var(--lucid-cool)"}
                    note={
                      hoverPoint?.fiiLongPct == null
                        ? "no reading (backfill gap)"
                        : hoverPoint.fiiLongPct > IND13_LONG_BULLISH
                          ? "bullish tilt"
                          : hoverPoint.fiiLongPct < IND13_LONG_BEARISH
                            ? "bearish tilt"
                            : "neutral"
                    }
                  />
                </div>
              </div>

              {/* Honest data-gap disclosure */}
              <div className="lt-card-2 p-4 flex flex-col gap-1.5">
                <div className="lt-eyebrow">Data coverage</div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>
                  DII absorption is only defined on days FII were net sellers — it is genuinely absent
                  ({data.diiNaCount} such {data.diiNaCount === 1 ? "day" : "days"} in this window) and is drawn as a gap, never zero.
                  {data.ind13GapCount > 0 && (
                    <> FII long % has {data.ind13GapCount} missing {data.ind13GapCount === 1 ? "day" : "days"} (historical backfill gap), also drawn as a gap.</>
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SeriesToggle({ label, color, on, onClick }: { label: string; color: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-opacity"
      style={{
        background: "var(--lucid-surface-2)",
        border: "1px solid var(--lucid-line)",
        color: on ? "var(--lucid-ink-2)" : "var(--lucid-ink-3)",
        opacity: on ? 1 : 0.45,
      }}
    >
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </button>
  );
}

function RailRow({ label, value, color, note }: { label: string; value: string; color: string; note: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>{label}</span>
      <span className="lt-num text-lg font-semibold leading-none" style={{ color }}>{value}</span>
      <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>{note}</span>
    </div>
  );
}
