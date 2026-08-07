"use client";
import { useQuery } from "@tanstack/react-query";
import { getCalendarWindow, getUnmappedQueue } from "@/lib/api/calendar";

/**
 * Calendar events in an absolute UTC window. The caller derives the window
 * from the selected timezone (see calendar-time.ts) — this hook never guesses
 * what "today" means.
 */
export function useCalendar(fromUtc: Date, toUtc: Date) {
  return useQuery({
    // Instants in the key so changing timezone (which moves the window's
    // boundaries) refetches rather than serving the previous zone's window.
    queryKey: ["calendar", fromUtc.toISOString(), toUtc.toISOString()],
    queryFn: () => getCalendarWindow(fromUtc, toUtc),
  });
}

export function useUnmappedQueue(enabled: boolean) {
  return useQuery({
    queryKey: ["calendar", "unmapped"],
    queryFn: getUnmappedQueue,
    enabled,
  });
}
