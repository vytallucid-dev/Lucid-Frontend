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
  return useQuery({ queryKey: tradingKeys.trades, queryFn: api.getTrades });
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
