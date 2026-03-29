"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import {
  demoAssets,
  getBiasColor,
  getScoreColor,
  getBiasPillClass,
  type AssetData,
  type IndicatorValue,
  type BiasType,
} from "@/data/assets";

type BiasFilter = "All" | "Bullish" | "Bearish" | "Neutral";
type SortOption = "score-desc" | "score-asc" | "alpha";

const indicatorColumns: { key: keyof AssetData; label: string }[] = [
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

function IndicatorCell({ value }: { value: IndicatorValue }) {
  if (value === null) {
    return (
      <td className="px-2 py-2.5 text-center text-xs" style={{ color: "#334155" }}>
        N/A
      </td>
    );
  }
  if (value === 0) {
    return (
      <td className="px-2 py-2.5 text-center text-xs font-semibold tabular-nums" style={{ color: "#334155" }}>
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

function CotCell({ value }: { value: number }) {
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
        background: active ? "rgba(59, 130, 246, 0.15)" : "rgba(255,255,255,0.03)",
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

export default function TopSetupsPage() {
  const [biasFilter, setBiasFilter] = useState<BiasFilter>("All");
  const [sortBy, setSortBy] = useState<SortOption>("score-desc");
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<AssetData | null>(null);

  const filtered = useMemo(() => {
    let result = [...demoAssets];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.asset.toLowerCase().includes(q));
    }

    // Bias filter
    if (biasFilter !== "All") {
      result = result.filter((a) => {
        if (biasFilter === "Bullish")
          return a.bias === "Bullish" || a.bias === "Strong Bullish";
        if (biasFilter === "Bearish")
          return a.bias === "Bearish" || a.bias === "Strong Bearish";
        return a.bias === "Neutral";
      });
    }

    // Sort
    if (sortBy === "score-desc") result.sort((a, b) => b.score - a.score);
    else if (sortBy === "score-asc") result.sort((a, b) => a.score - b.score);
    else result.sort((a, b) => a.asset.localeCompare(b.asset));

    return result;
  }, [biasFilter, sortBy, search]);

  const counts = useMemo(() => {
    const bullish = demoAssets.filter(
      (a) => a.bias === "Bullish" || a.bias === "Strong Bullish"
    ).length;
    const bearish = demoAssets.filter(
      (a) => a.bias === "Bearish" || a.bias === "Strong Bearish"
    ).length;
    const neutral = demoAssets.filter((a) => a.bias === "Neutral").length;
    return { total: demoAssets.length, bullish, bearish, neutral };
  }, []);

  function getRowBorder(bias: BiasType) {
    if (bias === "Strong Bullish") return "2px solid rgba(16, 185, 129, 0.5)";
    if (bias === "Strong Bearish") return "2px solid rgba(239, 68, 68, 0.5)";
    return "2px solid transparent";
  }

  return (
    <div className="p-6 relative">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="text-xl font-bold mb-1"
            style={{ color: "#F1F5F9", letterSpacing: "-0.02em" }}
          >
            Top Setups
          </h1>
          <p className="text-sm" style={{ color: "#64748B" }}>
            Fundamental + COT bias across all tracked assets
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: "#64748B" }}>
            Last updated: March 29, 2026 — 14:32 IST
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
            )
          )}
        </div>

        <div className="flex items-center gap-4">
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
            className="flex items-center gap-2 px-2 py-1.5 rounded-md"
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

        <div className="flex items-center gap-3 text-[11px]" style={{ color: "#64748B" }}>
          <span>🟢 Bullish</span>
          <span>🔴 Bearish</span>
          <span>⚪ Neutral</span>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Assets Tracked", value: counts.total, color: "#F1F5F9" },
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
          <table className="w-full text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
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
                <th
                  className="label text-left px-3 py-2.5 sticky left-0 z-10"
                  style={{ color: "#64748B", background: "rgba(2,8,23,0.95)" }}
                >
                  ASSET
                </th>
                <th className="label text-center px-2 py-2.5" style={{ color: "#64748B" }}>
                  BIAS
                </th>
                <th className="label text-center px-2 py-2.5" style={{ color: "#64748B" }}>
                  SCORE
                </th>
                <th className="label text-center px-2 py-2.5" style={{ color: "#64748B" }}>
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
              {filtered.map((asset, idx) => (
                <tr
                  key={asset.asset}
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedAsset(asset)}
                  style={{
                    borderLeft: getRowBorder(asset.bias),
                    background:
                      idx % 2 === 1 ? "rgba(255,255,255,0.01)" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(59, 130, 246, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      idx % 2 === 1 ? "rgba(255,255,255,0.01)" : "transparent";
                  }}
                >
                  {/* Asset */}
                  <td
                    className="px-3 py-2.5 sticky left-0 z-10"
                    style={{ background: "rgba(2,8,23,0.95)" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{asset.flag}</span>
                      <div>
                        <p
                          className="font-semibold text-[13px]"
                          style={{ color: "#F1F5F9" }}
                        >
                          {asset.asset}
                        </p>
                        <p className="text-[10px]" style={{ color: "#64748B" }}>
                          {asset.type}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Bias pill */}
                  <td className="px-2 py-2.5 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${getBiasPillClass(asset.bias)}`}
                    >
                      {asset.bias}
                    </span>
                  </td>

                  {/* Score */}
                  <td className="px-2 py-2.5 text-center">
                    <span
                      className="text-base font-bold tabular-nums"
                      style={{ color: getScoreColor(asset.score) }}
                    >
                      {asset.score > 0 ? `+${asset.score}` : asset.score}
                    </span>
                  </td>

                  {/* COT */}
                  <CotCell value={asset.cot} />

                  {/* Indicator columns */}
                  {indicatorColumns.map((col) => (
                    <IndicatorCell
                      key={col.key}
                      value={asset[col.key] as IndicatorValue}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Table footer */}
        {filtered.length > 0 && (
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-[11px]" style={{ color: "#334155" }}>
              Data sourced from CFTC, FRED, and macro releases. Scores update
              with each economic release.
            </p>
            <p className="text-[11px]" style={{ color: "#334155" }}>
              Last updated: March 29, 2026 — 14:32 IST
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
            className="fixed top-0 right-0 h-full w-[380px] z-50 p-6 flex flex-col"
            style={{
              background: "rgba(10, 22, 40, 0.95)",
              backdropFilter: "blur(16px)",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedAsset.flag}</span>
                <div>
                  <h2
                    className="text-lg font-bold"
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

            <div className="glass-card p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="label" style={{ color: "#64748B" }}>
                  Overall Score
                </span>
                <span
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: getScoreColor(selectedAsset.score) }}
                >
                  {selectedAsset.score > 0
                    ? `+${selectedAsset.score}`
                    : selectedAsset.score}
                </span>
              </div>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getBiasPillClass(selectedAsset.bias)}`}
              >
                {selectedAsset.bias}
              </span>
            </div>

            <div className="glass-card p-4 flex-1 flex items-center justify-center">
              <p className="text-sm text-center" style={{ color: "#64748B" }}>
                Full scorecard coming in Asset Scorecard tab
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
