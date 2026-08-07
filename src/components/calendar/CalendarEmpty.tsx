"use client";

import type { ReactNode } from "react";

/**
 * A designed rest state.
 *
 * Most days carry no tracked release, so this is a COMMON view rather than an
 * edge case, and it has to look deliberate — blank space reads as a page that
 * failed to load. Sits inside a `.lx-card` so an empty day occupies the same
 * frame a populated one would.
 */
export function CalendarEmpty({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="lx-cal-empty" role="status">
      <span className="lx-cal-empty-mark" aria-hidden="true">
        {icon}
      </span>
      <p className="lx-body lx-cal-empty-title">
        {title}
      </p>
      <p className="lx-micro lx-cal-empty-detail">
        {detail}
      </p>
    </div>
  );
}
