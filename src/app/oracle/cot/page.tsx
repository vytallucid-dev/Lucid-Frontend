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
import { useOracleTools } from "@/components/oracle-tools/OracleToolsProvider";

/** Assets valid for the COT Trajectory tool (currency/commodity codes). */
const COT_TOOL_ASSETS = new Set(["USD", "EUR", "GBP", "JPY", "Gold"]);

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
  if (pct >= 60) return "var(--lucid-pos)";
  if (pct <= 40) return "var(--lucid-neg)";
  return "var(--lucid-ink-3)";
}

/** Lucid-themed score pill styling (replaces the legacy glow pill classes). */
function scorePillStyle(score: number): React.CSSProperties {
  if (score >= 1) {
    return {
      background: "var(--lucid-pos-bg)",
      color: "var(--lucid-pos)",
      border: "1px solid var(--lucid-pos-bd)",
    };
  }
  if (score <= -1) {
    return {
      background: "var(--lucid-neg-bg)",
      color: "var(--lucid-neg)",
      border: "1px solid var(--lucid-neg-bd)",
    };
  }
  return {
    background: "var(--lucid-surface-3)",
    color: "var(--lucid-ink-3)",
    border: "1px solid var(--lucid-line)",
  };
}

function rowBorderColor(score: number): string | undefined {
  if (score === 2) return "var(--lucid-pos)";
  if (score === -2) return "var(--lucid-neg)";
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
    <td className="px-3 py-3 lt-num" style={{ color: "var(--lucid-ink-3)" }}>—</td>
  );
}

