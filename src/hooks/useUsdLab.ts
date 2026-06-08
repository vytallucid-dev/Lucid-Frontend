"use client";
import { useQuery } from '@tanstack/react-query';
import { getUsdLab, getUsdLabSubIndicator } from '@/lib/api/usd-lab';

export function useUsdLab() {
  return useQuery({
    queryKey: ['nifty', 'usd-lab'],
    queryFn: getUsdLab,
  });
}

export function useUsdLabSubIndicator(code: string | null) {
  return useQuery({
    queryKey: ['nifty', 'usd-lab', 'sub-indicator', code],
    queryFn: () => getUsdLabSubIndicator(code as string),
    enabled: code !== null,
  });
}
