"use client";
import { useQuery } from '@tanstack/react-query';
import { getCotAssets } from '@/lib/api/oracle';

export function useCot() {
  return useQuery({
    queryKey: ['oracle', 'cot'],
    queryFn: getCotAssets,
  });
}
