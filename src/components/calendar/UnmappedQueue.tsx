"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useUnmappedQueue } from "@/hooks/useCalendar";
import { zonedDayLabel, zonedTime } from "@/lib/calendar-time";

/**
 * Admin-facing view of calendar events whose (country, title) matched no
 * mapping entry.
 *
 * DELIBERATELY RECESSED. It sits on `--lucid-page-bg-deep` — one step below
 * the page ground — collapsed by default, below every calendar band. This is
 * an admin maintenance concern, not part of the daily read, and presenting it
 * at the weight of a calendar band inverts the hierarchy.
 *
 * A populated queue is NORMAL, not an alarm: the feed carries ~80 events a
 * week that no EdgeFinder indicator tracks, plus the euro-area national
 * sub-PMIs which are excluded permanently by design. What matters is spotting
 * a title that looks like something already tracked — that is an upstream
 * rename surfacing, instead of an indicator quietly ceasing to update.
 *
 * The query only runs once opened, so the daily view costs no request.
 */
export function UnmappedQueue({ timeZone }: { timeZone: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useUnmappedQueue(open);

  return (
    <div className="lx-cal-admin">
      <button
        type="button"
        className="lx-cal-admin-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Rotation is driven by the button's own aria-expanded in CSS, so the
            open state has exactly one source of truth. */}
        <ChevronRight size={12} aria-hidden="true" className="lx-cal-admin-chev" />
        <span className="lx-eyebrow">Unmapped queue</span>
        {data && <span className="lx-micro">{data.count}</span>}
        <span className="lx-micro lx-num-cell">
          admin
        </span>
      </button>

      {open && (
        <div className="lx-cal-admin-body">
          <p className="lx-micro lx-cal-admin-intro">
            Events the feed sent that resolve to no tracked indicator. Most are
            genuinely untracked releases. Watch for a title resembling something
            already tracked — that is an upstream rename.
          </p>

          {isLoading && <p className="lx-micro">Loading…</p>}

          {error && (
            <p className="lx-micro lx-cal-admin-error">
              Could not load the unmapped queue.
            </p>
          )}

          {data && data.entries.length === 0 && (
            <p className="lx-micro">Queue is empty.</p>
          )}

          {data?.entries.map((e) => (
            <div key={e.id} className="lx-cal-admin-row">
              <span className="lx-micro lx-cal-ccy">
                {e.country}
              </span>
              <span
                className="lx-body lx-cal-admin-title"
              >
                {e.title}
              </span>
              {e.occurrences > 1 && (
                <span className="lx-micro lx-cal-admin-when">
                  ×{e.occurrences}
                </span>
              )}
              <span className="lx-micro lx-num-cell lx-cal-admin-when">
                {zonedDayLabel(new Date(e.scheduledAt), timeZone)}{" "}
                {zonedTime(new Date(e.scheduledAt), timeZone)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
