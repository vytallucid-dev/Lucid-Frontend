"use client";

import { useQuery } from '@tanstack/react-query';
import { getPatterns } from '@/lib/api/nifty';

export function usePatterns() {
  return useQuery({
    queryKey: ['nifty', 'patterns'],
    queryFn: getPatterns,
    staleTime: Infinity, // pattern catalog is static reference content
  });
}
