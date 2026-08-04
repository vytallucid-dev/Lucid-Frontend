"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/trading";

// Query-key roots. Keeping them centralized makes invalidation explicit.
export const tradingKeys = {
  accounts: ["trading", "accounts"] as const,
  trades: ["trading", "trades"] as const,
  planned: ["trading", "planned"] as const,
  models: ["trading", "models"] as const,
  pairs: ["trading", "pairs"] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useAccounts() {
  return useQuery({ queryKey: tradingKeys.accounts, queryFn: api.getAccounts });
}

export function useTrades() {
  return useQuery({ queryKey: tradingKeys.trades, queryFn: () => api.getTrades() });
}

// Account-filtered idea list: ideas with an execution in that account, each
// idea's `executions` narrowed to that account's fill(s). Distinct query key
// (not a client-side filter of useTrades()) so the "which account's numbers
// am I looking at" scoping is explicit and cacheable per account.
export function useTradesForAccount(accountId: string | undefined) {
  return useQuery({
    queryKey: [...tradingKeys.trades, "account", accountId],
    queryFn: () => api.getTrades(accountId),
    enabled: !!accountId,
  });
}

export function usePlanned() {
  return useQuery({ queryKey: tradingKeys.planned, queryFn: api.getPlanned });
}

export function useTradingModels() {
  return useQuery({ queryKey: tradingKeys.models, queryFn: api.getModels });
}

export function useTradingPairs() {
  return useQuery({ queryKey: tradingKeys.pairs, queryFn: api.getPairs });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

// Accounts
export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createAccount,
    onSuccess: () => qc.invalidateQueries({ queryKey: tradingKeys.accounts }),
  });
}
export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: api.UpdateAccountPayload }) =>
      api.updateAccount(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: tradingKeys.accounts }),
  });
}
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tradingKeys.accounts });
      qc.invalidateQueries({ queryKey: tradingKeys.trades }); // trades cascade-delete with the account
    },
  });
}
export function useAddCashFlow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: api.CashFlowPayload }) =>
      api.addCashFlow(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: tradingKeys.accounts }),
  });
}

// Trades — also refresh accounts, since closed-trade P&L drives account equity.
function invalidateTradesAndAccounts(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: tradingKeys.trades });
  qc.invalidateQueries({ queryKey: tradingKeys.accounts });
}
export function useCreateTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createTrade,
    onSuccess: () => invalidateTradesAndAccounts(qc),
  });
}
export function useUpdateTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: api.UpdateTradePayload }) =>
      api.updateTrade(id, body),
    onSuccess: () => invalidateTradesAndAccounts(qc),
  });
}
export function useDeleteTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTrade,
    onSuccess: () => invalidateTradesAndAccounts(qc),
  });
}

// Executions — same dual invalidation as trade mutations: an execution's
// P&L drives its account's balance, so both the idea list and the accounts
// list must refresh, exactly as create/update/delete trade already did.
export function useAddExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tradeId, body }: { tradeId: string; body: api.CreateExecutionPayload }) =>
      api.addExecution(tradeId, body),
    onSuccess: () => invalidateTradesAndAccounts(qc),
  });
}
export function useUpdateExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tradeId, executionId, body }: { tradeId: string; executionId: string; body: api.UpdateExecutionPayload }) =>
      api.updateExecution(tradeId, executionId, body),
    onSuccess: () => invalidateTradesAndAccounts(qc),
  });
}
export function useRemoveExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tradeId, executionId }: { tradeId: string; executionId: string }) =>
      api.removeExecution(tradeId, executionId),
    onSuccess: () => invalidateTradesAndAccounts(qc),
  });
}
export function useSetPrimaryExecution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tradeId, executionId }: { tradeId: string; executionId: string }) =>
      api.setPrimaryExecution(tradeId, executionId),
    onSuccess: () => invalidateTradesAndAccounts(qc),
  });
}

// Planned trades
export function useCreatePlanned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createPlanned,
    onSuccess: () => qc.invalidateQueries({ queryKey: tradingKeys.planned }),
  });
}
export function useUpdatePlanned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: api.UpdatePlannedPayload }) =>
      api.updatePlanned(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: tradingKeys.planned }),
  });
}
export function useDeletePlanned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deletePlanned,
    onSuccess: () => qc.invalidateQueries({ queryKey: tradingKeys.planned }),
  });
}

// Models
export function useCreateModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createModel,
    onSuccess: () => qc.invalidateQueries({ queryKey: tradingKeys.models }),
  });
}
export function useUpdateModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: api.UpdateModelPayload }) =>
      api.updateModel(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: tradingKeys.models }),
  });
}
export function useDeleteModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteModel,
    onSuccess: () => qc.invalidateQueries({ queryKey: tradingKeys.models }),
  });
}

// Pairs
export function useCreatePair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createPair,
    onSuccess: () => qc.invalidateQueries({ queryKey: tradingKeys.pairs }),
  });
}
export function useUpdatePair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: api.UpdatePairPayload }) =>
      api.updatePair(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: tradingKeys.pairs }),
  });
}
export function useDeletePair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deletePair,
    onSuccess: () => qc.invalidateQueries({ queryKey: tradingKeys.pairs }),
  });
}
