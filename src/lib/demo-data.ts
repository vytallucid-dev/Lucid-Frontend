// lib/demo-data.ts

export type Conviction = 'Low' | 'Medium' | 'High';
export type Direction = 'Buy' | 'Sell';
export type ExitType = 'TP' | 'SL' | 'Manual' | 'Partial+TP' | 'Partial+SL' | 'BE';
export type Session = 'Asian' | 'London' | 'London-NY Overlap' | 'New York';
export type AccountStage = 'Stage 1' | 'Stage 2' | 'Funded' | 'Blown';
export type AccountStatus = 'Active' | 'Passed' | 'Blown' | 'Closed';
// The spine of the all-traders repositioning: an account's type decides which
// fields and language appear. Personal/Demo are normal broker accounts; Prop
// Firm is the opt-in add-on that surfaces challenge/stage/drawdown/payout.
export type AccountType = 'personal' | 'demo' | 'prop_firm';
export type CashFlowType = 'deposit' | 'withdrawal' | 'payout';
// Models and pairs are user-defined (managed in the Trading Hub → System tab),
// so these identifiers are free-form strings rather than fixed unions. The six
// seed pairs / three seed models below are just defaults.
export type ModelName = string;
export type Pair = string;
export type PlannedStatus = 'Watching' | 'Ready' | 'Invalidated' | 'Cancelled';
// How a trade's Oracle entry score came to be stored. See Trade below.
export type OracleScoreSource = 'snapshot' | 'legacy' | 'manual';

// ── Integrity ────────────────────────────────────────────────────────────────
//
// Whether a stored trade is internally consistent. Computed server-side on
// every read from the row itself and never stored, so there is no state to go
// stale and no "resolve" action: correcting the offending field makes the next
// read come back clean.
//
// 'blocking' failures cannot be written on any path; 'advisory' failures refuse
// a create but are allowed through on an edit or an import, so an already-wrong
// trade can be corrected incrementally instead of being locked.
export type ProblemSeverity = 'blocking' | 'advisory';

export interface IntegrityProblem {
  /** snake_case field path, matching the API body shape. */
  field: string;
  message: string;
  severity: ProblemSeverity;
  /** The execution this failure belongs to, or null when it is idea-level. */
  execution_id: string | null;
}

export interface TradeIntegrity {
  /** False ⇒ needs attention: flagged in the journal, excluded from every
   * edge statistic (numerator and denominator both), never hidden. */
  ok: boolean;
  problems: IntegrityProblem[];
}

// Execution = the fill, per account: its own account, risk %, lot size,
// actual entry, exit, P&L and R. A Trade (the idea) always has at least one.
export interface Execution {
  id: string;
  trade_id: string;
  account_id: string;
  is_primary: boolean; // the idea's outcome, for edge statistics, is THIS execution's outcome
  risk_pct: number;
  lot_size: number;
  entry_price: number; // the actual fill — may differ from the idea's planned_entry
  partial_exit_price: number | null;
  partial_exit_lot_pct: number | null;
  main_exit_price: number;
  total_pips: number;
  blended_pnl: number; // entered by hand, stored verbatim — never derived from prices
  // Realised R for this fill: pips achieved / pips risked against the idea's
  // stop. Lot size and pip value cancel, so it compares across account sizes.
  blended_rr: number;
  exit_type: ExitType;
  date_closed: string; // ISO, or "" if this execution is still open
  // Oracle score for the trade's pair ON this fill's exit date, frozen when the
  // fill closed. Exit lives per-execution because two accounts can close the
  // same idea on different days. Null when no score exists for that date.
  oracle_score_at_exit: number | null;
  oracle_score_exit_date: string | null; // YYYY-MM-DD (UTC) the score addresses
  oracle_score_exit_captured_at: string | null;
}

