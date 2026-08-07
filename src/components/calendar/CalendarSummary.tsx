"use client";

import { useEffect, useState } from "react";
import type { CalendarEvent } from "@/lib/api/calendar";
import { formatCountdown, zonedTime, zonedDayLabel } from "@/lib/calendar-time";

/**
 * Three facts about the rest of the week, derived from the events the server
 * already returned. Nothing here is fetched separately and nothing is
 * re-derived from a field the server computed — `hasActual` is read as sent.
 */

/** Minute-resolution display, so a 30s tick is twice as often as it can change. */
const TICK_MS = 30_000;

export function CalendarSummary({
  events,
  timeZone,
  now,
}: {
  /** Remaining events in the window, chronological. */
  events: CalendarEvent[];
  timeZone: string;
  now: Date;
}) {
  // Local clock for the countdown only. Seeded from `now` so the first paint
  // matches the rest of the page, then advances on its own — the parent's
  // `now` is stable across renders by design (it anchors the query window).
  const [tick, setTick] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setTick(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const remaining = events.length;
  const awaiting = events.filter((e) => !e.hasActual).length;
  const next = events.find((e) => new Date(e.scheduledAt).getTime() > tick.getTime()) ?? null;

  return (
    <div className="lx-card lx-card-compact">
      <div className="lx-grid-metrics" style={{ ["--lx-cols" as string]: 3 }}>
        <div>
          <p className="lx-eyebrow">Releases left</p>
          <p className="lx-metric lx-cal-stat-value">
            {remaining}
          </p>
          <p className="lx-micro lx-cal-stat-note">
            tracked, rest of this week
          </p>
        </div>

        <div>
          <p className="lx-eyebrow">Awaiting actual</p>
          <p className="lx-metric lx-cal-stat-value">
            {awaiting}
          </p>
          <p className="lx-micro lx-cal-stat-note">
            no print entered yet
          </p>
        </div>

        <div>
          <p className="lx-eyebrow">Next release</p>
          {next ? (
            <>
              <p
                className="lx-metric-sm lx-cal-stat-value is-accent"
              >
                {formatCountdown(new Date(next.scheduledAt), tick)}
              </p>
              <p className="lx-micro lx-cal-stat-note">
                {next.country} · {next.indicatorName ?? next.title} ·{" "}
                {zonedDayLabel(new Date(next.scheduledAt), timeZone)}{" "}
                {zonedTime(new Date(next.scheduledAt), timeZone)}
              </p>
            </>
          ) : (
            <>
              <p
                className="lx-metric-sm lx-cal-stat-value is-muted"
              >
                —
              </p>
              <p className="lx-micro lx-cal-stat-note">
                nothing further this week
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
