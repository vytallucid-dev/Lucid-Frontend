"use client";
import { useQuery } from '@tanstack/react-query';
import { getCompass } from '@/lib/api/oracle';

// The Compass snapshot is recomputed once per day by the classifier cron and is
// identical for every user, so cache it hard: a 30-minute staleTime keeps repeat
// navigations from refetching, and the backend sends matching Cache-Control.
export function useCompass() {
  return useQuery({
    queryKey: ['oracle', 'compass'],
    queryFn: getCompass,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
