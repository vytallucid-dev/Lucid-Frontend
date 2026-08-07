import { apiFetch } from "./client";

/**
 * B3 — the top-bar badge/panel. Backed by the single overdue resolver on
 * the server (overdue-resolver.ts); this module has no logic of its own,
 * it only fetches and defers/undefers.
 */

export type OverdueState = "overdue" | "deferred_to_date" | "deferred_indefinitely";

export interface OverdueEntry {
  id: string; // calendar_events row id — use for a one-off defer action
  // The deferral row currently silencing this entry, or null when state is
  // "overdue" (nothing silencing it yet). Use THIS, never `id`, to undefer.
  deferralId: string | null;
  indicatorCode: string;
  indicatorName: string;
  variant: string | null;
  scheduledAt: string; // ISO UTC instant
  observationDate: string; // YYYY-MM-DD
  country: string;
  title: string;
  state: OverdueState;
  deferUntil: string | null; // YYYY-MM-DD, only for deferred_to_date
  reason: string | null;
}

export interface OverduePanel {
  dueToday: OverdueEntry[];
  overdue: OverdueEntry[];
  deferred: OverdueEntry[];
  /** Badge count — overdue only. Never aging, DataHealth, deferred, or due-today. */
  badgeCount: number;
}

interface OverdueEnvelope {
  success: boolean;
  data: OverduePanel;
}

export async function getOverduePanel(): Promise<OverduePanel> {
  const res = await apiFetch<OverdueEnvelope>("/api/oracle/overdue");
  return res.data;
}

export interface DeferParams {
  /** One-off: defer exactly this occurrence. */
  calendarEventId?: string;
  /** Standing: defer future releases of this indicator (+variant). Required
   *  when calendarEventId is omitted. */
  indicatorCode?: string;
  variant?: string | null;
  /** ISO YYYY-MM-DD. Omit/null = deferred indefinitely. */
  deferUntil?: string | null;
  /** Prompted but optional at entry. */
  reason?: string | null;
}

export async function deferOverdueEvent(params: DeferParams): Promise<void> {
  await apiFetch("/api/admin/overdue/defer", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function undeferOverdueEvent(deferralId: string): Promise<void> {
  await apiFetch(`/api/admin/overdue/defer/${deferralId}`, { method: "DELETE" });
}
