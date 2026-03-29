"use client";

import { useState } from "react";
import {
  fxPairs,
  type FxPairKey,
  type FxPairData,
  type FxIndicatorRow,
  type FxCategoryCard,
  type ResultTag,
} from "@/data/fx-scorecard";
import {
  getScoreColor,
  getBiasPillClass,
  getBias,
} from "@/data/assets";
import { ScoreHistoryChart } from "@/components/ScoreHistoryChart";
import { ScoreGauge } from "@/components/ScoreGauge";

const pairOptions: { key: FxPairKey; label: string }[] = [
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

function ResultBadge({ result }: { result: ResultTag }) {
  const styles: Record<ResultTag, { bg: string; color: string; border: string }> = {
    BEAT: { bg: "rgba(16,185,129,0.15)", color: "#10B981", border: "rgba(16,185,129,0.3)" },
    MISS: { bg: "rgba(239,68,68,0.10)", color: "#EF4444", border: "rgba(239,68,68,0.25)" },
    MET: { bg: "rgba(100,116,139,0.12)", color: "#64748B", border: "rgba(100,116,139,0.2)" },
    "N/A": { bg: "transparent", color: "#334155", border: "rgba(255,255,255,0.04)" },
  };
  const s = styles[result];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {result}
    </span>
  );
}

/* ─── Tooltip row ─── */

