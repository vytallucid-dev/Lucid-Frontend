"use client";

import { useState } from "react";
import { RotateCcw, ChevronDown } from "lucide-react";
import {
    Line,
    LineChart,
    ReferenceArea,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { useVelocity } from "@/hooks/useVelocity";
import { ApiError } from "@/lib/api/client";
import type { PublicVelocityResponse, VelocityLabel } from "@/lib/api/nifty";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import { bandColor, formatDateShort, netDisplay, VELOCITY_TIERS } from "../nifty-utils";

function velocityLabelToColor(label: VelocityLabel | null | undefined): string {
  if (!label) return "var(--text-secondary)";
  const tier = VELOCITY_TIERS.find((t) => t.label === label);
  return tier ? `var(${tier.cssVar})` : "var(--text-secondary)";
}

function velocityLabelToSymbol(label: VelocityLabel | null | undefined): string {
  if (!label) return "—";
  return VELOCITY_TIERS.find((t) => t.label === label)?.symbol ?? "—";
}

function formatVelocity(v: number): string {
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;
}

function is404(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 404;
}

export default function VelocityPage() {
  const [userStartDate, setUserStartDate] = useState<string | null>(null);
  const [userEndDate, setUserEndDate] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useVelocity({
    startDate: userStartDate ?? undefined,
    endDate: userEndDate ?? undefined,
  });

  const hasVelocity =
    !!data && data.velocity !== null && data.label !== null;

  // Picker prefill: user's typed value wins; else last resolved date from a
  // successful fetch; else empty. During error / loading, data is undefined,
  // so the input falls back to whatever the user last typed (or empty on
  // first load) — pickers never blank out unexpectedly.
  const startInputValue = userStartDate ?? data?.start_date ?? "";
  const endInputValue = userEndDate ?? data?.end_date ?? "";

  const showAutoHint =
    !!data &&
    (data.auto_anchors.high_anchor_date !== null ||
      data.auto_anchors.low_anchor_date !== null);

  function resetToAuto() {
    setUserStartDate(null);
    setUserEndDate(null);
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-350">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="lt-serif text-2xl font-bold" style={{ color: "var(--lucid-ink)" }}>Velocity</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>Net score change per day, anchor-to-anchor.</p>
      </div>

      {/* ── Date Range Inputs (always mounted) ──────────────────────── */}
      <div className="lt-card p-4 sm:p-5">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="vel-start"
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--lucid-ink-3)" }}
            >
              Start
            </label>
            <input
              id="vel-start"
              type="date"
              value={startInputValue}
              onChange={(e) => setUserStartDate(e.target.value || null)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--lucid-surface-2)",
                border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)",
                color: "var(--lucid-ink)",
                colorScheme: "dark",
              }}
            />
            {hasVelocity && data.start_net !== null && (
              <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                Net {netDisplay(data.start_net)}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="vel-end"
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--lucid-ink-3)" }}
            >
              End
            </label>
            <input
              id="vel-end"
              type="date"
              value={endInputValue}
              onChange={(e) => setUserEndDate(e.target.value || null)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--lucid-surface-2)",
                border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)",
                color: "var(--lucid-ink)",
                colorScheme: "dark",
              }}
            />
            {hasVelocity && data.end_net !== null && (
              <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                Net {netDisplay(data.end_net)}
              </span>
            )}
          </div>

          {(userStartDate !== null || userEndDate !== null) && (
            <button
              className="flex items-center gap-1.5 text-xs px-3 py-2"
              style={{ color: "var(--lucid-ink-3)" }}
              onClick={resetToAuto}
            >
              <RotateCcw size={12} />
              Reset to auto
            </button>
          )}
        </div>

        {showAutoHint && (
          <div className="text-xs mt-3" style={{ color: "var(--lucid-ink-3)" }}>
            Suggested anchors:{" "}
            {data.auto_anchors.high_anchor_date !== null && (
              <span>
                high {data.auto_anchors.high_anchor_date}
                {data.auto_anchors.high_anchor_net !== null &&
                  ` (Net ${netDisplay(data.auto_anchors.high_anchor_net)})`}
              </span>
            )}
            {data.auto_anchors.high_anchor_date !== null &&
              data.auto_anchors.low_anchor_date !== null && <span>, </span>}
            {data.auto_anchors.low_anchor_date !== null && (
              <span>
                low {data.auto_anchors.low_anchor_date}
                {data.auto_anchors.low_anchor_net !== null &&
                  ` (Net ${netDisplay(data.auto_anchors.low_anchor_net)})`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Compact condition scale (current tier prominent; expand for full legend) ── */}
      <VelocityScale label={data?.label ?? null} velocity={data?.velocity ?? null} />

      {/* ── Result Area (swaps; chrome above stays mounted) ─────────── */}
      <ResultArea
        isLoading={isLoading}
        error={error}
        data={data}
        hasVelocity={hasVelocity}
        refetch={refetch}
      />
    </div>
  );
}

/**
 * Compact condition scale. Replaces the old always-tall 8-row legend: a single
 * segmented strip (deterioration → repair) with the CURRENT tier called out
 * prominently, and the full 8-tier reference tucked behind an expand toggle so
 * the chart + number stay the focus.
 */
function VelocityScale({ label, velocity }: { label: VelocityLabel | null; velocity: number | null }) {
  const [expanded, setExpanded] = useState(false);
  // VELOCITY_TIERS is ordered best → worst; reverse for a worst→best left-to-right strip.
  const strip = [...VELOCITY_TIERS].reverse();
  const current = label ? VELOCITY_TIERS.find((t) => t.label === label) ?? null : null;
  const currentColor = current ? `var(${current.cssVar})` : "var(--lucid-ink-3)";

  return (
    <div className="lt-card p-4">
      {/* Top row: current tier + segmented strip + expand toggle */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl leading-none" style={{ color: currentColor }}>
            {current?.symbol ?? "—"}
          </span>
          <div className="min-w-0">
            <div className="lt-eyebrow" style={{ color: "var(--lucid-ink-3)" }}>Velocity scale</div>
            <div className="lt-serif text-sm font-semibold leading-tight truncate" style={{ color: current ? "var(--lucid-ink)" : "var(--lucid-ink-3)" }}>
              {label ?? "No reading"}
              {velocity !== null && (
                <span className="lt-num ml-2 font-normal" style={{ color: currentColor }}>
                  {formatVelocity(velocity)}/day
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Segmented condition strip — current segment raised + ringed. */}
        <div className="flex items-center gap-0.5 flex-1 min-w-[180px]" role="img" aria-label={`Velocity tier: ${label ?? "none"}`}>
          {strip.map((tier) => {
            const isCurrent = tier.label === label;
            return (
              <div
                key={tier.label}
                title={`${tier.label} · ${tier.range}`}
                className="flex-1 rounded-sm transition-all"
                style={{
                  height: isCurrent ? 16 : 8,
                  background: `var(${tier.cssVar})`,
                  opacity: isCurrent ? 1 : 0.32,
                  outline: isCurrent ? "1px solid var(--lucid-ink)" : "none",
                  outlineOffset: 1,
                }}
              />
            );
          })}
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs shrink-0"
          style={{ color: "var(--lucid-ink-3)" }}
        >
          {expanded ? "Hide" : "Full scale"}
          <ChevronDown size={13} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </button>
      </div>

      {/* Expanded full legend */}
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-4 pt-4" style={{ borderTop: "1px solid var(--lucid-line)" }}>
          {VELOCITY_TIERS.map((tier) => {
            const isCurrent = label === tier.label;
            return (
              <div
                key={tier.label}
                className="flex items-center gap-2.5 px-2 py-1 rounded-md"
                style={{ background: isCurrent ? "var(--lucid-accent-bg)" : "transparent" }}
              >
                <span className="text-base w-6 text-center" style={{ color: `var(${tier.cssVar})` }}>{tier.symbol}</span>
                <span className="lt-num text-xs w-28 shrink-0" style={{ color: "var(--lucid-ink-3)" }}>{tier.range}</span>
                <span className="text-xs font-medium truncate" style={{ color: isCurrent ? "var(--lucid-ink)" : "var(--lucid-ink-2)" }}>{tier.label}</span>
                {isCurrent && <span className="ml-auto text-xs shrink-0" style={{ color: "var(--lucid-accent)" }}>◄</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResultArea({
  isLoading,
  error,
  data,
  hasVelocity,
  refetch,
}: {
  isLoading: boolean;
  error: Error | null;
  data: PublicVelocityResponse | undefined;
  hasVelocity: boolean;
  refetch: () => void;
}) {
  if (isLoading) {
    return <LoadingState message="Loading velocity..." />;
  }
  if (error) {
    if (is404(error)) {
      return (
        <div className="lt-card p-5 sm:p-8" style={{ background: "var(--lucid-line)" }}>
          <EmptyState
            title="No scorecard for selected date"
            description={`${error.message}. Pick a date with available data above.`}
          />
        </div>
      );
    }
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }
  if (!data) {
    return <EmptyState title="No velocity data" />;
  }

  if (!hasVelocity) {
    return (
      <div className="lt-card p-8" style={{ background: "var(--lucid-line)" }}>
        <EmptyState
          title="Velocity unavailable"
          description={data.reason ?? undefined}
        />
      </div>
    );
  }

  return <SuccessView data={data} />;
}

function SuccessView({ data }: { data: PublicVelocityResponse }) {
  const { velocity, label, sessions, start_date, end_date, trajectory } = data;
  const velColor = velocityLabelToColor(label);
  const velSymbol = velocityLabelToSymbol(label);

  // Data-driven y-domain (no hardcoded cap). Net operative range is −13..+13;
  // pad the actual data, always keep 0 in view, and never clip a band line.
  const netValues = trajectory.map((p) => p.net);
  const yDomain: [number, number] = (() => {
    if (netValues.length === 0) return [-2, 4];
    const lo = Math.min(0, ...netValues);
    const hi = Math.max(0, ...netValues);
    const pad = Math.max(2, Math.round((hi - lo) * 0.15));
    // Keep the +10 (Strong Bullish) / 0 reference lines visible when relevant.
    return [Math.max(-13, lo - pad), Math.min(13, Math.max(hi + pad, 10))];
  })();

  return (
    <div className="space-y-5">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div
        className="lt-card p-5 sm:p-8 text-center"
        style={{
          background: `color-mix(in srgb, ${velColor} 6%, transparent)`,
          borderColor: `color-mix(in srgb, ${velColor} 30%, transparent)`,
        }}
      >
        <div
          className="text-5xl font-bold tabular-nums leading-none mb-3"
          style={{ color: velColor }}
        >
          {formatVelocity(velocity!)} /day
        </div>
        <div
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-md mb-3"
          style={{
            color: velColor,
            background: `color-mix(in srgb, ${velColor} 12%, transparent)`,
            border: `1px solid ${velColor}`,
          }}
        >
          <span>{velSymbol}</span>
          <span>{label}</span>
        </div>
        {sessions !== null && (
          <div className="text-sm" style={{ color: "var(--lucid-ink-3)" }}>
            {sessions} sessions
          </div>
        )}
      </div>

      {/* ── Trajectory Chart ────────────────────────────────────────── */}
      <div className="lt-card p-5">
        <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--lucid-ink-3)" }}>
          Trajectory
          {start_date && end_date && (
            <span style={{ color: "var(--lucid-ink-3)" }}>
              {" "}
              — {formatDateShort(start_date)} → {formatDateShort(end_date)}
            </span>
          )}
        </div>
        {trajectory.length < 2 ? (
          <EmptyState
            title="Trajectory accumulating"
            description="Need at least two anchor points to render a trajectory."
          />
        ) : (
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trajectory.map((p) => ({
                  date: formatDateShort(p.date),
                  fullDate: p.date,
                  net: p.net,
                  isAnchor: p.date === start_date || p.date === end_date,
                }))}
                margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
              >
                <XAxis dataKey="date" tick={{ fill: "var(--lucid-ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={yDomain} tick={{ fill: "var(--lucid-ink-3)", fontSize: 11 }} tickLine={false} axisLine={false} width={24} />
                <ReferenceLine y={10} stroke={bandColor("Strong Bullish")} strokeDasharray="3 3" strokeOpacity={0.4} label={{ value: "SB", position: "insideRight", fill: bandColor("Strong Bullish"), fontSize: 10 }} />
                <ReferenceLine y={7} stroke={bandColor("Bullish")} strokeDasharray="3 3" strokeOpacity={0.3} />
                <ReferenceLine y={4} stroke={bandColor("Neutral")} strokeDasharray="3 3" strokeOpacity={0.25} />
                <ReferenceLine y={0} stroke={bandColor("Strong Bearish")} strokeDasharray="3 3" strokeOpacity={0.3} />
                {start_date && end_date && (
                  <ReferenceArea
                    x1={formatDateShort(start_date)}
                    x2={formatDateShort(end_date)}
                    fill={velColor}
                    fillOpacity={0.04}
                  />
                )}
                <Tooltip
                  contentStyle={{ background: "var(--lucid-surface-2)", border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", borderRadius: 8, fontSize: 12 }}
                  formatter={(val) => [netDisplay(Number(val)), "Net"]}
                />
                <Line
                  dataKey="net"
                  stroke="var(--lucid-accent)"
                  strokeWidth={2}
                  dot={(props) => {
                    const point = trajectory[props.index];
                    const isAnchor = point?.date === start_date || point?.date === end_date;
                    return (
                      <circle
                        key={props.index}
                        cx={props.cx}
                        cy={props.cy}
                        r={isAnchor ? 6 : 3}
                        fill={isAnchor ? "var(--lucid-accent)" : "var(--lucid-line-3)"}
                        stroke={isAnchor ? "var(--lucid-accent)" : "transparent"}
                        strokeWidth={isAnchor ? 2 : 0}
                      />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Historical Events Placeholder ───────────────────────────── */}
      <div className="lt-card p-5">
        <EmptyState
          title="Historical velocity events"
          description="Backend doesn't yet expose the event log. Real events will populate as the velocity classifier accumulates history."
        />
      </div>
    </div>
  );
}
