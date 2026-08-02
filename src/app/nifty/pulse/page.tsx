"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Zap, Search, ChevronRight } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useLatestScorecard } from "@/hooks/useLatestScorecard";
import { usePulseHistory } from "@/hooks/usePulseHistory";
import { AnimatedNumber } from "@/components/motion";
import { DetailDrawer } from "@/components/DetailDrawer";
import { PageSkeleton } from "@/components/state/PageSkeleton";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import {
  bandColor,
  bandBg,
  netDisplay,
  scoreDisplay,
  scorePillClass,
  flagPillStyle,
  velocityColor,
  formatDate,
  formatDateShort,
} from "../nifty-utils";

type DrawerContent = "domestic" | "external" | null;

export default function PulsePage() {
  const router = useRouter();
  const [drawerContent, setDrawerContent] = useState<DrawerContent>(null);

  const latestQuery = useLatestScorecard();
  const historyQuery = usePulseHistory();

  if (latestQuery.isLoading || historyQuery.isLoading) {
    return (
      <PageSkeleton cards={4} blocks={2} blockHeight={220} />
    );
  }

  if (latestQuery.error || historyQuery.error) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState
          error={latestQuery.error ?? historyQuery.error}
          onRetry={() => {
            latestQuery.refetch();
            historyQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (!latestQuery.data) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState title="No scorecard data available" />
      </div>
    );
  }

  const current = latestQuery.data;
  const history = historyQuery.data ?? [];
  const prior = history[1];

  if (current.indicators.length !== 13) {
    console.warn("Unexpected indicator count", current.indicators.length);
  }

  // Sparkline: last 10 scorecards (chronological)
  const sparkData = [...history]
    .slice(0, 10)
    .reverse()
    .map((s) => ({
      date: formatDateShort(s.date),
      net: s.net_score,
      band: s.band,
    }));
  const sparkInsufficient = sparkData.length < 2;
  // Data-driven y-domain (no hardcoded cap). Keep 0 and the +10 line in view.
  const sparkDomain: [number, number] = (() => {
    const vals = sparkData.map((d) => d.net);
    if (vals.length === 0) return [-2, 11];
    const lo = Math.min(0, ...vals);
    const hi = Math.max(0, ...vals);
    const pad = Math.max(1, Math.round((hi - lo) * 0.15));
    return [Math.max(-13, lo - pad), Math.min(13, Math.max(hi + pad, 11))];
  })();

  // Velocity (sourced from backend's velocity_short on the latest scorecard)
  const vel = current.velocity_short ?? null;
  const velColorVal = vel !== null ? velocityColor(vel) : null;

  // Indicator splits
  const domesticInds = current.indicators.filter((i) => i.composite === "Domestic");
  const externalInds = current.indicators.filter((i) => i.composite === "External");

  // Composition flag styling (handles null via default case)
  const flagStyle = flagPillStyle(current.composition_flag);

  // What changed (driven by prev_score embedded on each indicator)
  const changedIndicators = current.indicators.filter(
    (ind) => ind.prev_score !== undefined && ind.prev_score !== ind.score,
  );
  const showWhatChanged = prior !== undefined && changedIndicators.length > 0;

  // Missing indicators (insufficient_data outcome)
  const missingCount = current.missing_indicators.length;

  // Hero metadata flags
  const showHeroPhase = !!current.phase;
  const showHeroBucket = !!current.bucket;
  const showHeroMetaLine = showHeroPhase || showHeroBucket;
  const ind9Raw = current.ind9_raw_composite;

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="lt-rise lt-stagger-1 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="lt-serif text-2xl font-bold" style={{ color: "var(--lucid-ink)" }}>Pulse</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>Where macro sits right now.</p>
        </div>
        <div className="text-right text-sm shrink-0" style={{ color: "var(--lucid-ink-3)" }}>
          <p>As of {formatDate(current.date)}</p>
          {missingCount > 0 && (
            <p className="text-xs mt-0.5" style={{ color: "var(--lucid-warn)" }}>
              {missingCount} indicator{missingCount !== 1 ? "s" : ""} unavailable
            </p>
          )}
          {showHeroMetaLine && (
            <p>
              {showHeroPhase && <span>{current.phase}</span>}
              {showHeroPhase && showHeroBucket && " · "}
              {showHeroBucket && (
                <span style={{ color: "var(--lucid-ink-2)" }}>{current.bucket} regime</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* ── Section 1: Hero Band Card ────────────────────────────────── */}
      <div
        className="lt-card lt-edge lt-rise lt-stagger-2 p-5 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8"
        style={{
          background: `radial-gradient(120% 140% at 0% 0%, ${bandBg(current.band)}, transparent 55%), var(--lucid-grad-surface)`,
          borderColor: `color-mix(in srgb, ${bandColor(current.band)} 30%, transparent)`,
          boxShadow: "var(--lucid-elev-1)",
        }}
      >
        {/* Left — Band reading */}
        <div className="flex flex-col justify-center gap-3">
          <div>
            <div
              className="lt-serif text-5xl font-bold leading-none mb-2"
              style={{ color: bandColor(current.band) }}
            >
              {current.band}
            </div>
            <div className="text-2xl font-semibold tabular-nums" style={{ color: "var(--lucid-ink-2)" }}>
              Net <AnimatedNumber value={current.net_score} format={(n) => netDisplay(Math.round(n))} />
            </div>
            <div className="text-sm mt-1" style={{ color: "var(--lucid-ink-3)" }}>
              of 13 indicators · theoretical range −17 to +17
            </div>
          </div>
          {(showHeroPhase || showHeroBucket) && (
            <div className="flex items-center gap-3 mt-1">
              {showHeroPhase && (
                <span
                  className="text-xs font-semibold uppercase tracking-widest px-2 py-1 rounded"
                  style={{
                    background: bandBg(current.band),
                    color: bandColor(current.band),
                    border: `1px solid color-mix(in srgb, ${bandColor(current.band)} 40%, transparent)`,
                  }}
                >
                  {current.phase}
                </span>
              )}
              {showHeroBucket && (
                <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                  {current.bucket} regime
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right — Trajectory sparkline */}
        <div className="flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--lucid-ink-3)" }}>
            Net Score — Last 10 Scorecards
          </div>
          <div style={{ height: 120 }}>
            {sparkInsufficient ? (
              <EmptyState title="History accumulating…" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                  <XAxis dataKey="date" tick={{ fill: "var(--lucid-ink-3)", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis domain={sparkDomain} tick={{ fill: "var(--lucid-ink-3)", fontSize: 10 }} tickLine={false} axisLine={false} width={20} />
                  <ReferenceLine y={10} stroke={bandColor("Strong Bullish")} strokeDasharray="3 3" strokeOpacity={0.4} />
                  <ReferenceLine y={7} stroke={bandColor("Bullish")} strokeDasharray="3 3" strokeOpacity={0.3} />
                  <ReferenceLine y={0} stroke={bandColor("Strong Bearish")} strokeDasharray="3 3" strokeOpacity={0.3} />
                  <Tooltip
                    contentStyle={{ background: "var(--lucid-surface-2)", border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "var(--lucid-ink-2)" }}
                    formatter={(val: unknown) => [netDisplay(Number(val)), "Net"] as [string, string]}
                  />
                  <Line
                    dataKey="net"
                    stroke={bandColor(current.band)}
                    strokeWidth={2}
                    dot={(props) => {
                      const isLast = props.index === sparkData.length - 1;
                      return (
                        <circle
                          key={props.index}
                          cx={props.cx}
                          cy={props.cy}
                          r={isLast ? 5 : 3}
                          fill={isLast ? bandColor(current.band) : "var(--lucid-line-3)"}
                          stroke={isLast ? bandColor(current.band) : "transparent"}
                        />
                      );
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Velocity summary — populated when backend ships velocity_short,
              empty-state when it doesn't. Peak context lives in the peak
              banner below when active, so we hide the peak sub-line here to
              avoid duplicate data on adjacent surfaces. */}
          <div className="lt-card p-3 space-y-2" style={{ background: "var(--lucid-surface-2)" }}>
            {vel !== null && velColorVal ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-semibold tabular-nums" style={{ color: velColorVal }}>
                    {vel > 0 ? "+" : ""}{vel.toFixed(2)}
                  </span>
                  <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>/ day</span>
                </div>
                {!current.peak_score_active &&
                  current.peak_score_peak_value !== undefined &&
                  current.peak_score_peak_date && (
                    <div className="text-xs" style={{ color: "var(--lucid-ink-2)" }}>
                      Peak: {netDisplay(current.peak_score_peak_value)} on {formatDate(current.peak_score_peak_date)}
                    </div>
                  )}
              </>
            ) : (
              <div className="text-xs" style={{ color: "var(--lucid-ink-2)" }}>
                Velocity accumulating — populates after second scorecard
              </div>
            )}
            <button
              onClick={() => router.push("/nifty/velocity")}
              className="text-xs font-medium flex items-center gap-1"
              style={{ color: "var(--lucid-accent)" }}
            >
              View Velocity <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 2: Active Sub-Tool Banners ──────────────────────── */}
      {current.peak_score_active &&
        current.peak_score_peak_value !== undefined &&
        current.peak_score_peak_date && (
        <div
          className="lt-card p-4 flex flex-wrap items-start justify-between gap-3"
          style={{
            background: "var(--warning-bg)",
            border: "1px solid color-mix(in srgb, var(--lucid-warn) 15%, transparent)",
          }}
        >
          <div className="flex gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: "var(--warning)" }} />
            <div>
              <div className="font-semibold text-sm" style={{ color: "var(--warning)" }}>
                {current.band} — Ceiling State
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--lucid-ink-2)" }}>
                Peak {netDisplay(current.peak_score_peak_value)} on{" "}
                {formatDate(current.peak_score_peak_date)} · Now{" "}
                {netDisplay(current.net_score)}
              </div>
            </div>
          </div>
          <button
            onClick={() => router.push("/nifty/velocity")}
            className="flex items-center gap-1 text-xs font-medium shrink-0 ml-4 mt-0.5"
            style={{ color: "var(--warning)" }}
          >
            View velocity <ChevronRight size={14} />
          </button>
        </div>
      )}

      {current.conflict_flag && (
        <div
          className="lt-card p-4 flex items-start gap-3"
          style={{ background: "var(--purple-bg)", border: "1px solid color-mix(in srgb, var(--lucid-accent) 14%, transparent)" }}
        >
          <Zap size={18} className="mt-0.5 shrink-0" style={{ color: "var(--purple)" }} />
          <div>
            <div className="font-semibold text-sm" style={{ color: "var(--purple)" }}>
              CONFLICT — Domestic {netDisplay(current.domestic_composite)}, External {netDisplay(current.external_composite)}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--lucid-ink-2)" }}>
              Net masks the regime. Read External as the trade-relevant signal.
            </div>
          </div>
        </div>
      )}

      {(current.band === "Bearish" || current.band === "Strong Bearish") && (
        <button
          onClick={() => router.push("/nifty/v-bottom")}
          className="lt-card p-3 w-full flex items-center justify-between text-sm"
          style={{ background: "var(--lucid-surface-2)", border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)" }}
        >
          <div className="flex items-center gap-2">
            <Search size={15} style={{ color: "var(--lucid-ink-2)" }} />
            <span style={{ color: "var(--lucid-ink-2)" }}>
              {current.band} band active — V-Bottom diagnostic available
            </span>
          </div>
          <div className="flex items-center gap-1" style={{ color: "var(--lucid-accent)" }}>
            Open <ChevronRight size={14} />
          </div>
        </button>
      )}

      {/* ── Section 3: Section 9F Split ─────────────────────────────── */}
      <div
        className="lt-card lt-edge lt-rise lt-stagger-3 p-4 sm:p-6"
        style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--lucid-ink-3)" }}>
          Section 9F — Composite Breakdown
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
          {[
            { label: "DOMESTIC", value: current.domestic_composite, desc: "The slow-moving structural floor.", sub: "structural", min: 0, max: 7, drawerKey: "domestic" as DrawerContent },
            { label: "EXTERNAL", value: current.external_composite, desc: "The fast-moving cycle driver.", sub: "cycle", min: -6, max: 6, drawerKey: "external" as DrawerContent },
            { label: "NET", value: current.net_score, desc: "Combined reading.", sub: "summary", min: -4, max: 11, drawerKey: null },
          ].map(({ label, value, desc, sub, min, max, drawerKey }) => {
            const isNet = label === "NET";
            const fillPct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
            return (
              <button
                key={label}
                className="text-left space-y-3 cursor-pointer group"
                onClick={() => {
                  if (drawerKey) setDrawerContent(drawerKey);
                  else router.push("/nifty/scorecard");
                }}
              >
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--lucid-ink-3)" }}>
                  {label}
                </div>
                <div
                  className="text-5xl font-bold tabular-nums transition-colors"
                  style={{ color: isNet ? bandColor(current.band) : "var(--lucid-ink)" }}
                >
                  <AnimatedNumber value={value} format={(n) => netDisplay(Math.round(n))} />
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div
                    className="lt-bar h-full rounded-full transition-all"
                    style={{
                      width: `${fillPct}%`,
                      background: isNet ? bandColor(current.band) : "color-mix(in srgb, var(--lucid-ctx) 20%, transparent)",
                    }}
                  />
                </div>
                <div>
                  <div className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>{sub}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>{desc}</div>
                </div>
                {drawerKey && (
                  <div className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--lucid-accent)" }}>
                    Click to expand indicators →
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section 4: Two-Column Strip ─────────────────────────────── */}
      <div className="lt-rise lt-stagger-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left — What Changed */}
        <div className="lt-card p-5 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--lucid-ink-3)" }}>
            {formatDate(current.date)}
            {current.phase ? ` — ${current.phase}` : ""}
          </div>

          <div>
            <div className="text-sm font-medium mb-2" style={{ color: "var(--lucid-ink-2)" }}>
              This scorecard&apos;s catalysts
            </div>
            {current.catalysts.length > 0 ? (
              <ul className="space-y-1.5">
                {current.catalysts.slice(0, 5).map((c, i) => (
                  <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                    <span style={{ color: "var(--lucid-ink-3)" }}>•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                No catalysts recorded for this scorecard.
              </p>
            )}
          </div>

          {showWhatChanged && (
            <div>
              <div className="text-sm font-medium mb-2" style={{ color: "var(--lucid-ink-2)" }}>
                What changed vs prior scorecard
              </div>
              <ul className="space-y-1.5">
                {changedIndicators.map((ind) => {
                  const prev = ind.prev_score ?? 0;
                  if (ind.score === null) {
                    return (
                      <li key={ind.id} className="flex items-center gap-2 text-xs">
                        <span style={{ color: "var(--lucid-ink-3)" }}>—</span>
                        <span style={{ color: "var(--lucid-ink-2)" }}>{ind.short}</span>
                        <span style={{ color: "var(--lucid-ink-3)" }}>
                          {scoreDisplay(prev)} → unavailable
                        </span>
                      </li>
                    );
                  }
                  const up = ind.score > prev;
                  return (
                    <li key={ind.id} className="flex items-center gap-2 text-xs">
                      <span style={{ color: up ? "var(--positive)" : "var(--negative)" }}>
                        {up ? "↑" : "↓"}
                      </span>
                      <span style={{ color: "var(--lucid-ink-2)" }}>{ind.short}</span>
                      <span style={{ color: "var(--lucid-ink-3)" }}>
                        flipped {scoreDisplay(prev)} → {scoreDisplay(ind.score)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Right — Composition Flag */}
        <div className="lt-card p-5 space-y-4">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--lucid-ink-3)" }}>
            Ind 9 Composition
          </div>

          {current.composition_flag ? (
            <>
              <div>
                <span
                  className="inline-block px-3 py-1.5 rounded-lg text-sm font-bold"
                  style={{
                    background: flagStyle.bg,
                    color: flagStyle.color,
                    border: `1px solid ${flagStyle.border}`,
                  }}
                >
                  {current.composition_flag.replaceAll("_", " ")}
                </span>
              </div>

              <div className="space-y-2">
                {[
                  { label: "Inflation cluster", keys: ["CPI_YoY", "PPI_YoY", "Core_PCE"] },
                  { label: "Growth cluster", keys: ["GDP_QoQ", "ISM_Mfg", "ISM_Svc", "Retail_Sales"] },
                  { label: "Labor cluster", keys: ["NFP", "Unemployment", "Jobless_Claims", "ADP", "JOLTS"] },
                ].map(({ label, keys }) => {
                  const scores = keys.map((k) => Number(current.ind9_sub_indicators[k] ?? 0));
                  const negCount = scores.filter((s) => s < 0).length;
                  const sum = scores.reduce((a: number, b: number) => a + b, 0);
                  return (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span style={{ color: "var(--lucid-ink-3)" }}>{label}</span>
                      <span className="tabular-nums" style={{ color: sum < 0 ? "var(--negative)" : sum > 0 ? "var(--positive)" : "var(--lucid-ink-3)" }}>
                        {netDisplay(sum)} ({negCount} neg)
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => router.push("/nifty/usd-lab")}
                className="text-xs font-medium flex items-center gap-1"
                style={{ color: "var(--lucid-accent)" }}
              >
                Open USD Lab <ChevronRight size={12} />
              </button>
            </>
          ) : (
            <p className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
              Composition flag inactive — Ind 9 raw not in trigger range (current: {ind9Raw ?? "—"})
            </p>
          )}
        </div>
      </div>

      {/* ── Section 5: Narrative ─────────────────────────────────────── */}
      {current.notes && (
        <div
          className="lt-card lt-rise lt-stagger-5 p-5"
          style={{ background: "var(--lucid-grad-surface-2)", borderColor: "var(--lucid-line)", boxShadow: "var(--lucid-elev-1)" }}
        >
          <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--lucid-ink-3)" }}>
            Phase Narrative
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--lucid-ink-2)" }}>
            {current.notes}
          </p>
        </div>
      )}

      {/* ── Drawer: Composite indicators ─────────────────────────────── */}
      <DetailDrawer
        open={drawerContent !== null}
        onClose={() => setDrawerContent(null)}
        title={drawerContent === "domestic" ? "Domestic Indicators" : "External Indicators"}
      >
        <div className="p-4 sm:p-6 space-y-4">
          <p className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
            {drawerContent === "domestic"
              ? "6 domestic indicators (Ind 1, 2, 3, 4, 5, 7) driving the structural floor."
              : "6 external indicators (Ind 6, 8, 9, 10, 11, 12) driving the cycle reading."}
          </p>
          {(drawerContent === "domestic" ? domesticInds : externalInds).map((ind) => {
            const borderColor =
              ind.score !== null && ind.score >= 1
                ? "var(--positive)"
                : ind.score !== null && ind.score <= -1
                  ? "var(--negative)"
                  : "color-mix(in srgb, var(--lucid-ctx) 20%, transparent)";
            return (
              <div
                key={ind.id}
                className="p-4 rounded-xl"
                style={{
                  background: "var(--lucid-surface-2)",
                  borderLeft: `3px solid ${borderColor}`,
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>Ind {ind.id} · </span>
                    <span className="text-sm font-medium" style={{ color: "var(--lucid-ink)" }}>{ind.name}</span>
                  </div>
                  <span className={scorePillClass(ind.score)}>{scoreDisplay(ind.score)}</span>
                </div>
                <div className="font-mono text-base font-semibold" style={{ color: "var(--lucid-ink)" }}>
                  {ind.value}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>{ind.magnitude}</div>
              </div>
            );
          })}
        </div>
      </DetailDrawer>
    </div>
  );
}
