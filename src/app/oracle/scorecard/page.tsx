"use client";

import { useState, useMemo } from "react";
import {
  getScoreColor,
  getBiasPillClass,
  getBias,
  type BiasType,
} from "@/data/assets";
import { useAssetScorecard } from "@/hooks/useAssetScorecard";
import { useAssets } from "@/hooks/useAssets";
import {
  type ScorecardAssetKey,
  type PublicScorecardSection,
  type PublicScorecardIndicator,
} from "@/lib/api/oracle";
import { ScoreHistoryChart } from "@/components/ScoreHistoryChart";
import { ScoreGauge } from "@/components/ScoreGauge";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";

const assetOptions: { key: ScorecardAssetKey; flag: string; label: string }[] = [
  { key: "USD", flag: "🇺🇸", label: "USD" },
  { key: "EUR", flag: "🇪🇺", label: "EUR" },
  { key: "GBP", flag: "🇬🇧", label: "GBP" },
  { key: "JPY", flag: "🇯🇵", label: "JPY" },
  { key: "Gold", flag: "🥇", label: "Gold" },
  { key: "SPY", flag: "📈", label: "SPY" },
  { key: "NAS100", flag: "💻", label: "NAS100" },
];

function ScorePill({ score }: { score: number }) {
  const color =
    score > 0 ? "#10B981" : score < 0 ? "#EF4444" : "#64748B";
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

function SmallPill({
  label,
  variant,
}: {
  label: string;
  variant: "bullish" | "bearish" | "neutral";
}) {
  const styles = {
    bullish: {
      bg: "rgba(16, 185, 129, 0.15)",
      color: "#10B981",
      border: "rgba(16, 185, 129, 0.3)",
    },
    bearish: {
      bg: "rgba(239, 68, 68, 0.15)",
      color: "#EF4444",
      border: "rgba(239, 68, 68, 0.3)",
    },
    neutral: {
      bg: "rgba(100, 116, 139, 0.15)",
      color: "#64748B",
      border: "rgba(100, 116, 139, 0.2)",
    },
  }[variant];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{
        background: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
      }}
    >
      {label}
    </span>
  );
}

function IndicatorRow({ ind }: { ind: PublicScorecardIndicator }) {
  const isInsufficient = ind.outcome === "insufficient_data";

  const scoreColor =
    ind.score !== null
      ? ind.score > 0
        ? "#10B981"
        : ind.score < 0
          ? "#EF4444"
          : "#64748B"
      : "#334155";
  const scoreBg =
    ind.score !== null
      ? ind.score > 0
        ? "rgba(16, 185, 129, 0.15)"
        : ind.score < 0
          ? "rgba(239, 68, 68, 0.1)"
          : "transparent"
      : "transparent";

  let surpriseColor = "#64748B";
  let surpriseBg = "transparent";
  if (
    ind.surprise !== null &&
    ind.surprise !== "0.0%" &&
    ind.surprise !== "0.0"
  ) {
    const isPos =
      ind.surprise.startsWith("+") && ind.surprise !== "+0.0%";
    const isNeg = ind.surprise.startsWith("-");
    if (isPos) {
      surpriseColor = "#10B981";
      surpriseBg = "rgba(16, 185, 129, 0.1)";
    } else if (isNeg) {
      surpriseColor = "#EF4444";
      surpriseBg = "rgba(239, 68, 68, 0.08)";
    }
  }

  let actualColor = "#F1F5F9";
  if (
    ind.surprise !== null &&
    ind.surprise !== "0.0%" &&
    ind.surprise !== "0.0"
  ) {
    if (ind.surprise.startsWith("+") && ind.surprise !== "+0.0%")
      actualColor = "#10B981";
    else if (ind.surprise.startsWith("-")) actualColor = "#EF4444";
  }

  return (
    <tr
      className="transition-colors"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(59, 130, 246, 0.03)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <td
        className="py-2.5 px-3 text-[13px] font-medium"
        style={{ color: "#F1F5F9" }}
      >
        <div className="flex items-center gap-2">
          {ind.name}
          {ind.staleDate && (
            <span
              className="text-[9px] font-medium px-1.5 py-0.5 rounded"
              style={{
                background: "rgba(245, 158, 11, 0.15)",
                color: "#F59E0B",
                border: "1px solid rgba(245, 158, 11, 0.25)",
              }}
            >
              {ind.staleDate}
            </span>
          )}
        </div>
      </td>
      <td
        className="py-2.5 px-3 text-[13px] font-semibold tabular-nums text-right"
        style={{ color: actualColor }}
      >
        {ind.actual ?? "—"}
      </td>
      <td
        className="py-2.5 px-3 text-[13px] tabular-nums text-right"
        style={{ color: "#64748B" }}
      >
        {ind.forecast ?? "—"}
      </td>
      <td
        className="py-2.5 px-3 text-[13px] tabular-nums text-right"
        style={{ color: "#64748B" }}
      >
        {ind.previous ?? "—"}
      </td>
      <td
        className="py-2.5 px-3 text-[13px] font-semibold tabular-nums text-right"
        style={{ color: surpriseColor, background: surpriseBg }}
      >
        {ind.surprise ?? "—"}
      </td>
      <td className="py-2.5 px-3 text-center">
        {isInsufficient ? (
          <span
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{
              background: "rgba(245, 158, 11, 0.15)",
              color: "#F59E0B",
              border: "1px solid rgba(245, 158, 11, 0.25)",
            }}
          >
            No data
          </span>
        ) : (
          <span
            className="inline-flex items-center justify-center w-8 py-0.5 rounded text-[11px] font-semibold tabular-nums"
            style={{ background: scoreBg, color: scoreColor }}
          >
            {ind.score === null
              ? "—"
              : ind.score > 0
                ? "+1"
                : ind.score < 0
                  ? "-1"
                  : "0"}
          </span>
        )}
      </td>
    </tr>
  );
}

