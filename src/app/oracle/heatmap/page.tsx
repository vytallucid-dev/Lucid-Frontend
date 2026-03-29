"use client";

import { useState, useMemo } from "react";
import {
  economies,
  heatmapData,
  type EconomyKey,
  type HeatmapIndicator,
} from "@/data/heatmap";

const CATEGORIES = ["ECONOMIC GROWTH", "INFLATION", "JOBS MARKET"] as const;
const TODAY = new Date(2026, 2, 29); // Mar 29, 2026

function daysUntil(dateStr: string): number | null {
  if (dateStr === "Daily" || dateStr === "—") return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - TODAY.getTime()) / 86_400_000);
}

function nextReleaseDateStyle(dateStr: string): React.CSSProperties {
  const days = daysUntil(dateStr);
  if (days === null) return { color: "#94A3B8" };
  if (days <= 2) return { color: "#F59E0B", fontWeight: 500 };
  if (days <= 7) return { color: "#3B82F6", fontWeight: 500 };
  return { color: "#94A3B8" };
}

function surpriseStyle(surprise: string): React.CSSProperties {
  if (surprise === "—") return { color: "#475569" };
  if (surprise === "Hawkish") return { background: "rgba(16,185,129,0.15)", color: "#10B981" };
  const num = parseFloat(surprise);
  if (isNaN(num)) return { color: "#475569" };
  if (num > 0) return { background: "rgba(16,185,129,0.15)", color: "#10B981" };
  if (num < 0) return { background: "rgba(239,68,68,0.1)", color: "#EF4444" };
  return { color: "#475569" };
}

function actualColor(surprise: string): string {
  if (surprise === "—") return "#F1F5F9";
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

export default function HeatmapPage() {
  const [economy, setEconomy] = useState<EconomyKey>("US");

  const indicators = heatmapData[economy];

  const stats = useMemo(() => {
    const total = indicators.length;
    const bullish = indicators.filter((i) => i.score === 1).length;
    const bearish = indicators.filter((i) => i.score === -1).length;
    const neutral = indicators.filter((i) => i.score === 0).length;
    const denom = total - neutral;
    const bullishPct = denom > 0 ? (bullish / denom) * 100 : 50;
    return { total, bullish, bearish, neutral, bullishPct };
  }, [indicators]);

  const grouped = useMemo(() => {
    const map = new Map<string, HeatmapIndicator[]>();
    for (const cat of CATEGORIES) {
      map.set(
        cat,
        indicators.filter((i) => i.category === cat)
      );
    }
    return map;
  }, [indicators]);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "#F1F5F9" }}>
            Economic Heatmap
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
            Macro release data and surprise indicators by economy
          </p>
        </div>
        <p className="text-xs" style={{ color: "#475569" }}>
          Last updated Mar 29, 2026
        </p>
      </div>

      {/* Economy Selector */}
      <div className="flex gap-2">
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
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Indicators Tracked", value: stats.total, color: "#94A3B8" },
          { label: "Bullish", value: stats.bullish, color: "#10B981" },
          { label: "Bearish", value: stats.bearish, color: "#EF4444" },
          { label: "Neutral", value: stats.neutral, color: "#64748B" },
          {
            label: "Bullish %",
            value: `${stats.bullishPct.toFixed(1)}%`,
            color: progressBarColor(stats.bullishPct),
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
                <CategoryGroup key={cat} category={cat} rows={rows} />
              );
            })}
          </tbody>
        </table>
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
              width: `${stats.bullishPct}%`,
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
}: {
  category: string;
  rows: HeatmapIndicator[];
}) {
  const catColors: Record<string, string> = {
    "ECONOMIC GROWTH": "#3B82F6",
    INFLATION: "#818CF8",
    "JOBS MARKET": "#F59E0B",
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
      {rows.map((ind) => (
        <tr
          key={ind.name}
          className="transition-colors hover:bg-white/[0.03]"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
        >
          {/* Indicator */}
          <td className="px-3 py-2.5">
            <span className="font-semibold text-white">{ind.name}</span>
            <br />
            <span className="text-[10px]" style={{ color: "#475569" }}>
              {ind.frequency}
            </span>
          </td>

          {/* Last Release */}
          <td
            className="px-3 py-2.5 tabular-nums whitespace-nowrap"
            style={{ color: ind.stale ? "#F59E0B" : "#94A3B8" }}
          >
            {ind.lastRelease}
          </td>

          {/* Next Release */}
          <td
            className="px-3 py-2.5 tabular-nums whitespace-nowrap"
            style={nextReleaseDateStyle(ind.nextRelease)}
          >
            {ind.nextRelease}
          </td>

          {/* Actual */}
          <td
            className="px-3 py-2.5 font-medium tabular-nums"
            style={{ color: actualColor(ind.surprise) }}
          >
            {ind.actual}
          </td>

          {/* Forecast */}
          <td className="px-3 py-2.5 tabular-nums text-white">
            {ind.forecast}
          </td>

          {/* Previous */}
          <td
            className="px-3 py-2.5 tabular-nums"
            style={{ color: "#64748B" }}
          >
            {ind.previous}
          </td>

          {/* Surprise */}
          <td className="px-3 py-2.5">
            <span
              className="inline-block px-2 py-0.5 rounded font-bold tabular-nums"
              style={surpriseStyle(ind.surprise)}
            >
              {ind.surprise}
            </span>
          </td>

          {/* Score */}
          <td className="px-3 py-2.5">
            <span
              className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${scorePillClass(ind.score)}`}
            >
              {ind.score > 0 ? "+" : ""}
              {ind.score}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}
