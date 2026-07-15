"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X, Info, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import {
  getBiasPillClass,
  type BiasType,
} from "@/data/assets";
import { useAssets } from "@/hooks/useAssets";
import { useCompass } from "@/hooks/useCompass";
import { useQueries } from "@tanstack/react-query";
import { getScoreHistory, toScoreHistorySubject, type PublicAssetData } from "@/lib/api/oracle";
import { useOracleTools } from "@/components/oracle-tools/OracleToolsProvider";
import { AnimatedNumber } from "@/components/motion";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import { formatUpdated } from "@/lib/format-date";

type BiasFilter = "All" | "Bullish" | "Bearish" | "Neutral";
type SortOption = "score-desc" | "score-asc" | "change-desc" | "alpha";

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
  { label: "ECONOMIC GROWTH", span: 5 },
  { label: "INFLATION", span: 4 },
  { label: "JOBS MARKET", span: 5 },
];

// Indicator → group mapping for drawer subtotals. Mirrors columnGroups spans.
const INDICATOR_GROUPS: { label: string; keys: IndicatorKey[] }[] = [
  { label: "Economic Growth", keys: ["gdp", "pmiM", "pmiS", "retail", "consConf"] },
  { label: "Inflation", keys: ["cpi", "ppi", "pce", "yield"] },
  { label: "Jobs Market", keys: ["nfp", "unemp", "claims", "adp", "jolts"] },
];

const INDICATOR_LABELS: Record<IndicatorKey, string> = {
  gdp: "GDP", pmiM: "Manufacturing PMI", pmiS: "Services PMI",
  retail: "Retail Sales", consConf: "Consumer Confidence",
  cpi: "CPI", ppi: "PPI", pce: "PCE", yield: "Yield",
  nfp: "NFP", unemp: "Unemployment", claims: "Jobless Claims",
  adp: "ADP", jolts: "JOLTS",
};

// Subjects the score-history endpoint serves (assets USD/EUR/GBP/JPY/Gold +
// the 5 FX pairs). Others (SPY/NAS100) have no dated history → no sparkline/delta.
const HISTORY_SUBJECTS = new Set([
  "USD", "EUR", "GBP", "JPY", "Gold",
  "EURUSD", "GBPUSD", "USDJPY", "EURJPY", "GBPJPY",
]);

function scoreColorVar(score: number | null): string {
  if (score === null) return "var(--lucid-ink-3)";
  if (score >= 3) return "var(--lucid-pos)";
  if (score <= -3) return "var(--lucid-neg)";
  return "var(--lucid-ink-2)";
}

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
    return { label: g.label, subtotal, scoredCount, total: g.keys.length };
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

/** Mini sparkline drawn with theme tokens (no hardcoded hex). */
function MiniSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <span className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>—</span>;
  const w = 60, h = 20, pad = 2;
  const cw = w - pad * 2, ch = h - pad * 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * cw;
    const y = pad + ch - ((v - min) / range) * ch;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const first = data[0], last = data[data.length - 1];
  const color = last - first > 0.5 ? "var(--lucid-pos)" : last - first < -0.5 ? "var(--lucid-neg)" : "var(--lucid-ink-3)";
  const lastX = pad + cw, lastY = pad + ch - ((last - min) / range) * ch;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="inline-block align-middle">
      <path d={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  );
}

function DeltaArrow({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) {
    return <span className="text-[10px] lt-num" style={{ color: "var(--lucid-ink-3)" }}>{delta === 0 ? "0" : "—"}</span>;
  }
  const Icon = delta > 0 ? ArrowUpRight : ArrowDownRight;
  const color = delta > 0 ? "var(--lucid-pos)" : "var(--lucid-neg)";
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold lt-num" style={{ color }}>
      <Icon size={12} />
      {delta > 0 ? `+${delta}` : delta}
    </span>
  );
}

