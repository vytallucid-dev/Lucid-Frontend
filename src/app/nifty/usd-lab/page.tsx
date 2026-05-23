"use client";

import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { patterns } from "@/lib/nifty-demo-data";
import { useLatestScorecard } from "@/hooks/useLatestScorecard";
import { useScorecardHistory } from "@/hooks/useScorecardHistory";
import type { PublicScorecard } from "@/lib/api/nifty";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import {
  scorePillClass,
  scoreDisplay,
  netDisplay,
  flagPillStyle,
  formatDateShort,
} from "../nifty-utils";

// Sub-indicator definitions per cluster
const CLUSTERS = [
  {
    name: "INFLATION",
    keys: ["CPI_YoY", "PPI_YoY", "Core_PCE"],
    labels: ["CPI YoY", "PPI YoY", "Core PCE"],
    note: null,
    includesInFlag: true,
    flagKey: "I",
  },
  {
    name: "GROWTH",
    keys: ["GDP_QoQ", "ISM_Mfg", "ISM_Svc", "Retail_Sales"],
    labels: ["GDP QoQ", "ISM Mfg", "ISM Svc", "Retail Sales"],
    note: null,
    includesInFlag: true,
    flagKey: "GL",
  },
  {
    name: "LABOR",
    keys: ["NFP", "Unemployment", "Jobless_Claims", "ADP", "JOLTS"],
    labels: ["NFP", "Unemployment", "Jobless Claims", "ADP", "JOLTS"],
    note: null,
    includesInFlag: true,
    flagKey: "GL",
  },
  {
    name: "SENTIMENT",
    keys: ["Consumer_Conf", "US02Y_SMA"],
    labels: ["Consumer Conf", "US02Y SMA"],
    note: "Excluded from composition flag logic",
    includesInFlag: false,
    flagKey: null,
  },
];

// Compute cluster sums and negatives
function computeClusterStats(sc: PublicScorecard) {
  return CLUSTERS.map((cluster) => {
    const scores = cluster.keys.map((k) => (sc.ind9_sub_indicators[k] ?? 0) as number);
    const sum = scores.reduce((a, b) => a + b, 0);
    const negCount = scores.filter((s) => s < 0).length;
    const posCount = scores.filter((s) => s > 0).length;
    return { ...cluster, scores, sum, negCount, posCount };
  });
}

// Composition flag resolution text (negative side)
function computeFlagResolution(sc: PublicScorecard): string {
  const raw = sc.ind9_raw_composite;
  if (raw === null) {
    return "Composition flag inactive — Ind 9 raw composite not available.";
  }

  const stats = computeClusterStats(sc);
  const inflationCluster = stats[0];
  const growthCluster = stats[1];
  const laborCluster = stats[2];
  const I_neg = inflationCluster.negCount;
  const GL_neg = growthCluster.negCount + laborCluster.negCount;
  const I_pos = inflationCluster.posCount;
  const GL_pos = growthCluster.posCount + laborCluster.posCount;

  if (raw > -4 && raw < 4) {
    return "Composition flag inactive — Ind 9 raw not in trigger range.";
  }

  if (raw <= -4) {
    const lines = [
      `I_neg (INFLATION cluster negatives): ${I_neg}`,
      `GL_neg (GROWTH + LABOR negatives): ${GL_neg}`,
      "",
    ];
    if (I_neg >= 2) {
      lines.push(`Resolution: I_neg = ${I_neg} ≥ 2 → INFLATION_LED`);
      lines.push("USD weakness driven by inflation cooling — equity-supportive.");
    } else if (GL_neg >= 6 && I_neg === 0) {
      lines.push(`Resolution: GL_neg = ${GL_neg} ≥ 6 AND I_neg = 0 → DEMAND_DESTRUCTION`);
      lines.push("USD weakness driven purely by demand deterioration — equity-stalling.");
    } else {
      lines.push(`Resolution: GL_neg = ${GL_neg} ≥ 6, but I_neg = ${I_neg} → not pure demand destruction.`);
      lines.push(`I_neg = ${I_neg} < 2 → not inflation-led.`);
      lines.push("→ MIXED — no directional read on composition.");
    }
    return lines.join("\n");
  } else {
    const lines = [
      `I_pos (INFLATION cluster positives): ${I_pos}`,
      `GL_pos (GROWTH + LABOR positives): ${GL_pos}`,
      "",
    ];
    if (I_pos >= 2) {
      lines.push(`Resolution: I_pos = ${I_pos} ≥ 2 → INFLATION_HOT`);
      lines.push("USD strength driven by hot inflation — negative for NIFTY macro.");
    } else if (GL_pos >= 6 && I_pos === 0) {
      lines.push(`Resolution: GL_pos = ${GL_pos} ≥ 6 AND I_pos = 0 → DEMAND_REACCEL`);
      lines.push("USD strength driven by demand re-acceleration — growth premium shift.");
    } else {
      lines.push(`Resolution: Mixed composition on positive side → MIXED (positive regime).`);
    }
    return lines.join("\n");
  }
}

