import { apiFetch } from "./client";
import type {
  Account,
  Trade,
  Execution,
  PlannedTrade,
  Model,
  PairConfig,
  AccountType,
  AccountStatus,
  AccountStage,
  Direction,
  Conviction,
  ExitType,
  CashFlowType,
  PlannedStatus,
} from "@/lib/demo-data";

// The backend wraps reads/writes in { success, data }.
interface Envelope<T> {
  success: boolean;
  data: T;
}

// Pairs carry a server id (the demo PairConfig type is keyed by symbol only).
export type ApiPair = PairConfig & { id: string };

// ─── Payload types (snake_case, mirror the backend Zod schemas) ───────────────

export interface CreateAccountPayload {
  account_type: AccountType;
  account_name: string;
  account_size: number;
  current_balance?: number;
  currency?: string;
  status?: AccountStatus;
  starting_date: string; // YYYY-MM-DD
  broker?: string | null;
  profit_goal_pct?: number | null;
  prop_firm?: string | null;
  stage?: AccountStage | null;
  max_drawdown_pct?: number | null;
  profit_target_pct?: number | null;
}
export type UpdateAccountPayload = Partial<CreateAccountPayload>;

export interface CashFlowPayload {
  type: CashFlowType;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string | null;
}

// One account's fill within a CreateTradePayload's `executions` array.
export interface CreateExecutionPayload {
  account_id: string;
  is_primary?: boolean;
  risk_pct: number;
  lot_size: number;
  entry_price: number;
  is_closed?: boolean;
  partial_exit_price?: number | null;
  partial_exit_lot_pct?: number | null;
  main_exit_price?: number | null;
  date_closed?: string | null;
  exit_type?: ExitType;
  // User-entered realized net P&L for a closed execution. Stored verbatim (no
  // recompute); the sign decides this execution's outcome everywhere.
  net_pnl?: number | null;
}
export type UpdateExecutionPayload = Partial<CreateExecutionPayload>;

// Trade = the idea. Created with one or more executions inline; executions on
// an existing trade are then added/updated/removed/re-primaried individually.
export interface CreateTradePayload {
  model: string;
  pair: string;
  direction: Direction;
  planned_entry: number;
  planned_sl: number;
  planned_first_tp?: number | null;
  planned_main_tp: number;
  conviction: Conviction;
  fundamental_score?: number | null;
  psychology?: string | null;
  notes?: string | null;
  screenshots?: string[];
  date_opened?: string;
  executions: CreateExecutionPayload[];
}
// Idea-level fields only — executions are managed via the /executions
// endpoints below, not folded into a trade PATCH.
export type UpdateTradePayload = Partial<Omit<CreateTradePayload, "executions">>;

export interface CreatePlannedPayload {
  pair: string;
  model: string;
  direction: Direction;
  planned_entry: number;
  planned_sl: number;
  planned_first_tp?: number | null;
  planned_main_tp: number;
  planned_risk_pct?: number;
  conviction?: Conviction;
  status?: PlannedStatus;
  notes?: string | null;
  screenshots?: string[];
  current_market_price?: number;
  date_added?: string; // ISO datetime or YYYY-MM-DD; defaults to now server-side
}
export type UpdatePlannedPayload = Partial<CreatePlannedPayload>;

export interface CreateModelPayload {
  name: string;
  description?: string;
  rules?: string;
  status?: "Active" | "Inactive";
}
export type UpdateModelPayload = Partial<CreateModelPayload>;

export interface CreatePairPayload {
  symbol: string;
  display_name: string;
  flag_a?: string;
  flag_b?: string;
  pip_value: number;
  status?: "Active" | "Inactive";
}
export type UpdatePairPayload = Partial<CreatePairPayload>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const jsonBody = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

// ─── Accounts ─────────────────────────────────────────────────────────────────

export async function getAccounts(): Promise<Account[]> {
  return (await apiFetch<Envelope<Account[]>>("/api/trading/accounts")).data;
}
export async function createAccount(body: CreateAccountPayload): Promise<Account> {
  return (await apiFetch<Envelope<Account>>("/api/trading/accounts", { method: "POST", ...jsonBody(body) })).data;
}
export async function updateAccount(id: string, body: UpdateAccountPayload): Promise<Account> {
  return (await apiFetch<Envelope<Account>>(`/api/trading/accounts/${id}`, { method: "PATCH", ...jsonBody(body) })).data;
}
export async function deleteAccount(id: string): Promise<void> {
  await apiFetch(`/api/trading/accounts/${id}`, { method: "DELETE" });
}
export async function addCashFlow(id: string, body: CashFlowPayload): Promise<Account> {
  return (await apiFetch<Envelope<Account>>(`/api/trading/accounts/${id}/cash-flows`, { method: "POST", ...jsonBody(body) })).data;
}

