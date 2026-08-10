"use client";

import type { CalendarEvent } from "@/lib/api/calendar";
import { zonedTime } from "@/lib/calendar-time";

/**
 * One release, as a `.lx-row`: time and currency left, indicator name in the
 * middle, status right in a `.lx-num-cell`. Numbers right, text left — the
 * house rule.
 *
 * Impact is carried by a 2px rail on the row's leading edge rather than a
 * coloured chip. Three chips per row across twenty rows reads as decoration;
 * a rail encodes the same fact, scans vertically, and leaves gold free to
 * mean "interactive" rather than "medium impact".
 */

/**
 * Impact → row modifier. The whole visual treatment (rail height and colour,
 * row wash, ink weight, currency border) lives in CSS against these classes
 * rather than as inline values here, so the ranking is expressed in one place
 * and a row carries no style object at all.
 *
 * Anything that is not High or Medium is unranked — no rail, receding ink.
 */
function impactClass(impact: string): string {
  if (impact === "High") return "is-high";
  if (impact === "Medium") return "is-medium";
  return "is-low";
}

export function CalendarRow({
  event,
  timeZone,
}: {
  event: CalendarEvent;
  timeZone: string;
}) {
  const isCompanion = !event.isPrimary;
  return (
    <div
      className={`lx-row lx-cal-row ${impactClass(event.impact)} ${isCompanion ? "is-companion" : ""}`}
    >
      <span aria-hidden="true" className="lx-cal-rail" />

      <span className="lx-value lx-cal-time">
        {zonedTime(new Date(event.scheduledAt), timeZone)}
      </span>

      <span className="lx-micro lx-cal-ccy">{event.country}</span>

      <span className="lx-cal-name">
        {/* indicatorName as the server sent it — never re-derived from the code. */}
        <span className="lx-body lx-cal-name-text">
          {event.indicatorName ?? event.title}
        </span>
        {event.variant && <span className="lx-cal-variant">{event.variant}</span>}
        {isCompanion && (
          <span className="lx-cal-companion-tag" title={`Companion release — same indicator as the primary "${event.title}" row above/below`}>
            companion
          </span>
        )}
      </span>

      <span className="lx-num-cell">
        <span
          className={`lx-cal-status ${event.hasActual ? "is-in" : ""}`}
        >
          {event.hasActual ? "actual in" : "awaiting"}
        </span>
      </span>

      <span className="sr-only">
        {event.impact} impact{isCompanion ? " — companion release, tracked under the primary event" : ""}
      </span>
    </div>
  );
}
