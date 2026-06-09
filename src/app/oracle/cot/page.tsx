"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useCot } from "@/hooks/useCot";
import { type PublicCotAsset } from "@/lib/api/oracle";
import { Sparkline } from "@/components/Sparkline";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import { formatUpdated } from "@/lib/format-date";

type SortKey =
  | "asset"
  | "longContracts"
  | "shortContracts"
  | "deltaLong"
  | "deltaShort"
  | "longPct"
  | "shortPct"
  | "netPctChange"
  | "netPosition"
  | "cotScore";

type SortDir = "asc" | "desc";

function fmt(n: number): string {
  return Math.abs(n).toLocaleString("en-US");
}

function signed(n: number): string {
  const prefix = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${prefix}${fmt(n)}`;
}

function pctColor(pct: number): string {
  if (pct >= 60) return "#10B981";
  if (pct <= 40) return "#EF4444";
  return "#64748B";
}

function scorePillClass(score: number): string {
  if (score >= 2) return "pill-strong-bullish";
  if (score >= 1) return "pill-bullish";
  if (score <= -2) return "pill-strong-bearish";
  if (score <= -1) return "pill-bearish";
  return "pill-neutral";
}

function rowBorderColor(score: number): string | undefined {
  if (score === 2) return "#10B981";
  if (score === -2) return "#EF4444";
  return undefined;
}

/**
 * Null-safe numeric comparator. Nulls sort to the end regardless of direction.
 */
function compareNullableNum(a: number | null, b: number | null, dir: SortDir): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return dir === "asc" ? a - b : b - a;
}

/** Type predicate — narrows to a scored row with all numeric fields non-null. */
type ScoredCotAsset = PublicCotAsset & {
  longContracts: number;
  shortContracts: number;
  deltaLong: number;
  deltaShort: number;
  longPct: number;
  shortPct: number;
  netPctChange: number;
  netPosition: number;
  cotScore: number;
  trend: number[];
};

function isScored(row: PublicCotAsset): row is ScoredCotAsset {
  return row.outcome === "scored";
}

function InsufficientCell() {
  return (
    <td className="px-3 py-3 tabular-nums" style={{ color: "#334155" }}>—</td>
  );
}

/** COT-score-column badge for non-scored rows: slate "Deferred" or amber "No data yet". */
function StatusBadge({ outcome, reason }: { outcome: PublicCotAsset["outcome"]; reason: string | null }) {
  const deferred = outcome === "deferred";
  return (
    <span
      title={reason ?? undefined}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
      style={
        deferred
          ? {
              background: "rgba(100, 116, 139, 0.15)",
              color: "#94A3B8",
              border: "1px solid rgba(100, 116, 139, 0.3)",
            }
          : {
              background: "rgba(245, 158, 11, 0.15)",
              color: "#F59E0B",
              border: "1px solid rgba(245, 158, 11, 0.3)",
            }
      }
    >
      {deferred ? "Deferred" : "No data yet"}
    </span>
  );
}

export default function CotPage() {
  const [sortKey, setSortKey] = useState<SortKey>("longPct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredScore, setHoveredScore] = useState<string | null>(null);

  // Portal-mount gate — body isn't available during SSR.
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => { setPortalReady(true); }, []);

  const { data: assets, isLoading, error, refetch } = useCot();

  // Bar chart only renders scored rows — long%/short% bars are meaningless without data.
  const chartSorted = useMemo<ScoredCotAsset[]>(() => {
    if (!assets) return [];
    return assets.filter(isScored).sort((a, b) => b.longPct - a.longPct);
  }, [assets]);

  const tableSorted = useMemo<PublicCotAsset[]>(() => {
    if (!assets) return [];
    const arr = [...assets];
    arr.sort((a, b) => {
      if (sortKey === "asset") {
        return sortDir === "asc"
          ? a.asset.localeCompare(b.asset)
          : b.asset.localeCompare(a.asset);
      }
      return compareNullableNum(a[sortKey], b[sortKey], sortDir);
    });
    return arr;
  }, [assets, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortArrow(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  if (isLoading) return <LoadingState message="Loading COT report..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!assets || assets.length === 0) return <EmptyState title="No COT data available" />;

  const barHeight = 36;
  const barGap = 10;
  const labelWidth = 90;
  const badgeWidth = 80;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate" style={{ color: "#F1F5F9" }}>
            COT Report
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
            Institutional positioning — Non-Commercial traders
          </p>
        </div>
        <div className="sm:text-right shrink-0">
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            Data as of <span className="font-medium text-white">{formatUpdated(assets[0]?.dataAsOf)}</span> · Released{" "}
            <span className="font-medium text-white">{formatUpdated(assets[0]?.releasedOn)}</span>
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#475569" }}>
            COT covers previous Tuesday positions. Released every Friday.
          </p>
        </div>
      </div>

      {/* SECTION 1: Positioning Bar Chart */}
      <div className="glass-card p-5 relative overflow-x-auto">
        <h2 className="label mb-4" style={{ color: "#64748B" }}>
          Positioning Overview
        </h2>
        {chartSorted.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                background: "rgba(245, 158, 11, 0.15)",
                color: "#F59E0B",
                border: "1px solid rgba(245, 158, 11, 0.3)",
              }}
            >
              Pending CFTC ingestion
            </span>
          </div>
        ) : (
          <div className="relative" style={{ minWidth: 400 }}>
            {chartSorted.map((asset, i) => {
              const isHovered = hoveredBar === asset.asset;
              return (
                <div
                  key={asset.asset}
                  className="flex items-center"
                  style={{
                    height: barHeight,
                    marginBottom: i < chartSorted.length - 1 ? barGap : 0,
                  }}
                  onMouseEnter={(e) => {
                    setHoveredBar(asset.asset);
                    setTooltipPos({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseMove={(e) => {
                    setTooltipPos({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Label */}
                  <div
                    className="shrink-0 text-xs font-medium tabular-nums"
                    style={{ width: labelWidth, color: "#CBD5E1" }}
                  >
                    <span className="mr-1">{asset.flag}</span>
                    {asset.asset}
                  </div>

                  {/* Bar container */}
                  <div
                    className="flex-1 relative rounded overflow-hidden"
                    style={{
                      height: barHeight,
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    {/* Long portion */}
                    <div
                      className="absolute inset-y-0 left-0 flex items-center justify-end pr-2 transition-opacity"
                      style={{
                        width: `${asset.longPct}%`,
                        background: "linear-gradient(90deg, rgba(59,130,246,0.6), rgba(59,130,246,0.85))",
                        opacity: isHovered ? 1 : 0.85,
                      }}
                    >
                      {asset.longPct >= 20 && (
                        <span className="text-xs font-medium text-white tabular-nums">
                          {asset.longPct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {/* Short portion */}
                    <div
                      className="absolute inset-y-0 right-0 flex items-center justify-start pl-2 transition-opacity"
                      style={{
                        width: `${asset.shortPct}%`,
                        background: "linear-gradient(90deg, rgba(239,68,68,0.7), rgba(239,68,68,0.5))",
                        opacity: isHovered ? 1 : 0.85,
                      }}
                    >
                      {asset.shortPct >= 20 && (
                        <span className="text-xs font-medium text-white tabular-nums">
                          {asset.shortPct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {/* 50% center line */}
                    <div
                      className="absolute inset-y-0"
                      style={{
                        left: "50%",
                        width: 1,
                        borderLeft: "1px dashed rgba(255,255,255,0.15)",
                      }}
                    />
                    {/* Long % beside bar if too narrow */}
                    {asset.longPct < 20 && (
                      <span
                        className="absolute text-xs tabular-nums font-medium"
                        style={{ left: `${asset.longPct + 1}%`, top: "50%", transform: "translateY(-50%)", color: "#3B82F6" }}
                      >
                        {asset.longPct.toFixed(1)}%
                      </span>
                    )}
                  </div>

                  {/* Net change badge */}
                  <div className="shrink-0 flex justify-end" style={{ width: badgeWidth }}>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 tabular-nums"
                      style={{
                        background:
                          asset.netPctChange >= 0
                            ? "rgba(16,185,129,0.15)"
                            : "rgba(239,68,68,0.15)",
                        color: asset.netPctChange >= 0 ? "#10B981" : "#EF4444",
                      }}
                    >
                      {asset.netPctChange >= 0 ? "↑" : "↓"}
                      {asset.netPctChange >= 0 ? "+" : ""}
                      {asset.netPctChange.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bar Tooltip — portaled to body so it escapes the glass-card's backdrop-filter
            containing block (which would otherwise trap position:fixed below sibling cards). */}
        {hoveredBar && portalReady && (() => {
          const a = chartSorted.find((d) => d.asset === hoveredBar);
          if (!a) return null;
          return createPortal(
            <div
              className="fixed z-100 bg-blue-950 px-3 py-2.5 text-xs space-y-1 pointer-events-none rounded-md"
              style={{
                left: tooltipPos.x + 12,
                top: tooltipPos.y - 60,
                minWidth: 200,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="font-semibold text-white mb-1">
                {a.flag} {a.asset}
              </div>
              <div style={{ color: "#94A3B8" }}>
                Long Contracts:{" "}
                <span className="text-white tabular-nums">{a.longContracts.toLocaleString()}</span>
              </div>
              <div style={{ color: "#94A3B8" }}>
                Short Contracts:{" "}
                <span className="text-white tabular-nums">{a.shortContracts.toLocaleString()}</span>
              </div>
              <div style={{ color: "#94A3B8" }}>
                Net Position:{" "}
                <span
                  className="tabular-nums font-medium"
                  style={{ color: a.netPosition >= 0 ? "#10B981" : "#EF4444" }}
                >
                  {signed(a.netPosition)}
                </span>
              </div>
              <div style={{ color: "#94A3B8" }}>
                Net Change:{" "}
                <span
                  className="tabular-nums font-medium"
                  style={{ color: a.netPctChange >= 0 ? "#10B981" : "#EF4444" }}
                >
                  {a.netPctChange >= 0 ? "+" : ""}
                  {a.netPctChange.toFixed(2)}%
                </span>
              </div>
            </div>,
            document.body,
          );
        })()}
      </div>

      {/* SECTION 2 + 3: Data Table */}
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {([
                ["asset", "ASSET"],
                ["longContracts", "LONG CONTRACTS"],
                ["shortContracts", "SHORT CONTRACTS"],
                ["deltaLong", "Δ LONG"],
                ["deltaShort", "Δ SHORT"],
                ["longPct", "LONG %"],
                ["shortPct", "SHORT %"],
                ["netPctChange", "NET % CHANGE"],
                ["netPosition", "NET POSITION"],
                ["cotScore", "COT SCORE"],
              ] as [SortKey, string][]).map(([key, label]) => (
                <th
                  key={key}
                  className="px-3 py-3 text-left label cursor-pointer select-none whitespace-nowrap"
                  style={{ color: "#64748B" }}
                  onClick={() => handleSort(key)}
                >
                  {label}
                  <span style={{ color: "#3B82F6" }}>{sortArrow(key)}</span>
                </th>
              ))}
              <th
                className="px-3 py-3 text-left label whitespace-nowrap"
                style={{ color: "#64748B" }}
              >
                4-WEEK TREND
              </th>
            </tr>
          </thead>
          <tbody>
            {tableSorted.map((a) => {
              if (!isScored(a)) {
                // Insufficient data row — amber badge in COT SCORE column, em-dashes elsewhere.
                return (
                  <tr
                    key={a.asset}
                    className="transition-colors hover:bg-white/3"
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      borderLeft: "2px solid transparent",
                    }}
                  >
                    {/* Asset */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{a.flag}</span>
                        <div>
                          <span className="font-semibold text-white">{a.asset}</span>
                          <span
                            className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              color: "#64748B",
                            }}
                          >
                            {a.type}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* 8 numeric columns → em-dash */}
                    <InsufficientCell />
                    <InsufficientCell />
                    <InsufficientCell />
                    <InsufficientCell />
                    <InsufficientCell />
                    <InsufficientCell />
                    <InsufficientCell />
                    <InsufficientCell />

                    {/* COT Score → "Deferred" (slate) or "No data yet" (amber) badge */}
                    <td className="px-3 py-3">
                      <StatusBadge outcome={a.outcome} reason={a.reason} />
                    </td>

                    {/* Trend → em-dash */}
                    <td className="px-3 py-3 tabular-nums" style={{ color: "#334155" }}>—</td>
                  </tr>
                );
              }

              const borderColor = rowBorderColor(a.cotScore);
              return (
                <tr
                  key={a.asset}
                  className="transition-colors hover:bg-white/3"
                  style={{
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    borderLeft: borderColor ? `2px solid ${borderColor}` : "2px solid transparent",
                  }}
                >
                  {/* Asset */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span>{a.flag}</span>
                      <div>
                        <span className="font-semibold text-white">{a.asset}</span>
                        <span
                          className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            color: "#64748B",
                          }}
                        >
                          {a.type}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Long Contracts */}
                  <td className="px-3 py-3 tabular-nums text-white">{a.longContracts.toLocaleString()}</td>

                  {/* Short Contracts */}
                  <td className="px-3 py-3 tabular-nums text-white">{a.shortContracts.toLocaleString()}</td>

                  {/* Δ Long */}
                  <td className="px-3 py-3 tabular-nums font-medium" style={{ color: a.deltaLong >= 0 ? "#10B981" : "#EF4444" }}>
                    {a.deltaLong >= 0 ? "↑" : "↓"} {signed(a.deltaLong)}
                  </td>

                  {/* Δ Short — inverted: more shorts added = red, shorts reduced = green */}
                  <td className="px-3 py-3 tabular-nums font-medium" style={{ color: a.deltaShort > 0 ? "#EF4444" : "#10B981" }}>
                    {a.deltaShort > 0 ? "↑" : "↓"} {signed(a.deltaShort)}
                  </td>

                  {/* Long % */}
                  <td className="px-3 py-3 tabular-nums font-medium" style={{ color: pctColor(a.longPct) }}>
                    {a.longPct.toFixed(2)}%
                  </td>

                  {/* Short % */}
                  <td className="px-3 py-3 tabular-nums font-medium" style={{ color: pctColor(100 - a.longPct) }}>
                    {a.shortPct.toFixed(2)}%
                  </td>

                  {/* Net % Change */}
                  <td className="px-3 py-3">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium tabular-nums"
                      style={{
                        background:
                          a.netPctChange >= 0
                            ? "rgba(16,185,129,0.15)"
                            : "rgba(239,68,68,0.15)",
                        color: a.netPctChange >= 0 ? "#10B981" : "#EF4444",
                        border: `1px solid ${
                          a.netPctChange >= 0
                            ? "rgba(16,185,129,0.3)"
                            : "rgba(239,68,68,0.3)"
                        }`,
                      }}
                    >
                      {a.netPctChange >= 0 ? "↑" : "↓"}{" "}
                      {a.netPctChange >= 0 ? "+" : ""}
                      {a.netPctChange.toFixed(2)}%
                    </span>
                  </td>

                  {/* Net Position */}
                  <td
                    className="px-3 py-3 tabular-nums font-medium"
                    style={{ color: a.netPosition >= 0 ? "#10B981" : "#EF4444" }}
                  >
                    {signed(a.netPosition)}
                  </td>

                  {/* COT Score */}
                  <td className="px-3 py-3 relative">
                    <span
                      className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${scorePillClass(a.cotScore)}`}
                      onMouseEnter={() => setHoveredScore(a.asset)}
                      onMouseLeave={() => setHoveredScore(null)}
                    >
                      {a.cotScore > 0 ? "+" : ""}
                      {a.cotScore}
                    </span>
                    {hoveredScore === a.asset && a.scoreTooltip && (
                      <div
                        className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 glass-card px-3 py-2 text-[11px] whitespace-nowrap pointer-events-none"
                        style={{
                          color: "#CBD5E1",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        {a.scoreTooltip}
                      </div>
                    )}
                  </td>

                  {/* 4-Week Trend Sparkline */}
                  <td className="px-3 py-3">
                    <Sparkline data={a.trend} width={80} height={24} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <p className="text-[11px] leading-relaxed" style={{ color: "#334155" }}>
        Non-Commercial (speculative) positioning only. Data sourced directly from CFTC Commitment
        of Traders report. Released every Friday covering positions as of the previous Tuesday. COT
        scores calculated using net positioning and weekly change direction.
      </p>
    </div>
  );
}