function IndicatorCell({ value }: { value: number | null }) {
  if (value === null) {
    return <td className="px-2 py-2.5 text-center text-xs" style={{ color: "var(--lucid-ink-3)" }}>—</td>;
  }
  if (value === 0) {
    return <td className="px-2 py-2.5 text-center text-xs font-semibold lt-num" style={{ color: "var(--lucid-ink-3)" }}>0</td>;
  }
  const isPositive = value > 0;
  return (
    <td
      className="px-2 py-2.5 text-center text-xs font-semibold lt-num"
      style={{
        background: isPositive ? "var(--lucid-pos-bg)" : "var(--lucid-neg-bg)",
        color: isPositive ? "var(--lucid-pos)" : "var(--lucid-neg)",
      }}
    >
      {isPositive ? "+1" : "-1"}
    </td>
  );
}

function CotCell({ value }: { value: number | null }) {
  if (value === null) {
    return <td className="px-2 py-2.5 text-center text-xs" style={{ color: "var(--lucid-ink-3)" }}>—</td>;
  }
  const color = value > 0 ? "var(--lucid-pos)" : value < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)";
  const bg = value > 0 ? "var(--lucid-pos-bg)" : value < 0 ? "var(--lucid-neg-bg)" : "transparent";
  return (
    <td className="px-2 py-2.5 text-center text-xs font-semibold lt-num" style={{ color, background: bg }}>
      {value > 0 ? `+${value}` : value}
    </td>
  );
}

function BiasFilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
      style={{
        background: active ? "var(--lucid-accent-bg)" : "var(--lucid-surface-3)",
        color: active ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
        border: active ? "1px solid var(--lucid-accent-bd)" : "1px solid var(--lucid-line)",
      }}
    >
      {label}
    </button>
  );
}

function getRowBorder(bias: BiasType | null) {
  if (bias === "Strong Bullish") return "2px solid var(--lucid-pos-bd)";
  if (bias === "Strong Bearish") return "2px solid var(--lucid-neg-bd)";
  return "2px solid transparent";
}

interface Enriched {
  history: number[] | null;
  delta: number | null;
}

