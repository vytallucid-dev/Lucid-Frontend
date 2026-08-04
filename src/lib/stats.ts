// lib/stats.ts — the ONE statistics module for the trading journal.
//
// Two families, named so the unit is unmissable at the call site:
//
//   edge*    — counts IDEAS (Trade rows), using the PRIMARY execution's
//              outcome. This is what every win rate / expectancy / R:R /
//              per-model/pair/session/conviction breakdown must use. Logging
//              one idea across three accounts must not triple its weight
//              here — it is still exactly one sample.
//
//   account* — counts EXECUTIONS, sums dollars. Realized P&L, an account's
//              own win rate, balance curves and drawdown are properties of
//              the account, not the idea, and must include every execution.
//
// Before this module, the same win-rate/expectancy math was reimplemented
// independently in lib/stats.ts, analytics/page.tsx, dashboard/page.tsx's
// rolling win rate, AccountDrawerContent.tsx, and the journal's outcome
// filter — five copies that could silently drift from each other. Every one
// of those now imports from here.
import type { Trade, Execution } from './demo-data';
import { getPrimaryExecution, isExecutionOpen, isTradeOpen } from './trade-helpers';

// ─────────────────────────────────────────────────────────────────────────────
// EDGE — one row per idea, decided by the primary execution.
// ─────────────────────────────────────────────────────────────────────────────

/** An idea "counts" for edge purposes once its primary execution has closed. */
function isEdgeClosed(t: Trade): boolean {
  return !isTradeOpen(t);
}

function primaryPnl(t: Trade): number {
  return getPrimaryExecution(t)?.blended_pnl ?? 0;
}
function primaryRr(t: Trade): number {
  return getPrimaryExecution(t)?.blended_rr ?? 0;
}

/** Win rate across ideas: WR = wins / (wins + losses). BE excluded from the
 * denominator, exactly as before — only now one idea is one sample no matter
 * how many accounts it was executed in. */
export function edgeWinRate(trades: Trade[]): number | null {
  const closed = trades.filter(isEdgeClosed);
  const wins = closed.filter((t) => primaryPnl(t) > 0).length;
  const losses = closed.filter((t) => primaryPnl(t) < 0).length;
  if (wins + losses === 0) return null;
  return wins / (wins + losses);
}

/** Average R of winning ideas (primary execution's blended_rr). R, not
 * dollars — R is comparable across accounts of different sizes. */
export function edgeAvgWinR(trades: Trade[]): number | null {
  const wins = trades.filter(isEdgeClosed).filter((t) => primaryPnl(t) > 0);
  if (wins.length === 0) return null;
  return wins.reduce((s, t) => s + primaryRr(t), 0) / wins.length;
}

/** Average |R| of losing ideas. */
export function edgeAvgLossR(trades: Trade[]): number | null {
  const losses = trades.filter(isEdgeClosed).filter((t) => primaryPnl(t) < 0);
  if (losses.length === 0) return null;
  return Math.abs(losses.reduce((s, t) => s + primaryRr(t), 0) / losses.length);
}

/** Expectancy in R: WR × avgWinR − (1−WR) × avgLossR. Portable across a 10k
 * challenge and a 100k funded account — dollar expectancy summed across
 * different account sizes describes nothing. */
export function edgeExpectancyR(trades: Trade[]): number | null {
  const wr = edgeWinRate(trades);
  if (wr === null) return null;
  const avgWinR = edgeAvgWinR(trades) ?? 0;
  const avgLossR = edgeAvgLossR(trades) ?? 0;
  return wr * avgWinR - (1 - wr) * avgLossR;
}

/** Number of ideas (Trade rows) — NOT executions. Logging one idea to two
 * accounts must raise this by one, not two. */
export function edgeIdeaCount(trades: Trade[]): number {
  return trades.length;
}

export function edgeClosedIdeaCount(trades: Trade[]): number {
  return trades.filter(isEdgeClosed).length;
}

/** Win / Loss / BE / Live for one idea — re-exported here for convenience
 * next to the aggregate functions that share its definition of "outcome". */
export { edgeOutcome } from './trade-helpers';
export type { EdgeOutcome } from './trade-helpers';

/** The last N ideas to close (by primary execution's date_closed), most
 * recent first, and the win rate across them. Replaces the dashboard's old
 * "last 20 trade rows" — which, pre-split, could let one idea logged to
 * three accounts occupy three of the twenty slots. */
export function edgeRollingWinRate(trades: Trade[], n: number): { winRate: number | null; count: number } {
  const closed = trades
    .filter(isEdgeClosed)
    .slice()
    .sort((a, b) => {
      const ad = getPrimaryExecution(a)?.date_closed ?? '';
      const bd = getPrimaryExecution(b)?.date_closed ?? '';
      return bd.localeCompare(ad);
    })
    .slice(0, n);
  return { winRate: edgeWinRate(closed), count: closed.length };
}

