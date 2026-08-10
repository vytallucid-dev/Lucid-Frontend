"use client";

import { Fragment, Suspense, useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Archive } from "lucide-react";
import { useCalendar } from "@/hooks/useCalendar";
import { useUrlDateRange } from "@/hooks/useUrlDateRange";
import { PageSkeleton } from "@/components/state/PageSkeleton";
import { ErrorState } from "@/components/state/ErrorState";
import { CalendarEmpty } from "@/components/calendar/CalendarEmpty";
import {
  CalendarFilters,
  deriveCurrencies,
  deriveImpacts,
} from "@/components/calendar/CalendarFilters";
import type { CalendarEvent } from "@/lib/api/calendar";
import {
  subscribeTimezone,
  getTimezoneSnapshot,
  getTimezoneServerSnapshot,
} from "@/lib/calendar-timezone-store";
import {
  startOfZonedWeekUtc,
  addDays,
  zonedDateInput,
  zonedDateInputToUtc,
  zonedRangeLabel,
  zonedDayLabel,
  zonedTime,
} from "@/lib/calendar-time";

/**
 * Fix 4 — the calendar history view.
 *
 * All events are stored permanently (calendar_events, see the backend
 * comment on that model); this is the first surface that lets a trader
 * actually browse back through them. Deep-linkable by design: `?from=` and
 * `?to=` are the whole of the view's state (window range; filters are
 * client-only, matching the live page's own convention), so a shared URL and
 * a reload land on the same week.
 */

type SortKey = "time" | "currency" | "indicator" | "impact";
type SortDir = "asc" | "desc";

const IMPACT_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const IMPACT_DOT: Record<string, string> = {
  High: "var(--lucid-neg)",
  Medium: "var(--lucid-warn)",
  Low: "var(--lucid-ink-3)",
};

function sortEvents(events: CalendarEvent[], key: SortKey, dir: SortDir): CalendarEvent[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...events].sort((a, b) => {
    switch (key) {
      case "time":
        return sign * (new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
      case "currency":
        return sign * a.country.localeCompare(b.country);
      case "indicator":
        return sign * (a.indicatorName ?? a.title).localeCompare(b.indicatorName ?? b.title);
      case "impact":
        return sign * ((IMPACT_RANK[a.impact] ?? 9) - (IMPACT_RANK[b.impact] ?? 9));
      default:
        return 0;
    }
  });
}