// ─── Trades (ideas) ─────────────────────────────────────────────────────────

// account_id: ideas with an execution in that account, each idea's
// `executions` filtered down to that account's fill(s) only.
export async function getTrades(accountId?: string): Promise<Trade[]> {
  const qs = accountId ? `?account_id=${encodeURIComponent(accountId)}` : "";
  return (await apiFetch<Envelope<Trade[]>>(`/api/trading/trades${qs}`)).data;
}
export async function getTrade(id: string): Promise<Trade> {
  return (await apiFetch<Envelope<Trade>>(`/api/trading/trades/${id}`)).data;
}
export async function createTrade(body: CreateTradePayload): Promise<Trade> {
  return (await apiFetch<Envelope<Trade>>("/api/trading/trades", { method: "POST", ...jsonBody(body) })).data;
}
export async function updateTrade(id: string, body: UpdateTradePayload): Promise<Trade> {
  return (await apiFetch<Envelope<Trade>>(`/api/trading/trades/${id}`, { method: "PATCH", ...jsonBody(body) })).data;
}
export async function deleteTrade(id: string): Promise<void> {
  await apiFetch(`/api/trading/trades/${id}`, { method: "DELETE" });
}

// ─── Executions (fills, per account) ───────────────────────────────────────

export async function addExecution(tradeId: string, body: CreateExecutionPayload): Promise<Trade> {
  return (await apiFetch<Envelope<Trade>>(`/api/trading/trades/${tradeId}/executions`, { method: "POST", ...jsonBody(body) })).data;
}
export async function updateExecution(tradeId: string, executionId: string, body: UpdateExecutionPayload): Promise<Trade> {
  return (await apiFetch<Envelope<Trade>>(`/api/trading/trades/${tradeId}/executions/${executionId}`, { method: "PATCH", ...jsonBody(body) })).data;
}
export async function removeExecution(tradeId: string, executionId: string): Promise<Trade> {
  return (await apiFetch<Envelope<Trade>>(`/api/trading/trades/${tradeId}/executions/${executionId}`, { method: "DELETE" })).data;
}
export async function setPrimaryExecution(tradeId: string, executionId: string): Promise<Trade> {
  return (await apiFetch<Envelope<Trade>>(`/api/trading/trades/${tradeId}/executions/${executionId}/primary`, { method: "POST" })).data;
}

// ─── Planned trades ───────────────────────────────────────────────────────────

export async function getPlanned(): Promise<PlannedTrade[]> {
  return (await apiFetch<Envelope<PlannedTrade[]>>("/api/trading/planned")).data;
}
export async function createPlanned(body: CreatePlannedPayload): Promise<PlannedTrade> {
  return (await apiFetch<Envelope<PlannedTrade>>("/api/trading/planned", { method: "POST", ...jsonBody(body) })).data;
}
export async function updatePlanned(id: string, body: UpdatePlannedPayload): Promise<PlannedTrade> {
  return (await apiFetch<Envelope<PlannedTrade>>(`/api/trading/planned/${id}`, { method: "PATCH", ...jsonBody(body) })).data;
}
export async function deletePlanned(id: string): Promise<void> {
  await apiFetch(`/api/trading/planned/${id}`, { method: "DELETE" });
}

// ─── Models ───────────────────────────────────────────────────────────────────

export async function getModels(): Promise<Model[]> {
  return (await apiFetch<Envelope<Model[]>>("/api/trading/models")).data;
}
export async function createModel(body: CreateModelPayload): Promise<Model> {
  return (await apiFetch<Envelope<Model>>("/api/trading/models", { method: "POST", ...jsonBody(body) })).data;
}
export async function updateModel(id: string, body: UpdateModelPayload): Promise<Model> {
  return (await apiFetch<Envelope<Model>>(`/api/trading/models/${id}`, { method: "PATCH", ...jsonBody(body) })).data;
}
export async function deleteModel(id: string): Promise<void> {
  await apiFetch(`/api/trading/models/${id}`, { method: "DELETE" });
}

// ─── Pairs ────────────────────────────────────────────────────────────────────

export async function getPairs(): Promise<ApiPair[]> {
  return (await apiFetch<Envelope<ApiPair[]>>("/api/trading/pairs")).data;
}
export async function createPair(body: CreatePairPayload): Promise<ApiPair> {
  return (await apiFetch<Envelope<ApiPair>>("/api/trading/pairs", { method: "POST", ...jsonBody(body) })).data;
}
export async function updatePair(id: string, body: UpdatePairPayload): Promise<ApiPair> {
  return (await apiFetch<Envelope<ApiPair>>(`/api/trading/pairs/${id}`, { method: "PATCH", ...jsonBody(body) })).data;
}
export async function deletePair(id: string): Promise<void> {
  await apiFetch(`/api/trading/pairs/${id}`, { method: "DELETE" });
}