export default function TopSetupsPage() {
  const [biasFilter, setBiasFilter] = useState<BiasFilter>("All");
  const [sortBy, setSortBy] = useState<SortOption>("score-desc");
  const [search, setSearch] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<PublicAssetData | null>(null);

  const { data: assets, isLoading, error, refetch } = useAssets();
  const { data: compass } = useCompass();
  const { openScoreTrend } = useOracleTools();

  // Enrich with real dated score history (sparkline + delta + movers) for the
  // subjects the score-history endpoint serves. No prior-score field exists on
  // the assets payload, so this is the honest source — assets without history
  // (SPY/NAS100) simply render without a sparkline/delta.
  const historySubjects = useMemo(
    () => (assets ?? []).map((a) => a.asset).filter((s) => HISTORY_SUBJECTS.has(toScoreHistorySubject(s))),
    [assets],
  );

  const historyQueries = useQueries({
    queries: historySubjects.map((subject) => ({
      queryKey: ["oracle", "score-history", subject, "6M"],
      queryFn: () => getScoreHistory(subject, "6M" as const),
      staleTime: 10 * 60 * 1000,
    })),
  });

  // Stable signal that changes whenever any history query resolves/updates.
  const historySignature = historyQueries.map((q) => q.dataUpdatedAt).join(",");

  const enrichedBySubject = useMemo(() => {
    const map = new Map<string, Enriched>();
    historySubjects.forEach((subject, i) => {
      const q = historyQueries[i];
      const pts = q.data?.points ?? [];
      if (pts.length === 0) {
        map.set(subject, { history: null, delta: null });
        return;
      }
      const history = pts.map((p) => p.totalScore);
      const delta = pts.length > 1 ? history[history.length - 1] - history[history.length - 2] : null;
      map.set(subject, { history, delta });
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySubjects, historySignature]);

  // Movers: biggest score change since prior reading, from real dated history.
  const movers = useMemo(() => {
    const rows: { asset: string; flag: string; delta: number; score: number | null }[] = [];
    for (const a of assets ?? []) {
      const e = enrichedBySubject.get(a.asset);
      if (e?.delta != null && e.delta !== 0) {
        rows.push({ asset: a.asset, flag: a.flag, delta: e.delta, score: a.score });
      }
    }
    rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    return rows.slice(0, 5);
  }, [assets, enrichedBySubject]);

  // Regime line: current Compass regime + how many scored subjects align with it.
  const regime = useMemo(() => {
    if (!compass) return null;
    const active = compass.current.activeRegime;
    // Regime tilt: Risk-On favours bullish scores, Risk-Off favours bearish.
    const rows = compass.scoreImpact ?? [];
    let aligned = 0;
    for (const r of rows) {
      if (active === "Risk-On" && r.finalScore > 0) aligned += 1;
      else if (active === "Risk-Off" && r.finalScore < 0) aligned += 1;
      else if (active === "Caution" && r.finalScore === 0) aligned += 1;
    }
    return { active, aligned, total: rows.length };
  }, [compass]);

  const filtered = useMemo(() => {
    const list = assets ?? [];
    let result = [...list];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.asset.toLowerCase().includes(q));
    }

    if (biasFilter !== "All") {
      result = result.filter((a) => {
        if (biasFilter === "Bullish") return a.bias === "Bullish" || a.bias === "Strong Bullish";
        if (biasFilter === "Bearish") return a.bias === "Bearish" || a.bias === "Strong Bearish";
        return a.bias === "Neutral";
      });
    }

    const scoreCmp = (a: PublicAssetData, b: PublicAssetData, dir: 1 | -1) => {
      if (a.score === null && b.score === null) return 0;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return dir * (b.score - a.score);
    };

    if (sortBy === "score-desc") result.sort((a, b) => scoreCmp(a, b, 1));
    else if (sortBy === "score-asc") result.sort((a, b) => scoreCmp(a, b, -1));
    else if (sortBy === "change-desc") {
      result.sort((a, b) => {
        const da = Math.abs(enrichedBySubject.get(a.asset)?.delta ?? 0);
        const db = Math.abs(enrichedBySubject.get(b.asset)?.delta ?? 0);
        return db - da;
      });
    } else result.sort((a, b) => a.asset.localeCompare(b.asset));

    return result;
  }, [assets, biasFilter, sortBy, search, enrichedBySubject]);

  const counts = useMemo(() => {
    const list = assets ?? [];
    const bullish = list.filter((a) => a.bias === "Bullish" || a.bias === "Strong Bullish").length;
    const bearish = list.filter((a) => a.bias === "Bearish" || a.bias === "Strong Bearish").length;
    const neutral = list.filter((a) => a.bias === "Neutral").length;
    return { total: list.length, bullish, bearish, neutral };
  }, [assets]);

  if (isLoading) return <LoadingState stages={["Scanning markets…", "Ranking setups…", "Surfacing movers…"]} />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!assets || assets.length === 0) return <EmptyState title="No assets available" />;

  return (
    <div className="p-4 sm:p-6 relative">
      {/* Page header */}
      <div className="lt-rise lt-stagger-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div className="min-w-0">
          <h1 className="lt-serif text-xl font-semibold mb-1 truncate" style={{ color: "var(--lucid-ink)" }}>
            Top Setups
          </h1>
          <p className="text-sm" style={{ color: "var(--lucid-ink-3)" }}>
            Fundamental + COT bias across all tracked assets
          </p>
        </div>
        <div className="sm:text-right shrink-0">
          <p className="text-xs lt-num" style={{ color: "var(--lucid-ink-3)" }}>
            Last updated: {formatUpdated(assets[0]?.lastUpdated)}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>
            Updates with each data release
          </p>
        </div>
      </div>

      {/* ── MOVERS STRIP ── */}
      <div
        className="lt-card lt-edge lt-rise lt-stagger-2 px-4 py-3 mb-3"
        style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="lt-eyebrow shrink-0">
            <TrendingUp size={12} style={{ display: "inline", marginRight: 6 }} />
            Movers
          </span>
          {movers.length === 0 ? (
            <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
              No score changes vs prior reading.
            </span>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {movers.map((m) => {
                const firmed = m.delta > 0;
                const flipped = m.score !== null && ((m.delta > 0 && m.score >= 3) || (m.delta < 0 && m.score <= -3));
                const verb = flipped ? (firmed ? "flipped ↑" : "flipped ↓") : firmed ? "firmed" : "weakened";
                const color = firmed ? "var(--lucid-pos)" : "var(--lucid-neg)";
                return (
                  <button
                    key={m.asset}
                    onClick={() => openScoreTrend(m.asset)}
                    className="lt-hover inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs"
                    style={{ background: "var(--lucid-surface-3)", border: "1px solid var(--lucid-line)" }}
                    title={`Open Score Trend for ${m.asset}`}
                  >
                    <span>{m.flag}</span>
                    <span className="font-semibold" style={{ color: "var(--lucid-ink)" }}>{m.asset}</span>
                    <span style={{ color }}>{verb}</span>
                    <span className="lt-num" style={{ color }}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── REGIME LINE ── */}
      {regime && (
        <div className="lt-card lt-rise lt-stagger-3 px-4 py-2.5 mb-4 flex items-center gap-3 flex-wrap">
          <span className="lt-eyebrow shrink-0">Regime</span>
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{
              background:
                regime.active === "Risk-On" ? "var(--lucid-pos-bg)" : regime.active === "Risk-Off" ? "var(--lucid-neg-bg)" : "var(--lucid-warn-bg)",
              color:
                regime.active === "Risk-On" ? "var(--lucid-pos)" : regime.active === "Risk-Off" ? "var(--lucid-neg)" : "var(--lucid-warn)",
              border: `1px solid ${regime.active === "Risk-On" ? "var(--lucid-pos-bd)" : regime.active === "Risk-Off" ? "var(--lucid-neg-bd)" : "var(--lucid-warn-bd)"}`,
            }}
          >
            {regime.active}
          </span>
          <span className="text-xs" style={{ color: "var(--lucid-ink-2)" }}>
            <span className="lt-num" style={{ color: "var(--lucid-ink)" }}>{regime.aligned}</span>
            {" of "}
            <span className="lt-num" style={{ color: "var(--lucid-ink)" }}>{regime.total}</span>
            {" subjects align with the current regime"}
          </span>
          <Link href="/oracle/compass" className="text-xs ml-auto" style={{ color: "var(--lucid-accent)" }}>
            Compass →
          </Link>
        </div>
      )}

      {/* Filter bar */}
      <div className="lt-card lt-rise lt-stagger-3 px-4 py-3 mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="lt-eyebrow">Bias</span>
          {(["All", "Bullish", "Bearish", "Neutral"] as BiasFilter[]).map((f) => (
            <BiasFilterButton key={f} label={f} active={biasFilter === f} onClick={() => setBiasFilter(f)} />
          ))}
        </div>

        <div className="flex sm:items-center gap-4 flex-col sm:flex-row items-start">
          <div className="flex items-center gap-2">
            <span className="lt-eyebrow">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-xs px-2 py-1.5 rounded-md outline-none cursor-pointer"
              style={{ background: "var(--lucid-surface-3)", border: "1px solid var(--lucid-line)", color: "var(--lucid-ink-2)" }}
            >
              <option value="score-desc">Score: High to Low</option>
              <option value="score-asc">Score: Low to High</option>
              <option value="change-desc">Biggest change</option>
              <option value="alpha">Alphabetical</option>
            </select>
          </div>

          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded-md w-full sm:w-auto"
            style={{ background: "var(--lucid-surface-3)", border: "1px solid var(--lucid-line)" }}
          >
            <Search size={13} style={{ color: "var(--lucid-ink-3)" }} />
            <input
              type="text"
              placeholder="Filter assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-xs w-28"
              style={{ color: "var(--lucid-ink)" }}
            />
          </div>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="lt-rise lt-stagger-4 grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Assets Tracked", value: counts.total, color: "var(--lucid-ink)" },
          { label: "Bullish", value: counts.bullish, color: "var(--lucid-pos)" },
          { label: "Bearish", value: counts.bearish, color: "var(--lucid-neg)" },
          { label: "Neutral", value: counts.neutral, color: "var(--lucid-ink-2)" },
        ].map((card) => (
          <div key={card.label} className="lt-metric px-4 py-3">
            <p className="lt-eyebrow mb-1">{card.label}</p>
            <p className="lt-num text-2xl font-semibold" style={{ color: card.color }}>
              <AnimatedNumber value={card.value} format={(n) => `${Math.round(n)}`} />
            </p>
          </div>
        ))}
      </div>

      {/* Main table */}
      <div
        className="lt-card lt-rise lt-stagger-5 overflow-x-auto"
        style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm" style={{ color: "var(--lucid-ink-3)" }}>No assets match your current filters.</p>
            <button
              onClick={() => { setBiasFilter("All"); setSearch(""); }}
              className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
              style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "1px solid var(--lucid-accent-bd)" }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <table className="w-full text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              {/* Group header row */}
              <tr>
                <th colSpan={5} className="px-3 py-2" />
                {columnGroups.map((g) => (
                  <th
                    key={g.label}
                    colSpan={g.span}
                    className="lt-eyebrow text-left px-2 py-2"
                    style={{ borderBottom: "1px solid var(--lucid-line)" }}
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
              {/* Column header row */}
              <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
                <th className="lt-eyebrow text-left px-3 py-2.5">Asset</th>
                <th className="lt-eyebrow text-center px-2 py-2.5">Trend</th>
                <th className="lt-eyebrow text-center px-2 py-2.5">Bias</th>
                <th className="lt-eyebrow text-center px-2 py-2.5">Score</th>
                <th className="lt-eyebrow text-center px-2 py-2.5">COT</th>
                {indicatorColumns.map((col) => (
                  <th key={col.key} className="lt-eyebrow text-center px-2 py-2.5 whitespace-nowrap">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const enriched = enrichedBySubject.get(row.asset);
                const clickable = row.outcome === "scored";
                const dimmed = row.outcome === "deferred";
                return (
                  <tr
                    key={row.asset}
                    className={clickable ? "cursor-pointer transition-colors" : "transition-colors"}
                    onClick={clickable ? () => openScoreTrend(row.asset) : undefined}
                    style={{ borderLeft: getRowBorder(row.bias as BiasType), background: "transparent" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--lucid-surface-2)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    {/* Asset + info (info opens the detail drawer without opening the tool) */}
                    <td className="px-3 py-2.5" style={dimmed ? { opacity: 0.55 } : undefined}>
                      <div className="flex items-center gap-2 pl-1">
                        <div className="min-w-0">
                          <p className="font-semibold text-[13px]" style={{ color: "var(--lucid-ink)" }}>{row.asset}</p>
                          <p className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>{row.type}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedAsset(row); }}
                          className="p-1 rounded transition-colors shrink-0"
                          style={{ color: "var(--lucid-ink-3)" }}
                          title="Quick details"
                        >
                          <Info size={12} />
                        </button>
                      </div>
                    </td>

                    {/* Trend: sparkline + delta (real dated history) */}
                    <td className="px-2 py-2.5 text-center" style={dimmed ? { opacity: 0.55 } : undefined}>
                      {enriched?.history ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <MiniSparkline data={enriched.history} />
                          <DeltaArrow delta={enriched.delta} />
                        </div>
                      ) : (
                        <span className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>—</span>
                      )}
                    </td>

                    {/* Bias */}
                    <td className="px-2 py-2.5 text-center" style={dimmed ? { opacity: 0.55 } : undefined}>
                      {row.outcome === "scored" && row.bias ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${getBiasPillClass(row.bias as BiasType)}`}>
                          {row.bias}
                        </span>
                      ) : row.outcome === "insufficient_data" ? (
                        <span
                          title={row.reason ?? undefined}
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                          style={{ background: "var(--lucid-warn-bg)", color: "var(--lucid-warn)", border: "1px solid var(--lucid-warn-bd)" }}
                        >
                          No data yet
                        </span>
                      ) : (
                        <span
                          title={row.reason ?? undefined}
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
                          style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-3)", border: "1px solid var(--lucid-line-2)" }}
                        >
                          Deferred
                        </span>
                      )}
                    </td>

                    {/* Score */}
                    <td className="px-2 py-2.5 text-center" style={dimmed ? { opacity: 0.55 } : undefined}>
                      {row.outcome === "scored" && row.score !== null ? (
                        <span className="lt-num text-base font-semibold" style={{ color: scoreColorVar(row.score) }}>
                          {row.score > 0 ? `+${row.score}` : row.score}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>—</span>
                      )}
                    </td>

                    {row.outcome === "scored" ? (
                      <>
                        <CotCell value={row.cot} />
                        {indicatorColumns.map((col) => (
                          <IndicatorCell key={col.key} value={row[col.key]} />
                        ))}
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-2.5 text-center text-xs" style={{ color: "var(--lucid-ink-3)", opacity: dimmed ? 0.55 : 1 }}>—</td>
                        {indicatorColumns.map((col) => (
                          <td key={col.key} className="px-2 py-2.5 text-center text-xs" style={{ color: "var(--lucid-ink-3)", opacity: dimmed ? 0.55 : 1 }}>—</td>
                        ))}
                      </>
                    )}
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
            style={{ borderTop: "1px solid var(--lucid-line)" }}
          >
            <p className="text-[11px]" style={{ color: "var(--lucid-ink-3)" }}>
              Row click opens Score Trend. Data sourced from CFTC, FRED, and macro releases.
            </p>
            <p className="text-[11px] lt-num" style={{ color: "var(--lucid-ink-3)" }}>
              Last updated: {formatUpdated(assets[0]?.lastUpdated)}
            </p>
          </div>
        )}
      </div>

      {/* Detail sidebar (opened via the info button — quick glance without leaving the page) */}
      {selectedAsset && (
        <>
          <div className="lt-fade-in fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setSelectedAsset(null)} />
          <div
            className="drawer-enter fixed top-0 right-0 h-full w-full sm:w-95 z-50 p-4 sm:p-6 flex flex-col"
            style={{ background: "var(--lucid-surface-2)", borderLeft: "1px solid var(--lucid-line)" }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl shrink-0 leading-none">{selectedAsset.flag}</span>
                <div className="min-w-0">
                  <h2 className="lt-serif text-lg font-semibold truncate" style={{ color: "var(--lucid-ink)" }}>{selectedAsset.asset}</h2>
                  <span className="text-[11px]" style={{ color: "var(--lucid-ink-3)" }}>{selectedAsset.type}</span>
                </div>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="p-1 rounded-md transition-colors" style={{ color: "var(--lucid-ink-3)" }}>
                <X size={18} />
              </button>
            </div>
            <DrawerBody asset={selectedAsset} onOpenTrend={() => { openScoreTrend(selectedAsset.asset); setSelectedAsset(null); }} />
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Drawer body ─── */

function DrawerBody({ asset, onOpenTrend }: { asset: PublicAssetData; onOpenTrend: () => void }) {
  if (asset.outcome !== "scored") {
    return (
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        <div
          className="lt-card p-4 flex flex-col items-center justify-center gap-3"
          style={
            asset.outcome === "insufficient_data"
              ? { borderColor: "var(--lucid-warn-bd)" }
              : { borderColor: "var(--lucid-line-2)" }
          }
        >
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={
              asset.outcome === "insufficient_data"
                ? { background: "var(--lucid-warn-bg)", color: "var(--lucid-warn)", border: "1px solid var(--lucid-warn-bd)" }
                : { background: "var(--lucid-surface-3)", color: "var(--lucid-ink-3)", border: "1px solid var(--lucid-line-2)" }
            }
          >
            {asset.outcome === "insufficient_data" ? "Data unavailable" : "Scoring deferred"}
          </span>
          {asset.reason && (
            <p className="text-xs text-center leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>{asset.reason}</p>
          )}
        </div>
      </div>
    );
  }

  const subtotals = computeGroupSubtotals(asset);
  const top = topContributors(asset, 3);
  const cotScore = asset.cot;
  const overall = asset.score ?? 0;

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
      {/* Overall score + bias */}
      <div className="lt-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="lt-eyebrow">Overall Score</span>
          <span className="lt-num text-2xl font-semibold" style={{ color: scoreColorVar(overall) }}>
            {overall > 0 ? `+${overall}` : overall}
          </span>
        </div>
        {asset.bias && (
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getBiasPillClass(asset.bias as BiasType)}`}>
            {asset.bias}
          </span>
        )}
      </div>

      {/* Category subtotals */}
      <div className="lt-card p-4">
        <span className="lt-eyebrow block mb-3">By Category</span>
        <div className="flex flex-col gap-2">
          {subtotals.map((s) => {
            const v = s.subtotal;
            const color = v > 0 ? "var(--lucid-pos)" : v < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)";
            return (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--lucid-ink-2)" }}>{s.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] lt-num" style={{ color: "var(--lucid-ink-3)" }}>{s.scoredCount}/{s.total}</span>
                  <span className="text-sm font-semibold lt-num w-8 text-right" style={{ color }}>{v > 0 ? `+${v}` : v}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top contributors */}
      {top.length > 0 && (
        <div className="lt-card p-4">
          <span className="lt-eyebrow block mb-3">Top Contributors</span>
          <div className="flex flex-col gap-1.5">
            {top.map((c) => {
              const color = c.value > 0 ? "var(--lucid-pos)" : "var(--lucid-neg)";
              const bg = c.value > 0 ? "var(--lucid-pos-bg)" : "var(--lucid-neg-bg)";
              return (
                <div key={c.key} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--lucid-ink-2)" }}>{c.label}</span>
                  <span className="text-[11px] font-semibold lt-num px-1.5 py-0.5 rounded" style={{ background: bg, color }}>
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
        <div className="lt-card p-4 flex items-center justify-between">
          <span className="lt-eyebrow">COT Score</span>
          <span
            className="text-sm font-semibold lt-num px-2 py-0.5 rounded"
            style={{
              background: cotScore > 0 ? "var(--lucid-pos-bg)" : cotScore < 0 ? "var(--lucid-neg-bg)" : "transparent",
              color: cotScore > 0 ? "var(--lucid-pos)" : cotScore < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)",
            }}
          >
            {cotScore > 0 ? `+${cotScore}` : cotScore}
          </span>
        </div>
      )}

      {/* Actions */}
      <button
        onClick={onOpenTrend}
        className="text-xs font-medium mt-1 self-end flex items-center gap-1"
        style={{ color: "var(--lucid-accent)" }}
      >
        Open Score Trend →
      </button>
      <Link
        href={`/oracle/scorecard?asset=${encodeURIComponent(asset.asset)}`}
        className="text-xs font-medium self-end flex items-center gap-1"
        style={{ color: "var(--lucid-ink-2)" }}
      >
        View full scorecard →
      </Link>
    </div>
  );
}
