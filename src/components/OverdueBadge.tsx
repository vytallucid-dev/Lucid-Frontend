"use client";

// ─── B3 — the top-bar overdue badge + panel ─────────────────────────────────
//
// One badge, present on every page (mounted in TopBar.tsx, which renders on
// every route). Count is OVERDUE ONLY — not aging, not deferred, not
// due-today — see useOverduePanel's doc and buildOverduePanel on the backend
// for why each of those is deliberately excluded.
//
// Uses plain useQuery (useOverduePanel), never a hand-rolled cache
// subscription — TopBar.tsx documents the exact "Cannot update while
// rendering" defect a raw useSyncExternalStore subscriber to the query cache
// can hit; useQuery's own subscription already goes through the same
// notifyManager batching that fix relies on, so this hook does not
// reintroduce that class of bug.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, ChevronRight, X } from "lucide-react";
import { useOverduePanel, useDeferOverdueEvent, useUndeferOverdueEvent } from "@/hooks/useOverdue";
import { useAuth } from "@/lib/auth/auth-context";
import type { OverdueEntry } from "@/lib/api/overdue";
import { zonedTime, zonedDayLabel } from "@/lib/calendar-time";
import {
  subscribeTimezone,
  getTimezoneSnapshot,
  getTimezoneServerSnapshot,
} from "@/lib/calendar-timezone-store";