function SectionCard({ section }: { section: PublicScorecardSection }) {
  return (
    <div className="glass-card overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${section.color}33` }}
      >
        <span className="label" style={{ color: section.color }}>
          {section.label}
        </span>
        <div className="flex items-center gap-2">
          <ScorePill score={section.subtotal} />
        </div>
      </div>

      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <th
              className="label text-left px-3 py-2"
              style={{ color: "#64748B" }}
            >
              INDICATOR
            </th>
            <th
              className="label text-right px-3 py-2"
              style={{ color: "#64748B" }}
            >
              ACTUAL
            </th>
            <th
              className="label text-right px-3 py-2"
              style={{ color: "#64748B" }}
            >
              FORECAST
            </th>
            <th
              className="label text-right px-3 py-2"
              style={{ color: "#64748B" }}
            >
              PREVIOUS
            </th>
            <th
              className="label text-right px-3 py-2"
              style={{ color: "#64748B" }}
            >
              SURPRISE
            </th>
            <th
              className="label text-center px-3 py-2"
              style={{ color: "#64748B" }}
            >
              SCORE
            </th>
          </tr>
        </thead>
        <tbody>
          {section.indicators.map((ind) => (
            <IndicatorRow key={ind.name} ind={ind} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ScorecardPage() {
  const [selectedKey, setSelectedKey] =
    useState<ScorecardAssetKey>("USD");

  const { data: allAssets } = useAssets();
  const scorecardQuery = useAssetScorecard(selectedKey);

  // Derive which selector tabs are deferred from the Top Setups list.
  // SPY and NAS100 appear by name in that response; other scorecard assets
  // (USD, EUR, GBP, JPY, Gold) do not, so they default to non-deferred.
  const deferredKeys = useMemo<Set<ScorecardAssetKey>>(() => {
    const set = new Set<ScorecardAssetKey>();
    for (const a of allAssets ?? []) {
      if (
        a.outcome === "deferred" &&
        (a.asset === "SPY" || a.asset === "NAS100")
      ) {
        set.add(a.asset as ScorecardAssetKey);
      }
    }
    return set;
  }, [allAssets]);

  const asset = scorecardQuery.data;

  return (
    <div className="p-6">
      {/* Asset selector */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {assetOptions.map((opt) => {
          const active = selectedKey === opt.key;
          const isDeferred = deferredKeys.has(opt.key);
          return (
            <button
              key={opt.key}
              onClick={() => setSelectedKey(opt.key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active
                  ? "rgba(59, 130, 246, 0.15)"
                  : "rgba(255,255,255,0.03)",
                color: active ? "#F1F5F9" : isDeferred ? "#475569" : "#64748B",
                border: active
                  ? "1px solid rgba(59, 130, 246, 0.3)"
                  : "1px solid rgba(255,255,255,0.06)",
                boxShadow: active
                  ? "0 0 16px rgba(59, 130, 246, 0.1)"
                  : "none",
                opacity: isDeferred && !active ? 0.6 : 1,
              }}
            >
              <span>{opt.flag}</span>
              {opt.label}
              {isDeferred && (
                <span
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                  style={{
                    background: "rgba(100, 116, 139, 0.2)",
                    color: "#64748B",
                    border: "1px solid rgba(100, 116, 139, 0.3)",
                  }}
                >
                  Deferred
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      {scorecardQuery.isLoading ? (
        <LoadingState message="Loading scorecard..." />
      ) : scorecardQuery.error ? (
        <ErrorState
          error={scorecardQuery.error}
          onRetry={() => scorecardQuery.refetch()}
        />
      ) : !asset ? (
        <EmptyState title="No scorecard available" />
      ) : asset.outcome === "deferred" ? (
        /* ── Deferred state ─────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div
            className="glass-card p-10 max-w-lg w-full text-center flex flex-col items-center gap-4"
            style={{ borderColor: "rgba(100, 116, 139, 0.25)" }}
          >
            <span className="text-4xl">{asset.flag}</span>
            <div>
              <p
                className="text-base font-semibold mb-1"
                style={{ color: "#94A3B8" }}
              >
                {asset.name}
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
            {asset.reason && (
              <p
                className="text-sm leading-relaxed max-w-sm"
                style={{ color: "#64748B" }}
              >
                {asset.reason}
              </p>
            )}
          </div>
        </div>
      ) : asset.outcome === "insufficient_data" ? (
        /* ── Insufficient data state ─────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div
            className="glass-card p-10 max-w-lg w-full text-center flex flex-col items-center gap-4"
            style={{
              borderColor: "rgba(245, 158, 11, 0.25)",
              background: "rgba(245, 158, 11, 0.03)",
            }}
          >
            <span className="text-4xl">{asset.flag}</span>
            <div>
              <p
                className="text-base font-semibold mb-1"
                style={{ color: "#94A3B8" }}
              >
                {asset.name}
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
            {asset.reason && (
              <p
                className="text-sm leading-relaxed max-w-sm"
                style={{ color: "#64748B" }}
              >
                {asset.reason}
              </p>
            )}
          </div>
        </div>
      ) : (
        /* ── Scored — full layout ────────────────────────────────────── */
        <div className="flex gap-6 items-start">
          {/* LEFT PANEL */}
          <div className="w-70 shrink-0 flex flex-col gap-4">
            {/* Score & Bias */}
            <div className="glass-card p-5 text-center">
              {asset.totalScore !== null && <ScoreGauge score={asset.totalScore} />}
              <div className="mb-2 -mt-1">
                {asset.bias && (
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getBiasPillClass(asset.bias as BiasType)}`}
                  >
                    {asset.bias}
                  </span>
                )}
              </div>
              <p
                className="text-sm font-medium"
                style={{ color: "#94A3B8" }}
              >
                {asset.flag} {asset.name}
              </p>
            </div>

            {/* Score breakdown */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs" style={{ color: "#64748B" }}>
                  COT Score
                </span>
                {asset.cotScore !== null ? (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums"
                    style={{
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "#60A5FA",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                    }}
                  >
                    {asset.cotScore > 0
                      ? `+${asset.cotScore}`
                      : asset.cotScore}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "#334155" }}>
                    —
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs" style={{ color: "#64748B" }}>
                  Fundamentals
                </span>
                {asset.fundamentals !== null ? (
                  <ScorePill score={asset.fundamentals} />
                ) : (
                  <span className="text-xs" style={{ color: "#334155" }}>
                    —
                  </span>
                )}
              </div>
              <div
                className="my-2"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              />
              <div className="flex items-center justify-between py-1">
                <span
                  className="text-xs font-semibold"
                  style={{ color: "#94A3B8" }}
                >
                  Total Score
                </span>
                {asset.totalScore !== null ? (
                  <span
                    className="text-lg font-bold tabular-nums"
                    style={{ color: getScoreColor(asset.totalScore) }}
                  >
                    {asset.totalScore > 0
                      ? `+${asset.totalScore}`
                      : asset.totalScore}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "#334155" }}>
                    —
                  </span>
                )}
              </div>
            </div>

            {/* COT detail */}
            {asset.cot && (
              <div className="glass-card p-4">
                <p className="label mb-3" style={{ color: "#64748B" }}>
                  INSTITUTIONAL ACTIVITY
                </p>
                <div className="flex flex-col gap-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "#64748B" }}>
                      Net Positioning
                    </span>
                    <SmallPill
                      label={asset.cot.netPositioning}
                      variant={
                        asset.cot.netPositioning === "Bullish"
                          ? "bullish"
                          : asset.cot.netPositioning === "Bearish"
                            ? "bearish"
                            : "neutral"
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "#64748B" }}>
                      Weekly Change
                    </span>
                    <SmallPill
                      label={asset.cot.weeklyChange}
                      variant={
                        asset.cot.weeklyChange === "Bullish"
                          ? "bullish"
                          : asset.cot.weeklyChange === "Bearish"
                            ? "bearish"
                            : "neutral"
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "#64748B" }}>
                      COT Score
                    </span>
                    <span
                      className="text-xs font-semibold tabular-nums"
                      style={{
                        color:
                          asset.cot.cotScore > 0
                            ? "#10B981"
                            : asset.cot.cotScore < 0
                              ? "#EF4444"
                              : "#64748B",
                      }}
                    >
                      {asset.cot.cotScore > 0
                        ? `+${asset.cot.cotScore}`
                        : asset.cot.cotScore}
                    </span>
                  </div>
                </div>
                <div
                  className="my-2"
                  style={{
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}
                />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="text-center">
                    <p
                      className="text-[10px] mb-0.5"
                      style={{ color: "#64748B" }}
                    >
                      Long %
                    </p>
                    <p
                      className="text-xs font-semibold tabular-nums"
                      style={{ color: "#10B981" }}
                    >
                      {asset.cot.longPct}
                    </p>
                  </div>
                  <div className="text-center">
                    <p
                      className="text-[10px] mb-0.5"
                      style={{ color: "#64748B" }}
                    >
                      Short %
                    </p>
                    <p
                      className="text-xs font-semibold tabular-nums"
                      style={{ color: "#EF4444" }}
                    >
                      {asset.cot.shortPct}
                    </p>
                  </div>
                  <div className="text-center">
                    <p
                      className="text-[10px] mb-0.5"
                      style={{ color: "#64748B" }}
                    >
                      Δ Weekly
                    </p>
                    <p
                      className="text-xs font-semibold tabular-nums"
                      style={{
                        color: asset.cot.deltaWeekly.startsWith("+")
                          ? "#10B981"
                          : asset.cot.deltaWeekly.startsWith("-")
                            ? "#EF4444"
                            : "#64748B",
                      }}
                    >
                      {asset.cot.deltaWeekly}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Score History Chart */}
            {asset.scoreHistory && asset.scoreHistory.length > 0 && (
              <div className="glass-card p-4">
                <p className="label mb-3" style={{ color: "#64748B" }}>
                  SCORE HISTORY (12 WEEKS)
                </p>
                <ScoreHistoryChart data={asset.scoreHistory} />
              </div>
            )}

            {/* Last updated */}
            <p
              className="text-[10px] text-center"
              style={{ color: "#334155" }}
            >
              Last updated: March 29, 2026 — 14:32 IST
            </p>
          </div>

          {/* RIGHT PANEL */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {asset.sections.map((section) => (
              <SectionCard key={section.label} section={section} />
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
                <span className="label" style={{ color: "#60A5FA" }}>
                  LUCID OUTLOOK
                </span>
              </div>
              <p
                className="text-sm leading-relaxed mb-4"
                style={{ color: "#64748B" }}
              >
                AI-powered qualitative macro analysis for this asset — Fed
                commentary, geopolitical developments, rate trajectory signals,
                and global risk factors interpreted through your trading lens.
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
