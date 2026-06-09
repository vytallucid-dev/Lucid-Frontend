"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  getScoreColor,
  getBiasPillClass,
  type BiasType,
} from "@/data/assets";
import { useAssets } from "@/hooks/useAssets";
import { type PublicAssetData } from "@/lib/api/oracle";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import { formatUpdated } from "@/lib/format-date";

type BiasFilter = "All" | "Bullish" | "Bearish" | "Neutral";
type SortOption = "score-desc" | "score-asc" | "alpha";

type IndicatorKey =
  | "gdp" | "pmiM" | "pmiS" | "retail" | "consConf"
  | "cpi" | "ppi" | "pce" | "yield"
  | "nfp" | "unemp" | "claims" | "adp" | "jolts";

const indicatorColumns: { key: IndicatorKey; label: string }[] = [
  { key: "gdp", label: "GDP" },
  { key: "pmiM", label: "PMI(M)" },
  { key: "pmiS", label: "PMI(S)" },
  { key: "retail", label: "RETAIL" },
  { key: "consConf", label: "CONS CONF" },
  { key: "cpi", label: "CPI" },
  { key: "ppi", label: "PPI" },
  { key: "pce", label: "PCE" },
  { key: "yield", label: "YIELD" },
  { key: "nfp", label: "NFP" },
  { key: "unemp", label: "UNEMP" },
  { key: "claims", label: "CLAIMS" },
  { key: "adp", label: "ADP" },
  { key: "jolts", label: "JOLTS" },
];

const columnGroups = [
  { label: "ECONOMIC GROWTH", span: 5, color: "#3B82F6" },
  { label: "INFLATION", span: 4, color: "#818CF8" },
  { label: "JOBS MARKET", span: 5, color: "#F59E0B" },
];

// Indicator → group mapping for drawer subtotals. Mirrors columnGroups spans.
const INDICATOR_GROUPS: { label: string; color: string; keys: IndicatorKey[] }[] = [
  { label: "Economic Growth", color: "#3B82F6", keys: ["gdp", "pmiM", "pmiS", "retail", "consConf"] },
  { label: "Inflation", color: "#818CF8", keys: ["cpi", "ppi", "pce", "yield"] },
  { label: "Jobs Market", color: "#F59E0B", keys: ["nfp", "unemp", "claims", "adp", "jolts"] },
];

const INDICATOR_LABELS: Record<IndicatorKey, string> = {
  gdp: "GDP", pmiM: "Manufacturing PMI", pmiS: "Services PMI",
  retail: "Retail Sales", consConf: "Consumer Confidence",
  cpi: "CPI", ppi: "PPI", pce: "PCE", yield: "Yield",
  nfp: "NFP", unemp: "Unemployment", claims: "Jobless Claims",
  adp: "ADP", jolts: "JOLTS",
};

// Compute per-group subtotals from a row's per-indicator scores.
function computeGroupSubtotals(row: PublicAssetData) {
  return INDICATOR_GROUPS.map((g) => {
    let subtotal = 0;
    let scoredCount = 0;
    for (const k of g.keys) {
      const v = row[k];
      if (v !== null) {
        subtotal += v;
        scoredCount += 1;
      }
    }
    return { label: g.label, color: g.color, subtotal, scoredCount, total: g.keys.length };
  });
}

// Top contributing indicators sorted by absolute score, ties broken by label.
function topContributors(row: PublicAssetData, n: number): { key: IndicatorKey; label: string; value: number }[] {
  const contributors: { key: IndicatorKey; label: string; value: number }[] = [];
  for (const g of INDICATOR_GROUPS) {
    for (const k of g.keys) {
      const v = row[k];
      if (v !== null && v !== 0) {
        contributors.push({ key: k, label: INDICATOR_LABELS[k], value: v });
      }
    }
  }
  contributors.sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.label.localeCompare(b.label));
  return contributors.slice(0, n);
}

function IndicatorCell({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <td
        className="px-2 py-2.5 text-center text-xs"
        style={{ color: "#334155" }}
      >
        —
      </td>
    );
  }
  if (value === 0) {
    return (
      <td
        className="px-2 py-2.5 text-center text-xs font-semibold tabular-nums"
        style={{ color: "#334155" }}
      >
        0
      </td>
    );
  }
  const isPositive = value > 0;
  return (
    <td
      className="px-2 py-2.5 text-center text-xs font-semibold tabular-nums"
      style={{
        background: isPositive
          ? "rgba(16, 185, 129, 0.15)"
          : "rgba(239, 68, 68, 0.1)",
        color: isPositive ? "#10B981" : "#EF4444",
      }}
    >
      {isPositive ? "+1" : "-1"}
    </td>
  );
}

