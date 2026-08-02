"use client";

import { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { formatCurrency, type Trade } from "@/lib/demo-data";
import { useTrades, useAccounts } from "@/hooks/useTrading";
import { Skeleton, SkeletonCard } from "@/components/state/Skeleton";
import { ErrorState } from "@/components/state/ErrorState";

// ─────────────────────────────────────────────────────────────────────────────
// Analytics — the trader's review process. blended_pnl (manual net P&L) is the
// SINGLE source of truth for every win/loss/BE and every aggregate here:
//   pnl  > 0 → Win     pnl < 0 → Loss     pnl === 0 → Break-even
// blended_rr survives only as a DISPLAY metric (the average R multiple).
// ─────────────────────────────────────────────────────────────────────────────

type DateRangePreset =
  | "Last 7 days"
  | "Last 30 days"
  | "Last 90 days"
  | "Year to Date"
  | "All Time";

/** Optional per-trade mistakes / rule-violation tag. Not yet on the Trade model;
 *  read defensively so the rule-violation view lights up the moment it exists. */
function tradeMistakes(t: Trade): string[] {
  const m = (t as unknown as { mistakes?: unknown }).mistakes;
  if (Array.isArray(m)) return m.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  if (typeof m === "string" && m.trim() !== "") return [m.trim()];
  return [];
}

// ─── Formatting helpers ────────────────────────────────────────────────────────

/** formatCurrency already prefixes "-" for negatives; add "+" for non-negatives. */
function signedCurrency(v: number): string {
  return (v >= 0 ? "+" : "") + formatCurrency(v);
}

function pctText(v: number | null): string {
  return v === null ? "—" : `${(v * 100).toFixed(1)}%`;
}

function pnlColorVar(v: number): string {
  return v > 0 ? "var(--lucid-pos)" : v < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
}

// ─── Filter ─────────────────────────────────────────────────────────────────

function applyDateFilter(tradeList: Trade[], preset: DateRangePreset): Trade[] {
  if (preset === "All Time") return tradeList;
  const now = new Date();
  let cutoff: Date;
  switch (preset) {
    case "Last 7 days":
      cutoff = new Date(now.getTime() - 7 * 864e5);
      break;
    case "Last 30 days":
      cutoff = new Date(now.getTime() - 30 * 864e5);
      break;
    case "Last 90 days":
      cutoff = new Date(now.getTime() - 90 * 864e5);
      break;
    case "Year to Date":
      cutoff = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return tradeList;
  }
  return tradeList.filter((t) => {
    const date = t.date_closed ? new Date(t.date_closed) : new Date(t.date_opened);
    return date >= cutoff;
  });
}

// ─── Core aggregate (the same math every table + headline reuses) ─────────────

interface Agg {
  count: number;      // closed trades
  wins: number;
  losses: number;
  be: number;
  winRate: number | null;   // wins / (wins + losses), BE excluded; null if none decided
  netPnl: number;
  avgWin: number;           // mean P&L of winners (>= 0)
  avgLoss: number;          // mean |P&L| of losers (>= 0)
  expectancy: number | null;// (WR × avgWin) − (LR × avgLoss); null if no decided trades
  avgRR: number | null;     // display: mean blended_rr over winners; null if none
}

/** Expectancy uses the classic decomposition, consistent everywhere:
 *  E = (winRate × avgWin) − (lossRate × avgLoss), lossRate = 1 − winRate.
 *  (Equivalent to netPnl / decidedCount, but kept in decomposed form so the
 *  headline can also surface avgWin / avgLoss from the same source.) */
function aggregate(trades: Trade[]): Agg {
  const closed = trades.filter((t) => t.date_closed !== "");
  const winTrades = closed.filter((t) => t.blended_pnl > 0);
  const lossTrades = closed.filter((t) => t.blended_pnl < 0);
  const be = closed.length - winTrades.length - lossTrades.length;

  const decided = winTrades.length + lossTrades.length;
  const winRate = decided > 0 ? winTrades.length / decided : null;

  const netPnl = closed.reduce((s, t) => s + t.blended_pnl, 0);
  const avgWin = winTrades.length > 0 ? winTrades.reduce((s, t) => s + t.blended_pnl, 0) / winTrades.length : 0;
  const avgLoss =
    lossTrades.length > 0 ? Math.abs(lossTrades.reduce((s, t) => s + t.blended_pnl, 0) / lossTrades.length) : 0;

  const expectancy = winRate === null ? null : winRate * avgWin - (1 - winRate) * avgLoss;

  const rrWinners = winTrades.filter((t) => Number.isFinite(t.blended_rr));
  const avgRR = rrWinners.length > 0 ? rrWinners.reduce((s, t) => s + t.blended_rr, 0) / rrWinners.length : null;

  return {
    count: closed.length,
    wins: winTrades.length,
    losses: lossTrades.length,
    be,
    winRate,
    netPnl,
    avgWin,
    avgLoss,
    expectancy,
    avgRR,
  };
}

// ─── Equity curve ─────────────────────────────────────────────────────────────

interface CurvePoint {
  date: string;
  cumPnl: number;
  pair: string;
  pnl: number;
}

function buildEquityCurve(closed: Trade[]): CurvePoint[] {
  const sorted = [...closed].sort(
    (a, b) => new Date(a.date_closed).getTime() - new Date(b.date_closed).getTime(),
  );
  const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const points: CurvePoint[] = [];
  let cum = 0;
  for (const t of sorted) {
    cum += t.blended_pnl;
    points.push({ date: fmt(t.date_closed), cumPnl: Math.round(cum * 100) / 100, pair: t.pair, pnl: t.blended_pnl });
  }
  return points;
}

/** Contiguous windows where equity sits below its running peak (drawdown). */
function computeDrawdownWindows(pts: CurvePoint[]): { x1: string; x2: string }[] {
  const windows: { x1: string; x2: string }[] = [];
  let peak = -Infinity;
  let inDD = false;
  let ddStartIdx = 0;
  for (let i = 0; i < pts.length; i++) {
    const v = pts[i].cumPnl;
    if (v > peak) {
      if (inDD) {
        windows.push({ x1: pts[ddStartIdx].date, x2: pts[i - 1].date });
        inDD = false;
      }
      peak = v;
    } else if (v < peak && !inDD) {
      inDD = true;
      ddStartIdx = i - 1 >= 0 ? i - 1 : 0;
    }
  }
  if (inDD && pts.length > 0) windows.push({ x1: pts[ddStartIdx].date, x2: pts[pts.length - 1].date });
  return windows;
}

function computeMaxDrawdown(pts: CurvePoint[]): number {
  let peak = -Infinity;
  let maxDD = 0;
  for (const p of pts) {
    if (p.cumPnl > peak) peak = p.cumPnl;
    const dd = peak - p.cumPnl;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

// ─── Breakdown dimensions ──────────────────────────────────────────────────────

interface Row extends Agg {
  key: string;
}

function buildRows(closed: Trade[], keyOf: (t: Trade) => string, order?: string[]): Row[] {
  const groups = new Map<string, Trade[]>();
  for (const t of closed) {
    const k = keyOf(t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  const rows: Row[] = [];
  for (const [key, ts] of groups) rows.push({ key, ...aggregate(ts) });
  if (order) {
    rows.sort((a, b) => {
      const ia = order.indexOf(a.key);
      const ib = order.indexOf(b.key);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }
  return rows;
}

const PAIR_ORDER = ["EURUSD", "GBPUSD", "USDJPY", "EURJPY", "GBPJPY", "XAUUSD"];

/** Conviction tier bucketed by risk_pct — the cleaner, always-present signal.
 *  ≥ 0.7% risk = "High conviction", below = "Standard". (Stated in the UI.) */
const HIGH_CONVICTION_RISK = 0.7;
function convictionTier(t: Trade): string {
  return t.risk_pct >= HIGH_CONVICTION_RISK ? "High (≥0.7%)" : "Standard (<0.7%)";
}

/** Hold-time bucket from dateClosed − dateOpened. */
const HOLD_ORDER = ["< 3 days", "3–7 days", "1–3 weeks", "> 3 weeks"];
function holdBucket(t: Trade): string {
  const ms = new Date(t.date_closed).getTime() - new Date(t.date_opened).getTime();
  const days = ms / 864e5;
  if (days < 3) return "< 3 days";
  if (days < 7) return "3–7 days";
  if (days < 21) return "1–3 weeks";
  return "> 3 weeks";
}

// ─── Sortable table ─────────────────────────────────────────────────────────

type SortKey = "key" | "count" | "winRate" | "netPnl" | "expectancy" | "avgRR";
type SortDir = "asc" | "desc";

const COLUMNS: { id: SortKey; label: string; align: "left" | "right" }[] = [
  { id: "key", label: "", align: "left" },
  { id: "count", label: "# Trades", align: "right" },
  { id: "winRate", label: "Win Rate", align: "right" },
  { id: "netPnl", label: "Net P&L", align: "right" },
  { id: "expectancy", label: "Expectancy", align: "right" },
  { id: "avgRR", label: "Avg R:R", align: "right" },
];

function sortRows(rows: Row[], key: SortKey, dir: SortDir): Row[] {
  const mult = dir === "asc" ? 1 : -1;
  const val = (r: Row): number | string => {
    switch (key) {
      case "key": return r.key;
      case "count": return r.count;
      case "winRate": return r.winRate ?? -1;
      case "netPnl": return r.netPnl;
      case "expectancy": return r.expectancy ?? -Infinity;
      case "avgRR": return r.avgRR ?? -Infinity;
    }
  };
  return [...rows].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * mult;
    return ((va as number) - (vb as number)) * mult;
  });
}

function BreakdownTable({
  title,
  subtitle,
  rows,
  dimensionLabel,
}: {
  title: string;
  subtitle?: string;
  rows: Row[];
  dimensionLabel: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("netPnl");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir]);

  // Best & worst rows by net P&L, highlighted subtly (only when > 1 row).
  const { bestKey, worstKey } = useMemo(() => {
    if (rows.length < 2) return { bestKey: null as string | null, worstKey: null as string | null };
    let best = rows[0];
    let worst = rows[0];
    for (const r of rows) {
      if (r.netPnl > best.netPnl) best = r;
      if (r.netPnl < worst.netPnl) worst = r;
    }
    return { bestKey: best.key, worstKey: worst.key };
  }, [rows]);

  function toggleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "key" ? "asc" : "desc");
    }
  }

  return (
    <div className="lt-card" style={{ padding: 18 }}>
      <div className="lt-eyebrow" style={{ marginBottom: 4 }}>
        {title}
        <span className="lt-eyebrow-ln" />
      </div>
      {subtitle && (
        <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", margin: "0 0 12px" }}>{subtitle}</p>
      )}

      {rows.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--lucid-ink-3)", fontStyle: "italic", padding: "12px 0" }}>
          No closed trades in this period.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 460 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
                {COLUMNS.map((c) => {
                  const active = c.id === sortKey;
                  return (
                    <th
                      key={c.id}
                      onClick={() => toggleSort(c.id)}
                      style={{
                        textAlign: c.align,
                        padding: "6px 10px",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: active ? "var(--lucid-ink-2)" : "var(--lucid-ink-3)",
                        cursor: "pointer",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          justifyContent: c.align === "right" ? "flex-end" : "flex-start",
                        }}
                      >
                        {c.id === "key" ? dimensionLabel : c.label}
                        {active ? (
                          sortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                        ) : (
                          <ChevronsUpDown size={11} style={{ opacity: 0.4 }} />
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const isBest = r.key === bestKey;
                const isWorst = r.key === worstKey;
                const rowBg = isBest
                  ? "var(--lucid-pos-bg)"
                  : isWorst
                  ? "var(--lucid-neg-bg)"
                  : "transparent";
                return (
                  <tr
                    key={r.key}
                    style={{ borderBottom: "1px solid var(--lucid-line)", background: rowBg }}
                  >
                    <td style={{ padding: "8px 10px", fontSize: 13, color: "var(--lucid-ink)", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {r.key}
                    </td>
                    <td className="lt-num" style={{ padding: "8px 10px", fontSize: 13, textAlign: "right", color: "var(--lucid-ink-2)" }}>
                      {r.count}
                    </td>
                    <td className="lt-num" style={{ padding: "8px 10px", fontSize: 13, textAlign: "right", color: "var(--lucid-ink-2)" }}>
                      {pctText(r.winRate)}
                    </td>
                    <td className="lt-num" style={{ padding: "8px 10px", fontSize: 13, textAlign: "right", fontWeight: 600, color: pnlColorVar(r.netPnl) }}>
                      {signedCurrency(r.netPnl)}
                    </td>
                    <td className="lt-num" style={{ padding: "8px 10px", fontSize: 13, textAlign: "right", fontWeight: 600, color: r.expectancy === null ? "var(--lucid-ink-3)" : pnlColorVar(r.expectancy) }}>
                      {r.expectancy === null ? "—" : signedCurrency(r.expectancy)}
                    </td>
                    <td className="lt-num" style={{ padding: "8px 10px", fontSize: 13, textAlign: "right", color: "var(--lucid-ink-2)" }}>
                      {r.avgRR === null ? "—" : `${r.avgRR.toFixed(2)}R`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Headline stat cell ─────────────────────────────────────────────────────

function Stat({
  label,
  value,
  color,
  hero,
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  hero?: boolean;
  sub?: string;
}) {
  return (
    <div
      className={hero ? "lt-card lt-edge" : "lt-card"}
      style={{
        padding: hero ? "18px 20px" : "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        ...(hero ? { background: "var(--lucid-surface-2)" } : {}),
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: hero ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
        }}
      >
        {label}
      </span>
      <span
        className="lt-num"
        style={{ fontSize: hero ? 34 : 22, fontWeight: 700, color: color ?? "var(--lucid-ink)", lineHeight: 1.1 }}
      >
        {value}
      </span>
      {sub && <span style={{ fontSize: 10.5, color: "var(--lucid-ink-3)" }}>{sub}</span>}
    </div>
  );
}

// ─── Curve tooltip ────────────────────────────────────────────────────────────

function CurveTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CurvePoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="lt-card" style={{ padding: "10px 12px", background: "var(--lucid-surface-2)" }}>
      <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", margin: "0 0 4px" }}>{d.date}</p>
      <p className="lt-num" style={{ fontSize: 15, fontWeight: 700, color: "var(--lucid-ink)", margin: 0 }}>
        {signedCurrency(d.cumPnl)}
      </p>
      {d.pair && (
        <p className="lt-num" style={{ fontSize: 11, color: pnlColorVar(d.pnl), margin: "2px 0 0" }}>
          {d.pair} · {signedCurrency(d.pnl)}
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRangePreset>("All Time");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  const tradesQuery = useTrades();
  const accountsQuery = useAccounts();
  const allTrades = useMemo(() => tradesQuery.data ?? [], [tradesQuery.data]);
  const accounts = accountsQuery.data ?? [];

  const filtered = useMemo(() => {
    let t = allTrades;
    if (accountFilter !== "all") t = t.filter((x) => x.account_id === accountFilter);
    return applyDateFilter(t, dateRange);
  }, [allTrades, accountFilter, dateRange]);

  const closed = useMemo(() => filtered.filter((t) => t.date_closed !== ""), [filtered]);
  const head = useMemo(() => aggregate(filtered), [filtered]);

  const curve = useMemo(() => buildEquityCurve(closed), [closed]);
  const maxDD = useMemo(() => computeMaxDrawdown(curve), [curve]);
  const ddWindows = useMemo(() => computeDrawdownWindows(curve), [curve]);

  const byPair = useMemo(() => buildRows(closed, (t) => t.pair, PAIR_ORDER), [closed]);
  const byModel = useMemo(() => buildRows(closed, (t) => (t.model?.trim() ? t.model : "Untagged")), [closed]);
  const byConviction = useMemo(() => buildRows(closed, convictionTier), [closed]);
  const bySession = useMemo(() => buildRows(closed, (t) => t.session), [closed]);
  const byHold = useMemo(() => buildRows(closed, holdBucket, HOLD_ORDER), [closed]);

  // Rule-violation split (works off the Mistakes field; empty state if absent).
  const violation = useMemo(() => {
    const tagged = closed.filter((t) => tradeMistakes(t).length > 0);
    const clean = closed.filter((t) => tradeMistakes(t).length === 0);
    const anyTagged = tagged.length > 0;
    return {
      anyTagged,
      taggedCount: tagged.length,
      cleanCount: clean.length,
      taggedPnl: tagged.reduce((s, t) => s + t.blended_pnl, 0),
      cleanPnl: clean.reduce((s, t) => s + t.blended_pnl, 0),
    };
  }, [closed]);

  const wrColor =
    head.winRate === null
      ? "var(--lucid-ink)"
      : head.winRate >= 0.5
      ? "var(--lucid-pos)"
      : head.winRate >= 0.4
      ? "var(--lucid-warn)"
      : "var(--lucid-neg)";

  const selectStyle: React.CSSProperties = {
    background: "var(--lucid-surface-3)",
    border: "1px solid var(--lucid-line)",
    borderRadius: 8,
    color: "var(--lucid-ink)",
    fontSize: 13,
    padding: "6px 12px",
    cursor: "pointer",
    outline: "none",
  };

  const optionStyle: React.CSSProperties = { background: "var(--lucid-surface)", color: "var(--lucid-ink)" };

  if (tradesQuery.isLoading) {
    return (
      <div className="px-4 sm:px-6 py-4 sm:py-6 flex flex-col" style={{ gap: 20 }} aria-hidden="true">
        <div>
          <Skeleton bare height={26} width={168} />
          <Skeleton bare height={11} width={340} style={{ marginTop: 8 }} />
        </div>
        <div className="lx-grid-metrics">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} height={116} />
          ))}
        </div>
        <div className="lx-grid-two">
          {[0, 1].map((i) => (
            <div key={i} className="lx-card">
              <Skeleton bare height={9} width={104} />
              <Skeleton bare height={260} radius={10} style={{ marginTop: 16 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (tradesQuery.isError) {
    return (
      <div className="px-4 sm:px-6 py-6">
        <ErrorState error={tradesQuery.error} onRetry={() => tradesQuery.refetch()} title="Couldn't load analytics" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 pb-12 flex flex-col" style={{ gap: 20 }}>
      {/* Header */}
      <div>
        <h1 className="lt-serif" style={{ fontSize: 26, fontWeight: 600, color: "var(--lucid-ink)", margin: 0 }}>
          Analytics
        </h1>
        <p style={{ fontSize: 13, color: "var(--lucid-ink-3)", margin: "4px 0 0" }}>
          Find the edge. Cut the drag. All outcomes from your logged net P&amp;L.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangePreset)} style={selectStyle}>
          {(["Last 7 days", "Last 30 days", "Last 90 days", "Year to Date", "All Time"] as DateRangePreset[]).map((p) => (
            <option key={p} value={p} style={optionStyle}>{p}</option>
          ))}
        </select>
        <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} style={selectStyle}>
          <option value="all" style={optionStyle}>All Accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id} style={optionStyle}>{a.account_name}</option>
          ))}
        </select>
      </div>

      {/* ── 1. HEADLINE STATS ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* Hero: expectancy per trade */}
        <div className="col-span-2 lg:col-span-1">
          <Stat
            hero
            label="Expectancy / Trade"
            value={head.expectancy === null ? "—" : signedCurrency(head.expectancy)}
            color={head.expectancy === null ? "var(--lucid-ink)" : pnlColorVar(head.expectancy)}
            sub="(WR × avg win) − (LR × avg loss)"
          />
        </div>
        <Stat
          label="Net P&L"
          value={signedCurrency(head.netPnl)}
          color={pnlColorVar(head.netPnl)}
        />
        <Stat label="Win Rate" value={pctText(head.winRate)} color={wrColor} sub="BE excluded" />
        <Stat label="Avg Winner" value={head.wins > 0 ? formatCurrency(head.avgWin) : "—"} color={head.wins > 0 ? "var(--lucid-pos)" : "var(--lucid-ink)"} />
        <Stat label="Avg Loser" value={head.losses > 0 ? `-${formatCurrency(head.avgLoss)}` : "—"} color={head.losses > 0 ? "var(--lucid-neg)" : "var(--lucid-ink)"} />
        <Stat label="Avg R:R" value={head.avgRR === null ? "—" : `${head.avgRR.toFixed(2)}R`} sub="display metric" />
        <Stat label="Total Trades" value={String(filtered.length)} sub={`${head.count} closed`} />
        <Stat
          label="W / L / BE"
          value={`${head.wins} / ${head.losses} / ${head.be}`}
        />
      </div>

      {/* ── 2. EQUITY CURVE ───────────────────────────────────────────────── */}
      <div className="lt-card" style={{ padding: 18 }}>
        <div className="flex flex-wrap items-center justify-between gap-2" style={{ marginBottom: 12 }}>
          <div className="lt-eyebrow" style={{ flex: "0 0 auto" }}>
            Equity Curve — Cumulative Realized P&amp;L
          </div>
          <span
            className="lt-num"
            style={{
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 6,
              background: "var(--lucid-neg-bg)",
              color: "var(--lucid-neg)",
              border: "1px solid var(--lucid-neg-bd)",
              fontWeight: 600,
            }}
          >
            Max DD −{formatCurrency(maxDD)}
          </span>
        </div>

        {curve.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={curve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--lucid-accent)" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="var(--lucid-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--lucid-line)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--lucid-ink-3)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--lucid-ink-3)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
                width={58}
              />
              <Tooltip content={<CurveTooltip />} />
              <ReferenceLine y={0} stroke="var(--lucid-line-3)" strokeDasharray="4 4" />
              {/* Drawdown windows shaded in low-opacity negative */}
              {ddWindows.map((w, i) => (
                <ReferenceArea key={i} x1={w.x1} x2={w.x2} fill="var(--lucid-neg)" fillOpacity={0.08} ifOverflow="visible" />
              ))}
              <Area
                type="monotone"
                dataKey="cumPnl"
                stroke="var(--lucid-accent)"
                strokeWidth={2}
                fill="url(#eqGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "var(--lucid-accent)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center" style={{ height: 300, color: "var(--lucid-ink-3)", fontSize: 13 }}>
            No closed trades for this period.
          </div>
        )}
      </div>

      {/* ── 3. BREAKDOWN TABLES ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownTable title="By Pair" dimensionLabel="Pair" rows={byPair} />
        <BreakdownTable title="By Model" dimensionLabel="Model" rows={byModel} />
        <BreakdownTable
          title="By Conviction Tier"
          subtitle="Bucketed by risk % — ≥0.7% = High conviction, below = Standard."
          dimensionLabel="Tier"
          rows={byConviction}
        />
        <BreakdownTable title="By Session" dimensionLabel="Session" rows={bySession} />
        <div className="lg:col-span-2">
          <BreakdownTable
            title="By Hold Time"
            subtitle="Time in trade (close − open)."
            dimensionLabel="Hold"
            rows={byHold}
          />
        </div>
      </div>

      {/* ── 4. RULE-VIOLATION VIEW ────────────────────────────────────────── */}
      <div className="lt-card" style={{ padding: 18 }}>
        <div className="lt-eyebrow" style={{ marginBottom: 12 }}>
          System vs Execution — Rule Violations
          <span className="lt-eyebrow-ln" />
        </div>

        {violation.anyTagged ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="lt-card-2" style={{ padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--lucid-neg)", margin: "0 0 8px" }}>
                Rule-Violation Trades
              </p>
              <p className="lt-num" style={{ fontSize: 24, fontWeight: 700, color: "var(--lucid-ink)", margin: 0 }}>
                {violation.taggedCount}
              </p>
              <p className="lt-num" style={{ fontSize: 14, fontWeight: 600, color: pnlColorVar(violation.taggedPnl), margin: "4px 0 0" }}>
                {signedCurrency(violation.taggedPnl)} net
              </p>
              <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", margin: "6px 0 0" }}>
                Execution failures — you broke your own rules.
              </p>
            </div>
            <div className="lt-card-2" style={{ padding: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--lucid-pos)", margin: "0 0 8px" }}>
                Clean Trades
              </p>
              <p className="lt-num" style={{ fontSize: 24, fontWeight: 700, color: "var(--lucid-ink)", margin: 0 }}>
                {violation.cleanCount}
              </p>
              <p className="lt-num" style={{ fontSize: 14, fontWeight: 600, color: pnlColorVar(violation.cleanPnl), margin: "4px 0 0" }}>
                {signedCurrency(violation.cleanPnl)} net
              </p>
              <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", margin: "6px 0 0" }}>
                Followed the plan — this is your system&apos;s true P&amp;L.
              </p>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--lucid-ink-3)", fontStyle: "italic", lineHeight: 1.6, margin: 0 }}>
            No trades tagged with rule violations (Mistakes) in this period. Once you tag trades
            where you broke your rules, this view separates system failures from execution failures —
            so a losing month from bad discipline reads differently from a losing edge.
          </p>
        )}
      </div>
    </div>
  );
}