function IndicatorTooltip({
  ind,
  currAName,
  currBName,
}: {
  ind: FxIndicatorRow;
  currAName: string;
  currBName: string;
}) {
  return (
    <div
      className="absolute z-50 left-0 right-0 top-full mt-1 p-3 rounded-lg text-xs shadow-xl"
      style={{
        background: "rgba(10, 22, 40, 0.97)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(16px)",
      }}
    >
      <p className="font-semibold mb-2" style={{ color: "#F1F5F9" }}>
        {ind.name}
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <span className="w-8 font-semibold" style={{ color: "#94A3B8" }}>{currAName}</span>
          <span style={{ color: "#64748B" }}>Actual: {ind.currA.actual}</span>
          {ind.currA.forecast && <span style={{ color: "#64748B" }}>Forecast: {ind.currA.forecast}</span>}
          {ind.currA.surprise && <span style={{ color: "#64748B" }}>Surprise: {ind.currA.surprise}</span>}
          <span style={{ color: "#94A3B8" }}>→</span>
          <ResultBadge result={ind.currA.result} />
        </div>
        <div className="flex items-center gap-3">
          <span className="w-8 font-semibold" style={{ color: "#94A3B8" }}>{currBName}</span>
          <span style={{ color: "#64748B" }}>Actual: {ind.currB.actual}</span>
          {ind.currB.forecast && <span style={{ color: "#64748B" }}>Forecast: {ind.currB.forecast}</span>}
          {ind.currB.surprise && <span style={{ color: "#64748B" }}>Surprise: {ind.currB.surprise}</span>}
          <span style={{ color: "#94A3B8" }}>→</span>
          <ResultBadge result={ind.currB.result} />
        </div>
      </div>
      <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ color: "#64748B" }}>
          {ind.currA.result} vs {ind.currB.result} → Pair Score:{" "}
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
  cat: FxCategoryCard;
  currAName: string;
  currAFlag: string;
  currBName: string;
  currBFlag: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const scoredRows = cat.indicators.filter((r) => r.pairScore !== null);
  const aBullish = scoredRows.filter((r) => r.pairScore! > 0).length;
  const aBearish = scoredRows.filter((r) => r.pairScore! < 0).length;
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
          {cat.indicators.map((ind, idx) => (
            <tr
              key={ind.name}
              className="relative transition-colors cursor-default"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <td className="py-2.5 px-3 relative">
                <div className="text-[13px] font-medium" style={{ color: "#F1F5F9" }}>
                  {ind.name}
                </div>
                {ind.frequency && (
                  <div className="text-[9px] mt-0.5" style={{ color: "#334155" }}>{ind.frequency}</div>
                )}
                {hoveredIdx === idx && (
                  <IndicatorTooltip ind={ind} currAName={currAName} currBName={currBName} />
                )}
              </td>
              <td className="py-2.5 px-3 text-center">
                <div className="flex flex-col items-center gap-1">
                  <ResultBadge result={ind.currA.result} />
                  {ind.currA.result !== "N/A" && (
                    <span className="text-[10px] tabular-nums" style={{ color: "#64748B" }}>
                      {ind.currA.actual}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-2.5 px-3 text-center">
                <div className="flex flex-col items-center gap-1">
                  <ResultBadge result={ind.currB.result} />
                  {ind.currB.result !== "N/A" && (
                    <span className="text-[10px] tabular-nums" style={{ color: "#64748B" }}>
                      {ind.currB.actual}
                    </span>
                  )}
                </div>
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

function CotCard({ pair }: { pair: FxPairData }) {
  const cotBias = getBias(pair.cotScore);
  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(130, 140, 248, 0.2)" }}
      >
        <span className="label" style={{ color: "#818CF8" }}>COT REPORT</span>
        <div className="flex items-center gap-2">
          <ScorePill score={pair.cotScore} />
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold ${getBiasPillClass(cotBias)}`}
          >
            {cotBias}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
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
                {pair.cotA.longPct}
              </td>
              <td className="py-2 px-3 text-center tabular-nums font-semibold" style={{ color: "#10B981" }}>
                {pair.cotB.longPct}
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <td className="py-2 pr-3 text-[12px]" style={{ color: "#94A3B8" }}>Short %</td>
              <td className="py-2 px-3 text-center tabular-nums font-semibold" style={{ color: "#EF4444" }}>
                {pair.cotA.shortPct}
              </td>
              <td className="py-2 px-3 text-center tabular-nums font-semibold" style={{ color: "#EF4444" }}>
                {pair.cotB.shortPct}
              </td>
            </tr>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <td className="py-2 pr-3 text-[12px]" style={{ color: "#94A3B8" }}>Change %</td>
              <td className="py-2 px-3 text-center tabular-nums font-semibold" style={{
                color: pair.cotA.changePct.startsWith("+") ? "#10B981" : pair.cotA.changePct.startsWith("-") ? "#EF4444" : "#64748B"
              }}>
                {pair.cotA.changePct} {pair.cotA.changePct.startsWith("+") ? "↑" : "↓"}
              </td>
              <td className="py-2 px-3 text-center tabular-nums font-semibold" style={{
                color: pair.cotB.changePct.startsWith("+") ? "#10B981" : pair.cotB.changePct.startsWith("-") ? "#EF4444" : "#64748B"
              }}>
                {pair.cotB.changePct} {pair.cotB.changePct.startsWith("+") ? "↑" : "↓"}
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-3 text-[12px]" style={{ color: "#94A3B8" }}>Direction</td>
              <td className="py-2 px-3 text-center">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold"
                  style={{
                    background: pair.cotA.direction === "Bullish" ? "rgba(16,185,129,0.15)" : pair.cotA.direction === "Bearish" ? "rgba(239,68,68,0.15)" : "rgba(100,116,139,0.15)",
                    color: pair.cotA.direction === "Bullish" ? "#10B981" : pair.cotA.direction === "Bearish" ? "#EF4444" : "#64748B",
                    border: `1px solid ${pair.cotA.direction === "Bullish" ? "rgba(16,185,129,0.3)" : pair.cotA.direction === "Bearish" ? "rgba(239,68,68,0.3)" : "rgba(100,116,139,0.2)"}`,
                  }}
                >
                  {pair.cotA.direction}
                </span>
              </td>
              <td className="py-2 px-3 text-center">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold"
                  style={{
                    background: pair.cotB.direction === "Bullish" ? "rgba(16,185,129,0.15)" : pair.cotB.direction === "Bearish" ? "rgba(239,68,68,0.15)" : "rgba(100,116,139,0.15)",
                    color: pair.cotB.direction === "Bullish" ? "#10B981" : pair.cotB.direction === "Bearish" ? "#EF4444" : "#64748B",
                    border: `1px solid ${pair.cotB.direction === "Bullish" ? "rgba(16,185,129,0.3)" : pair.cotB.direction === "Bearish" ? "rgba(239,68,68,0.3)" : "rgba(100,116,139,0.2)"}`,
                  }}
                >
                  {pair.cotB.direction}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 flex items-center justify-between text-[10px]"
        style={{ borderTop: "1px solid rgba(255,255,255,0.04)", color: "#64748B" }}
      >
        <span>Pair Rule: Change % A vs B head-to-head only</span>
        <span className="font-semibold tabular-nums" style={{
          color: pair.cotScore > 0 ? "#10B981" : pair.cotScore < 0 ? "#EF4444" : "#64748B"
        }}>
          Pair COT Score: {pair.cotScore > 0 ? `+${pair.cotScore}` : pair.cotScore}
        </span>
      </div>

      {/* Tooltip note */}
      <div
        className="px-4 py-2 text-[9px]"
        style={{ borderTop: "1px solid rgba(255,255,255,0.03)", color: "#334155" }}
      >
        {pair.cotNote}
      </div>
    </div>
  );
}

/* ─── Main page ─── */

export default function FxScorecardPage() {
  const [selectedKey, setSelectedKey] = useState<FxPairKey>("EURUSD");
  const pair = fxPairs.find((p) => p.key === selectedKey)!;

  const scoreColor = getScoreColor(pair.totalScore);

  return (
    <div className="p-6">
      {/* Pair selector */}
      <div className="flex items-center gap-2 mb-6">
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

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">
        {/* LEFT PANEL */}
        <div className="w-[280px] shrink-0 sticky top-[112px] flex flex-col gap-4">
          {/* Score & Bias */}
          <div className="glass-card p-5 text-center">
            <ScoreGauge score={pair.totalScore} />
            <div className="mb-2 -mt-1">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getBiasPillClass(pair.bias)}`}
              >
                {pair.bias}
              </span>
            </div>
            <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>
              {pair.currAFlag} {pair.currAName} / {pair.currBName} {pair.currBFlag}
            </p>
          </div>

          {/* Score breakdown */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs" style={{ color: "#64748B" }}>COT Score</span>
              <ScorePill score={pair.cotScore} />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs" style={{ color: "#64748B" }}>Fundamentals</span>
              <ScorePill score={pair.fundamentals} />
            </div>
            <div className="my-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
            <div className="flex items-center justify-between py-1">
              <span className="text-xs font-semibold" style={{ color: "#94A3B8" }}>Total Score</span>
              <span className="text-lg font-bold tabular-nums" style={{ color: scoreColor }}>
                {pair.totalScore > 0 ? `+${pair.totalScore}` : pair.totalScore}
              </span>
            </div>
          </div>

          {/* COT detail */}
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
                    color: pair.cotA.changePct.startsWith("+") ? "#10B981" : "#EF4444"
                  }}>
                    {pair.cotA.changePct} {pair.cotA.changePct.startsWith("+") ? "↑" : "↓"}
                  </td>
                  <td className="py-1 text-center tabular-nums font-semibold" style={{
                    color: pair.cotB.changePct.startsWith("+") ? "#10B981" : "#EF4444"
                  }}>
                    {pair.cotB.changePct} {pair.cotB.changePct.startsWith("+") ? "↑" : "↓"}
                  </td>
                </tr>
                <tr>
                  <td className="py-1" style={{ color: "#64748B" }}>Direction</td>
                  <td className="py-1 text-center font-semibold" style={{
                    color: pair.cotA.direction === "Bullish" ? "#10B981" : pair.cotA.direction === "Bearish" ? "#EF4444" : "#64748B"
                  }}>
                    {pair.cotA.direction}
                  </td>
                  <td className="py-1 text-center font-semibold" style={{
                    color: pair.cotB.direction === "Bullish" ? "#10B981" : pair.cotB.direction === "Bearish" ? "#EF4444" : "#64748B"
                  }}>
                    {pair.cotB.direction}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="my-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
            <div className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: "#64748B" }}>Pair COT Score</span>
              <span className="text-xs font-bold tabular-nums" style={{
                color: pair.cotScore > 0 ? "#10B981" : pair.cotScore < 0 ? "#EF4444" : "#64748B"
              }}>
                {pair.cotScore > 0 ? `+${pair.cotScore}` : pair.cotScore}
              </span>
            </div>
            <p className="text-[9px] mt-2" style={{ color: "#334155" }}>{pair.cotNote}</p>
          </div>

          {/* Score History */}
          <div className="glass-card p-4">
            <p className="label mb-3" style={{ color: "#64748B" }}>SCORE HISTORY (12 WEEKS)</p>
            <ScoreHistoryChart data={pair.scoreHistory} />
          </div>

          {/* Last updated */}
          <p className="text-[10px] text-center" style={{ color: "#334155" }}>
            Last updated: March 29, 2026 — 14:32 IST
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
            className="glass-card p-6"
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
    </div>
  );
}
