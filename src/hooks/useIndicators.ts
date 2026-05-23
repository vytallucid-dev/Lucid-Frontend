"use client";

import { useQuery } from '@tanstack/react-query';
import { getIndicators } from '@/lib/api/nifty';

export function useIndicators() {
  return useQuery({
    queryKey: ['nifty', 'indicators'],
    queryFn: getIndicators,
    staleTime: Infinity,
  });
}