/** COT-score-column badge for non-scored rows: slate "Deferred" or amber "No data yet". */
function StatusBadge({ outcome, reason }: { outcome: PublicCotAsset["outcome"]; reason: string | null }) {
  const deferred = outcome === "deferred";
  return (
    <span
      title={reason ?? undefined}
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap lt-eyebrow"
      style={
        deferred
          ? {
              background: "var(--lucid-surface-3)",
              color: "var(--lucid-ink-2)",
              border: "1px solid var(--lucid-line-2)",
            }
          : {
              background: "var(--lucid-warn-bg)",
              color: "var(--lucid-warn)",
              border: "1px solid var(--lucid-warn-bd)",
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

  const { openCotTrajectory } = useOracleTools();

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

  if (isLoading) return <LoadingState stages={["Loading COT report…", "Parsing CFTC positioning…", "Charting the field…"]} />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!assets || assets.length === 0) return <EmptyState title="No COT data available" />;

  const barHeight = 36;
  const barGap = 10;
  const labelWidth = 90;
  const badgeWidth = 80;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Page Header */}
      <div className="lt-rise lt-stagger-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate lt-serif" style={{ color: "var(--lucid-ink)" }}>
            COT Report
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>
            Institutional positioning — Non-Commercial traders
          </p>
        </div>
        <div className="sm:text-right shrink-0">
          <p className="text-sm" style={{ color: "var(--lucid-ink-2)" }}>
            Data as of <span className="font-medium" style={{ color: "var(--lucid-ink)" }}>{formatUpdated(assets[0]?.dataAsOf)}</span> · Released{" "}
            <span className="font-medium" style={{ color: "var(--lucid-ink)" }}>{formatUpdated(assets[0]?.releasedOn)}</span>
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>
            COT covers previous Tuesday positions. Released every Friday.
          </p>
        </div>
      </div>

      {/* SECTION 1: Positioning Bar Chart */}
      <div
        className="lt-card lt-edge lt-rise lt-stagger-2 p-5 relative overflow-x-auto"
        style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
      >
        <h2 className="lt-eyebrow lt-serif mb-4" style={{ color: "var(--lucid-ink-3)" }}>
          Positioning Overview
        </h2>
        {chartSorted.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                background: "var(--lucid-warn-bg)",
                color: "var(--lucid-warn)",
                border: "1px solid var(--lucid-warn-bd)",
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
                    className="shrink-0 text-xs font-medium lt-num"
                    style={{ width: labelWidth, color: "var(--lucid-ink-2)" }}
                  >
                    <span className="mr-1">{asset.flag}</span>
                    {asset.asset}
                  </div>

                  {/* Bar container */}
                  <div
                    className="flex-1 relative rounded overflow-hidden"
                    style={{
                      height: barHeight,
                      background: "var(--lucid-line)",
                    }}
                  >
                    {/* Long portion */}
                    <div
                      className="lt-bar absolute inset-y-0 left-0 flex items-center justify-end pr-2 transition-opacity"
                      style={{
                        width: `${asset.longPct}%`,
                        background: "var(--lucid-pos)",
                        opacity: isHovered ? 1 : 0.85,
                        animationDelay: `${0.15 + i * 0.05}s`,
                      }}
                    >
                      {asset.longPct >= 20 && (
                        <span className="text-xs font-medium lt-num" style={{ color: "var(--lucid-bg)" }}>
                          {asset.longPct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {/* Short portion */}
                    <div
                      className="lt-bar absolute inset-y-0 right-0 flex items-center justify-start pl-2 transition-opacity"
                      style={{
                        width: `${asset.shortPct}%`,
                        background: "var(--lucid-neg)",
                        opacity: isHovered ? 1 : 0.85,
                        animationDelay: `${0.15 + i * 0.05}s`,
                      }}
                    >
                      {asset.shortPct >= 20 && (
                        <span className="text-xs font-medium lt-num" style={{ color: "var(--lucid-bg)" }}>
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
                        borderLeft: "1px dashed var(--lucid-line-2)",
                      }}
                    />
                    {/* Long % beside bar if too narrow */}
                    {asset.longPct < 20 && (
                      <span
                        className="absolute text-xs lt-num font-medium"
                        style={{ left: `${asset.longPct + 1}%`, top: "50%", transform: "translateY(-50%)", color: "var(--lucid-pos)" }}
                      >
                        {asset.longPct.toFixed(1)}%
                      </span>
                    )}
                  </div>

                  {/* Net change badge */}
                  <div className="shrink-0 flex justify-end" style={{ width: badgeWidth }}>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 lt-num"
                      style={{
                        background:
                          asset.netPctChange >= 0
                            ? "var(--lucid-pos-bg)"
                            : "var(--lucid-neg-bg)",
                        color: asset.netPctChange >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)",
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

        {/* Bar Tooltip — portaled to body so it escapes the card's stacking context. */}
        {hoveredBar && portalReady && (() => {
          const a = chartSorted.find((d) => d.asset === hoveredBar);
          if (!a) return null;
          return createPortal(
            <div
              className="fixed z-100 px-3 py-2.5 text-xs space-y-1 pointer-events-none rounded-md"
              style={{
                left: tooltipPos.x + 12,
                top: tooltipPos.y - 60,
                minWidth: 200,
                background: "var(--lucid-surface-2)",
                border: "1px solid var(--lucid-line-2)",
              }}
            >
              <div className="font-semibold mb-1" style={{ color: "var(--lucid-ink)" }}>
                {a.flag} {a.asset}
              </div>
              <div style={{ color: "var(--lucid-ink-2)" }}>
                Long Contracts:{" "}
                <span className="lt-num" style={{ color: "var(--lucid-ink)" }}>{a.longContracts.toLocaleString()}</span>
              </div>
              <div style={{ color: "var(--lucid-ink-2)" }}>
                Short Contracts:{" "}
                <span className="lt-num" style={{ color: "var(--lucid-ink)" }}>{a.shortContracts.toLocaleString()}</span>
              </div>
              <div style={{ color: "var(--lucid-ink-2)" }}>
                Net Position:{" "}
                <span
                  className="lt-num font-medium"
                  style={{ color: a.netPosition >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)" }}
                >
                  {signed(a.netPosition)}
                </span>
              </div>
              <div style={{ color: "var(--lucid-ink-2)" }}>
                Net Change:{" "}
                <span
                  className="lt-num font-medium"
                  style={{ color: a.netPctChange >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)" }}
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
      <div
        className="lt-card lt-edge lt-rise lt-stagger-3 overflow-x-auto"
        style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
      >
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
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
                  className="px-3 py-3 text-left lt-eyebrow cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort(key)}
                >
                  {label}
                  <span style={{ color: "var(--lucid-accent)" }}>{sortArrow(key)}</span>
                </th>
              ))}
              <th className="px-3 py-3 text-left lt-eyebrow whitespace-nowrap">
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
                    className="transition-colors"
                    style={{
                      borderBottom: "1px solid var(--lucid-line)",
                      borderLeft: "2px solid transparent",
                    }}
                  >
                    {/* Asset */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{a.flag}</span>
                        <div>
                          <span className="font-semibold" style={{ color: "var(--lucid-ink)" }}>{a.asset}</span>
                          <span
                            className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{
                              background: "var(--lucid-surface-3)",
                              color: "var(--lucid-ink-3)",
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
                    <td className="px-3 py-3 lt-num" style={{ color: "var(--lucid-ink-3)" }}>—</td>
                  </tr>
                );
              }

              const borderColor = rowBorderColor(a.cotScore);
              const clickable = COT_TOOL_ASSETS.has(a.asset);
              return (
                <tr
                  key={a.asset}
                  className={`transition-colors${clickable ? " cursor-pointer" : ""}`}
                  onClick={clickable ? () => openCotTrajectory(a.asset) : undefined}
                  onMouseEnter={
                    clickable
                      ? (e) => {
                          e.currentTarget.style.background = "var(--lucid-line)";
                        }
                      : undefined
                  }
                  onMouseLeave={
                    clickable
                      ? (e) => {
                          e.currentTarget.style.background = "transparent";
                        }
                      : undefined
                  }
                  style={{
                    background: "transparent",
                    borderBottom: "1px solid var(--lucid-line)",
                    borderLeft: borderColor ? `2px solid ${borderColor}` : "2px solid transparent",
                  }}
                >
                  {/* Asset */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span>{a.flag}</span>
                      <div>
                        <span className="font-semibold" style={{ color: "var(--lucid-ink)" }}>{a.asset}</span>
                        <span
                          className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{
                            background: "var(--lucid-surface-3)",
                            color: "var(--lucid-ink-3)",
                          }}
                        >
                          {a.type}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Long Contracts */}
                  <td className="px-3 py-3 lt-num" style={{ color: "var(--lucid-ink)" }}>{a.longContracts.toLocaleString()}</td>

                  {/* Short Contracts */}
                  <td className="px-3 py-3 lt-num" style={{ color: "var(--lucid-ink)" }}>{a.shortContracts.toLocaleString()}</td>

                  {/* Δ Long */}
                  <td className="px-3 py-3 lt-num font-medium" style={{ color: a.deltaLong >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                    {a.deltaLong >= 0 ? "↑" : "↓"} {signed(a.deltaLong)}
                  </td>

                  {/* Δ Short — inverted: more shorts added = red, shorts reduced = green */}
                  <td className="px-3 py-3 lt-num font-medium" style={{ color: a.deltaShort > 0 ? "var(--lucid-neg)" : "var(--lucid-pos)" }}>
                    {a.deltaShort > 0 ? "↑" : "↓"} {signed(a.deltaShort)}
                  </td>

                  {/* Long % */}
                  <td className="px-3 py-3 lt-num font-medium" style={{ color: pctColor(a.longPct) }}>
                    {a.longPct.toFixed(2)}%
                  </td>

                  {/* Short % */}
                  <td className="px-3 py-3 lt-num font-medium" style={{ color: pctColor(100 - a.longPct) }}>
                    {a.shortPct.toFixed(2)}%
                  </td>

                  {/* Net % Change */}
                  <td className="px-3 py-3">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium lt-num"
                      style={{
                        background:
                          a.netPctChange >= 0
                            ? "var(--lucid-pos-bg)"
                            : "var(--lucid-neg-bg)",
                        color: a.netPctChange >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)",
                        border: `1px solid ${
                          a.netPctChange >= 0
                            ? "var(--lucid-pos-bd)"
                            : "var(--lucid-neg-bd)"
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
                    className="px-3 py-3 lt-num font-medium"
                    style={{ color: a.netPosition >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)" }}
                  >
                    {signed(a.netPosition)}
                  </td>

                  {/* COT Score */}
                  <td className="px-3 py-3 relative">
                    <span
                      className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold lt-num"
                      style={scorePillStyle(a.cotScore)}
                      onMouseEnter={() => setHoveredScore(a.asset)}
                      onMouseLeave={() => setHoveredScore(null)}
                    >
                      {a.cotScore > 0 ? "+" : ""}
                      {a.cotScore}
                    </span>
                    {hoveredScore === a.asset && a.scoreTooltip && (
                      <div
                        className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 lt-card px-3 py-2 text-[11px] whitespace-nowrap pointer-events-none"
                        style={{
                          color: "var(--lucid-ink-2)",
                          background: "var(--lucid-surface-2)",
                          border: "1px solid var(--lucid-line-2)",
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
      <p className="text-[11px] leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>
        Non-Commercial (speculative) positioning only. Data sourced directly from CFTC Commitment
        of Traders report. Released every Friday covering positions as of the previous Tuesday. COT
        scores calculated using net positioning and weekly change direction.
      </p>
    </div>
  );
}
