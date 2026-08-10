import { apiFetch } from "./client";

export interface CalendarEvent {
  id: string;
  /** UTC ISO-8601 instant. Convert at render time, never store local strings. */
  scheduledAt: string;
  country: string;
  title: string;
  impact: string;
  indicatorCode: string | null;
  indicatorName: string | null;
  variant: string | null;
  /**
   * Companion-event designation. false marks the SECONDARY row of a
   * companion pair (e.g. AU_RBA_RATE's "RBA Rate Statement" alongside its
   * primary "Cash Rate") — same indicator, same release instant, reported by
   * Forex Factory as two calendar rows. A companion row still renders, just
   * visibly secondary; it can never go overdue and never counts toward the
   * badge. true for every other row, mapped or unmapped.
   */
  isPrimary: boolean;
  hasActual: boolean;
  /**
   * Fix 4 — Forex Factory's own forecast/previous strings, reference-only
   * (the user's real forecasts are entered manually elsewhere; these are for
   * the history table's cross-check display, never for scoring). Null when
   * the feed sent none.
   */
  forecastRaw: string | null;
  previousRaw: string | null;
}

export interface CalendarWindowResponse {
  events: CalendarEvent[];
  /**
   * The last instant the stored data can actually speak to. Forex Factory's
   * feed is current-week-only, so the UI must show this honestly rather than
   * implying a rolling seven-day view.
   */
  horizonEndsAt: string;
  /**
   * The first instant the stored data can speak to — the week ingestion
   * started. Fix 4: the history view needs this to draw an honest edge
   * ("data begins here") rather than showing empty weeks forever when
   * browsing backwards. Null only if the table is genuinely empty.
   */
  earliestStoredAt: string | null;
  universeSize: number;
}

export interface UnmappedQueueEntry {
  id: string;
  scheduledAt: string;
  country: string;
  title: string;
  impact: string;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrences: number;
}

export interface UnmappedQueueResponse {
  entries: UnmappedQueueEntry[];
  count: number;
}

/**
 * The server takes absolute UTC instants — the client owns the timezone
 * question, since only it knows which zone the viewer selected and therefore
 * where "today" begins.
 */
export async function getCalendarWindow(
  fromUtc: Date,
  toUtc: Date,
): Promise<CalendarWindowResponse> {
  const qs = new URLSearchParams({
    fromUtc: fromUtc.toISOString(),
    toUtc: toUtc.toISOString(),
  });
  return apiFetch<CalendarWindowResponse>(`/api/calendar?${qs.toString()}`);
}

export async function getUnmappedQueue(): Promise<UnmappedQueueResponse> {
  return apiFetch<UnmappedQueueResponse>("/api/admin/calendar/unmapped");
}
