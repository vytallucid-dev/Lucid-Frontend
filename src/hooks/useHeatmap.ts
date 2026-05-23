"use client";

import { useQuery } from '@tanstack/react-query';
import { getHeatmap } from '@/lib/api/oracle';

export function useHeatmap() {
  return useQuery({
    queryKey: ['oracle', 'heatmap'],
    queryFn: getHeatmap,
  });
}