// Trade = the idea: one setup, one pair, one direction, one entry rationale.
// This is the unit every edge statistic counts. Execution-specific fields —
// account, risk %, lot size, actual prices, exit, P&L, R — live on
// `executions`, one per account the idea was taken in.
export interface Trade {
  id: string;
  model: ModelName;
  pair: Pair;
  direction: Direction;
  planned_entry: number;
  planned_sl: number;
  planned_first_tp: number | null;
  planned_main_tp: number;
  conviction: Conviction;
  date_opened: string; // ISO
  session: Session;
  // Oracle score for this pair ON the entry date, frozen at write time — never
  // a live read, so a later revision to the Oracle's history cannot rewrite
  // what a past trade was taken against. `source` says how much weight it
  // carries: 'snapshot' is a real dated read, 'legacy' was carried across from
  // the pre-snapshot era and is addressed to no date, 'manual' the user typed.
  oracle_score_at_entry: number | null;
  oracle_score_entry_date: string | null; // YYYY-MM-DD (UTC), null when legacy/manual
  oracle_score_entry_captured_at: string | null;
  oracle_score_entry_source: OracleScoreSource | null;
  // R the plan aimed at: planned reward / planned risk. Derived server-side on
  // every read from the planned prices, so it can never go stale against them.
  // Null when the plan has no target, or no risk to divide by.
  expected_rr: number | null;
  // Recomputed server-side on every read. THE one implementation — no surface
  // re-derives it. See TradeIntegrity above.
  integrity: TradeIntegrity;
  screenshots: string[]; // URL placeholders
  psychology: string;
  notes: string;
  // Phase 3 placeholder fields
  pre_trade_memory: PreTradeMemory | null;
  debrief_memory: DebriefMemory | null;
  executions: Execution[];
}

export interface PreTradeMemory {
  setup_description: string;
  fundamental_bias_at_entry: string;
  lucid_analysis: string; // Phase 3
  agreements: string[];
  disagreements: string[];
  decision_reasoning: string;
}

export interface DebriefMemory {
  outcome_summary: string;
  expectation_vs_reality: string;
  decision_quality_note: string;
}

export interface Account {
  id: string;
  account_type: AccountType; // drives conditional fields + language everywhere
  account_name: string;
  account_size: number; // starting balance (universal)
  current_balance: number; // live equity = account_size + trading_pnl + net_deposits
  trading_pnl?: number; // realized P&L from closed trades only (full-equity model)
  net_deposits?: number; // deposits − withdrawals − payouts
  currency: string;
  status: AccountStatus;
  starting_date: string;
  // Personal / Demo
  broker?: string; // free-text broker name (optional)
  profit_goal_pct?: number | null; // optional user-set goal (not firm-imposed)
  // Prop firm (add-on) — preserved, only meaningful when account_type === 'prop_firm'
  prop_firm?: string;
  stage?: AccountStage;
  max_drawdown_pct?: number;
  profit_target_pct?: number;
  // Money movements: deposits/withdrawals for personal, payouts for prop
  cash_flows: CashFlow[];
  payouts: Payout[]; // preserved (prop firm payout history)
}

export interface Payout {
  date: string;
  amount: number;
  running_total: number;
}

export interface CashFlow {
  date: string;
  type: CashFlowType;
  amount: number; // positive magnitude; `type` carries the direction
  note?: string;
}

export interface Model {
  id: string;
  name: ModelName;
  description: string;
  rules: string;
  status: 'Active' | 'Inactive';
}

export interface PairConfig {
  symbol: Pair;
  display_name: string;
  flag_a: string; // emoji
  flag_b: string;
  pip_value: number;
  status: 'Active' | 'Inactive';
}

export interface PlannedTrade {
  id: string;
  pair: Pair;
  model: ModelName;
  direction: Direction;
  planned_entry: number;
  planned_sl: number;
  planned_first_tp: number | null;
  planned_main_tp: number;
  planned_risk_pct: number;
  conviction: Conviction;
  status: PlannedStatus;
  date_added: string;
  notes: string;
  screenshots: string[];
  current_market_price: number; // for distance-to-entry calc
}

// === SEED DATA ===

