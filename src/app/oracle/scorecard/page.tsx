"use client";

import { useState, useMemo } from "react";
import {
  getBiasPillClass,
  type BiasType,
} from "@/data/assets";
import { useAssetScorecard } from "@/hooks/useAssetScorecard";
import { useAssets } from "@/hooks/useAssets";
import { formatUpdated } from "@/lib/format-date";
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
import { useOracleTools } from "@/components/oracle-tools/OracleToolsProvider";

const assetOptions: { key: ScorecardAssetKey; flag: string; label: string }[] = [
  { key: "USD", flag: "🇺🇸", label: "USD" },
  { key: "EUR", flag: "🇪🇺", label: "EUR" },
  { key: "GBP", flag: "🇬🇧", label: "GBP" },
  { key: "JPY", flag: "🇯🇵", label: "JPY" },
  { key: "Gold", flag: "🥇", label: "Gold" },
  { key: "SPY", flag: "📈", label: "SPY" },
  { key: "NAS100", flag: "💻", label: "NAS100" },
];

/** Score → theme token (positive green / negative red / neutral gold). */
function scoreToken(score: number): string {
  if (score > 0) return "var(--lucid-pos)";
  if (score < 0) return "var(--lucid-neg)";
  return "var(--lucid-accent)";
}

function ScorePill({ score }: { score: number }) {
  const color =
    score > 0
      ? "var(--lucid-pos)"
      : score < 0
        ? "var(--lucid-neg)"
        : "var(--lucid-ink-2)";
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
      className="lt-num inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
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
      bg: "var(--lucid-pos-bg)",
      color: "var(--lucid-pos)",
      border: "var(--lucid-pos-bd)",
    },
    bearish: {
      bg: "var(--lucid-neg-bg)",
      color: "var(--lucid-neg)",
      border: "var(--lucid-neg-bd)",
    },
    neutral: {
      bg: "var(--lucid-surface-3)",
      color: "var(--lucid-ink-2)",
      border: "var(--lucid-line)",
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
        ? "var(--lucid-pos)"
        : ind.score < 0
          ? "var(--lucid-neg)"
          : "var(--lucid-ink-2)"
      : "var(--lucid-ink-3)";
  const scoreBg =
    ind.score !== null
      ? ind.score > 0
        ? "var(--lucid-pos-bg)"
        : ind.score < 0
          ? "var(--lucid-neg-bg)"
          : "transparent"
      : "transparent";

  let surpriseColor = "var(--lucid-ink-3)";
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
      surpriseColor = "var(--lucid-pos)";
      surpriseBg = "var(--lucid-pos-bg)";
    } else if (isNeg) {
      surpriseColor = "var(--lucid-neg)";
      surpriseBg = "var(--lucid-neg-bg)";
    }
  }

  let actualColor = "var(--lucid-ink)";
  if (
    ind.surprise !== null &&
    ind.surprise !== "0.0%" &&
    ind.surprise !== "0.0"
  ) {
    if (ind.surprise.startsWith("+") && ind.surprise !== "+0.0%")
      actualColor = "var(--lucid-pos)";
    else if (ind.surprise.startsWith("-")) actualColor = "var(--lucid-neg)";
  }

  return (
    <tr
      className="transition-colors"
      style={{ borderBottom: "1px solid var(--lucid-line)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--lucid-surface-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <td
        className="py-2.5 px-3 text-[13px] font-medium"
        style={{ color: "var(--lucid-ink)" }}
      >
        <div className="flex items-center gap-2">
          {ind.name}
          {ind.staleDate && (
            <span
              className="text-[9px] font-medium px-1.5 py-0.5 rounded"
              style={{
                background: "var(--lucid-warn-bg)",
                color: "var(--lucid-warn)",
                border: "1px solid var(--lucid-warn-bd)",
              }}
            >
              {ind.staleDate}
            </span>
          )}
        </div>
      </td>
      <td
        className="lt-num py-2.5 px-3 text-[13px] font-semibold text-right"
        style={{ color: actualColor }}
      >
        {ind.actual ?? "—"}
      </td>
      <td
        className="lt-num py-2.5 px-3 text-[13px] text-right"
        style={{ color: "var(--lucid-ink-3)" }}
      >
        {ind.forecast ?? "—"}
      </td>
      <td
        className="lt-num py-2.5 px-3 text-[13px] text-right"
        style={{ color: "var(--lucid-ink-3)" }}
      >
        {ind.previous ?? "—"}
      </td>
      <td
        className="lt-num py-2.5 px-3 text-[13px] font-semibold text-right"
        style={{ color: surpriseColor, background: surpriseBg }}
      >
        {ind.surprise ?? "—"}
      </td>
      <td className="py-2.5 px-3 text-center">
        {isInsufficient ? (
          <span
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{
              background: "var(--lucid-warn-bg)",
              color: "var(--lucid-warn)",
              border: "1px solid var(--lucid-warn-bd)",
            }}
          >
            No data
          </span>
        ) : (
          <span
            className="lt-num inline-flex items-center justify-center w-8 py-0.5 rounded text-[11px] font-semibold"
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

function SectionCard({ section, delay = 0 }: { section: PublicScorecardSection; delay?: number }) {
  return (
    <div
      className="lt-card lt-edge lt-rise overflow-hidden"
      style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)", animationDelay: `${delay}s` }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--lucid-line)" }}
      >
        <span className="lt-eyebrow lt-serif" style={{ color: "var(--lucid-ink-2)" }}>
          {section.label}
        </span>
        <div className="flex items-center gap-2">
          <ScorePill score={section.subtotal} />
        </div>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
            <th className="lt-eyebrow text-left px-3 py-2">INDICATOR</th>
            <th className="lt-eyebrow text-right px-3 py-2">
              <span className="ml-auto">ACTUAL</span>
            </th>
            <th className="lt-eyebrow text-right px-3 py-2">
              <span className="ml-auto">FORECAST</span>
            </th>
            <th className="lt-eyebrow text-right px-3 py-2">
              <span className="ml-auto">PREVIOUS</span>
            </th>
            <th className="lt-eyebrow text-right px-3 py-2">
              <span className="ml-auto">SURPRISE</span>
            </th>
            <th className="lt-eyebrow px-3 py-2">
              <span className="mx-auto">SCORE</span>
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
    </div>
  );
}

export default function ScorecardPage() {
  const [selectedKey, setSelectedKey] =
    useState<ScorecardAssetKey>("USD");

  const { data: allAssets } = useAssets();
  const scorecardQuery = useAssetScorecard(selectedKey);
  const { openScoreTrend } = useOracleTools();

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
    <div className="p-4 sm:p-6" style={{ color: "var(--lucid-ink)" }}>
      {/* Asset selector */}
      <div className="lt-rise lt-stagger-1 flex items-center gap-2 mb-6 flex-wrap">
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
                  ? "var(--lucid-accent-bg)"
                  : "var(--lucid-surface-3)",
                color: active
                  ? "var(--lucid-accent)"
                  : isDeferred
                    ? "var(--lucid-ink-3)"
                    : "var(--lucid-ink-2)",
                border: active
                  ? "1px solid var(--lucid-accent-bd)"
                  : "1px solid var(--lucid-line)",
                boxShadow: active ? "0 0 18px rgba(205, 167, 79, 0.16)" : "none",
                opacity: isDeferred && !active ? 0.6 : 1,
              }}
            >
              <span>{opt.flag}</span>
              {opt.label}
              {isDeferred && (
                <span
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                  style={{
                    background: "var(--lucid-surface-3)",
                    color: "var(--lucid-ink-3)",
                    border: "1px solid var(--lucid-line-2)",
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
        <LoadingState stages={["Loading scorecard…", "Scoring indicators…", "Drawing gauge…"]} />
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
            className="lt-card p-10 max-w-lg w-full text-center flex flex-col items-center gap-4"
            style={{ borderColor: "var(--lucid-line-2)" }}
          >
            <span className="text-4xl">{asset.flag}</span>
            <div>
              <p
                className="lt-serif text-base font-semibold mb-1"
                style={{ color: "var(--lucid-ink-2)" }}
              >
                {asset.name}
              </p>
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: "var(--lucid-surface-3)",
                  color: "var(--lucid-ink-3)",
                  border: "1px solid var(--lucid-line-2)",
                }}
              >
                Scoring deferred
              </span>
            </div>
            {asset.reason && (
              <p
                className="text-sm leading-relaxed max-w-sm"
                style={{ color: "var(--lucid-ink-3)" }}
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
            className="lt-card p-10 max-w-lg w-full text-center flex flex-col items-center gap-4"
            style={{
              borderColor: "var(--lucid-warn-bd)",
              background: "var(--lucid-warn-bg)",
            }}
          >
            <span className="text-4xl">{asset.flag}</span>
            <div>
              <p
                className="lt-serif text-base font-semibold mb-1"
                style={{ color: "var(--lucid-ink-2)" }}
              >
                {asset.name}
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
            {asset.reason && (
              <p
                className="text-sm leading-relaxed max-w-sm"
                style={{ color: "var(--lucid-ink-3)" }}
              >
                {asset.reason}
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
              onClick={() => openScoreTrend(asset.key)}
              className="lt-card lt-edge p-5 text-center w-full transition-opacity hover:opacity-90 cursor-pointer"
              title="Open Score Trend"
              style={{
                background: `radial-gradient(120% 90% at 50% 0%, ${
                  asset.totalScore !== null && asset.totalScore >= 3
                    ? "rgba(72, 186, 124, 0.10)"
                    : asset.totalScore !== null && asset.totalScore <= -3
                      ? "rgba(226, 88, 77, 0.10)"
                      : "rgba(205, 167, 79, 0.10)"
                }, transparent 65%), var(--lucid-grad-surface)`,
                boxShadow: "var(--lucid-elev-1)",
              }}
            >
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
                className="lt-serif text-sm font-medium"
                style={{ color: "var(--lucid-ink-2)" }}
              >
                {asset.flag} {asset.name}
              </p>
            </button>

            {/* Score History Chart — inline score sparkline */}
            {asset.scoreHistory && asset.scoreHistory.length > 0 && (
              <div className="lt-card p-4">
                <p className="lt-eyebrow mb-3">SCORE HISTORY (12 WEEKS)</p>
                <ScoreHistoryChart data={asset.scoreHistory} />
              </div>
            )}

            {/* Score breakdown */}
            <div className="lt-card p-4">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                  COT Score
                </span>
                {asset.cotScore !== null ? (
                  <span
                    className="lt-num inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{
                      background: "var(--lucid-accent-bg)",
                      color: "var(--lucid-accent)",
                      border: "1px solid var(--lucid-accent-bd)",
                    }}
                  >
                    {asset.cotScore > 0
                      ? `+${asset.cotScore}`
                      : asset.cotScore}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                    —
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                  Fundamentals
                </span>
                {asset.fundamentals !== null ? (
                  <ScorePill score={asset.fundamentals} />
                ) : (
                  <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                    —
                  </span>
                )}
              </div>
              <div
                className="my-2"
                style={{ borderTop: "1px solid var(--lucid-line)" }}
              />
              <div className="flex items-center justify-between py-1">
                <span
                  className="text-xs font-semibold"
                  style={{ color: "var(--lucid-ink-2)" }}
                >
                  Total Score
                </span>
                {asset.totalScore !== null ? (
                  <span
                    className="lt-num text-lg font-bold"
                    style={{ color: scoreToken(asset.totalScore) }}
                  >
                    {asset.totalScore > 0
                      ? `+${asset.totalScore}`
                      : asset.totalScore}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                    —
                  </span>
                )}
              </div>
            </div>

            {/* COT detail */}
            {asset.cot && (
              <div className="lt-card p-4">
                <p className="lt-eyebrow mb-3">INSTITUTIONAL ACTIVITY</p>
                <div className="flex flex-col gap-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
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
                    <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
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
                    <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                      COT Score
                    </span>
                    <span
                      className="lt-num text-xs font-semibold"
                      style={{
                        color:
                          asset.cot.cotScore > 0
                            ? "var(--lucid-pos)"
                            : asset.cot.cotScore < 0
                              ? "var(--lucid-neg)"
                              : "var(--lucid-ink-2)",
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
                    borderTop: "1px solid var(--lucid-line)",
                  }}
                />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="text-center">
                    <p
                      className="text-[10px] mb-0.5"
                      style={{ color: "var(--lucid-ink-3)" }}
                    >
                      Long %
                    </p>
                    <p
                      className="lt-num text-xs font-semibold"
                      style={{ color: "var(--lucid-pos)" }}
                    >
                      {asset.cot.longPct}
                    </p>
                  </div>
                  <div className="text-center">
                    <p
                      className="text-[10px] mb-0.5"
                      style={{ color: "var(--lucid-ink-3)" }}
                    >
                      Short %
                    </p>
                    <p
                      className="lt-num text-xs font-semibold"
                      style={{ color: "var(--lucid-neg)" }}
                    >
                      {asset.cot.shortPct}
                    </p>
                  </div>
                  <div className="text-center">
                    <p
                      className="text-[10px] mb-0.5"
                      style={{ color: "var(--lucid-ink-3)" }}
                    >
                      Δ Weekly
                    </p>
                    <p
                      className="lt-num text-xs font-semibold"
                      style={{
                        color: asset.cot.deltaWeekly.startsWith("+")
                          ? "var(--lucid-pos)"
                          : asset.cot.deltaWeekly.startsWith("-")
                            ? "var(--lucid-neg)"
                            : "var(--lucid-ink-2)",
                      }}
                    >
                      {asset.cot.deltaWeekly}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Last updated */}
            <p
              className="text-[10px] text-center"
              style={{ color: "var(--lucid-ink-3)" }}
            >
              Last updated: {formatUpdated(asset.lastUpdated)}
            </p>
          </div>

          {/* RIGHT PANEL */}
          <div className="lt-rise lt-stagger-3 flex-1 flex flex-col gap-4 min-w-0">
            {asset.sections.map((section, idx) => (
              <SectionCard key={section.label} section={section} delay={Math.min(idx * 0.08, 0.4)} />
            ))}

            {/* Per-indicator drilldown flag */}
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
                <span className="lt-eyebrow lt-serif" style={{ color: "var(--lucid-accent)" }}>
                  LUCID OUTLOOK
                </span>
              </div>
              <p
                className="text-sm leading-relaxed mb-4"
                style={{ color: "var(--lucid-ink-3)" }}
              >
                AI-powered qualitative macro analysis for this asset — Fed
                commentary, geopolitical developments, rate trajectory signals,
                and global risk factors interpreted through your trading lens.
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
