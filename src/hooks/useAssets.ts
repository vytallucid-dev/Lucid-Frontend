"use client";
import { useQuery } from '@tanstack/react-query';
import { getAssets } from '@/lib/api/oracle';

export function useAssets() {
  return useQuery({
    queryKey: ['oracle', 'assets'],
    queryFn: getAssets,
  });
}