// A deliberate mix so the type-aware UI is visible: one Prop Firm (full
// challenge/drawdown/payout treatment), one Personal (broker + deposits/
// withdrawals + optional goal), one Demo (practice, no money pressure).
export const accounts: Account[] = [
  {
    id: 'acc_1',
    account_type: 'prop_firm',
    prop_firm: 'FundingPips',
    account_name: 'FP 10k Funded',
    account_size: 10000,
    current_balance: 10175,
    currency: 'USD',
    stage: 'Funded',
    status: 'Active',
    max_drawdown_pct: 5,
    profit_target_pct: 5,
    starting_date: '2026-01-15',
    cash_flows: [],
    payouts: [
      { date: '2026-03-05', amount: 210, running_total: 210 },
      { date: '2026-04-02', amount: 140, running_total: 350 },
    ],
  },
  {
    id: 'acc_2',
    account_type: 'personal',
    broker: 'IC Markets',
    account_name: 'IC Markets Live',
    account_size: 5000,
    current_balance: 5840,
    currency: 'USD',
    status: 'Active',
    profit_goal_pct: 20,
    starting_date: '2025-11-20',
    cash_flows: [
      { date: '2025-11-20', type: 'deposit', amount: 5000, note: 'Initial funding' },
      { date: '2026-02-10', type: 'withdrawal', amount: 500, note: 'Profit withdrawal' },
      { date: '2026-03-15', type: 'deposit', amount: 1000, note: 'Top-up' },
    ],
    payouts: [],
  },
  {
    id: 'acc_3',
    account_type: 'demo',
    broker: 'MT5 Demo',
    account_name: 'Breakout Strategy Demo',
    account_size: 10000,
    current_balance: 10420,
    currency: 'USD',
    status: 'Active',
    profit_goal_pct: null,
    starting_date: '2026-02-01',
    cash_flows: [],
    payouts: [],
  },
  {
    id: 'acc_4',
    account_type: 'prop_firm',
    prop_firm: 'Alpha Capital',
    account_name: 'AC 25k Stage 2',
    account_size: 25000,
    current_balance: 25640,
    currency: 'USD',
    stage: 'Stage 2',
    status: 'Active',
    max_drawdown_pct: 6,
    profit_target_pct: 8,
    starting_date: '2026-04-10',
    cash_flows: [],
    payouts: [],
  },
];

// ─── Account-type helpers (shared across Trading Hub + Dashboard) ─────────────

export function isPropAccount(a: Pick<Account, 'account_type'>): boolean {
  return a.account_type === 'prop_firm';
}

/**
 * Realized trading P&L (closed trades only) under the full-equity model. The
 * account's `current_balance` is live equity (size + trading P&L + net cash
 * flows), so this — not `current_balance − account_size` — is the true trading
 * performance. Falls back to balance − size for any account missing the field.
 */
export function accountTradingPnl(a: Account): number {
  return a.trading_pnl ?? (a.current_balance - a.account_size);
}

export function accountTypeLabel(type: AccountType): string {
  return type === 'prop_firm' ? 'Prop Firm' : type === 'demo' ? 'Demo' : 'Personal';
}

/** Pill colors: Personal = accent blue, Demo = muted gray, Prop = indigo/purple. */
export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  personal: '#3B82F6',
  demo: '#94A3B8',
  prop_firm: '#818CF8',
};

/** "Prop Firm" for prop accounts, "Broker" otherwise — the source-column label. */
export function accountSourceLabel(type: AccountType): string {
  return type === 'prop_firm' ? 'Prop Firm' : 'Broker';
}

/** The account's source name (firm for prop, broker for personal/demo). */
export function accountSource(a: Account): string {
  const src = a.account_type === 'prop_firm' ? a.prop_firm : a.broker;
  return src && src.trim() ? src : '—';
}

export const models: Model[] = [
  {
    id: 'mdl_1',
    name: '4HPullBack',
    description: 'Pullback to key level on higher timeframe with EMA confirmation.',
    rules: 'Wait for significant pullback on HTF. Price reacts to key support (daily fib 0.5/0.618 + technical level). Multiple touches required — base formation. Descending channel must be broken or weakened. Price closes above both 4H 50 EMA and 1H 50 EMA — entry trigger.',
    status: 'Active',
  },
  {
    id: 'mdl_2',
    name: 'Breakout',
    description: 'Organic consolidation near key level, breakout candle close as entry.',
    rules: 'Price consolidates organically near key level for multiple candles. Not a news spike. Base formation mandatory. EMAs supporting from below. Correlated pair must confirm — if GBPUSD breaks out, EURUSD should align. Entry on breakout candle close.',
    status: 'Active',
  },
  {
    id: 'mdl_3',
    name: 'Short',
    description: 'Mirror of Breakout — rejection from EMA at resistance, breakdown entry.',
    rules: 'Price at major resistance. Shoots up into level. EMA above acts as ceiling. Rejection occurs. Breaks down through level. Enter on breakdown candle close. Falls are faster than rallies — timing critical.',
    status: 'Active',
  },
];

