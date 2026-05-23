"use client";

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getVelocity } from '@/lib/api/nifty';

export function useVelocity(opts?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['nifty', 'velocity', opts],
    queryFn: () => getVelocity(opts),
    placeholderData: keepPreviousData,
  });
}
