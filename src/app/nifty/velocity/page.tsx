"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
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
    <div className="p-6 space-y-5 max-w-350">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#E2E8F0" }}>Velocity</h1>
        <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>Net score change per day, anchor-to-anchor.</p>
      </div>

      {/* ── Date Range Inputs (always mounted) ──────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="vel-start"
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#64748B" }}
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
                background: "rgba(14,20,30,0.6)",
                border: "1px solid rgba(148,163,184,0.12)",
                color: "#E2E8F0",
                colorScheme: "dark",
              }}
            />
            {hasVelocity && data.start_net !== null && (
              <span className="text-xs" style={{ color: "#475569" }}>
                Net {netDisplay(data.start_net)}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="vel-end"
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "#64748B" }}
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
                background: "rgba(14,20,30,0.6)",
                border: "1px solid rgba(148,163,184,0.12)",
                color: "#E2E8F0",
                colorScheme: "dark",
              }}
            />
            {hasVelocity && data.end_net !== null && (
              <span className="text-xs" style={{ color: "#475569" }}>
                Net {netDisplay(data.end_net)}
              </span>
            )}
          </div>

          {(userStartDate !== null || userEndDate !== null) && (
            <button
              className="flex items-center gap-1.5 text-xs px-3 py-2"
              style={{ color: "#64748B" }}
              onClick={resetToAuto}
            >
              <RotateCcw size={12} />
              Reset to auto
            </button>
          )}
        </div>

        {showAutoHint && (
          <div className="text-xs mt-3" style={{ color: "#64748B" }}>
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

      {/* ── Tier Reference (always mounted; highlights current label) ── */}
      <TierTable label={data?.label ?? null} />

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

function TierTable({ label }: { label: VelocityLabel | null }) {
  return (
    <div className="glass-card p-5">
      <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#64748B" }}>
        Velocity Scale
      </div>
      <div className="space-y-2">
        {VELOCITY_TIERS.map((tier) => {
          const isCurrent = label === tier.label;
          const tierColor = `var(${tier.cssVar})`;
          return (
            <div
              key={tier.label}
              className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all"
              style={{
                background: isCurrent ? "rgba(59,130,246,0.08)" : "transparent",
                borderLeft: isCurrent ? "2px solid #3B82F6" : "2px solid transparent",
              }}
            >
              <span className="text-lg w-8 text-center" style={{ color: tierColor }}>
                {tier.symbol}
              </span>
              <span className="text-xs tabular-nums w-32" style={{ color: "#475569" }}>
                {tier.range}
              </span>
              <span className="text-xs font-medium" style={{ color: isCurrent ? "#E2E8F0" : "#64748B" }}>
                {tier.label}
              </span>
              {isCurrent && (
                <span className="ml-auto text-xs" style={{ color: "#3B82F6" }}>◄</span>
              )}
            </div>
          );
        })}
      </div>
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
        <div className="glass-card p-8" style={{ background: "rgba(148,163,184,0.04)" }}>
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
      <div className="glass-card p-8" style={{ background: "rgba(148,163,184,0.04)" }}>
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

  return (
    <div className="space-y-5">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div
        className="glass-card p-8 text-center"
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
          <div className="text-sm" style={{ color: "#64748B" }}>
            {sessions} sessions
          </div>
        )}
      </div>

      {/* ── Trajectory Chart ────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#64748B" }}>
          Trajectory
          {start_date && end_date && (
            <span style={{ color: "#475569" }}>
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
                <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis domain={[-5, 13]} tick={{ fill: "#475569", fontSize: 11 }} tickLine={false} axisLine={false} width={24} />
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
                  contentStyle={{ background: "#0A1628", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 8, fontSize: 12 }}
                  formatter={(val) => [netDisplay(Number(val)), "Net"]}
                />
                <Line
                  dataKey="net"
                  stroke="#3B82F6"
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
                        fill={isAnchor ? "#3B82F6" : "#334155"}
                        stroke={isAnchor ? "#3B82F6" : "transparent"}
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
      <div className="glass-card p-5">
        <EmptyState
          title="Historical velocity events"
          description="Backend doesn't yet expose the event log. Real events will populate as the velocity classifier accumulates history."
        />
      </div>
    </div>
  );
}
