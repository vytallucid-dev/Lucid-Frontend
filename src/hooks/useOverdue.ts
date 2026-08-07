"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOverduePanel,
  deferOverdueEvent,
  undeferOverdueEvent,
  type DeferParams,
} from "@/lib/api/overdue";

/**
 * B3 — top-bar badge/panel data. Plain useQuery, not a hand-rolled cache
 * subscription: TopBar.tsx already documents the exact "Cannot update while
 * rendering" defect a raw useSyncExternalStore subscription to the query
 * cache can hit (QueryCache.notify() runs listeners synchronously via
 * notifyManager.batch()). useQuery's own internal subscription already goes
 * through that same batching, so it does not reintroduce that defect — this
 * hook is a normal consumer, not another hand-rolled subscriber.
 *
 * A short refetch interval (not on every render) keeps the badge honest as
 * deferrals expire and new events cross the 24h threshold, without a
 * push/websocket layer — explicitly out of scope per this prompt.
 */
export function useOverduePanel() {
  return useQuery({
    queryKey: ["oracle", "overdue"],
    queryFn: getOverduePanel,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useDeferOverdueEvent() {
  const queryClient = useQueryClient();
  return async (params: DeferParams) => {
    await deferOverdueEvent(params);
    await queryClient.invalidateQueries({ queryKey: ["oracle", "overdue"] });
  };
}

export function useUndeferOverdueEvent() {
  const queryClient = useQueryClient();
  return async (deferralId: string) => {
    await undeferOverdueEvent(deferralId);
    await queryClient.invalidateQueries({ queryKey: ["oracle", "overdue"] });
  };
}
