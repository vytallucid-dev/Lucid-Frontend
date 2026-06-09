"use client";

import { useState } from "react";
import {
  getScoreColor,
  getBiasPillClass,
  getBias,
  type BiasType,
} from "@/data/assets";
import { useFxPair } from "@/hooks/useFxPair";
import { formatUpdated } from "@/lib/format-date";
import {
  type PublicFxPairData,
  type PublicFxIndicatorRow,
  type PublicFxCategory,
  type FxResult,
} from "@/lib/api/oracle";
import { ScoreHistoryChart } from "@/components/ScoreHistoryChart";
import { ScoreGauge } from "@/components/ScoreGauge";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import { Info } from "lucide-react";

const PAIR_KEYS = ["EURUSD", "GBPUSD", "USDJPY", "EURJPY", "GBPJPY"] as const;
type PairKey = (typeof PAIR_KEYS)[number];

const pairOptions: { key: PairKey; label: string }[] = [
  { key: "EURUSD", label: "EUR/USD" },
  { key: "GBPUSD", label: "GBP/USD" },
  { key: "USDJPY", label: "USD/JPY" },
  { key: "EURJPY", label: "EUR/JPY" },
  { key: "GBPJPY", label: "GBP/JPY" },
];

/* ─── Shared pills ─── */

function ScorePill({ score }: { score: number }) {
  const color = score > 0 ? "#10B981" : score < 0 ? "#EF4444" : "#64748B";
  const bg =
    score > 0
      ? "rgba(16, 185, 129, 0.15)"
      : score < 0
        ? "rgba(239, 68, 68, 0.15)"
        : "rgba(100, 116, 139, 0.15)";
  const border =
    score > 0
      ? "rgba(16, 185, 129, 0.3)"
      : score < 0
        ? "rgba(239, 68, 68, 0.3)"
        : "rgba(100, 116, 139, 0.2)";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums"
      style={{ background: bg, color, border: `1px solid ${border}` }}
    >
      {score > 0 ? `+${score}` : score}
    </span>
  );
}

function ResultBadge({ result }: { result: FxResult }) {
  const styles: Record<FxResult, { bg: string; color: string; border: string; label: string }> = {
    BEAT: { bg: "rgba(16,185,129,0.15)", color: "#10B981", border: "rgba(16,185,129,0.3)", label: "BEAT" },
    MISS: { bg: "rgba(239,68,68,0.10)", color: "#EF4444", border: "rgba(239,68,68,0.25)", label: "MISS" },
    MET: { bg: "rgba(100,116,139,0.12)", color: "#64748B", border: "rgba(100,116,139,0.2)", label: "MET" },
    "N/A": { bg: "transparent", color: "#334155", border: "rgba(255,255,255,0.04)", label: "—" },
  };
  const s = styles[result];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

/* ─── Indicator info tooltip (shown on info icon hover) ─── */

function IndicatorInfo({
  ind,
  currAName,
  currBName,
}: {
  ind: PublicFxIndicatorRow;
  currAName: string;
  currBName: string;
}) {
  const aInsufficient = ind.currA.outcome === "insufficient_data";
  const bInsufficient = ind.currB.outcome === "insufficient_data";
  return (
    <span className="relative group inline-flex items-center">
      <Info
        size={13}
        className="opacity-30 group-hover:opacity-100 transition-opacity cursor-help"
        style={{ color: "#64748B" }}
      />
      <div
        className="absolute z-50 left-5 top-1/2 -translate-y-1/2 p-3 rounded-lg text-xs shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: "rgba(10, 22, 40, 0.97)",
          border: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(16px)",
          minWidth: 320,
        }}
      >
        <p className="font-semibold mb-2" style={{ color: "#F1F5F9" }}>
          {ind.name}
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="w-8 font-semibold" style={{ color: "#94A3B8" }}>{currAName}</span>
            {aInsufficient ? (
              <span style={{ color: "#334155" }}>No data</span>
            ) : (
              <>
                <span style={{ color: "#64748B" }}>Actual: {ind.currA.actual ?? "—"}</span>
                {ind.currA.forecast != null && (
                  <span style={{ color: "#64748B" }}>Forecast: {ind.currA.forecast}</span>
                )}
                {ind.currA.surprise != null && (
                  <span style={{ color: "#64748B" }}>Surprise: {ind.currA.surprise}</span>
                )}
                <span style={{ color: "#94A3B8" }}>→</span>
                <ResultBadge result={ind.currA.result} />
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-8 font-semibold" style={{ color: "#94A3B8" }}>{currBName}</span>
            {bInsufficient ? (
              <span style={{ color: "#334155" }}>No data</span>
            ) : (
              <>
                <span style={{ color: "#64748B" }}>Actual: {ind.currB.actual ?? "—"}</span>
                {ind.currB.forecast != null && (
                  <span style={{ color: "#64748B" }}>Forecast: {ind.currB.forecast}</span>
                )}
                {ind.currB.surprise != null && (
                  <span style={{ color: "#64748B" }}>Surprise: {ind.currB.surprise}</span>
                )}
                <span style={{ color: "#94A3B8" }}>→</span>
                <ResultBadge result={ind.currB.result} />
              </>
            )}
          </div>
        </div>
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ color: "#64748B" }}>
            Pair Score:{" "}
          </span>
          {ind.pairScore !== null ? (
            <span
              className="font-semibold tabular-nums"
              style={{ color: ind.pairScore > 0 ? "#10B981" : ind.pairScore < 0 ? "#EF4444" : "#64748B" }}
            >
              {ind.pairScore > 0 ? `+${ind.pairScore}` : ind.pairScore}
            </span>
          ) : (
            <span style={{ color: "#334155" }}>Excluded</span>
          )}
        </div>
      </div>
    </span>
  );
}

