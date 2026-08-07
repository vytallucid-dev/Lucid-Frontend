"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { CalendarCheck, Moon } from "lucide-react";
import { useCalendar } from "@/hooks/useCalendar";
import { useAuth } from "@/lib/auth/auth-context";
import { PageSkeleton } from "@/components/state/PageSkeleton";
import { ErrorState } from "@/components/state/ErrorState";
import { CalendarRow } from "@/components/calendar/CalendarRow";
import { CalendarSummary } from "@/components/calendar/CalendarSummary";
import { CalendarEmpty } from "@/components/calendar/CalendarEmpty";
import {
  CalendarFilters,
  deriveCurrencies,
  deriveImpacts,
} from "@/components/calendar/CalendarFilters";
import { UnmappedQueue } from "@/components/calendar/UnmappedQueue";
import type { CalendarEvent } from "@/lib/api/calendar";
import {
  subscribeTimezone,
  getTimezoneSnapshot,
  getTimezoneServerSnapshot,
  setTimezone,
} from "@/lib/calendar-timezone-store";
import {
  TIMEZONE_OPTIONS,
  zonedDayKey,
  zonedDayLabel,
  zoneAbbreviation,
  startOfZonedDayUtc,
  addDays,
} from "@/lib/calendar-time";

interface DayGroup {
  key: string;
  label: string;
  events: CalendarEvent[];
}

/** Zone-local day grouping. Presentation over the returned array. */
function groupByDay(events: CalendarEvent[], timeZone: string): DayGroup[] {
  const days = new Map<string, DayGroup>();
  for (const e of events) {
    const instant = new Date(e.scheduledAt);
    const key = zonedDayKey(instant, timeZone);
    let day = days.get(key);
    if (!day) {
      day = { key, label: zonedDayLabel(instant, timeZone), events: [] };
      days.set(key, day);
    }
    day.events.push(e);
  }
  return Array.from(days.values()).sort((a, b) => a.key.localeCompare(b.key));
}

