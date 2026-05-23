"use client";

import { useQuery } from '@tanstack/react-query';
import { getLatestScorecard } from '@/lib/api/nifty';

export function useLatestScorecard() {
  return useQuery({
    queryKey: ['nifty', 'scorecard', 'latest'],
    queryFn: getLatestScorecard,
  });
}