/** Grouped by country, the way Forex Factory / Trading Economics present it. */
function groupByCountry(events: CalendarEvent[]): Array<{ country: string; events: CalendarEvent[] }> {
  const order: string[] = [];
  const byCountry = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    if (!byCountry.has(e.country)) {
      byCountry.set(e.country, []);
      order.push(e.country);
    }
    byCountry.get(e.country)!.push(e);
  }
  return order.map((country) => ({ country, events: byCountry.get(country)! }));
}

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  numeric,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  numeric?: boolean;
}) {
  const isActive = activeKey === sortKey;
  return (
    <th
      className={`is-sortable ${numeric ? "is-num" : ""} ${isActive ? "is-active" : ""}`}
      onClick={() => onSort(sortKey)}
      aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      {label}
      {isActive && <span className="lx-hist-sort-arrow">{dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

function HistoryPageInner() {
  const timeZone = useSyncExternalStore(
    subscribeTimezone,
    getTimezoneSnapshot,
    getTimezoneServerSnapshot,
  );

  // Default window: the most recently completed week (last week, not the
  // live one — "history" implies looking backward; the live page already
  // owns the current week).
  const defaultRange = useMemo(() => {
    const now = new Date();
    const thisWeekStart = startOfZonedWeekUtc(now, timeZone);
    const lastWeekStart = addDays(thisWeekStart, -7);
    return {
      from: zonedDateInput(lastWeekStart, timeZone),
      to: zonedDateInput(thisWeekStart, timeZone),
    };
  }, [timeZone]);

  const [range, setRange] = useUrlDateRange(defaultRange.from, defaultRange.to);

  const { fromUtc, toUtc } = useMemo(() => {
    const from = zonedDateInputToUtc(range.from, timeZone) ?? new Date(defaultRange.from);
    const toStart = zonedDateInputToUtc(range.to, timeZone) ?? new Date(defaultRange.to);
    // `to` from the picker is the LAST included day; the window end is
    // exclusive, so the query needs one day past it.
    return { fromUtc: from, toUtc: addDays(toStart, 1) };
  }, [range, timeZone, defaultRange]);

  const { data, isLoading, error, refetch } = useCalendar(fromUtc, toUtc);

  const [selectedCurrencies, setSelectedCurrencies] = useState<Set<string>>(new Set());
  const [selectedImpacts, setSelectedImpacts] = useState<Set<string>>(new Set());
  const toggle = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (value: string) => {
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
      });
    },
    [],
  );

  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const allEvents = useMemo(() => data?.events ?? [], [data]);
  const currencies = useMemo(() => deriveCurrencies(allEvents), [allEvents]);
  const impacts = useMemo(() => deriveImpacts(allEvents), [allEvents]);

  const filtered = useMemo(
    () =>
      allEvents.filter(
        (e) =>
          (selectedCurrencies.size === 0 || selectedCurrencies.has(e.country)) &&
          (selectedImpacts.size === 0 || selectedImpacts.has(e.impact)),
      ),
    [allEvents, selectedCurrencies, selectedImpacts],
  );

  // Country grouping is the outer structure (matches FF/TE); within each
  // group, rows follow the active column sort.
  const grouped = useMemo(() => {
    const sorted = sortEvents(filtered, sortKey, sortDir);
    // Sorting by currency would fight the grouping (every group would
    // collapse to one), so currency-sort instead reorders which GROUP comes
    // first, while rows inside each group keep time order.
    if (sortKey === "currency") {
      const byTime = sortEvents(filtered, "time", "asc");
      const groups = groupByCountry(byTime);
      return sortDir === "asc" ? groups : [...groups].reverse();
    }
    return groupByCountry(sorted);
  }, [filtered, sortKey, sortDir]);

  const isFiltering = selectedCurrencies.size > 0 || selectedImpacts.size > 0;

  // Week-step navigation — steps the range by exactly 7 days each direction,
  // preserving whatever span the range currently covers (so a custom
  // multi-week range steps by a week without collapsing back to one).
  const stepWeek = useCallback(
    (direction: -1 | 1) => {
      const fromUtcNow = zonedDateInputToUtc(range.from, timeZone) ?? fromUtc;
      const toUtcNow = zonedDateInputToUtc(range.to, timeZone) ?? new Date(toUtc.getTime() - 86_400_000);
      const nextFrom = addDays(fromUtcNow, direction * 7);
      const nextTo = addDays(toUtcNow, direction * 7);
      setRange({ from: zonedDateInput(nextFrom, timeZone), to: zonedDateInput(nextTo, timeZone) });
    },
    [range, timeZone, fromUtc, toUtc, setRange],
  );

  // The honest edge: cannot step further back than the first stored event's
  // own week. No cutoff date is hardcoded — this reads the real earliest
  // instant the backend reports, so it moves automatically as older weeks
  // roll out of retention (they never do — calendar_events is permanent —
  // or forward as ingestion's own start date recedes into the past).
  const earliestStored = data?.earliestStoredAt ? new Date(data.earliestStoredAt) : null;
  const atEarliestEdge =
    earliestStored !== null && fromUtc.getTime() <= startOfZonedWeekUtc(earliestStored, timeZone).getTime();

  const rangeLabel = zonedRangeLabel(fromUtc, toUtc, timeZone);

  return (
    <div className="lx-container lx-cal-page">
      <section className="lx-band">
        <div className="lx-band-head">
          <p className="lx-eyebrow">Economic Calendar</p>
          <h1 className="lx-heading">History</h1>
        </div>

        <div className="lx-hist-nav">
          <div className="lx-hist-nav-controls">
            <button
              type="button"
              className="lx-hist-nav-btn"
              onClick={() => stepWeek(-1)}
              disabled={atEarliestEdge}
              title={atEarliestEdge ? "This is as far back as stored data goes" : "Previous week"}
              aria-label="Previous week"
            >
              <ChevronLeft size={14} />
            </button>
            <div>
              <p className="lx-hist-range-label">{rangeLabel}</p>
              {atEarliestEdge && (
                <p className="lx-hist-edge-note">data begins here</p>
              )}
            </div>
            <button
              type="button"
              className="lx-hist-nav-btn"
              onClick={() => stepWeek(1)}
              title="Next week"
              aria-label="Next week"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="lx-hist-picker">
            <label className="sr-only" htmlFor="hist-from">From date</label>
            <input
              id="hist-from"
              type="date"
              className="lx-input lx-hist-picker-input"
              value={range.from}
              max={range.to}
              onChange={(e) => e.target.value && setRange({ from: e.target.value, to: range.to })}
            />
            <span className="lx-hist-picker-sep">–</span>
            <label className="sr-only" htmlFor="hist-to">To date</label>
            <input
              id="hist-to"
              type="date"
              className="lx-input lx-hist-picker-input"
              value={range.to}
              min={range.from}
              onChange={(e) => e.target.value && setRange({ from: range.from, to: e.target.value })}
            />
          </div>
        </div>

        <div className="lx-cal-toolbar">
          <CalendarFilters
            currencies={currencies}
            impacts={impacts}
            selectedCurrencies={selectedCurrencies}
            selectedImpacts={selectedImpacts}
            onToggleCurrency={toggle(setSelectedCurrencies)}
            onToggleImpact={toggle(setSelectedImpacts)}
          />
        </div>

        {isLoading && <PageSkeleton cards={0} blocks={1} blockHeight={420} rows={8} />}

        {error && <ErrorState error={error} onRetry={() => refetch()} />}

        {data && (
          <div className="lx-card is-empty">
            {grouped.length === 0 ? (
              <CalendarEmpty
                icon={<Archive size={15} />}
                title={
                  isFiltering
                    ? "Nothing in this range matches these filters"
                    : atEarliestEdge && allEvents.length === 0
                      ? "This is before recorded history"
                      : "No tracked releases in this range"
                }
                detail={
                  isFiltering
                    ? "Clear a currency or impact filter to see the rest of the range."
                    : "Forex Factory ingestion began storing events from the week shown at the earliest edge — nothing was captured before that."
                }
              />
            ) : (
              <div className="lx-hist-table-wrap">
                <table className="lx-hist-table">
                  <thead>
                    <tr>
                      <th style={{ width: 90 }}>Date</th>
                      <SortHeader label="Time" sortKey="time" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortHeader label="Ccy" sortKey="currency" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortHeader label="Indicator" sortKey="indicator" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                      <SortHeader label="Impact" sortKey="impact" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                      <th className="is-num">Forecast</th>
                      <th className="is-num">Previous</th>
                      <th className="is-num">Actual entered?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped.map((group) => (
                      <Fragment key={group.country}>
                        <tr className="lx-hist-group-row">
                          <td colSpan={8}>
                            {group.country} · {group.events.length} release{group.events.length === 1 ? "" : "s"}
                          </td>
                        </tr>
                        {group.events.map((e) => {
                          const instant = new Date(e.scheduledAt);
                          const isCompanion = !e.isPrimary;
                          return (
                            <tr key={e.id} className={`lx-hist-row ${isCompanion ? "is-companion" : ""}`}>
                              <td className="lx-hist-cell-date">{zonedDayLabel(instant, timeZone)}</td>
                              <td className="lx-hist-cell-time">{zonedTime(instant, timeZone)}</td>
                              <td>{e.country}</td>
                              <td>
                                <span className="lx-hist-cell-name">{e.indicatorName ?? e.title}</span>
                                {e.variant && <span className="lx-hist-cell-variant">{e.variant}</span>}
                                {isCompanion && (
                                  <span
                                    className="lx-hist-companion-tag"
                                    title={`Companion release — same indicator as the primary release at this instant`}
                                  >
                                    companion
                                  </span>
                                )}
                              </td>
                              <td>
                                <span
                                  className="lx-hist-impact-dot"
                                  style={{ background: IMPACT_DOT[e.impact] ?? "var(--lucid-ink-3)" }}
                                  aria-hidden="true"
                                />
                                {e.impact}
                              </td>
                              <td className="is-num">{e.forecastRaw ?? "—"}</td>
                              <td className="is-num">{e.previousRaw ?? "—"}</td>
                              <td className="is-num">
                                <span className={`lx-hist-status ${e.hasActual ? "is-in" : ""}`}>
                                  {e.hasActual ? "entered" : "awaiting"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default function CalendarHistoryPage() {
  // Suspense-wrap: useUrlDateRange reads useSearchParams (via ?from=/?to=),
  // which forces a bailout from static prerendering unless the boundary is
  // explicit — same pattern the Oracle scorecard page uses for ?asset=.
  return (
    <Suspense fallback={<PageSkeleton cards={0} blocks={1} blockHeight={420} rows={8} />}>
      <HistoryPageInner />
    </Suspense>
  );
}
