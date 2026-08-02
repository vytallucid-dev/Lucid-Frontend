"use client";
import { useQuery } from '@tanstack/react-query';
import { getScorecardSubjects } from '@/lib/api/oracle';

export function useScorecardSubjects() {
  return useQuery({
    queryKey: ['oracle', 'scorecard-subjects'],
    queryFn: getScorecardSubjects,
    staleTime: 5 * 60 * 1000,
  });
}
