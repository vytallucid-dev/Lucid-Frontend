"use client";
import { useQuery } from '@tanstack/react-query';
import { getScorecardAsset, type ScorecardAssetKey } from '@/lib/api/oracle';

export function useAssetScorecard(key: ScorecardAssetKey) {
  return useQuery({
    queryKey: ['oracle', 'scorecard', key],
    queryFn: () => getScorecardAsset(key),
    enabled: !!key,
  });
}
