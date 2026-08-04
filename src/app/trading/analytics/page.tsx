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
import { getPrimaryExecution, edgeOutcome, isTradeOpen } from "@/lib/trade-helpers";
import {
  edgeStats,
  buildBalanceCurve,
  computeDrawdownWindows as sharedComputeDrawdownWindows,
  computeMaxDrawdown as sharedComputeMaxDrawdown,
  type EdgeBreakdownStats,
  type CurvePoint,
} from "@/lib/stats";

// ─────────────────────────────────────────────────────────────────────────────
// Analytics — the trader's review process.
//
// Win rate / expectancy / breakdowns are EDGE statistics: they count IDEAS
// (one row per Trade), decided by the PRIMARY execution's manual net P&L:
//   pnl  > 0 → Win     pnl < 0 → Loss     pnl === 0 → Break-even
// blended_rr survives as R — comparable across accounts of different sizes,
// which is why expectancy is expressed in R here, not dollars.
// Net P&L / avg win / avg loss remain dollar figures — ACCOUNT statistics,
// summed across every execution of the ideas in view (all accounts, or the
// one account selected by the filter below).
// All of this comes from lib/stats.ts, the one shared statistics module —
// this page no longer reimplements win-rate/expectancy/equity-curve math.
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

// Filters ideas by their primary execution's close date (open ideas keep
// their idea date) — a dashboard-range convenience filter, not a financial
// computation; see dashboard/dashboard-helpers.ts for the identical pattern.
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
    const primary = getPrimaryExecution(t);
    const date = primary?.date_closed ? new Date(primary.date_closed) : new Date(t.date_opened);
    return date >= cutoff;
  });
}

// ─── Breakdown dimensions — every row is edgeStats() over a group of IDEAS ────

interface Row extends EdgeBreakdownStats {
  key: string;
}