function CotCell({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <td
        className="px-2 py-2.5 text-center text-xs"
        style={{ color: "#334155" }}
      >
        —
      </td>
    );
  }
  const color = value > 0 ? "#10B981" : value < 0 ? "#EF4444" : "#334155";
  const bg =
    value > 0
      ? "rgba(16, 185, 129, 0.15)"
      : value < 0
        ? "rgba(239, 68, 68, 0.1)"
        : "transparent";
  return (
    <td
      className="px-2 py-2.5 text-center text-xs font-semibold tabular-nums"
      style={{ color, background: bg }}
    >
      {value > 0 ? `+${value}` : value}
    </td>
  );
}

function BiasFilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
      style={{
        background: active
          ? "rgba(59, 130, 246, 0.15)"
          : "rgba(255,255,255,0.03)",
        color: active ? "#60A5FA" : "#64748B",
        border: active
          ? "1px solid rgba(59, 130, 246, 0.3)"
          : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {label}
    </button>
  );
}

function getRowBorder(bias: BiasType | null) {
  if (bias === "Strong Bullish") return "2px solid rgba(16, 185, 129, 0.5)";
  if (bias === "Strong Bearish") return "2px solid rgba(239, 68, 68, 0.5)";
  return "2px solid transparent";
}

export default function TopSetupsPage() {
  const [biasFilter, setBiasFilter] = useState<BiasFilter>("All");
  const [sortBy, setSortBy] = useState<SortOption>("score-desc");
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<PublicAssetData | null>(null);

  const { data: assets, isLoading, error, refetch } = useAssets();

  const filtered = useMemo(() => {
    const list = assets ?? [];
    let result = [...list];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.asset.toLowerCase().includes(q));
    }

    if (biasFilter !== "All") {
      result = result.filter((a) => {
        if (biasFilter === "Bullish")
          return a.bias === "Bullish" || a.bias === "Strong Bullish";
        if (biasFilter === "Bearish")
          return a.bias === "Bearish" || a.bias === "Strong Bearish";
        return a.bias === "Neutral";
      });
    }

    if (sortBy === "score-desc") {
      result.sort((a, b) => {
        if (a.score === null && b.score === null) return 0;
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        return b.score - a.score;
      });
    } else if (sortBy === "score-asc") {
      result.sort((a, b) => {
        if (a.score === null && b.score === null) return 0;
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        return a.score - b.score;
      });
    } else {
      result.sort((a, b) => a.asset.localeCompare(b.asset));
    }

    return result;
  }, [assets, biasFilter, sortBy, search]);

  const counts = useMemo(() => {
    const list = assets ?? [];
    const bullish = list.filter(
      (a) => a.bias === "Bullish" || a.bias === "Strong Bullish",
    ).length;
    const bearish = list.filter(
      (a) => a.bias === "Bearish" || a.bias === "Strong Bearish",
    ).length;
    const neutral = list.filter((a) => a.bias === "Neutral").length;
    return { total: list.length, bullish, bearish, neutral };
  }, [assets]);

  if (isLoading) return <LoadingState message="Loading top setups..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!assets || assets.length === 0) return <EmptyState title="No assets available" />;

  return (
    <div className="p-4 sm:p-6 relative">
      {/* Page header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div className="min-w-0">
          <h1
            className="text-xl font-bold mb-1 truncate"
            style={{ color: "#F1F5F9", letterSpacing: "-0.02em" }}
          >
            Top Setups
          </h1>
          <p className="text-sm" style={{ color: "#64748B" }}>
            Fundamental + COT bias across all tracked assets
          </p>
        </div>
        <div className="sm:text-right shrink-0">
          <p className="text-xs" style={{ color: "#64748B" }}>
            Last updated: {formatUpdated(assets[0]?.lastUpdated)}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "#334155" }}>
            Updates with each data release
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="glass-card px-4 py-3 mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="label" style={{ color: "#64748B" }}>
            Bias:
          </span>
          {(["All", "Bullish", "Bearish", "Neutral"] as BiasFilter[]).map(
            (f) => (
              <BiasFilterButton
                key={f}
                label={f}
                active={biasFilter === f}
                onClick={() => setBiasFilter(f)}
              />
            ),
          )}
        </div>

        <div className="flex sm:items-center gap-4 flex-col sm:flex-row items-start w-full ">
          <div className="flex items-center gap-2">
            <span className="label" style={{ color: "#64748B" }}>
              Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-xs px-2 py-1.5 rounded-md outline-none cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#94A3B8",
              }}
            >
              <option value="score-desc">Score: High to Low</option>
              <option value="score-asc">Score: Low to High</option>
              <option value="alpha">Alphabetical</option>
            </select>
          </div>

          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded-md w-full sm:w-auto"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Search size={13} style={{ color: "#64748B" }} />
            <input
              type="text"
              placeholder="Filter assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-xs w-28"
              style={{ color: "#F1F5F9" }}
            />
          </div>
        </div>

        <div
          className="flex items-center gap-3 text-[11px]"
          style={{ color: "#64748B" }}
        >
          <span>🟢 Bullish</span>
          <span>🔴 Bearish</span>
          <span>⚪ Neutral</span>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          {
            label: "Total Assets Tracked",
            value: counts.total,
            color: "#F1F5F9",
          },
          { label: "Bullish", value: counts.bullish, color: "#10B981" },
          { label: "Bearish", value: counts.bearish, color: "#EF4444" },
          { label: "Neutral", value: counts.neutral, color: "#64748B" },
        ].map((card) => (
          <div key={card.label} className="glass-card px-4 py-3">
            <p className="label mb-1" style={{ color: "#64748B" }}>
              {card.label}
            </p>
            <p
              className="text-2xl font-bold tabular-nums"
              style={{ color: card.color }}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main table */}
      <div className="glass-card overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm" style={{ color: "#64748B" }}>
              No assets match your current filters.
            </p>
            <button
              onClick={() => {
                setBiasFilter("All");
                setSearch("");
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
              style={{
                background: "rgba(59, 130, 246, 0.15)",
                color: "#60A5FA",
                border: "1px solid rgba(59, 130, 246, 0.3)",
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <table
            className="w-full text-xs"
            style={{ borderCollapse: "separate", borderSpacing: 0 }}
          >
            <thead>
              {/* Group header row */}
              <tr>
                <th colSpan={3} className="px-3 py-2" />
                <th className="px-2 py-2" />
                {columnGroups.map((g) => (
                  <th
                    key={g.label}
                    colSpan={g.span}
                    className="label text-left px-2 py-2"
                    style={{
                      color: g.color,
                      borderBottom: `1px solid ${g.color}33`,
                    }}
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
              {/* Column header row */}
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th className="label text-center px-3 py-2.5 left-0 z-10">
                  ASSET
                </th>
                <th
                  className="label text-center px-2 py-2.5"
                  style={{ color: "#64748B" }}
                >
                  BIAS
                </th>
                <th
                  className="label text-center px-2 py-2.5"
                  style={{ color: "#64748B" }}
                >
                  SCORE
                </th>
                <th
                  className="label text-center px-2 py-2.5"
                  style={{ color: "#64748B" }}
                >
                  COT
                </th>
                {indicatorColumns.map((col) => (
                  <th
                    key={col.key}
                    className="label text-center px-2 py-2.5 whitespace-nowrap"
                    style={{ color: "#64748B" }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                if (row.outcome === "scored") {
                  return (
                    <tr
                      key={row.asset}
                      className="cursor-pointer transition-colors"
                      onClick={() => setSelectedAsset(row)}
                      style={{
                        borderLeft: getRowBorder(row.bias as BiasType),
                        background: "transparent",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(59, 130, 246, 0.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="pl-2">
                            <p
                              className="font-semibold text-[13px]"
                              style={{ color: "#F1F5F9" }}
                            >
                              {row.asset}
                            </p>
                            <p className="text-[10px]" style={{ color: "#64748B" }}>
                              {row.type}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-2 py-2.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${getBiasPillClass(row.bias as BiasType)}`}
                        >
                          {row.bias}
                        </span>
                      </td>

                      <td className="px-2 py-2.5 text-center">
                        <span
                          className="text-base font-bold tabular-nums"
                          style={{ color: getScoreColor(row.score!) }}
                        >
                          {row.score! > 0 ? `+${row.score}` : row.score}
                        </span>
                      </td>

                      <CotCell value={row.cot} />

                      {indicatorColumns.map((col) => (
                        <IndicatorCell
                          key={col.key}
                          value={row[col.key]}
                        />
                      ))}
                    </tr>
                  );
                }

                if (row.outcome === "insufficient_data") {
                  return (
                    <tr
                      key={row.asset}
                      className="cursor-pointer transition-colors"
                      onClick={() => setSelectedAsset(row)}
                      style={{
                        borderLeft: "2px solid transparent",
                        background: "transparent",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(59, 130, 246, 0.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="pl-2">
                            <p
                              className="font-semibold text-[13px]"
                              style={{ color: "#F1F5F9" }}
                            >
                              {row.asset}
                            </p>
                            <p className="text-[10px]" style={{ color: "#64748B" }}>
                              {row.type}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-2 py-2.5 text-center">
                        <span
                          title={row.reason ?? undefined}
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                          style={{
                            background: "rgba(245, 158, 11, 0.15)",
                            color: "#F59E0B",
                            border: "1px solid rgba(245, 158, 11, 0.3)",
                          }}
                        >
                          No data yet
                        </span>
                      </td>

                      <td className="px-2 py-2.5 text-center text-xs" style={{ color: "#334155" }}>—</td>
                      <td className="px-2 py-2.5 text-center text-xs" style={{ color: "#334155" }}>—</td>

                      {indicatorColumns.map((col) => (
                        <td
                          key={col.key}
                          className="px-2 py-2.5 text-center text-xs"
                          style={{ color: "#334155" }}
                        >
                          —
                        </td>
                      ))}
                    </tr>
                  );
                }

                // outcome === "deferred"
                return (
                  <tr
                    key={row.asset}
                    className="cursor-pointer transition-colors"
                    onClick={() => setSelectedAsset(row)}
                    style={{
                      borderLeft: "2px solid transparent",
                      background: "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(59, 130, 246, 0.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {/* Asset name at full opacity */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="pl-2">
                          <p
                            className="font-semibold text-[13px]"
                            style={{ color: "#F1F5F9" }}
                          >
                            {row.asset}
                          </p>
                          <p className="text-[10px]" style={{ color: "#64748B" }}>
                            {row.type}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Grey "Deferred" badge — dimmed */}
                    <td className="px-2 py-2.5 text-center" style={{ opacity: 0.5 }}>
                      <span
                        title={row.reason ?? undefined}
                        className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                        style={{
                          background: "rgba(100, 116, 139, 0.15)",
                          color: "#64748B",
                          border: "1px solid rgba(100, 116, 139, 0.3)",
                        }}
                      >
                        Deferred
                      </span>
                    </td>

                    <td className="px-2 py-2.5 text-center text-xs" style={{ color: "#334155", opacity: 0.5 }}>—</td>
                    <td className="px-2 py-2.5 text-center text-xs" style={{ color: "#334155", opacity: 0.5 }}>—</td>

                    {indicatorColumns.map((col) => (
                      <td
                        key={col.key}
                        className="px-2 py-2.5 text-center text-xs"
                        style={{ color: "#334155", opacity: 0.5 }}
                      >
                        —
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Table footer */}
        {filtered.length > 0 && (
          <div
            className="px-4 py-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-[11px]" style={{ color: "#334155" }}>
              Data sourced from CFTC, FRED, and macro releases. Scores update
              with each economic release.
            </p>
            <p className="text-[11px]" style={{ color: "#334155" }}>
              Last updated: {formatUpdated(assets[0]?.lastUpdated)}
            </p>
          </div>
        )}
      </div>

      {/* Detail sidebar */}
      {selectedAsset && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setSelectedAsset(null)}
          />
          {/* Panel */}
          <div
            className="fixed top-0 right-0 h-full w-full sm:w-95 z-50 p-4 sm:p-6 flex flex-col"
            style={{
              background: "rgba(10, 22, 40, 0.95)",
              backdropFilter: "blur(16px)",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="text-2xl shrink-0 leading-none"
                  style={{
                    fontFamily:
                      "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Twemoji Mozilla', 'EmojiOne Color', 'Android Emoji', sans-serif",
                  }}
                >
                  {selectedAsset.flag}
                </span>
                <div className="min-w-0">
                  <h2
                    className="text-lg font-bold truncate"
                    style={{ color: "#F1F5F9", letterSpacing: "-0.02em" }}
                  >
                    {selectedAsset.asset}
                  </h2>
                  <span className="text-[11px]" style={{ color: "#64748B" }}>
                    {selectedAsset.type}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                className="p-1 rounded-md transition-colors"
                style={{ color: "#64748B" }}
              >
                <X size={18} />
              </button>
            </div>

            <DrawerBody asset={selectedAsset} />
            </div>
        </>
      )}
    </div>
  );
}

/* ─── Drawer body ─── */

function DrawerBody({ asset }: { asset: PublicAssetData }) {
  if (asset.outcome !== "scored") {
    return (
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        <div
          className="glass-card p-4 flex flex-col items-center justify-center gap-3"
          style={
            asset.outcome === "insufficient_data"
              ? { borderColor: "rgba(245, 158, 11, 0.25)", background: "rgba(245, 158, 11, 0.03)" }
              : { borderColor: "rgba(100, 116, 139, 0.25)" }
          }
        >
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={
              asset.outcome === "insufficient_data"
                ? {
                    background: "rgba(245, 158, 11, 0.15)",
                    color: "#F59E0B",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                  }
                : {
                    background: "rgba(100, 116, 139, 0.15)",
                    color: "#64748B",
                    border: "1px solid rgba(100, 116, 139, 0.3)",
                  }
            }
          >
            {asset.outcome === "insufficient_data" ? "Data unavailable" : "Scoring deferred"}
          </span>
          {asset.reason && (
            <p className="text-xs text-center leading-relaxed" style={{ color: "#64748B" }}>
              {asset.reason}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Scored — compute breakdown from row data.
  const subtotals = computeGroupSubtotals(asset);
  const top = topContributors(asset, 3);
  const cotScore = asset.cot;
  const overall = asset.score ?? 0;

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
      {/* Overall score + bias */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="label" style={{ color: "#64748B" }}>Overall Score</span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: getScoreColor(overall) }}>
            {overall > 0 ? `+${overall}` : overall}
          </span>
        </div>
        {asset.bias && (
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getBiasPillClass(asset.bias as BiasType)}`}
          >
            {asset.bias}
          </span>
        )}
      </div>

      {/* Category subtotals */}
      <div className="glass-card p-4">
        <span className="label block mb-3" style={{ color: "#64748B" }}>By Category</span>
        <div className="flex flex-col gap-2">
          {subtotals.map((s) => {
            const v = s.subtotal;
            const color = v > 0 ? "#10B981" : v < 0 ? "#EF4444" : "#64748B";
            return (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: s.color }}>{s.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tabular-nums" style={{ color: "#475569" }}>
                    {s.scoredCount}/{s.total}
                  </span>
                  <span
                    className="text-sm font-semibold tabular-nums w-8 text-right"
                    style={{ color }}
                  >
                    {v > 0 ? `+${v}` : v}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top contributors */}
      {top.length > 0 && (
        <div className="glass-card p-4">
          <span className="label block mb-3" style={{ color: "#64748B" }}>
            Top Contributors
          </span>
          <div className="flex flex-col gap-1.5">
            {top.map((c) => {
              const color = c.value > 0 ? "#10B981" : "#EF4444";
              const bg = c.value > 0 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.10)";
              return (
                <div key={c.key} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#94A3B8" }}>{c.label}</span>
                  <span
                    className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded"
                    style={{ background: bg, color }}
                  >
                    {c.value > 0 ? `+${c.value}` : c.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* COT */}
      {cotScore !== null && (
        <div className="glass-card p-4 flex items-center justify-between">
          <span className="label" style={{ color: "#64748B" }}>COT Score</span>
          <span
            className="text-sm font-semibold tabular-nums px-2 py-0.5 rounded"
            style={{
              background:
                cotScore > 0 ? "rgba(16, 185, 129, 0.15)" : cotScore < 0 ? "rgba(239, 68, 68, 0.10)" : "transparent",
              color: cotScore > 0 ? "#10B981" : cotScore < 0 ? "#EF4444" : "#64748B",
            }}
          >
            {cotScore > 0 ? `+${cotScore}` : cotScore}
          </span>
        </div>
      )}

      {/* Link to full scorecard */}
      <Link
        href={`/oracle/scorecard?asset=${encodeURIComponent(asset.asset)}`}
        className="text-xs font-medium mt-1 self-end flex items-center gap-1"
        style={{ color: "#3B82F6" }}
      >
        View full scorecard →
      </Link>
    </div>
  );
}
