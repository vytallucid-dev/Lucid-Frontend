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
import { useOracleTools } from "@/components/oracle-tools/OracleToolsProvider";

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
  const color = score > 0 ? "var(--lucid-pos)" : score < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)";
  const bg =
    score > 0
      ? "var(--lucid-pos-bg)"
      : score < 0
        ? "var(--lucid-neg-bg)"
        : "var(--lucid-surface-3)";
  const border =
    score > 0
      ? "var(--lucid-pos-bd)"
      : score < 0
        ? "var(--lucid-neg-bd)"
        : "var(--lucid-line)";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold lt-num"
      style={{ background: bg, color, border: `1px solid ${border}` }}
    >
      {score > 0 ? `+${score}` : score}
    </span>
  );
}

function ResultBadge({ result }: { result: FxResult }) {
  const styles: Record<FxResult, { bg: string; color: string; border: string; label: string }> = {
    BEAT: { bg: "var(--lucid-pos-bg)", color: "var(--lucid-pos)", border: "var(--lucid-pos-bd)", label: "BEAT" },
    MISS: { bg: "var(--lucid-neg-bg)", color: "var(--lucid-neg)", border: "var(--lucid-neg-bd)", label: "MISS" },
    MET: { bg: "var(--lucid-surface-3)", color: "var(--lucid-ink-3)", border: "var(--lucid-line)", label: "MET" },
    "N/A": { bg: "transparent", color: "var(--lucid-ink-3)", border: "var(--lucid-line)", label: "—" },
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
        style={{ color: "var(--lucid-ink-3)" }}
      />
      <div
        className="absolute z-50 left-5 top-1/2 -translate-y-1/2 p-3 rounded-lg text-xs shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: "var(--lucid-surface-2)",
          border: "1px solid var(--lucid-line-2)",
          minWidth: 320,
        }}
      >
        <p className="font-semibold mb-2" style={{ color: "var(--lucid-ink)" }}>
          {ind.name}
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <span className="w-8 font-semibold" style={{ color: "var(--lucid-ink-2)" }}>{currAName}</span>
            {aInsufficient ? (
              <span style={{ color: "var(--lucid-ink-3)" }}>No data</span>
            ) : (
              <>
                <span className="lt-num" style={{ color: "var(--lucid-ink-3)" }}>Actual: {ind.currA.actual ?? "—"}</span>
                {ind.currA.forecast != null && (
                  <span className="lt-num" style={{ color: "var(--lucid-ink-3)" }}>Forecast: {ind.currA.forecast}</span>
                )}
                {ind.currA.surprise != null && (
                  <span className="lt-num" style={{ color: "var(--lucid-ink-3)" }}>Surprise: {ind.currA.surprise}</span>
                )}
                <span style={{ color: "var(--lucid-ink-2)" }}>→</span>
                <ResultBadge result={ind.currA.result} />
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-8 font-semibold" style={{ color: "var(--lucid-ink-2)" }}>{currBName}</span>
            {bInsufficient ? (
              <span style={{ color: "var(--lucid-ink-3)" }}>No data</span>
            ) : (
              <>
                <span className="lt-num" style={{ color: "var(--lucid-ink-3)" }}>Actual: {ind.currB.actual ?? "—"}</span>
                {ind.currB.forecast != null && (
                  <span className="lt-num" style={{ color: "var(--lucid-ink-3)" }}>Forecast: {ind.currB.forecast}</span>
                )}
                {ind.currB.surprise != null && (
                  <span className="lt-num" style={{ color: "var(--lucid-ink-3)" }}>Surprise: {ind.currB.surprise}</span>
                )}
                <span style={{ color: "var(--lucid-ink-2)" }}>→</span>
                <ResultBadge result={ind.currB.result} />
              </>
            )}
          </div>
        </div>
        <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--lucid-line)" }}>
          <span style={{ color: "var(--lucid-ink-3)" }}>
            Pair Score:{" "}
          </span>
          {ind.pairScore !== null ? (
            <span
              className="font-semibold lt-num"
              style={{ color: ind.pairScore > 0 ? "var(--lucid-pos)" : ind.pairScore < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)" }}
            >
              {ind.pairScore > 0 ? `+${ind.pairScore}` : ind.pairScore}
            </span>
          ) : (
            <span style={{ color: "var(--lucid-ink-3)" }}>Excluded</span>
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
        <span className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>—</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <ResultBadge result={side.result} />
      {side.result !== "N/A" && (
        <span className="text-[10px] lt-num" style={{ color: "var(--lucid-ink-3)" }}>
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
  delay = 0,
}: {
  cat: PublicFxCategory;
  currAName: string;
  currAFlag: string;
  currBName: string;
  currBFlag: string;
  delay?: number;
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
    <div
      className="lt-card lt-edge lt-rise overflow-hidden"
      style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)", animationDelay: `${delay}s` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${cat.color}33` }}
      >
        <span className="lt-eyebrow lt-serif" style={{ color: cat.color }}>{cat.label}</span>
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
          <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
            <th className="lt-eyebrow text-left px-3 py-2" style={{ color: "var(--lucid-ink-3)" }}>INDICATOR</th>
            <th className="lt-eyebrow text-center px-3 py-2" style={{ color: "var(--lucid-ink-3)" }}>
              {currAFlag} {currAName}
            </th>
            <th className="lt-eyebrow text-center px-3 py-2" style={{ color: "var(--lucid-ink-3)" }}>
              {currBFlag} {currBName}
            </th>
            <th className="lt-eyebrow text-center px-3 py-2" style={{ color: "var(--lucid-ink-3)" }}>SCORE</th>
          </tr>
        </thead>
        <tbody>
          {cat.indicators.map((ind) => (
            <tr
              key={ind.name}
              className="relative transition-colors hover:bg-white/2"
              style={{ borderBottom: "1px solid var(--lucid-line)" }}
            >
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5">
                  <IndicatorInfo ind={ind} currAName={currAName} currBName={currBName} />
                  <span className="text-[13px] font-medium" style={{ color: "var(--lucid-ink)" }}>
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
                  <span className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>—</span>
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
        style={{ borderTop: "1px solid var(--lucid-line)", color: "var(--lucid-ink-3)" }}
      >
        <span>
          Category Score:{" "}
          <span
            className="font-semibold"
            style={{ color: cat.subtotal > 0 ? "var(--lucid-pos)" : cat.subtotal < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)" }}
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
    if (val == null) return <span style={{ color: "var(--lucid-ink-3)" }}>—</span>;
    const isPos = val.startsWith("+");
    const isNeg = val.startsWith("-");
    const color = isPos ? "var(--lucid-pos)" : isNeg ? "var(--lucid-neg)" : "var(--lucid-ink-3)";
    return (
      <span className="lt-num" style={{ color }}>
        {val} {isPos ? "↑" : isNeg ? "↓" : ""}
      </span>
    );
  };

  const renderDirection = (dir: string | undefined) => {
    if (dir == null) return <span style={{ color: "var(--lucid-ink-3)" }}>—</span>;
    const isBull = dir === "Bullish";
    const isBear = dir === "Bearish";
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold"
        style={{
          background: isBull ? "var(--lucid-pos-bg)" : isBear ? "var(--lucid-neg-bg)" : "var(--lucid-surface-3)",
          color: isBull ? "var(--lucid-pos)" : isBear ? "var(--lucid-neg)" : "var(--lucid-ink-3)",
          border: `1px solid ${isBull ? "var(--lucid-pos-bd)" : isBear ? "var(--lucid-neg-bd)" : "var(--lucid-line)"}`,
        }}
      >
        {dir}
      </span>
    );
  };

  return (
    <div
      className="lt-card lt-edge lt-rise overflow-hidden"
      style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--lucid-line)" }}
      >
        <span className="lt-eyebrow lt-serif" style={{ color: "var(--lucid-ink-2)" }}>COT REPORT</span>
        <div className="flex items-center gap-2">
          {cotScore !== null ? <ScorePill score={cotScore} /> : (
            <span className="text-[11px]" style={{ color: "var(--lucid-ink-3)" }}>—</span>
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
            <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
              <th className="lt-eyebrow text-left py-2 pr-3" style={{ color: "var(--lucid-ink-3)" }} />
              <th className="lt-eyebrow text-center py-2 px-3" style={{ color: "var(--lucid-ink-3)" }}>
                {pair.currAFlag} {pair.currAName}
              </th>
              <th className="lt-eyebrow text-center py-2 px-3" style={{ color: "var(--lucid-ink-3)" }}>
                {pair.currBFlag} {pair.currBName}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
              <td className="py-2 pr-3 text-[12px]" style={{ color: "var(--lucid-ink-2)" }}>Long %</td>
              <td className="py-2 px-3 text-center lt-num font-semibold" style={{ color: "var(--lucid-pos)" }}>
                {cotA?.longPct ?? "—"}
              </td>
              <td className="py-2 px-3 text-center lt-num font-semibold" style={{ color: "var(--lucid-pos)" }}>
                {cotB?.longPct ?? "—"}
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
              <td className="py-2 pr-3 text-[12px]" style={{ color: "var(--lucid-ink-2)" }}>Short %</td>
              <td className="py-2 px-3 text-center lt-num font-semibold" style={{ color: "var(--lucid-neg)" }}>
                {cotA?.shortPct ?? "—"}
              </td>
              <td className="py-2 px-3 text-center lt-num font-semibold" style={{ color: "var(--lucid-neg)" }}>
                {cotB?.shortPct ?? "—"}
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
              <td className="py-2 pr-3 text-[12px]" style={{ color: "var(--lucid-ink-2)" }}>Change %</td>
              <td className="py-2 px-3 text-center lt-num font-semibold">
                {renderChange(cotA?.changePct)}
              </td>
              <td className="py-2 px-3 text-center lt-num font-semibold">
                {renderChange(cotB?.changePct)}
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-3 text-[12px]" style={{ color: "var(--lucid-ink-2)" }}>Direction</td>
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
        style={{ borderTop: "1px solid var(--lucid-line)", color: "var(--lucid-ink-3)" }}
      >
        <span>Pair Rule: Change % A vs B head-to-head only</span>
        <span
          className="font-semibold lt-num"
          style={{
            color:
              cotScore === null
                ? "var(--lucid-ink-3)"
                : cotScore > 0
                  ? "var(--lucid-pos)"
                  : cotScore < 0
                    ? "var(--lucid-neg)"
                    : "var(--lucid-ink-3)",
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
          style={{ borderTop: "1px solid var(--lucid-line)", color: "var(--lucid-ink-3)" }}
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
  const { openScoreTrend } = useOracleTools();

  return (
    <div className="p-4 sm:p-6">
      {/* Pair selector */}
      <div className="lt-rise lt-stagger-1 flex items-center gap-2 mb-6 flex-wrap">
        {pairOptions.map((opt) => {
          const active = selectedKey === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => setSelectedKey(opt.key)}
              className="lt-serif flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? "var(--lucid-accent-bg)" : "var(--lucid-surface-3)",
                color: active ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                border: active ? "1px solid var(--lucid-accent-bd)" : "1px solid var(--lucid-line)",
                boxShadow: active ? "0 0 18px rgba(205, 167, 79, 0.16)" : "none",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      {isLoading ? (
        <LoadingState stages={["Loading FX scorecard…", "Comparing economies…", "Drawing gauge…"]} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !pair ? (
        <EmptyState title="No FX scorecard available" />
      ) : pair.outcome === "deferred" ? (
        /* ── Deferred state ─────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div
            className="lt-card p-10 max-w-lg w-full text-center flex flex-col items-center gap-4"
            style={{ borderColor: "var(--lucid-line-2)" }}
          >
            <span className="text-4xl">
              {pair.currAFlag} {pair.currBFlag}
            </span>
            <div>
              <p className="lt-serif text-base font-semibold mb-1" style={{ color: "var(--lucid-ink-2)" }}>
                {pair.label}
              </p>
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: "var(--lucid-surface-3)",
                  color: "var(--lucid-ink-3)",
                  border: "1px solid var(--lucid-line)",
                }}
              >
                Scoring deferred
              </span>
            </div>
            {pair.reason && (
              <p className="text-sm leading-relaxed max-w-sm" style={{ color: "var(--lucid-ink-3)" }}>
                {pair.reason}
              </p>
            )}
          </div>
        </div>
      ) : pair.outcome === "insufficient_data" ? (
        /* ── Insufficient data state ─────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div
            className="lt-card p-10 max-w-lg w-full text-center flex flex-col items-center gap-4"
            style={{
              borderColor: "var(--lucid-warn-bd)",
              background: "var(--lucid-warn-bg)",
            }}
          >
            <span className="text-4xl">
              {pair.currAFlag} {pair.currBFlag}
            </span>
            <div>
              <p className="lt-serif text-base font-semibold mb-1" style={{ color: "var(--lucid-ink-2)" }}>
                {pair.label}
              </p>
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: "var(--lucid-warn-bg)",
                  color: "var(--lucid-warn)",
                  border: "1px solid var(--lucid-warn-bd)",
                }}
              >
                Data unavailable
              </span>
            </div>
            {pair.reason && (
              <p className="text-sm leading-relaxed max-w-sm" style={{ color: "var(--lucid-ink-3)" }}>
                {pair.reason}
              </p>
            )}
          </div>
        </div>
      ) : (
        /* ── Scored — full layout ────────────────────────────────────── */
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* LEFT PANEL */}
          <div className="lt-rise lt-stagger-2 w-full lg:w-70 lg:shrink-0 flex flex-col gap-4">
            {/* Score & Bias */}
            <button
              onClick={() => openScoreTrend(pair.key)}
              className="lt-card p-5 text-center w-full transition-opacity hover:opacity-90 cursor-pointer"
              title="Open Score Trend"
              style={{
                background: `radial-gradient(120% 90% at 50% 0%, ${
                  pair.totalScore !== null && pair.totalScore >= 3
                    ? "rgba(72, 186, 124, 0.10)"
                    : pair.totalScore !== null && pair.totalScore <= -3
                      ? "rgba(226, 88, 77, 0.10)"
                      : "rgba(205, 167, 79, 0.10)"
                }, transparent 65%), var(--lucid-grad-surface)`,
                boxShadow: "var(--lucid-elev-1)",
              }}
            >
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
              <p className="lt-serif text-sm font-medium" style={{ color: "var(--lucid-ink-2)" }}>
                {pair.currAFlag} {pair.currAName} / {pair.currBName} {pair.currBFlag}
              </p>
            </button>

            {/* Score breakdown */}
            <div className="lt-card p-4">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>COT Score</span>
                {pair.cotScore !== null ? (
                  <ScorePill score={pair.cotScore} />
                ) : (
                  <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>—</span>
                )}
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>Fundamentals</span>
                {pair.fundamentals !== null ? (
                  <ScorePill score={pair.fundamentals} />
                ) : (
                  <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>—</span>
                )}
              </div>
              <div className="my-2" style={{ borderTop: "1px solid var(--lucid-line)" }} />
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-semibold" style={{ color: "var(--lucid-ink-2)" }}>Total Score</span>
                {pair.totalScore !== null ? (
                  <span
                    className="text-lg font-bold lt-num"
                    style={{ color: getScoreColor(pair.totalScore) }}
                  >
                    {pair.totalScore > 0 ? `+${pair.totalScore}` : pair.totalScore}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>—</span>
                )}
              </div>
            </div>

            {/* COT detail (left-panel mini) */}
            <div className="lt-card p-4">
              <p className="lt-eyebrow mb-3" style={{ color: "var(--lucid-ink-3)" }}>
                INSTITUTIONAL ACTIVITY (COT)
              </p>
              <table className="w-full text-[11px]">
                <thead>
                  <tr>
                    <th />
                    <th className="text-center pb-1 font-semibold" style={{ color: "var(--lucid-ink-2)" }}>
                      {pair.currAName}
                    </th>
                    <th className="text-center pb-1 font-semibold" style={{ color: "var(--lucid-ink-2)" }}>
                      {pair.currBName}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1" style={{ color: "var(--lucid-ink-3)" }}>Change %</td>
                    <td className="py-1 text-center lt-num font-semibold" style={{
                      color: pair.cotA?.changePct.startsWith("+") ? "var(--lucid-pos)" : pair.cotA?.changePct.startsWith("-") ? "var(--lucid-neg)" : "var(--lucid-ink-3)",
                    }}>
                      {pair.cotA
                        ? `${pair.cotA.changePct} ${pair.cotA.changePct.startsWith("+") ? "↑" : pair.cotA.changePct.startsWith("-") ? "↓" : ""}`
                        : "—"}
                    </td>
                    <td className="py-1 text-center lt-num font-semibold" style={{
                      color: pair.cotB?.changePct.startsWith("+") ? "var(--lucid-pos)" : pair.cotB?.changePct.startsWith("-") ? "var(--lucid-neg)" : "var(--lucid-ink-3)",
                    }}>
                      {pair.cotB
                        ? `${pair.cotB.changePct} ${pair.cotB.changePct.startsWith("+") ? "↑" : pair.cotB.changePct.startsWith("-") ? "↓" : ""}`
                        : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1" style={{ color: "var(--lucid-ink-3)" }}>Direction</td>
                    <td className="py-1 text-center font-semibold" style={{
                      color: pair.cotA?.direction === "Bullish" ? "var(--lucid-pos)" : pair.cotA?.direction === "Bearish" ? "var(--lucid-neg)" : "var(--lucid-ink-3)",
                    }}>
                      {pair.cotA?.direction ?? "—"}
                    </td>
                    <td className="py-1 text-center font-semibold" style={{
                      color: pair.cotB?.direction === "Bullish" ? "var(--lucid-pos)" : pair.cotB?.direction === "Bearish" ? "var(--lucid-neg)" : "var(--lucid-ink-3)",
                    }}>
                      {pair.cotB?.direction ?? "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="my-2" style={{ borderTop: "1px solid var(--lucid-line)" }} />
              <div className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>Pair COT Score</span>
                <span className="text-xs font-bold lt-num" style={{
                  color:
                    pair.cotScore === null
                      ? "var(--lucid-ink-3)"
                      : pair.cotScore > 0
                        ? "var(--lucid-pos)"
                        : pair.cotScore < 0
                          ? "var(--lucid-neg)"
                          : "var(--lucid-ink-3)",
                }}>
                  {pair.cotScore === null ? "—" : pair.cotScore > 0 ? `+${pair.cotScore}` : pair.cotScore}
                </span>
              </div>
              {pair.cotNote && (
                <p className="text-[9px] mt-2" style={{ color: "var(--lucid-ink-3)" }}>{pair.cotNote}</p>
              )}
            </div>

            {/* Score History */}
            {pair.scoreHistory !== null && pair.scoreHistory.length > 0 && (
              <div className="lt-card p-4">
                <p className="lt-eyebrow mb-3" style={{ color: "var(--lucid-ink-3)" }}>SCORE HISTORY (12 WEEKS)</p>
                <ScoreHistoryChart data={pair.scoreHistory} />
              </div>
            )}

            {/* Last updated */}
            <p className="text-[10px] text-center" style={{ color: "var(--lucid-ink-3)" }}>
              Last updated: {formatUpdated(pair.lastUpdated)}
            </p>
          </div>

          {/* RIGHT PANEL */}
          <div className="lt-rise lt-stagger-3 flex-1 flex flex-col gap-4 min-w-0">
            {/* COT card first */}
            <CotCard pair={pair} />

            {/* Category cards */}
            {pair.categories.map((cat, idx) => (
              <CategoryCard
                key={cat.label}
                cat={cat}
                currAName={pair.currAName}
                currAFlag={pair.currAFlag}
                currBName={pair.currBName}
                currBFlag={pair.currBFlag}
                delay={Math.min((idx + 1) * 0.08, 0.4)}
              />
            ))}

            {/* Per-indicator drilldown flag note */}
            <p className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
              Per-indicator history drilldown pending a backend indicator-code field.
            </p>

            {/* Lucid Outlook placeholder */}
            <div
              className="lt-card p-4 sm:p-6"
              style={{
                background: "var(--lucid-accent-bg)",
                borderColor: "var(--lucid-accent-bd)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🤖</span>
                <span className="lt-eyebrow lt-serif" style={{ color: "var(--lucid-accent)" }}>LUCID OUTLOOK</span>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--lucid-ink-3)" }}>
                AI-powered qualitative macro analysis for this asset — Fed commentary,
                geopolitical developments, rate trajectory signals, and global risk
                factors interpreted through your trading lens.
              </p>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: "var(--lucid-accent-bg)",
                  color: "var(--lucid-accent)",
                  border: "1px solid var(--lucid-accent-bd)",
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