export interface EdgeBreakdownStats {
  idea_count: number; // ideas with a closed primary execution, in this group
  win_rate: number | null;
  avg_win_r: number | null;
  avg_loss_r: number | null;
  avg_rr: number | null; // alias of avg_win_r — the "R:R" display metric
  expectancy_r: number | null;
  /** $ — sum across every execution of these ideas (all accounts). An
   * account-family value surfaced for convenience on edge breakdown tables;
   * it does not affect win_rate/expectancy_r, which stay idea-counted. */
  net_pnl: number;
}

/** The core breakdown engine. Callers pre-filter `trades` to whatever group
 * they want (a model, a pair, a session, a conviction tier, a hold-time
 * bucket, a date range) — this function only ever counts ideas. */
export function edgeStats(trades: Trade[]): EdgeBreakdownStats {
  const closed = trades.filter(isEdgeClosed);
  const winRate = edgeWinRate(trades);
  const avgWinR = edgeAvgWinR(trades);
  const avgLossR = edgeAvgLossR(trades);
  const netPnl = closed.reduce((s, t) => s + t.executions.reduce((es, e) => es + e.blended_pnl, 0), 0);
  return {
    idea_count: closed.length,
    win_rate: winRate,
    avg_win_r: avgWinR,
    avg_loss_r: avgLossR,
    avg_rr: avgWinR,
    expectancy_r: edgeExpectancyR(trades),
    net_pnl: Math.round(netPnl * 100) / 100,
  };
}

function netPnlByKey(trades: Trade[], keyFn: (t: Trade) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of trades.filter(isEdgeClosed)) {
    const k = keyFn(t);
    const pnl = t.executions.reduce((s, e) => s + e.blended_pnl, 0);
    map.set(k, (map.get(k) ?? 0) + pnl);
  }
  return map;
}

export interface EdgeModelStats extends EdgeBreakdownStats {
  best_pair: string | null;
}
/** Per-model edge breakdown for the System page. */
export function edgeModelStats(allTrades: Trade[], modelName: string): EdgeModelStats {
  const group = allTrades.filter((t) => t.model === modelName);
  const pairPnl = netPnlByKey(group, (t) => t.pair);
  let best_pair: string | null = null;
  let best = -Infinity;
  for (const [pair, pnl] of pairPnl) if (pnl > best) { best = pnl; best_pair = pair; }
  return { ...edgeStats(group), best_pair };
}

export interface EdgePairStats extends EdgeBreakdownStats {
  best_model: string | null;
  worst_model: string | null;
}
/** Per-pair edge breakdown for the System page. */
export function edgePairStats(allTrades: Trade[], symbol: string): EdgePairStats {
  const group = allTrades.filter((t) => t.pair === symbol);
  const modelPnl = netPnlByKey(group, (t) => t.model);
  let best_model: string | null = null;
  let worst_model: string | null = null;
  let best = -Infinity;
  let worst = Infinity;
  for (const [model, pnl] of modelPnl) {
    if (pnl > best) { best = pnl; best_model = model; }
    if (pnl < worst) { worst = pnl; worst_model = model; }
  }
  if (modelPnl.size === 1) worst_model = best_model;
  return { ...edgeStats(group), best_model, worst_model };
}

export interface EdgeSessionStats extends EdgeBreakdownStats {
  best_pair: string | null;
}
/** Per-session edge breakdown for the System page. */
export function edgeSessionStats(allTrades: Trade[], session: string): EdgeSessionStats {
  const group = allTrades.filter((t) => t.session === session);
  const pairPnl = netPnlByKey(group, (t) => t.pair);
  let best_pair: string | null = null;
  let best = -Infinity;
  for (const [pair, pnl] of pairPnl) if (pnl > best) { best = pnl; best_pair = pair; }
  return { ...edgeStats(group), best_pair };
}

