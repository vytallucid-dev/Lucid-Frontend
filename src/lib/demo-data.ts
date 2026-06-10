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
export type ModelName = '4HPullBack' | 'Breakout' | 'Short';
export type Pair = 'EURUSD' | 'GBPUSD' | 'USDJPY' | 'EURJPY' | 'GBPJPY' | 'XAUUSD';
export type PlannedStatus = 'Watching' | 'Ready' | 'Invalidated' | 'Cancelled';

export interface Trade {
  id: string;
  account_id: string;
  model: ModelName;
  pair: Pair;
  direction: Direction;
  entry_price: number;
  sl_price: number;
  first_tp_price: number | null;
  main_tp_price: number;
  partial_exit_price: number | null;
  partial_exit_lot_pct: number | null;
  main_exit_price: number;
  lot_size: number;
  total_pips: number;
  risk_pct: number;
  conviction: Conviction;
  blended_pnl: number;
  blended_rr: number;
  exit_type: ExitType;
  date_opened: string; // ISO
  date_closed: string; // ISO
  session: Session;
  fundamental_score: number | null; // 1-10, null if not logged
  screenshots: string[]; // URL placeholders
  psychology: string;
  notes: string;
  // Phase 3 placeholder fields
  pre_trade_memory: PreTradeMemory | null;
  debrief_memory: DebriefMemory | null;
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
  current_balance: number;
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

export const trades: Trade[] = [
  // Trade 21 — current EURUSD short, running (most recent)
  {
    id: 'trd_21',
    account_id: 'acc_1',
    model: 'Short',
    pair: 'EURUSD',
    direction: 'Sell',
    entry_price: 1.0865,
    sl_price: 1.0905,
    first_tp_price: 1.0825,
    main_tp_price: 1.0780,
    partial_exit_price: null,
    partial_exit_lot_pct: null,
    main_exit_price: 0,
    lot_size: 0.45,
    total_pips: 0,
    risk_pct: 1.0,
    conviction: 'High',
    blended_pnl: 0,
    blended_rr: 0,
    exit_type: 'TP',
    date_opened: '2026-04-28T14:15:00Z',
    date_closed: '',
    session: 'London',
    fundamental_score: 7,
    screenshots: ['/demo/charts/trd21-entry.png'],
    psychology: 'Patient',
    notes: 'EMA rejection clean. Breakdown candle close confirmed.',
    pre_trade_memory: {
      setup_description: 'EURUSD at major resistance 1.0900. Shoot into level on Friday. EMA acting as ceiling.',
      fundamental_bias_at_entry: 'USD bullish — strong NFP, hawkish Fed talk. EUR weak — PMI miss.',
      lucid_analysis: '[Phase 3 placeholder — Lucid pre-trade analysis will appear here]',
      agreements: ['Fundamental bias supports short', 'Setup matches Short model template'],
      disagreements: [],
      decision_reasoning: 'Aligned setup + fundamentals. Conviction High. Sized 1% risk.',
    },
    debrief_memory: null,
  },
  // Trade 20 — EURUSD short winner
  {
    id: 'trd_20',
    account_id: 'acc_1',
    model: 'Short',
    pair: 'EURUSD',
    direction: 'Sell',
    entry_price: 1.0920,
    sl_price: 1.0960,
    first_tp_price: 1.0880,
    main_tp_price: 1.0820,
    partial_exit_price: 1.0880,
    partial_exit_lot_pct: 25,
    main_exit_price: 1.0820,
    lot_size: 0.40,
    total_pips: 95,
    risk_pct: 1.0,
    conviction: 'High',
    blended_pnl: 284,
    blended_rr: 2.85,
    exit_type: 'Partial+TP',
    date_opened: '2026-04-15T13:45:00Z',
    date_closed: '2026-04-22T18:30:00Z',
    session: 'London',
    fundamental_score: 8,
    screenshots: ['/demo/charts/trd20-entry.png', '/demo/charts/trd20-exit.png'],
    psychology: 'Confident',
    notes: 'Template trade for Short model. Clean execution.',
    pre_trade_memory: null,
    debrief_memory: null,
  },
  // Trade 19 — Gold winner
  {
    id: 'trd_19',
    account_id: 'acc_1',
    model: '4HPullBack',
    pair: 'XAUUSD',
    direction: 'Buy',
    entry_price: 2310,
    sl_price: 2295,
    first_tp_price: 2330,
    main_tp_price: 2360,
    partial_exit_price: 2330,
    partial_exit_lot_pct: 30,
    main_exit_price: 2358,
    lot_size: 0.15,
    total_pips: 144,
    risk_pct: 1.2,
    conviction: 'High',
    blended_pnl: 312,
    blended_rr: 3.21,
    exit_type: 'Partial+TP',
    date_opened: '2026-04-02T08:30:00Z',
    date_closed: '2026-04-09T16:45:00Z',
    session: 'Asian',
    fundamental_score: 9,
    screenshots: ['/demo/charts/trd19-entry.png'],
    psychology: 'Calm',
    notes: 'Daily 0.618 fib + EMA confluence. Multiple touches confirmed base.',
    pre_trade_memory: null,
    debrief_memory: null,
  },
  // Trade 18 — Gold loser (Iran war wipeout)
  {
    id: 'trd_18',
    account_id: 'acc_1',
    model: '4HPullBack',
    pair: 'XAUUSD',
    direction: 'Buy',
    entry_price: 2285,
    sl_price: 2270,
    first_tp_price: 2305,
    main_tp_price: 2330,
    partial_exit_price: null,
    partial_exit_lot_pct: null,
    main_exit_price: 2270,
    lot_size: 0.12,
    total_pips: -150,
    risk_pct: 1.0,
    conviction: 'Medium',
    blended_pnl: -100,
    blended_rr: -1.0,
    exit_type: 'SL',
    date_opened: '2026-03-25T10:00:00Z',
    date_closed: '2026-03-26T22:30:00Z',
    session: 'Asian',
    fundamental_score: 6,
    screenshots: [],
    psychology: 'Frustrated',
    notes: 'Iran headline gap. Floating profit hit 3% then reversed — should have moved SL to BE. Rule established.',
    pre_trade_memory: null,
    debrief_memory: null,
  },
  // Trade 17 — EURUSD winner
  {
    id: 'trd_17',
    account_id: 'acc_1',
    model: '4HPullBack',
    pair: 'EURUSD',
    direction: 'Buy',
    entry_price: 1.0780,
    sl_price: 1.0750,
    first_tp_price: 1.0810,
    main_tp_price: 1.0850,
    partial_exit_price: 1.0810,
    partial_exit_lot_pct: 25,
    main_exit_price: 1.0850,
    lot_size: 0.50,
    total_pips: 65,
    risk_pct: 1.5,
    conviction: 'High',
    blended_pnl: 245,
    blended_rr: 2.33,
    exit_type: 'Partial+TP',
    date_opened: '2026-03-12T14:00:00Z',
    date_closed: '2026-03-19T17:00:00Z',
    session: 'London',
    fundamental_score: 8,
    screenshots: [],
    psychology: 'Patient',
    notes: 'Textbook 4HPullBack. EMA stack supportive.',
    pre_trade_memory: null,
    debrief_memory: null,
  },
  // Trade 16 — GBPUSD breakout loser
  {
    id: 'trd_16',
    account_id: 'acc_1',
    model: 'Breakout',
    pair: 'GBPUSD',
    direction: 'Buy',
    entry_price: 1.2650,
    sl_price: 1.2620,
    first_tp_price: 1.2680,
    main_tp_price: 1.2720,
    partial_exit_price: null,
    partial_exit_lot_pct: null,
    main_exit_price: 1.2620,
    lot_size: 0.35,
    total_pips: -30,
    risk_pct: 1.0,
    conviction: 'Medium',
    blended_pnl: -105,
    blended_rr: -1.0,
    exit_type: 'SL',
    date_opened: '2026-03-05T15:30:00Z',
    date_closed: '2026-03-06T11:15:00Z',
    session: 'London-NY Overlap',
    fundamental_score: 5,
    screenshots: [],
    psychology: 'Eager',
    notes: 'EURUSD did not confirm. Rule violation — added correlation filter after this.',
    pre_trade_memory: null,
    debrief_memory: null,
  },
  // Trade 15 — USDJPY short failed
  {
    id: 'trd_15',
    account_id: 'acc_1',
    model: 'Short',
    pair: 'USDJPY',
    direction: 'Sell',
    entry_price: 152.40,
    sl_price: 152.80,
    first_tp_price: 152.00,
    main_tp_price: 151.40,
    partial_exit_price: null,
    partial_exit_lot_pct: null,
    main_exit_price: 152.80,
    lot_size: 0.20,
    total_pips: -40,
    risk_pct: 0.8,
    conviction: 'Low',
    blended_pnl: -80,
    blended_rr: -1.0,
    exit_type: 'SL',
    date_opened: '2026-02-22T16:00:00Z',
    date_closed: '2026-02-24T05:30:00Z',
    session: 'London-NY Overlap',
    fundamental_score: 4,
    screenshots: [],
    psychology: 'Impulsive',
    notes: 'Entered before EMA rejection complete. Template failure for Short model — informed model rules.',
    pre_trade_memory: null,
    debrief_memory: null,
  },
  // Trade 14 — EURJPY winner
  {
    id: 'trd_14',
    account_id: 'acc_1',
    model: '4HPullBack',
    pair: 'EURJPY',
    direction: 'Buy',
    entry_price: 164.50,
    sl_price: 163.80,
    first_tp_price: 165.30,
    main_tp_price: 166.50,
    partial_exit_price: 165.30,
    partial_exit_lot_pct: 30,
    main_exit_price: 166.40,
    lot_size: 0.20,
    total_pips: 175,
    risk_pct: 1.0,
    conviction: 'High',
    blended_pnl: 130,
    blended_rr: 2.71,
    exit_type: 'Partial+TP',
    date_opened: '2026-02-10T13:00:00Z',
    date_closed: '2026-02-17T16:30:00Z',
    session: 'London',
    fundamental_score: 7,
    screenshots: [],
    psychology: 'Confident',
    notes: 'Clean pullback structure. Held full 7 days.',
    pre_trade_memory: null,
    debrief_memory: null,
  },
  // Trade 13 — USDJPY breakeven
  {
    id: 'trd_13',
    account_id: 'acc_1',
    model: 'Breakout',
    pair: 'USDJPY',
    direction: 'Buy',
    entry_price: 151.50,
    sl_price: 151.20,
    first_tp_price: 151.80,
    main_tp_price: 152.20,
    partial_exit_price: null,
    partial_exit_lot_pct: null,
    main_exit_price: 151.50,
    lot_size: 0.25,
    total_pips: 0,
    risk_pct: 0.7,
    conviction: 'Medium',
    blended_pnl: 0,
    blended_rr: 0,
    exit_type: 'BE',
    date_opened: '2026-01-30T15:00:00Z',
    date_closed: '2026-02-02T10:00:00Z',
    session: 'London-NY Overlap',
    fundamental_score: 5,
    screenshots: [],
    psychology: 'Neutral',
    notes: 'Moved SL to BE after partial profit. Stopped out at BE — system working.',
    pre_trade_memory: null,
    debrief_memory: null,
  },
  // Trade 12 — Gold winner
  {
    id: 'trd_12',
    account_id: 'acc_1',
    model: '4HPullBack',
    pair: 'XAUUSD',
    direction: 'Buy',
    entry_price: 2265,
    sl_price: 2250,
    first_tp_price: 2285,
    main_tp_price: 2310,
    partial_exit_price: 2285,
    partial_exit_lot_pct: 30,
    main_exit_price: 2308,
    lot_size: 0.10,
    total_pips: 134,
    risk_pct: 0.9,
    conviction: 'High',
    blended_pnl: 139,
    blended_rr: 2.86,
    exit_type: 'Partial+TP',
    date_opened: '2026-01-22T09:30:00Z',
    date_closed: '2026-01-29T15:00:00Z',
    session: 'Asian',
    fundamental_score: 8,
    screenshots: [],
    psychology: 'Patient',
    notes: 'High conviction trade. Sized up appropriately.',
    pre_trade_memory: null,
    debrief_memory: null,
  },
];

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

export function calculatePnLPercent(trade: Trade, account: Account): number {
  return (trade.blended_pnl / account.account_size) * 100;
}

export function getAccountById(id: string): Account | undefined {
  return accounts.find(a => a.id === id);
}

export function getDrawdownPct(account: Account): number {
  const drawdown = account.account_size - account.current_balance;
  return drawdown > 0 ? (drawdown / account.account_size) * 100 : 0;
}

export function getProfitPct(account: Account): number {
  return ((account.current_balance - account.account_size) / account.account_size) * 100;
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