export const pairs: PairConfig[] = [
  { symbol: 'EURUSD', display_name: 'EUR/USD', flag_a: '🇪🇺', flag_b: '🇺🇸', pip_value: 10, status: 'Active' },
  { symbol: 'GBPUSD', display_name: 'GBP/USD', flag_a: '🇬🇧', flag_b: '🇺🇸', pip_value: 10, status: 'Active' },
  { symbol: 'USDJPY', display_name: 'USD/JPY', flag_a: '🇺🇸', flag_b: '🇯🇵', pip_value: 9.5, status: 'Active' },
  { symbol: 'EURJPY', display_name: 'EUR/JPY', flag_a: '🇪🇺', flag_b: '🇯🇵', pip_value: 9.5, status: 'Active' },
  { symbol: 'GBPJPY', display_name: 'GBP/JPY', flag_a: '🇬🇧', flag_b: '🇯🇵', pip_value: 9.5, status: 'Active' },
  { symbol: 'XAUUSD', display_name: 'Gold', flag_a: '🥇', flag_b: '🇺🇸', pip_value: 1, status: 'Active' },
];

// Dead fixture data (unused — no consumer imports this array; all
// pages read live Trade[] via useTrades()). Removed rather than
// hand-migrated to the new nested Trade+Execution shape for content
// nobody calls.
export const plannedTrades: PlannedTrade[] = [
  {
    id: 'plt_1',
    pair: 'GBPUSD',
    model: '4HPullBack',
    direction: 'Buy',
    planned_entry: 1.2580,
    planned_sl: 1.2540,
    planned_first_tp: 1.2620,
    planned_main_tp: 1.2680,
    planned_risk_pct: 1.0,
    conviction: 'High',
    status: 'Watching',
    date_added: '2026-05-01T10:00:00Z',
    notes: 'Waiting for clean retest of 1.2580 + EMA stack confirmation.',
    screenshots: [],
    current_market_price: 1.2615,
  },
  {
    id: 'plt_2',
    pair: 'XAUUSD',
    model: 'Breakout',
    direction: 'Buy',
    planned_entry: 2380,
    planned_sl: 2360,
    planned_first_tp: 2400,
    planned_main_tp: 2430,
    planned_risk_pct: 1.2,
    conviction: 'Medium',
    status: 'Ready',
    date_added: '2026-05-02T14:00:00Z',
    notes: 'Consolidating near 2380. Awaiting breakout candle close.',
    screenshots: [],
    current_market_price: 2378,
  },
  {
    id: 'plt_3',
    pair: 'EURJPY',
    model: 'Short',
    direction: 'Sell',
    planned_entry: 168.50,
    planned_sl: 169.20,
    planned_first_tp: 167.80,
    planned_main_tp: 166.50,
    planned_risk_pct: 0.8,
    conviction: 'Low',
    status: 'Invalidated',
    date_added: '2026-04-28T11:00:00Z',
    notes: 'Price broke above invalidation level — setup gone.',
    screenshots: [],
    current_market_price: 169.85,
  },
];

// === HELPER FUNCTIONS ===

export function getAccountById(id: string): Account | undefined {
  return accounts.find(a => a.id === id);
}

export function getDistanceToEntry(planned: PlannedTrade): { pips: number; direction: 'above' | 'below' | 'at' } {
  const pipMultiplier = planned.pair === 'XAUUSD' ? 1 : (planned.pair.endsWith('JPY') ? 100 : 10000);
  const diff = (planned.current_market_price - planned.planned_entry) * pipMultiplier;
  if (Math.abs(diff) < 1) return { pips: 0, direction: 'at' };
  return { pips: Math.abs(Math.round(diff)), direction: diff > 0 ? 'above' : 'below' };
}

export function getSessionFromTime(isoTime: string): Session {
  const date = new Date(isoTime);
  const hours = date.getUTCHours() + 5.5; // IST offset
  const adjusted = hours >= 24 ? hours - 24 : hours;
  if (adjusted >= 5.5 && adjusted < 11.5) return 'Asian';
  if (adjusted >= 13.5 && adjusted < 17.5) return 'London';
  if (adjusted >= 17.5 && adjusted < 21.5) return 'London-NY Overlap';
  return 'New York';
}

// === FORMATTING HELPERS ===

export function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toFixed(2);
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function formatPips(pips: number): string {
  if (pips === 0) return '0 pips';
  return pips > 0 ? `+${pips} pips` : `${pips} pips`;
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function formatTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m} UTC`;
}

export function getPairDisplay(symbol: Pair): string {
  const config = pairs.find(p => p.symbol === symbol);
  return config ? config.display_name : symbol;
}