/** Total ideas with a closed primary execution (was getTotalClosedTradeCount). */
export function edgeTotalClosedIdeaCount(allTrades: Trade[]): number {
  return edgeClosedIdeaCount(allTrades);
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT — one row per execution, scoped to a single account.
// ─────────────────────────────────────────────────────────────────────────────

/** Every execution across all ideas that belongs to one account. */
export function accountExecutions(trades: Trade[], accountId: string): Execution[] {
  const out: Execution[] = [];
  for (const t of trades) for (const e of t.executions) if (e.account_id === accountId) out.push(e);
  return out;
}

export interface AccountStats {
  trade_count: number; // executions in this account (open + closed) — kept as
  // `trade_count` to match the pre-split field name consumers already read
  win_rate: number; // 0-100, this account's OWN fills — count-based, execution-level
  avg_pnl: number; // $ mean per closed execution in this account
  best_pair: string | null;
  worst_pair: string | null;
}

/** An account's own performance: every execution it holds, win rate over its
 * own fills (not the idea's primary), $ averages. This is unchanged in
 * substance from before the split — an account's trades were always exactly
 * its executions — only the source data now comes from `executions`. */
export function accountStats(executions: Execution[]): AccountStats {
  const closed = executions.filter((e) => !isExecutionOpen(e));
  const wins = closed.filter((e) => e.blended_pnl > 0);
  const losses = closed.filter((e) => e.blended_pnl < 0);
  const denom = wins.length + losses.length;
  const winRate = denom > 0 ? (wins.length / denom) * 100 : 0;
  const netPnl = closed.reduce((s, e) => s + e.blended_pnl, 0);
  const avgPnl = closed.length > 0 ? netPnl / closed.length : 0;
  return { trade_count: executions.length, win_rate: winRate, avg_pnl: avgPnl, best_pair: null, worst_pair: null };
}

/** $ realized P&L for one account — sum of closed executions' blended_pnl.
 * This is the number that drives the account's balance and must never be
 * rolled up to the idea. */
export function accountRealizedPnl(executions: Execution[]): number {
  return executions.filter((e) => !isExecutionOpen(e)).reduce((s, e) => s + e.blended_pnl, 0);
}

export interface CurvePoint {
  date: string;
  cumPnl: number;
  pnl: number;
  pair?: string; // the execution's idea's pair, when this point is one execution
  isLive?: boolean;
}

/** Cumulative $ P&L curve, execution-level. Pass `accountId` to scope to one
 * account's balance curve; omit it for the all-accounts money curve. Either
 * way this sums every execution — an idea run across three accounts
 * contributes three points/legs, which is correct here: this is a dollar
 * curve, not an edge curve. */
export function buildBalanceCurve(trades: Trade[], accountId?: string): CurvePoint[] {
  const rows = trades.flatMap((t) => t.executions.map((e) => ({ e, pair: t.pair })));
  const scoped = accountId ? rows.filter((r) => r.e.account_id === accountId) : rows;
  const closed = scoped
    .filter((r) => !isExecutionOpen(r.e))
    .slice()
    .sort((a, b) => a.e.date_closed.localeCompare(b.e.date_closed));

  let cum = 0;
  const points: CurvePoint[] = closed.map(({ e, pair }) => {
    cum += e.blended_pnl;
    return { date: e.date_closed, cumPnl: Math.round(cum * 100) / 100, pnl: e.blended_pnl, pair };
  });

  const openExec = scoped.find((r) => isExecutionOpen(r.e));
  if (openExec) {
    points.push({ date: new Date().toISOString(), cumPnl: Math.round(cum * 100) / 100, pnl: 0, pair: openExec.pair, isLive: true });
  }
  return points;
}

export interface DrawdownWindow {
  startIndex: number;
  endIndex: number;
  peak: number;
  trough: number;
  depth: number;
}

export function computeDrawdownWindows(points: CurvePoint[]): DrawdownWindow[] {
  const windows: DrawdownWindow[] = [];
  let peak = points[0]?.cumPnl ?? 0;
  let peakIndex = 0;
  let inDrawdown = false;
  let troughValue = peak;
  let troughIndex = 0;

  for (let i = 1; i < points.length; i++) {
    const v = points[i].cumPnl;
    if (v >= peak) {
      if (inDrawdown && peakIndex !== troughIndex) {
        windows.push({ startIndex: peakIndex, endIndex: troughIndex, peak, trough: troughValue, depth: peak - troughValue });
      }
      peak = v;
      peakIndex = i;
      inDrawdown = false;
      troughValue = v;
      troughIndex = i;
    } else if (v < troughValue) {
      troughValue = v;
      troughIndex = i;
      inDrawdown = true;
    }
  }
  if (inDrawdown && peakIndex !== troughIndex) {
    windows.push({ startIndex: peakIndex, endIndex: troughIndex, peak, trough: troughValue, depth: peak - troughValue });
  }
  return windows;
}

export function computeMaxDrawdown(points: CurvePoint[]): number {
  let peak = points[0]?.cumPnl ?? 0;
  let maxDd = 0;
  for (const p of points) {
    if (p.cumPnl > peak) peak = p.cumPnl;
    maxDd = Math.max(maxDd, peak - p.cumPnl);
  }
  return maxDd;
}
