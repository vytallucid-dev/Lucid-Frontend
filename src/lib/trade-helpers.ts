// lib/trade-helpers.ts
//
// Small bridging helpers between Trade (the idea) and Execution (the fill,
// per account). Every consumer that needs to know "is this idea open" or
// "what's the idea's outcome" goes through here so that decision is made in
// exactly one place: the primary execution.
import type { Trade, Execution } from './demo-data';

/** The execution that decides the idea's outcome for edge statistics. */
export function getPrimaryExecution(trade: Trade): Execution | undefined {
  return trade.executions.find((e) => e.is_primary) ?? trade.executions[0];
}

export function isExecutionOpen(e: Execution): boolean {
  return e.date_closed === '';
}

/** The idea is "open" iff its primary execution hasn't closed yet. */
export function isTradeOpen(trade: Trade): boolean {
  const primary = getPrimaryExecution(trade);
  return primary ? isExecutionOpen(primary) : true;
}

/** How many distinct accounts this idea was executed across. */
export function tradeAccountCount(trade: Trade): number {
  return new Set(trade.executions.map((e) => e.account_id)).size;
}

export function isMultiAccount(trade: Trade): boolean {
  return tradeAccountCount(trade) > 1;
}

/** All of a trade's executions that belong to one account. */
export function executionsForAccount(trade: Trade, accountId: string): Execution[] {
  return trade.executions.filter((e) => e.account_id === accountId);
}

/** Win / Loss / BE / Live, decided by the primary execution's P&L sign — the
 * idea's outcome for every edge statistic. */
export type EdgeOutcome = 'Win' | 'Loss' | 'BE' | 'Live';

export function edgeOutcome(trade: Trade): EdgeOutcome {
  const p = getPrimaryExecution(trade);
  if (!p || isExecutionOpen(p)) return 'Live';
  if (p.blended_pnl > 0) return 'Win';
  if (p.blended_pnl < 0) return 'Loss';
  return 'BE';
}