/* ─── Side cell (renders one currency's result + actual, or "no data") ─── */

function SideCell({ side }: { side: PublicFxIndicatorRow["currA"] }) {
  if (side.outcome === "insufficient_data") {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px]" style={{ color: "#334155" }}>—</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <ResultBadge result={side.result} />
      {side.result !== "N/A" && (
        <span className="text-[10px] tabular-nums" style={{ color: "#64748B" }}>
          {side.actual ?? "—"}
        </span>
      )}
    </div>
  );
}

/* ─── Category card ─── */

function CategoryCard({
  cat,
  currAName,
  currAFlag,
  currBName,
  currBFlag,
}: {
  cat: PublicFxCategory;
  currAName: string;
  currAFlag: string;
  currBName: string;
  currBFlag: string;
}) {
  const scoredRows = cat.indicators.filter(
    (r): r is PublicFxIndicatorRow & { pairScore: number } => r.pairScore !== null,
  );
  const aBullish = scoredRows.filter((r) => r.pairScore > 0).length;
  const aBearish = scoredRows.filter((r) => r.pairScore < 0).length;
  const bBullish = aBearish;
  const bBearish = aBullish;

  const subtotalBias = getBias(cat.subtotal);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${cat.color}33` }}
      >
        <span className="label" style={{ color: cat.color }}>{cat.label}</span>
        <div className="flex items-center gap-2">
          <ScorePill score={cat.subtotal} />
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold ${getBiasPillClass(subtotalBias)}`}
          >
            {subtotalBias}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <th className="label text-left px-3 py-2" style={{ color: "#64748B" }}>INDICATOR</th>
            <th className="label text-center px-3 py-2" style={{ color: "#64748B" }}>
              {currAFlag} {currAName}
            </th>
            <th className="label text-center px-3 py-2" style={{ color: "#64748B" }}>
              {currBFlag} {currBName}
            </th>
            <th className="label text-center px-3 py-2" style={{ color: "#64748B" }}>SCORE</th>
          </tr>
        </thead>
        <tbody>
          {cat.indicators.map((ind) => (
            <tr
              key={ind.name}
              className="relative transition-colors hover:bg-white/2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
            >
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5">
                  <IndicatorInfo ind={ind} currAName={currAName} currBName={currBName} />
                  <span className="text-[13px] font-medium" style={{ color: "#F1F5F9" }}>
                    {ind.name}
                  </span>
                </div>
              </td>
              <td className="py-2.5 px-3 text-center">
                <SideCell side={ind.currA} />
              </td>
              <td className="py-2.5 px-3 text-center">
                <SideCell side={ind.currB} />
              </td>
              <td className="py-2.5 px-3 text-center">
                {ind.pairScore !== null ? (
                  <ScorePill score={ind.pairScore} />
                ) : (
                  <span className="text-[10px]" style={{ color: "#334155" }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 flex items-center gap-4 text-[10px] flex-wrap"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)", color: "#64748B" }}
      >
        <span>
          Category Score:{" "}
          <span
            className="font-semibold"
            style={{ color: cat.subtotal > 0 ? "#10B981" : cat.subtotal < 0 ? "#EF4444" : "#64748B" }}
          >
            {subtotalBias}
          </span>
        </span>
        <span>|</span>
        <span>
          {currAName}: {aBullish} Bullish, {aBearish} Bearish
        </span>
        <span>|</span>
        <span>
          {currBName}: {bBullish} Bullish, {bBearish} Bearish
        </span>
      </div>
    </div>
  );
}

/* ─── COT Card ─── */

function CotCard({ pair }: { pair: PublicFxPairData }) {
  const cotScore = pair.cotScore;
  const cotBias = cotScore !== null ? getBias(cotScore) : null;
  const cotA = pair.cotA;
  const cotB = pair.cotB;

  const renderChange = (val: string | undefined) => {
    if (val == null) return <span style={{ color: "#334155" }}>—</span>;
    const isPos = val.startsWith("+");
    const isNeg = val.startsWith("-");
    const color = isPos ? "#10B981" : isNeg ? "#EF4444" : "#64748B";
    return (
      <span style={{ color }}>
        {val} {isPos ? "↑" : isNeg ? "↓" : ""}
      </span>
    );
  };

  const renderDirection = (dir: string | undefined) => {
    if (dir == null) return <span style={{ color: "#334155" }}>—</span>;
    const isBull = dir === "Bullish";
    const isBear = dir === "Bearish";
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold"
        style={{
          background: isBull ? "rgba(16,185,129,0.15)" : isBear ? "rgba(239,68,68,0.15)" : "rgba(100,116,139,0.15)",
          color: isBull ? "#10B981" : isBear ? "#EF4444" : "#64748B",
          border: `1px solid ${isBull ? "rgba(16,185,129,0.3)" : isBear ? "rgba(239,68,68,0.3)" : "rgba(100,116,139,0.2)"}`,
        }}
      >
        {dir}
      </span>
    );
  };

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(130, 140, 248, 0.2)" }}
      >
        <span className="label" style={{ color: "#818CF8" }}>COT REPORT</span>
        <div className="flex items-center gap-2">
          {cotScore !== null ? <ScorePill score={cotScore} /> : (
            <span className="text-[11px]" style={{ color: "#334155" }}>—</span>
          )}
          {cotBias && (
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold ${getBiasPillClass(cotBias)}`}
            >
              {cotBias}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <th className="label text-left py-2 pr-3" style={{ color: "#64748B" }} />
              <th className="label text-center py-2 px-3" style={{ color: "#64748B" }}>
                {pair.currAFlag} {pair.currAName}
              </th>
              <th className="label text-center py-2 px-3" style={{ color: "#64748B" }}>
                {pair.currBFlag} {pair.currBName}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <td className="py-2 pr-3 text-[12px]" style={{ color: "#94A3B8" }}>Long %</td>
              <td className="py-2 px-3 text-center tabular-nums font-semibold" style={{ color: "#10B981" }}>
                {cotA?.longPct ?? "—"}
              </td>
              <td className="py-2 px-3 text-center tabular-nums font-semibold" style={{ color: "#10B981" }}>
                {cotB?.longPct ?? "—"}
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <td className="py-2 pr-3 text-[12px]" style={{ color: "#94A3B8" }}>Short %</td>
              <td className="py-2 px-3 text-center tabular-nums font-semibold" style={{ color: "#EF4444" }}>
                {cotA?.shortPct ?? "—"}
              </td>
              <td className="py-2 px-3 text-center tabular-nums font-semibold" style={{ color: "#EF4444" }}>
                {cotB?.shortPct ?? "—"}
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <td className="py-2 pr-3 text-[12px]" style={{ color: "#94A3B8" }}>Change %</td>
              <td className="py-2 px-3 text-center tabular-nums font-semibold">
                {renderChange(cotA?.changePct)}
              </td>
              <td className="py-2 px-3 text-center tabular-nums font-semibold">
                {renderChange(cotB?.changePct)}
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-3 text-[12px]" style={{ color: "#94A3B8" }}>Direction</td>
              <td className="py-2 px-3 text-center">
                {renderDirection(cotA?.direction)}
              </td>
              <td className="py-2 px-3 text-center">
                {renderDirection(cotB?.direction)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-1 text-[10px]"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)", color: "#64748B" }}
      >
        <span>Pair Rule: Change % A vs B head-to-head only</span>
        <span
          className="font-semibold tabular-nums"
          style={{
            color:
              cotScore === null
                ? "#334155"
                : cotScore > 0
                  ? "#10B981"
                  : cotScore < 0
                    ? "#EF4444"
                    : "#64748B",
          }}
        >
          Pair COT Score:{" "}
          {cotScore === null ? "—" : cotScore > 0 ? `+${cotScore}` : cotScore}
        </span>
      </div>

      {/* Tooltip note */}
      {pair.cotNote && (
        <div
          className="px-4 py-2 text-[9px]"
          style={{ borderTop: "1px solid rgba(255,255,255,0.03)", color: "#334155" }}
        >
          {pair.cotNote}
        </div>
      )}
    </div>
  );
}

/* ─── Main page ─── */

export default function FxScorecardPage() {
  const [selectedKey, setSelectedKey] = useState<PairKey>("EURUSD");
  const { data: pair, isLoading, error, refetch } = useFxPair(selectedKey);

  return (
    <div className="p-4 sm:p-6">
      {/* Pair selector */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {pairOptions.map((opt) => {
          const active = selectedKey === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setSelectedKey(opt.key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? "rgba(59, 130, 246, 0.15)" : "rgba(255,255,255,0.03)",
                color: active ? "#F1F5F9" : "#64748B",
                border: active ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(255,255,255,0.06)",
                boxShadow: active ? "0 0 16px rgba(59, 130, 246, 0.1)" : "none",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      {isLoading ? (
        <LoadingState message="Loading FX scorecard..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !pair ? (
        <EmptyState title="No FX scorecard available" />
      ) : pair.outcome === "deferred" ? (
        /* ── Deferred state ─────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div
            className="glass-card p-10 max-w-lg w-full text-center flex flex-col items-center gap-4"
            style={{ borderColor: "rgba(100, 116, 139, 0.25)" }}
          >
            <span className="text-4xl">
              {pair.currAFlag} {pair.currBFlag}
            </span>
            <div>
              <p className="text-base font-semibold mb-1" style={{ color: "#94A3B8" }}>
                {pair.label}
              </p>
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: "rgba(100, 116, 139, 0.15)",
                  color: "#64748B",
                  border: "1px solid rgba(100, 116, 139, 0.3)",
                }}
              >
                Scoring deferred
              </span>
            </div>
            {pair.reason && (
              <p className="text-sm leading-relaxed max-w-sm" style={{ color: "#64748B" }}>
                {pair.reason}
              </p>
            )}
          </div>
        </div>
      ) : pair.outcome === "insufficient_data" ? (
        /* ── Insufficient data state ─────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div
            className="glass-card p-10 max-w-lg w-full text-center flex flex-col items-center gap-4"
            style={{
              borderColor: "rgba(245, 158, 11, 0.25)",
              background: "rgba(245, 158, 11, 0.03)",
            }}
          >
            <span className="text-4xl">
              {pair.currAFlag} {pair.currBFlag}
            </span>
            <div>
              <p className="text-base font-semibold mb-1" style={{ color: "#94A3B8" }}>
                {pair.label}
              </p>
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: "rgba(245, 158, 11, 0.15)",
                  color: "#F59E0B",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                }}
              >
                Data unavailable
              </span>
            </div>
            {pair.reason && (
              <p className="text-sm leading-relaxed max-w-sm" style={{ color: "#64748B" }}>
                {pair.reason}
              </p>
            )}
          </div>
        </div>
      ) : (
        /* ── Scored — full layout ────────────────────────────────────── */
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* LEFT PANEL */}
          <div className="w-full lg:w-70 lg:shrink-0 flex flex-col gap-4">
            {/* Score & Bias */}
            <div className="glass-card p-5 text-center">
              {pair.totalScore !== null && <ScoreGauge score={pair.totalScore} />}
              <div className="mb-2 -mt-1">
                {pair.bias && (
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getBiasPillClass(pair.bias as BiasType)}`}
                  >
                    {pair.bias}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>
                {pair.currAFlag} {pair.currAName} / {pair.currBName} {pair.currBFlag}
              </p>
            </div>

            {/* Score breakdown */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs" style={{ color: "#64748B" }}>COT Score</span>
                {pair.cotScore !== null ? (
                  <ScorePill score={pair.cotScore} />
                ) : (
                  <span className="text-xs" style={{ color: "#334155" }}>—</span>
                )}
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs" style={{ color: "#64748B" }}>Fundamentals</span>
                {pair.fundamentals !== null ? (
                  <ScorePill score={pair.fundamentals} />
                ) : (
                  <span className="text-xs" style={{ color: "#334155" }}>—</span>
                )}
              </div>
              <div className="my-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-semibold" style={{ color: "#94A3B8" }}>Total Score</span>
                {pair.totalScore !== null ? (
                  <span
                    className="text-lg font-bold tabular-nums"
                    style={{ color: getScoreColor(pair.totalScore) }}
                  >
                    {pair.totalScore > 0 ? `+${pair.totalScore}` : pair.totalScore}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "#334155" }}>—</span>
                )}
              </div>
            </div>

            {/* COT detail (left-panel mini) */}
            <div className="glass-card p-4">
              <p className="label mb-3" style={{ color: "#64748B" }}>
                INSTITUTIONAL ACTIVITY (COT)
              </p>
              <table className="w-full text-[11px]">
                <thead>
                  <tr>
                    <th />
                    <th className="text-center pb-1 font-semibold" style={{ color: "#94A3B8" }}>
                      {pair.currAName}
                    </th>
                    <th className="text-center pb-1 font-semibold" style={{ color: "#94A3B8" }}>
                      {pair.currBName}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1" style={{ color: "#64748B" }}>Change %</td>
                    <td className="py-1 text-center tabular-nums font-semibold" style={{
                      color: pair.cotA?.changePct.startsWith("+") ? "#10B981" : pair.cotA?.changePct.startsWith("-") ? "#EF4444" : "#64748B",
                    }}>
                      {pair.cotA
                        ? `${pair.cotA.changePct} ${pair.cotA.changePct.startsWith("+") ? "↑" : pair.cotA.changePct.startsWith("-") ? "↓" : ""}`
                        : "—"}
                    </td>
                    <td className="py-1 text-center tabular-nums font-semibold" style={{
                      color: pair.cotB?.changePct.startsWith("+") ? "#10B981" : pair.cotB?.changePct.startsWith("-") ? "#EF4444" : "#64748B",
                    }}>
                      {pair.cotB
                        ? `${pair.cotB.changePct} ${pair.cotB.changePct.startsWith("+") ? "↑" : pair.cotB.changePct.startsWith("-") ? "↓" : ""}`
                        : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1" style={{ color: "#64748B" }}>Direction</td>
                    <td className="py-1 text-center font-semibold" style={{
                      color: pair.cotA?.direction === "Bullish" ? "#10B981" : pair.cotA?.direction === "Bearish" ? "#EF4444" : "#64748B",
                    }}>
                      {pair.cotA?.direction ?? "—"}
                    </td>
                    <td className="py-1 text-center font-semibold" style={{
                      color: pair.cotB?.direction === "Bullish" ? "#10B981" : pair.cotB?.direction === "Bearish" ? "#EF4444" : "#64748B",
                    }}>
                      {pair.cotB?.direction ?? "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="my-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: "#64748B" }}>Pair COT Score</span>
                <span className="text-xs font-bold tabular-nums" style={{
                  color:
                    pair.cotScore === null
                      ? "#334155"
                      : pair.cotScore > 0
                        ? "#10B981"
                        : pair.cotScore < 0
                          ? "#EF4444"
                          : "#64748B",
                }}>
                  {pair.cotScore === null ? "—" : pair.cotScore > 0 ? `+${pair.cotScore}` : pair.cotScore}
                </span>
              </div>
              {pair.cotNote && (
                <p className="text-[9px] mt-2" style={{ color: "#334155" }}>{pair.cotNote}</p>
              )}
            </div>

            {/* Score History */}
            {pair.scoreHistory !== null && pair.scoreHistory.length > 0 && (
              <div className="glass-card p-4">
                <p className="label mb-3" style={{ color: "#64748B" }}>SCORE HISTORY (12 WEEKS)</p>
                <ScoreHistoryChart data={pair.scoreHistory} />
              </div>
            )}

            {/* Last updated */}
            <p className="text-[10px] text-center" style={{ color: "#334155" }}>
              Last updated: {formatUpdated(pair.lastUpdated)}
            </p>
          </div>

          {/* RIGHT PANEL */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* COT card first */}
            <CotCard pair={pair} />

            {/* Category cards */}
            {pair.categories.map((cat) => (
              <CategoryCard
                key={cat.label}
                cat={cat}
                currAName={pair.currAName}
                currAFlag={pair.currAFlag}
                currBName={pair.currBName}
                currBFlag={pair.currBFlag}
              />
            ))}

            {/* Lucid Outlook placeholder */}
            <div
              className="glass-card p-4 sm:p-6"
              style={{
                borderColor: "rgba(59, 130, 246, 0.3)",
                boxShadow: "0 0 24px rgba(59, 130, 246, 0.1)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🤖</span>
                <span className="label" style={{ color: "#60A5FA" }}>LUCID OUTLOOK</span>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "#64748B" }}>
                AI-powered qualitative macro analysis for this asset — Fed commentary,
                geopolitical developments, rate trajectory signals, and global risk
                factors interpreted through your trading lens.
              </p>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: "rgba(59, 130, 246, 0.12)",
                  color: "#60A5FA",
                  border: "1px solid rgba(59, 130, 246, 0.25)",
                  boxShadow: "0 0 16px rgba(59, 130, 246, 0.1)",
                }}
              >
                ⚡ Coming in Phase 4
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
