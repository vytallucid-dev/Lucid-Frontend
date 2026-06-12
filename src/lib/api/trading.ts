import { apiFetch } from "./client";
import type {
  Account,
  Trade,
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

export interface CreateTradePayload {
  account_id: string;
  model: string;
  pair: string;
  direction: Direction;
  entry_price: number;
  sl_price: number;
  first_tp_price?: number | null;
  main_tp_price: number;
  lot_size: number;
  risk_pct: number;
  conviction: Conviction;
  fundamental_score?: number | null;
  psychology?: string | null;
  notes?: string | null;
  screenshots?: string[];
  date_opened?: string;
  is_closed?: boolean;
  partial_exit_price?: number | null;
  partial_exit_lot_pct?: number | null;
  main_exit_price?: number | null;
  date_closed?: string | null;
  exit_type?: ExitType;
}
export type UpdateTradePayload = Partial<CreateTradePayload>;

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

// ─── Trades ───────────────────────────────────────────────────────────────────

export async function getTrades(): Promise<Trade[]> {
  return (await apiFetch<Envelope<Trade[]>>("/api/trading/trades")).data;
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
