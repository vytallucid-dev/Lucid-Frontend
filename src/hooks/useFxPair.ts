"use client";
import { useQuery } from '@tanstack/react-query';
import { getFxPair } from '@/lib/api/oracle';

export function useFxPair(pair: string) {
  return useQuery({
    queryKey: ['oracle', 'fx-scorecard', pair],
    queryFn: () => getFxPair(pair),
    enabled: !!pair,
  });
}
