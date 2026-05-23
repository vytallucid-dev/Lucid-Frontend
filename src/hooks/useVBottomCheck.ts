"use client";

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getVBottomCheck } from '@/lib/api/nifty';

export function useVBottomCheck(opts?: { date?: string }) {
  return useQuery({
    queryKey: ['nifty', 'v-bottom-check', opts],
    queryFn: () => getVBottomCheck(opts),
    placeholderData: keepPreviousData,
  });
}
