"use client";

import { useQuery } from '@tanstack/react-query';
import { getScorecardHistory } from '@/lib/api/nifty';

type HistoryOpts = {
  from?: string;
  to?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 100;

export function useScorecardHistory(opts?: HistoryOpts) {
  const queryOpts = {
    from: opts?.from,
    to: opts?.to,
    limit: opts?.limit ?? DEFAULT_LIMIT,
    includeBreakdown: true,
  } as const;
  return useQuery({
    queryKey: ['nifty', 'scorecard', 'history', queryOpts],
    queryFn: () => getScorecardHistory(queryOpts),
  });
}