export default function CalendarPage() {
  const { isAdmin } = useAuth();

  // Persisted across reloads. Read through useSyncExternalStore rather than
  // useState+useEffect: the server has no localStorage, so the store hands the
  // server the default and the client the stored zone, with no hydration
  // mismatch and no cascading render on mount.
  const timeZone = useSyncExternalStore(
    subscribeTimezone,
    getTimezoneSnapshot,
    getTimezoneServerSnapshot,
  );

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

  // Anchors the query window. Stable across renders — recomputed only when the
  // zone changes, because where a day begins is a zone-dependent question.
  const { fromUtc, toUtc, now } = useMemo(() => {
    const instant = new Date();
    const start = startOfZonedDayUtc(instant, timeZone);
    // Eight days covers the feed's Sun→Sat horizon from any starting weekday.
    // The server returns only what it holds; this is a ceiling, not a promise.
    return { fromUtc: start, toUtc: addDays(start, 8), now: instant };
  }, [timeZone]);

  const { data, isLoading, error, refetch } = useCalendar(fromUtc, toUtc);

  const allEvents = useMemo(() => data?.events ?? [], [data]);

  // Filter options derive from the data, never a hardcoded list.
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

  const todayKey = zonedDayKey(now, timeZone);
  const zoneLabel = zoneAbbreviation(now, timeZone);

  const todayEvents = useMemo(
    () => filtered.filter((e) => zonedDayKey(new Date(e.scheduledAt), timeZone) === todayKey),
    [filtered, timeZone, todayKey],
  );

  // "This week" is everything after today — today already has its own band, so
  // repeating it below would double-count what the trader is looking at.
  const laterDays = useMemo(
    () => groupByDay(filtered, timeZone).filter((d) => d.key > todayKey),
    [filtered, timeZone, todayKey],
  );

  const isFiltering = selectedCurrencies.size > 0 || selectedImpacts.size > 0;
  const horizonLabel = data ? zonedDayLabel(new Date(data.horizonEndsAt), timeZone) : null;

  // `lx-cal-page` is a scope hook, not a layout change: every spacing override
  // lives behind it, so .lx-band keeps its shared 48/72px rhythm on every
  // other page that uses it.
  return (
    <div className="lx-container lx-cal-page">
      {/* ── Band 1: header, filters, summary ── */}
      <section className="lx-band">
        <div className="lx-band-head">
          <p className="lx-eyebrow">Economic Calendar</p>
          <h1 className="lx-heading">Release schedule</h1>
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

          <div className="lx-cal-zone">
            <label className="lx-eyebrow" htmlFor="calendar-tz">
              Zone
            </label>
            <select
              id="calendar-tz"
              className="lx-input lx-select lx-cal-zone-select"
              value={timeZone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz.id} value={tz.id}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading && <PageSkeleton cards={1} blocks={2} blockHeight={220} rows={5} />}

        {error && <ErrorState error={error} onRetry={() => refetch()} />}

        {data && <CalendarSummary events={filtered} timeZone={timeZone} now={now} />}
      </section>

      {data && (
        <>
          <div className="lx-rule" />

          {/* ── Band 2: Today — the primary band ── */}
          <section className="lx-band">
            <div className="lx-band-head">
              <p className="lx-eyebrow">Today · {zonedDayLabel(now, timeZone)}</p>
              <h2 className="lx-heading">
                {todayEvents.length > 0
                  ? `${todayEvents.length} release${todayEvents.length === 1 ? "" : "s"}`
                  : "No releases"}
              </h2>
            </div>

            {/* `is-empty` drops the card's own padding when its only content
                is an empty state, so a quiet day does not reserve the height a
                populated one would. */}
            <div className={`lx-card ${todayEvents.length === 0 ? "is-empty" : ""}`}>
              {todayEvents.length > 0 ? (
                <div className="lx-rows">
                  {todayEvents.map((e) => (
                    <CalendarRow key={e.id} event={e} timeZone={timeZone} />
                  ))}
                </div>
              ) : (
                <CalendarEmpty
                  icon={<Moon size={15} />}
                  title={
                    isFiltering
                      ? "Nothing today matches these filters"
                      : "No tracked releases today"
                  }
                  detail={
                    isFiltering
                      ? "Clear a currency or impact filter to see the rest of today's schedule."
                      : "A quiet day. Most days carry no release for the indicators this desk tracks — the week below shows what is still coming."
                  }
                />
              )}
            </div>
          </section>

          <div className="lx-rule" />

          {/* ── Band 3: rest of this week ── */}
          <section className="lx-band">
            <div className="lx-band-head">
              <p className="lx-eyebrow">Rest of this week</p>
              <h2 className="lx-heading">
                {laterDays.length > 0 ? "Ahead" : "Nothing further"}
              </h2>
              <p className="lx-body lx-cal-note">
                Forex Factory publishes the current week only, so this view ends{" "}
                {horizonLabel ?? "with the current week"} rather than rolling
                seven days forward. Next week&apos;s releases appear once the feed
                rolls over. All times {zoneLabel}.
              </p>
            </div>

            {laterDays.length > 0 ? (
              <div className="lx-cal-days">
                {laterDays.map((day) => (
                  <div key={day.key}>
                    <div className="lx-cal-day">
                      <span className="lx-eyebrow">{day.label}</span>
                      <span className="lx-cal-day-rule" aria-hidden="true" />
                      <span className="lx-micro">
                        {day.events.length}
                      </span>
                    </div>
                    <div className="lx-card lx-card-compact">
                      <div className="lx-rows">
                        {day.events.map((e) => (
                          <CalendarRow key={e.id} event={e} timeZone={timeZone} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="lx-card is-empty">
                <CalendarEmpty
                  icon={<CalendarCheck size={15} />}
                  title={
                    isFiltering
                      ? "Nothing left this week matches these filters"
                      : "The week is done"
                  }
                  detail={
                    isFiltering
                      ? "Clear a filter to see the remaining releases."
                      : "Every tracked release for the current week has passed. New events appear when the feed rolls over."
                  }
                />
              </div>
            )}
          </section>

          {/* ── Admin basement — recessed, secondary, collapsed by default ── */}
          {isAdmin && (
            <section className="lx-band lx-cal-admin-band">
              <UnmappedQueue timeZone={timeZone} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