// 5-tier mapping
function getTierLabel(raw: number): string {
  if (raw <= -7) return "+2 (USD very weak — strong NIFTY tailwind)";
  if (raw <= -4) return "+1 (USD weakening)";
  if (raw <= 3) return "0 (neutral)";
  if (raw <= 6) return "−1 (USD strengthening)";
  return "−2 (USD very strong — NIFTY headwind)";
}

// Patterns that involve Ind 9 (from demo until patterns API wired)
const ind9Patterns = patterns.filter(
  (p) =>
    p.id === "P15-2" ||
    p.id === "P15-8" ||
    p.id === "P22-3" ||
    p.id === "P18-6" ||
    p.drives_subtool === "Composition" ||
    p.drives_subtool === "V-Bottom",
);

export default function USDLabPage() {
  const router = useRouter();
  const {
    data: current,
    isLoading,
    error,
    refetch,
  } = useLatestScorecard();
  const historyQuery = useScorecardHistory({ limit: 100 });

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingState message="Loading scorecard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="p-6">
        <EmptyState title="No scorecard data available" />
      </div>
    );
  }

  const subIndicatorsEmpty = Object.keys(current.ind9_sub_indicators).length === 0;
  const clusterStats = computeClusterStats(current);
  const flagResolution = computeFlagResolution(current);
  const flagStyle = flagPillStyle(current.composition_flag);
  const rawVal = current.ind9_raw_composite;
  const hasRaw = rawVal !== null;
  const isNegativeSide = hasRaw && rawVal! <= -4;
  const isPositiveSide = hasRaw && rawVal! >= 4;
  const sliderPct = hasRaw ? ((rawVal! + 14) / 28) * 100 : 50;
  const ind9 = current.indicators.find((i) => i.id === 9);

  // History chart data — full history has ind9_raw_composite + date + id
  const historyItems = historyQuery.data ?? [];
  const ind9History = [...historyItems]
    .reverse()
    .map((s) => ({
      date: formatDateShort(s.date),
      raw: s.ind9_raw_composite,
      isCurrent: s.id === current.id,
    }))
    .filter((p) => p.raw !== null) as Array<{ date: string; raw: number; isCurrent: boolean }>;

  return (
    <div className="p-6 space-y-5 max-w-350">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#E2E8F0" }}>USD Lab</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>The texture behind Indicator 9.</p>
        </div>
        <div className="text-sm" style={{ color: "#64748B" }}>
          Raw {hasRaw ? netDisplay(rawVal!) : "—"} · Score {scoreDisplay(ind9?.score)}{" "}
          {current.composition_flag && (
            <span style={{ color: flagStyle.color }}>· [{current.composition_flag.replace("_", " ")}]</span>
          )}
        </div>
      </div>

      {/* ── Section 1: Composite Math Strip ─────────────────────────── */}
      <div className="glass-card p-5">
        <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#64748B" }}>
          Raw Composite: {hasRaw ? `${rawVal! >= 0 ? "+" : ""}${rawVal}` : "—"} / −14 to +14
        </div>

        {hasRaw ? (
          <>
            {/* Slider visualization */}
            <div className="relative h-6 mb-3">
              <div className="absolute inset-0 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
              <div className="absolute top-0 bottom-0 w-px" style={{ left: "50%", background: "rgba(148,163,184,0.3)" }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2"
                style={{
                  left: `${sliderPct}%`,
                  transform: "translate(-50%, -50%)",
                  background: rawVal! < 0 ? "var(--positive)" : rawVal! > 0 ? "var(--negative)" : "var(--neutral)",
                  border: `2px solid ${rawVal! < 0 ? "var(--positive)" : rawVal! > 0 ? "var(--negative)" : "var(--neutral)"}`,
                  boxShadow: `0 0 8px ${rawVal! < 0 ? "rgba(16,185,129,0.5)" : rawVal! > 0 ? "rgba(239,68,68,0.5)" : "transparent"}`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs" style={{ color: "#334155" }}>
              <span>−14 (USD very weak)</span>
              <span>0</span>
              <span>+14 (USD very strong)</span>
            </div>

            <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(14,20,30,0.5)" }}>
              <div className="text-xs" style={{ color: "#94A3B8" }}>
                Score tier: <strong style={{ color: "#E2E8F0" }}>{getTierLabel(rawVal!)}</strong>
              </div>
            </div>
          </>
        ) : (
          <div className="text-xs" style={{ color: "#64748B" }}>
            Ind 9 raw composite not available for this scorecard.
          </div>
        )}
      </div>

      {/* ── Section 2: Cluster Grid (or sub-indicator EmptyState) ──── */}
      {subIndicatorsEmpty ? (
        <div className="glass-card p-5">
          <EmptyState
            title="Sub-indicator breakdown not yet available"
            description="The EdgeFinder → NIFTY Ind 9 detailed bridge is pending. Headline score is available; sub-cluster detail will populate once wired."
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {clusterStats.map((cluster) => (
            <div key={cluster.name} className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#64748B" }}>
                    {cluster.name}
                  </div>
                  <div
                    className="text-2xl font-bold tabular-nums mt-0.5"
                    style={{ color: cluster.sum < 0 ? "var(--positive)" : cluster.sum > 0 ? "var(--negative)" : "#64748B" }}
                  >
                    {netDisplay(cluster.sum)}
                  </div>
                </div>
                {cluster.note && (
                  <div
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: "rgba(148,163,184,0.1)", color: "#64748B" }}
                  >
                    ⓘ {cluster.note}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {cluster.keys.map((key, i) => {
                  const score = (current.ind9_sub_indicators[key] ?? 0) as Parameters<typeof scorePillClass>[0];
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "#64748B" }}>{cluster.labels[i]}</span>
                      <span className={scorePillClass(score)}>{scoreDisplay(score)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 pt-3 border-t text-xs" style={{ borderColor: "rgba(148,163,184,0.08)", color: "#475569" }}>
                Composition: {cluster.negCount} negative{cluster.negCount !== 1 ? "s" : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Section 3: Composition Flag Card ────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#64748B" }}>
            Composition Flag:
          </div>
          {current.composition_flag ? (
            <span
              className="px-3 py-1.5 rounded-lg text-sm font-bold"
              style={{ background: flagStyle.bg, color: flagStyle.color, border: `1px solid ${flagStyle.border}` }}
            >
              {current.composition_flag.replace(/_/g, " ")}
            </span>
          ) : (
            <span className="text-sm" style={{ color: "#64748B" }}>Inactive</span>
          )}
        </div>

        {/* Rule */}
        <div className="mb-4">
          <div className="text-xs font-semibold mb-2" style={{ color: "#475569" }}>Rule (negative side):</div>
          <div className="text-xs space-y-1" style={{ color: "#64748B" }}>
            <div>• INFLATION_LED if I_neg ≥ 2</div>
            <div>• DEMAND_DESTRUCTION if GL_neg ≥ 6 AND I_neg = 0</div>
            <div>• MIXED — all other patterns</div>
          </div>
        </div>

        {/* Resolution */}
        <div className="p-4 rounded-xl whitespace-pre-wrap text-xs leading-relaxed" style={{ background: "rgba(14,20,30,0.6)", color: "#94A3B8", fontFamily: "monospace" }}>
          {subIndicatorsEmpty && (isNegativeSide || isPositiveSide)
            ? "Composition flag resolution unavailable — sub-indicator data pending."
            : flagResolution}
        </div>

        {/* Operational read */}
        <div className="mt-4 text-xs" style={{ color: "#475569" }}>
          {hasRaw && isNegativeSide && (
            <p>Composition flag activated (Ind 9 raw {rawVal} ≤ −4 ✓). Flag is observational — informs context, no scoring impact.</p>
          )}
          {hasRaw && isPositiveSide && (
            <p>MIRROR flag active (Ind 9 raw +{rawVal} ≥ +4). Mirror flags assess USD strength composition.</p>
          )}
          {hasRaw && !isNegativeSide && !isPositiveSide && (
            <p>Composition flag inactive — Ind 9 raw {rawVal} not in trigger range (need ≤ −4 or ≥ +4).</p>
          )}
          {!hasRaw && (
            <p>Composition flag status unavailable — Ind 9 raw composite missing.</p>
          )}
        </div>
      </div>

      {/* ── Section 4: Ind 9 Raw History Chart ──────────────────────── */}
      <div className="glass-card p-5">
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#64748B" }}>
          Ind 9 Raw — Historical Chart
        </div>
        <p className="text-xs mb-4" style={{ color: "#475569" }}>
          Full-cycle swings (≥10 points peak-to-trough) signal USD regime turns (P15-8).
        </p>
        <div style={{ height: 280 }}>
          {historyQuery.isLoading ? (
            <LoadingState message="Loading history..." />
          ) : historyQuery.error ? (
            <ErrorState
              error={historyQuery.error}
              onRetry={() => historyQuery.refetch()}
              title="Couldn't load Ind 9 history"
            />
          ) : ind9History.length === 0 ? (
            <EmptyState title="No historical Ind 9 data available" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ind9History} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <XAxis dataKey="date" tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
                <YAxis domain={[-14, 14]} tick={{ fill: "#475569", fontSize: 10 }} tickLine={false} axisLine={false} width={24} />
                <ReferenceLine y={7} stroke="var(--negative)" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: "+7 (−2 score)", position: "insideRight", fill: "#EF4444", fontSize: 9 }} />
                <ReferenceLine y={4} stroke="var(--negative)" strokeDasharray="3 3" strokeOpacity={0.3} label={{ value: "+4", position: "insideRight", fill: "#F97316", fontSize: 9 }} />
                <ReferenceLine y={0} stroke="rgba(148,163,184,0.5)" strokeDasharray="3 3" label={{ value: "0", position: "insideRight", fill: "#94A3B8", fontSize: 9 }} />
                <ReferenceLine y={-4} stroke="var(--positive)" strokeDasharray="3 3" strokeOpacity={0.3} label={{ value: "−4", position: "insideRight", fill: "#34D399", fontSize: 9 }} />
                <ReferenceLine y={-7} stroke="var(--positive)" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: "−7 (+2 score)", position: "insideRight", fill: "#10B981", fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ background: "#0A1628", border: "1px solid rgba(148,163,184,0.15)", borderRadius: 8, fontSize: 12 }}
                  formatter={(val: unknown) => { const n = Number(val ?? 0); return [`${n >= 0 ? "+" : ""}${n}`, "Ind 9 Raw"] as [string, string]; }}
                />
                <Line
                  dataKey="raw"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={(props) => {
                    const item = ind9History[props.index];
                    return (
                      <circle
                        key={props.index}
                        cx={props.cx}
                        cy={props.cy}
                        r={item?.isCurrent ? 5 : 2.5}
                        fill={item?.isCurrent ? "#3B82F6" : "#334155"}
                        stroke={item?.isCurrent ? "#3B82F6" : "transparent"}
                      />
                    );
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Section 5: Patterns Referencing Ind 9 ───────────────────── */}
      <div className="glass-card p-5">
        <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#64748B" }}>
          Patterns Involving Ind 9
        </div>
        <div className="space-y-3">
          {ind9Patterns.map((p) => (
            <button
              key={p.id}
              className="w-full text-left p-4 rounded-xl hover:bg-white/5 transition-colors"
              style={{ background: "rgba(14,20,30,0.4)", border: "1px solid rgba(148,163,184,0.08)" }}
              onClick={() => router.push("/nifty/patterns")}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold" style={{ color: "#3B82F6" }}>{p.id}</span>
                  <span className="text-sm font-medium" style={{ color: "#E2E8F0" }}>{p.name}</span>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    background: p.tier === "CONFIRMED" ? "rgba(16,185,129,0.12)" : p.tier === "OBSERVED" ? "rgba(59,130,246,0.12)" : "rgba(168,85,247,0.12)",
                    color: p.tier === "CONFIRMED" ? "#10B981" : p.tier === "OBSERVED" ? "#60A5FA" : "#A855F7",
                  }}
                >
                  {p.tier}
                </span>
              </div>
              <p className="text-xs" style={{ color: "#64748B" }}>{p.rule.slice(0, 120)}...</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
