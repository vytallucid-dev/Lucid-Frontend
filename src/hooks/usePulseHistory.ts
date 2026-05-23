"use client";

import { useQuery } from '@tanstack/react-query';
import { getScorecardHistory } from '@/lib/api/nifty';

export function usePulseHistory() {
  return useQuery({
    queryKey: ['nifty', 'scorecard', 'history', 'pulse'],
    queryFn: () => getScorecardHistory({ includeBreakdown: false, limit: 12 }),
  });
}
