"use client";

import { useState, useMemo } from "react";
import { economies } from "@/data/heatmap";
import { useHeatmap } from "@/hooks/useHeatmap";
import type {
  OracleEconomy,
  PublicHeatmapIndicator,
} from "@/lib/api/oracle";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";

const CATEGORIES = ["ECONOMIC GROWTH", "INFLATION", "JOBS MARKET"] as const;

function daysUntil(dateStr: string, today: Date): number | null {
  if (dateStr === "Daily" || dateStr === "—") return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

function nextReleaseDateStyle(dateStr: string, today: Date): React.CSSProperties {
  const days = daysUntil(dateStr, today);
  if (days === null) return { color: "#94A3B8" };
  if (days <= 2) return { color: "#F59E0B", fontWeight: 500 };
  if (days <= 7) return { color: "#3B82F6", fontWeight: 500 };
  return { color: "#94A3B8" };
}

function surpriseStyle(surprise: string | null): React.CSSProperties {
  if (surprise === null || surprise === "—") return { color: "#475569" };
  if (surprise === "Hawkish") return { background: "rgba(16,185,129,0.15)", color: "#10B981" };
  const num = parseFloat(surprise);
  if (isNaN(num)) return { color: "#475569" };
  if (num > 0) return { background: "rgba(16,185,129,0.15)", color: "#10B981" };
  if (num < 0) return { background: "rgba(239,68,68,0.1)", color: "#EF4444" };
  return { color: "#475569" };
}

function actualColor(surprise: string | null): string {
  if (surprise === null || surprise === "—") return "#F1F5F9";
  if (surprise === "Hawkish") return "#10B981";
  const num = parseFloat(surprise);
  if (isNaN(num) || num === 0) return "#F1F5F9";
  return num > 0 ? "#10B981" : "#EF4444";
}

function scorePillClass(score: number): string {
  if (score === 1) return "pill-bullish";
  if (score === -1) return "pill-bearish";
  return "pill-neutral";
}

function progressBarColor(pct: number): string {
  if (pct < 35) return "#EF4444";
  if (pct > 65) return "#10B981";
  return "#3B82F6";
}

function biasLabel(pct: number): string {
  if (pct >= 65) return "Bullish";
  if (pct <= 35) return "Bearish";
  return "Neutral";
}

function formatToday(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function HeatmapPage() {
  const [economy, setEconomy] = useState<OracleEconomy>("US");
  const { data: heatmap, isLoading, error, refetch } = useHeatmap();
  const TODAY = useMemo(() => new Date(), []);

  const indicators: PublicHeatmapIndicator[] = useMemo(
    () => (heatmap ? heatmap[economy] ?? [] : []),
    [heatmap, economy],
  );

  const stats = useMemo(() => {
    const total = indicators.length;
    const scored = indicators.filter((i) => i.outcome !== 'insufficient_data');
    const bullish = scored.filter((i) => i.score === 1).length;
    const bearish = scored.filter((i) => i.score === -1).length;
    const neutral = scored.filter((i) => i.score === 0).length;
    const denom = scored.length - neutral;
    const bullishPct = denom > 0 ? (bullish / denom) * 100 : 50;
    const allInsufficient = scored.length === 0 && total > 0;
    return { total, bullish, bearish, neutral, bullishPct, allInsufficient };
  }, [indicators]);

  const grouped = useMemo(() => {
    const map = new Map<string, PublicHeatmapIndicator[]>();
    for (const cat of CATEGORIES) {
      map.set(
        cat,
        indicators.filter((i) => i.category === cat)
      );
    }
    return map;
  }, [indicators]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingState message="Loading heatmap..." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }
  if (!heatmap) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState title="No heatmap data available" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate" style={{ color: "#F1F5F9" }}>
            Economic Heatmap
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
            Macro release data and surprise indicators by economy
          </p>
        </div>
        <p className="text-xs shrink-0 sm:text-right" style={{ color: "#475569" }}>
          Viewed {formatToday(TODAY)}
        </p>
      </div>

      {/* Economy Selector */}
      <div className="flex gap-2 flex-wrap">
        {economies.map((e) => {
          const active = economy === e.key;
          return (
            <button
              key={e.key}
              onClick={() => setEconomy(e.key)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={
                active
                  ? {
                      background: "#3B82F6",
                      color: "#FFFFFF",
                      boxShadow: "0 0 16px rgba(59,130,246,0.3)",
                    }
                  : {
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      color: "#64748B",
                    }
              }
            >
              {e.flag} {e.label}
            </button>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Indicators Tracked", value: stats.total, color: "#94A3B8" },
          { label: "Bullish", value: stats.bullish, color: "#10B981" },
          { label: "Bearish", value: stats.bearish, color: "#EF4444" },
          { label: "Neutral", value: stats.neutral, color: "#64748B" },
          {
            label: "Bullish %",
            value: stats.allInsufficient ? "—" : `${stats.bullishPct.toFixed(1)}%`,
            color: stats.allInsufficient ? "#F59E0B" : progressBarColor(stats.bullishPct),
          },
        ].map((card) => (
          <div key={card.label} className="glass-card px-4 py-3">
            <p className="label" style={{ color: "#475569" }}>
              {card.label}
            </p>
            <p
              className="text-lg font-semibold mt-1 tabular-nums"
              style={{ color: card.color }}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div className="glass-card overflow-x-auto">
        {indicators.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No indicators for this economy"
              description="The backend returned an empty set for the selected economy."
            />
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  "INDICATOR",
                  "LAST RELEASE",
                  "NEXT RELEASE",
                  "ACTUAL",
                  "FORECAST",
                  "PREVIOUS",
                  "SURPRISE",
                  "SCORE",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-left label whitespace-nowrap"
                    style={{ color: "#64748B" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => {
                const rows = grouped.get(cat);
                if (!rows || rows.length === 0) return null;
                return (
                  <CategoryGroup key={cat} category={cat} rows={rows} today={TODAY} />
                );
              })}
              {(() => {
                const otherRows = indicators.filter(
                  (i) => !CATEGORIES.includes(i.category as typeof CATEGORIES[number])
                );
                if (otherRows.length === 0) return null;
                return <CategoryGroup key="OTHER" category="OTHER" rows={otherRows} today={TODAY} />;
              })()}
            </tbody>
          </table>
        )}
      </div>

      {/* Overall Economy Score */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p
              className="label"
              style={{ color: "#475569" }}
            >
              OVERALL BULLISH BIAS
            </p>
            <div className="flex items-baseline gap-3 mt-1">
              {stats.allInsufficient ? (
                <span className="text-2xl font-bold" style={{ color: "#F59E0B" }}>
                  No data
                </span>
              ) : (
                <>
                  <span
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: progressBarColor(stats.bullishPct) }}
                  >
                    {stats.bullishPct.toFixed(1)}%
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "#94A3B8" }}
                  >
                    {biasLabel(stats.bullishPct)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: stats.allInsufficient ? "0%" : `${stats.bullishPct}%`,
              background: progressBarColor(stats.bullishPct),
            }}
          />
        </div>

        <p className="text-xs mt-3" style={{ color: "#64748B" }}>
          <span style={{ color: "#10B981" }}>{stats.bullish} Bullish</span>
          {" · "}
          <span style={{ color: "#EF4444" }}>{stats.bearish} Bearish</span>
          {" · "}
          <span style={{ color: "#64748B" }}>{stats.neutral} Neutral</span>
        </p>
      </div>
    </div>
  );
}

/* ─── Category group with section divider ─── */
function CategoryGroup({
  category,
  rows,
  today,
}: {
  category: string;
  rows: PublicHeatmapIndicator[];
  today: Date;
}) {
  const catColors: Record<string, string> = {
    "ECONOMIC GROWTH": "#3B82F6",
    INFLATION: "#818CF8",
    "JOBS MARKET": "#F59E0B",
    OTHER: "#64748B",
  };

  return (
    <>
      {/* Section divider */}
      <tr>
        <td colSpan={8} className="px-3 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <span
              className="label whitespace-nowrap"
              style={{ color: catColors[category] || "#64748B" }}
            >
              {category}
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
          </div>
        </td>
      </tr>
      {rows.map((ind) => {
        const isInsufficient = ind.outcome === 'insufficient_data';
        const staleTooltip = ind.stale
          ? ind.staleDate
            ? `Data is more than 60 days old (last observation ${ind.staleDate})`
            : "Data is more than 60 days old"
          : undefined;
        return (
          <tr
            key={ind.name}
            className="transition-colors hover:bg-white/[0.03]"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
          >
            {/* Indicator */}
            <td className="px-3 py-2.5">
              <span className="font-semibold text-white">{ind.name}</span>
              {ind.stale && (
                <span
                  title={staleTooltip}
                  className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider align-middle"
                  style={{
                    background: "rgba(245,158,11,0.12)",
                    color: "#F59E0B",
                    border: "1px solid rgba(245,158,11,0.3)",
                  }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ background: "#F59E0B" }}
                    aria-hidden="true"
                  />
                  stale
                </span>
              )}
              <br />
              <span className="text-[10px]" style={{ color: "#475569" }}>
                {ind.frequency}
              </span>
            </td>

            {/* Last Release */}
            <td
              className="px-3 py-2.5 tabular-nums whitespace-nowrap"
              style={{ color: ind.stale ? "#F59E0B" : "#94A3B8" }}
              title={ind.stale ? staleTooltip : undefined}
            >
              {ind.lastRelease}
            </td>

            {/* Next Release */}
            <td
              className="px-3 py-2.5 tabular-nums whitespace-nowrap"
              style={nextReleaseDateStyle(ind.nextRelease, today)}
            >
              {ind.nextRelease}
            </td>

            {/* Actual */}
            <td
              className="px-3 py-2.5 font-medium tabular-nums"
              style={{ color: isInsufficient || ind.actual === null ? "#94A3B8" : actualColor(ind.surprise) }}
            >
              {isInsufficient || ind.actual === null ? "—" : ind.actual}
            </td>

            {/* Forecast */}
            <td className="px-3 py-2.5 tabular-nums text-white">
              {isInsufficient || ind.forecast === null ? "—" : ind.forecast}
            </td>

            {/* Previous */}
            <td
              className="px-3 py-2.5 tabular-nums"
              style={{ color: "#64748B" }}
            >
              {isInsufficient || ind.previous === null ? "—" : ind.previous}
            </td>

            {/* Surprise */}
            <td className="px-3 py-2.5">
              {isInsufficient || ind.surprise === null ? (
                <span
                  className="inline-block px-2 py-0.5 rounded font-bold tabular-nums"
                  style={{ color: "#475569" }}
                >
                  —
                </span>
              ) : (
                <span
                  className="inline-block px-2 py-0.5 rounded font-bold tabular-nums"
                  style={surpriseStyle(ind.surprise)}
                >
                  {ind.surprise}
                </span>
              )}
            </td>

            {/* Score */}
            <td className="px-3 py-2.5">
              {isInsufficient || ind.score === null ? (
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold"
                  style={{
                    background: "rgba(245,158,11,0.12)",
                    color: "#F59E0B",
                    border: "1px solid rgba(245,158,11,0.3)",
                  }}
                  title={ind.reason ?? undefined}
                >
                  No data
                </span>
              ) : (
                <span
                  className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${scorePillClass(ind.score)}`}
                >
                  {ind.score > 0 ? "+" : ""}
                  {ind.score}
                </span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