function buildRows(trades: Trade[], keyOf: (t: Trade) => string, order?: string[]): Row[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = keyOf(t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  const rows: Row[] = [];
  for (const [key, ts] of groups) rows.push({ key, ...edgeStats(ts) });
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

/** Conviction tier bucketed by risk % — the cleaner, always-present signal.
 *  ≥ 0.7% risk = "High conviction", below = "Standard". (Stated in the UI.)
 *  Risk is execution-level now; the primary execution's risk % represents
 *  the idea, matching every other idea-level derived value in this app. */
const HIGH_CONVICTION_RISK = 0.7;
function convictionTier(t: Trade): string {
  const risk = getPrimaryExecution(t)?.risk_pct ?? 0;
  return risk >= HIGH_CONVICTION_RISK ? "High (≥0.7%)" : "Standard (<0.7%)";
}

/** Hold-time bucket from the primary execution's close − the idea's open. */
const HOLD_ORDER = ["< 3 days", "3–7 days", "1–3 weeks", "> 3 weeks"];
function holdBucket(t: Trade): string {
  const primary = getPrimaryExecution(t);
  if (!primary?.date_closed) return "< 3 days";
  const ms = new Date(primary.date_closed).getTime() - new Date(t.date_opened).getTime();
  const days = ms / 864e5;
  if (days < 3) return "< 3 days";
  if (days < 7) return "3–7 days";
  if (days < 21) return "1–3 weeks";
  return "> 3 weeks";
}

// ─── Sortable table ─────────────────────────────────────────────────────────

type SortKey = "key" | "idea_count" | "win_rate" | "net_pnl" | "expectancy_r" | "avg_rr";
type SortDir = "asc" | "desc";

const COLUMNS: { id: SortKey; label: string; align: "left" | "right" }[] = [
  { id: "key", label: "", align: "left" },
  { id: "idea_count", label: "# Trades", align: "right" },
  { id: "win_rate", label: "Win Rate", align: "right" },
  { id: "net_pnl", label: "Net P&L", align: "right" },
  { id: "expectancy_r", label: "Expectancy", align: "right" },
  { id: "avg_rr", label: "Avg R:R", align: "right" },
];

function sortRows(rows: Row[], key: SortKey, dir: SortDir): Row[] {
  const mult = dir === "asc" ? 1 : -1;
  const val = (r: Row): number | string => {
    switch (key) {
      case "key": return r.key;
      case "idea_count": return r.idea_count;
      case "win_rate": return r.win_rate ?? -1;
      case "net_pnl": return r.net_pnl;
      case "expectancy_r": return r.expectancy_r ?? -Infinity;
      case "avg_rr": return r.avg_rr ?? -Infinity;
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
  const [sortKey, setSortKey] = useState<SortKey>("net_pnl");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir]);

  // Best & worst rows by net P&L, highlighted subtly (only when > 1 row).
  const { bestKey, worstKey } = useMemo(() => {
    if (rows.length < 2) return { bestKey: null as string | null, worstKey: null as string | null };
    let best = rows[0];
    let worst = rows[0];
    for (const r of rows) {
      if (r.net_pnl > best.net_pnl) best = r;
      if (r.net_pnl < worst.net_pnl) worst = r;
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
                      {r.idea_count}
                    </td>
                    <td className="lt-num" style={{ padding: "8px 10px", fontSize: 13, textAlign: "right", color: "var(--lucid-ink-2)" }}>
                      {pctText(r.win_rate)}
                    </td>
                    <td className="lt-num" style={{ padding: "8px 10px", fontSize: 13, textAlign: "right", fontWeight: 600, color: pnlColorVar(r.net_pnl) }}>
                      {signedCurrency(r.net_pnl)}
                    </td>
                    <td className="lt-num" style={{ padding: "8px 10px", fontSize: 13, textAlign: "right", fontWeight: 600, color: r.expectancy_r === null ? "var(--lucid-ink-3)" : pnlColorVar(r.expectancy_r) }}>
                      {r.expectancy_r === null ? "—" : `${r.expectancy_r.toFixed(2)}R`}
                    </td>
                    <td className="lt-num" style={{ padding: "8px 10px", fontSize: 13, textAlign: "right", color: "var(--lucid-ink-2)" }}>
                      {r.avg_rr === null ? "—" : `${r.avg_rr.toFixed(2)}R`}
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

  // Account filter: ideas with an execution in that account, narrowed to that
  // account's own execution — every edge stat below then naturally reads as
  // "as if I only had this account" (getPrimaryExecution falls back to the
  // sole remaining execution), and every dollar figure sums just its P&L.
  const filtered = useMemo(() => {
    let t = allTrades;
    if (accountFilter !== "all") {
      t = t
        .filter((x) => x.executions.some((e) => e.account_id === accountFilter))
        .map((x) => ({ ...x, executions: x.executions.filter((e) => e.account_id === accountFilter) }));
    }
    return applyDateFilter(t, dateRange);
  }, [allTrades, accountFilter, dateRange]);

  const closed = useMemo(() => filtered.filter((t) => !isTradeOpen(t)), [filtered]);

  // Edge headline: counts ideas, primary execution's outcome. edgeStats()
  // already computes win_rate/avg_win_r/avg_loss_r/expectancy_r/net_pnl; wins/
  // losses/be are the only extra breakdown this headline needs on top.
  const head = useMemo(
    () => ({
      ...edgeStats(filtered),
      wins: closed.filter((t) => edgeOutcome(t) === "Win").length,
      losses: closed.filter((t) => edgeOutcome(t) === "Loss").length,
      be: closed.filter((t) => edgeOutcome(t) === "BE").length,
    }),
    [filtered, closed],
  );

  // Account headline: dollar sum across every execution in view — the money
  // curve, execution-level, correctly counting every account's fill.
  const curve = useMemo(() => buildBalanceCurve(closed), [closed]);
  const maxDD = useMemo(() => sharedComputeMaxDrawdown(curve), [curve]);
  const ddWindowsRaw = useMemo(() => sharedComputeDrawdownWindows(curve), [curve]);
  const ddWindows = useMemo(
    () => ddWindowsRaw.map((w) => ({ x1: curve[w.startIndex]?.date ?? "", x2: curve[w.endIndex]?.date ?? "" })),
    [ddWindowsRaw, curve],
  );

  const byPair = useMemo(() => buildRows(filtered, (t) => t.pair, PAIR_ORDER), [filtered]);
  const byModel = useMemo(() => buildRows(filtered, (t) => (t.model?.trim() ? t.model : "Untagged")), [filtered]);
  const byConviction = useMemo(() => buildRows(filtered, convictionTier), [filtered]);
  const bySession = useMemo(() => buildRows(filtered, (t) => t.session), [filtered]);
  const byHold = useMemo(() => buildRows(filtered, holdBucket, HOLD_ORDER), [filtered]);

  // Rule-violation split (works off the Mistakes field; empty state if absent).
  // Dollar impact sums every execution — an account-family total, like Net P&L.
  const violation = useMemo(() => {
    const tagged = closed.filter((t) => tradeMistakes(t).length > 0);
    const clean = closed.filter((t) => tradeMistakes(t).length === 0);
    const anyTagged = tagged.length > 0;
    const sumPnl = (ts: Trade[]) => ts.reduce((s, t) => s + t.executions.reduce((es, e) => es + e.blended_pnl, 0), 0);
    return {
      anyTagged,
      taggedCount: tagged.length,
      cleanCount: clean.length,
      taggedPnl: sumPnl(tagged),
      cleanPnl: sumPnl(clean),
    };
  }, [closed]);

  const wrColor =
    head.win_rate === null
      ? "var(--lucid-ink)"
      : head.win_rate >= 0.5
      ? "var(--lucid-pos)"
      : head.win_rate >= 0.4
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
        {/* Hero: expectancy per trade, in R — portable across account sizes;
            dollar expectancy summed across a 10k challenge and a 100k funded
            account describes nothing. */}
        <div className="col-span-2 lg:col-span-1">
          <Stat
            hero
            label="Expectancy / Trade (R)"
            value={head.expectancy_r === null ? "—" : `${head.expectancy_r.toFixed(2)}R`}
            color={head.expectancy_r === null ? "var(--lucid-ink)" : pnlColorVar(head.expectancy_r)}
            sub="(WR × avg win R) − (LR × avg loss R)"
          />
        </div>
        <Stat
          label="Net P&L"
          value={signedCurrency(head.net_pnl)}
          color={pnlColorVar(head.net_pnl)}
          sub="every execution, all accounts in view"
        />
        <Stat label="Win Rate" value={pctText(head.win_rate)} color={wrColor} sub="BE excluded, idea-counted" />
        <Stat label="Avg Winner (R)" value={head.wins > 0 && head.avg_win_r !== null ? `${head.avg_win_r.toFixed(2)}R` : "—"} color={head.wins > 0 ? "var(--lucid-pos)" : "var(--lucid-ink)"} />
        <Stat label="Avg Loser (R)" value={head.losses > 0 && head.avg_loss_r !== null ? `-${head.avg_loss_r.toFixed(2)}R` : "—"} color={head.losses > 0 ? "var(--lucid-neg)" : "var(--lucid-ink)"} />
        <Stat label="Avg R:R" value={head.avg_rr === null ? "—" : `${head.avg_rr.toFixed(2)}R`} sub="display metric" />
        <Stat label="Total Trades" value={String(filtered.length)} sub={`${head.idea_count} closed`} />
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