function EntryRow({
  entry,
  timeZone,
  isAdmin,
  onDeferDate,
  onDeferIndefinite,
  onUndefer,
}: {
  entry: OverdueEntry;
  timeZone: string;
  isAdmin: boolean;
  onDeferDate: (entry: OverdueEntry, date: string) => void;
  onDeferIndefinite: (entry: OverdueEntry) => void;
  onUndefer: (entry: OverdueEntry) => void;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const scheduled = new Date(entry.scheduledAt);
  const label = `${zonedDayLabel(scheduled, timeZone)} ${zonedTime(scheduled, timeZone)}`;
  const jumpHref = `/data/edgefinder/${entry.indicatorCode}`;

  return (
    <div className="lx-overdue-row">
      <div className="lx-overdue-row-main">
        <span className="lx-overdue-row-name">
          {entry.indicatorName}
          {entry.variant && <span className="lx-overdue-row-variant">{entry.variant}</span>}
        </span>
        <span className="lx-overdue-row-meta">
          {entry.country} · {label}
          {entry.state === "deferred_to_date" && entry.deferUntil && (
            <> · deferred to {entry.deferUntil}</>
          )}
          {entry.state === "deferred_indefinitely" && <> · deferred indefinitely</>}
        </span>
        {entry.reason && <span className="lx-overdue-row-reason">&ldquo;{entry.reason}&rdquo;</span>}
      </div>

      <div className="lx-overdue-row-actions">
        <a href={jumpHref} className="lx-overdue-row-jump" title={`Open ${entry.indicatorCode} entry panel`}>
          <ChevronRight size={13} />
        </a>
        {isAdmin && entry.state === "overdue" && !showDatePicker && (
          <>
            <button
              type="button"
              className="lx-overdue-row-action"
              onClick={() => setShowDatePicker(true)}
            >
              Defer…
            </button>
            <button
              type="button"
              className="lx-overdue-row-action"
              onClick={() => onDeferIndefinite(entry)}
            >
              Defer indefinitely
            </button>
          </>
        )}
        {isAdmin && showDatePicker && (
          <input
            type="date"
            autoFocus
            className="lx-overdue-row-date"
            onChange={(e) => {
              if (e.target.value) {
                onDeferDate(entry, e.target.value);
                setShowDatePicker(false);
              }
            }}
            onBlur={() => setShowDatePicker(false)}
          />
        )}
        {isAdmin && entry.state !== "overdue" && (
          <button type="button" className="lx-overdue-row-action" onClick={() => onUndefer(entry)}>
            Un-defer
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, entries, recessed, ...rowProps }: {
  title: string;
  entries: OverdueEntry[];
  /** B3 — the deferred section is recessed, never hidden. */
  recessed?: boolean;
} & Omit<Parameters<typeof EntryRow>[0], "entry">) {
  if (entries.length === 0) return null;
  return (
    <div className={`lx-overdue-section ${recessed ? "is-recessed" : ""}`}>
      <p className="lx-overdue-section-title">{title}</p>
      {entries.map((e) => (
        <EntryRow key={e.id} entry={e} {...rowProps} />
      ))}
    </div>
  );
}

export function OverdueBadge() {
  const { data } = useOverduePanel();
  const { isAdmin } = useAuth();
  const defer = useDeferOverdueEvent();
  const undefer = useUndeferOverdueEvent();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const timeZone = useSyncExternalStore(subscribeTimezone, getTimezoneSnapshot, getTimezoneServerSnapshot);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleDeferDate = useCallback(
    (entry: OverdueEntry, date: string) => {
      void defer({ calendarEventId: entry.id, deferUntil: date });
    },
    [defer],
  );
  const handleDeferIndefinite = useCallback(
    (entry: OverdueEntry) => {
      void defer({ calendarEventId: entry.id, deferUntil: null });
    },
    [defer],
  );
  const handleUndefer = useCallback(
    (entry: OverdueEntry) => {
      // entry.deferralId, never entry.id — the latter is the calendar_events
      // row (used to CREATE a one-off deferral); the deferral itself (which
      // may be one-off or a standing row for the indicator+variant) has its
      // own id, which is what DELETE /defer/:id expects.
      if (entry.deferralId) void undefer(entry.deferralId);
    },
    [undefer],
  );

  const count = data?.badgeCount ?? 0;

  return (
    <div className="lx-overdue-badge-root" ref={rootRef}>
      <button
        type="button"
        className={`lx-overdue-trigger ${count > 0 ? "has-overdue" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={count > 0 ? `${count} overdue release${count === 1 ? "" : "s"}` : "No overdue releases"}
        title={count > 0 ? `${count} overdue release${count === 1 ? "" : "s"}` : "No overdue releases"}
      >
        <AlertTriangle size={15} />
        {count > 0 && <span className="lx-overdue-count">{count}</span>}
      </button>

      {open && (
        <div className="lx-overdue-panel" role="dialog" aria-label="Overdue releases">
          <div className="lx-overdue-panel-header">
            <span className="lx-overdue-panel-title">Releases</span>
            <button type="button" className="lx-overdue-panel-close" onClick={() => setOpen(false)}>
              <X size={13} />
            </button>
          </div>

          <div className="lx-overdue-panel-body">
            {!data && <p className="lx-overdue-empty">Loading…</p>}

            {data && data.dueToday.length === 0 && data.overdue.length === 0 && data.deferred.length === 0 && (
              <p className="lx-overdue-empty">Nothing overdue or due today.</p>
            )}

            {data && (
              <>
                <Section
                  title="Due today"
                  entries={data.dueToday}
                  timeZone={timeZone}
                  isAdmin={isAdmin}
                  onDeferDate={handleDeferDate}
                  onDeferIndefinite={handleDeferIndefinite}
                  onUndefer={handleUndefer}
                />
                <Section
                  title="Overdue"
                  entries={data.overdue}
                  timeZone={timeZone}
                  isAdmin={isAdmin}
                  onDeferDate={handleDeferDate}
                  onDeferIndefinite={handleDeferIndefinite}
                  onUndefer={handleUndefer}
                />
                {/* Deferred — recessed, always visible, excluded from the
                    badge count. A March deferral discovered in September
                    must never be invisible. */}
                <Section
                  title="Deferred"
                  entries={data.deferred}
                  recessed
                  timeZone={timeZone}
                  isAdmin={isAdmin}
                  onDeferDate={handleDeferDate}
                  onDeferIndefinite={handleDeferIndefinite}
                  onUndefer={handleUndefer}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
