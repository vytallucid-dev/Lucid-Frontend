/**
 * Timezone handling for the economic calendar.
 *
 * The rule this module exists to enforce: the wire carries UTC instants, and
 * a local-time string is produced only at the moment of rendering. Nothing
 * derived from a local string is ever sent back to the server or stored.
 *
 * All conversion goes through Intl with an explicit `timeZone`, so the
 * viewer's OS timezone is irrelevant — a user in London and a user in Mumbai
 * both see IST by default, and both see the same instants.
 */

export interface TimezoneOption {
  /** IANA zone id — the only form that survives DST correctly. */
  id: string;
  label: string;
}

/**
 * Offered zones. IST leads because it is the user's own zone; the rest are
 * the sessions whose opens matter when reading an economic calendar.
 */
export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { id: "Asia/Kolkata", label: "IST — India" },
  { id: "UTC", label: "UTC" },
  { id: "America/New_York", label: "New York" },
  { id: "Europe/London", label: "London" },
  { id: "Asia/Tokyo", label: "Tokyo" },
  { id: "Australia/Sydney", label: "Sydney" },
];

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/** Parts of an instant as seen in a given zone. */
function zonedParts(instant: Date, timeZone: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(instant)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return out;
}

/**
 * Calendar day key (YYYY-MM-DD) of an instant AS SEEN IN `timeZone`.
 *
 * Grouping must use this rather than the UTC date: a release at
 * 2026-08-06T23:30Z is Thursday in UTC but already Friday 05:00 in IST, and
 * showing it under Thursday would put it on the wrong day for the viewer.
 */
export function zonedDayKey(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** HH:MM of an instant in `timeZone`, 24-hour. */
export function zonedTime(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  // Intl renders midnight as "24" in some locales/zones under hour12:false.
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${hour}:${p.minute}`;
}

/** e.g. "Fri 7 Aug" for a day heading. */
export function zonedDayLabel(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(instant);
}

/**
 * e.g. "Tue" — weekday only, no date. For compact inline use (the heatmap's
 * next-release cell) where zonedDayLabel's full "Fri 7 Aug" is too wide.
 */
export function zonedWeekday(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(instant);
}

/** Short zone abbreviation (IST, GMT+5:30, …) for labelling a time column. */
export function zoneAbbreviation(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(instant);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

/** The zone's UTC offset, in ms, at a given instant. */
function zoneOffsetMsAt(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const wallAsUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    p.hour === "24" ? 0 : Number(p.hour),
    Number(p.minute),
    0,
    0,
  );
  // Intl only gives us minute resolution, so drop sub-minute precision from
  // the instant before differencing — otherwise seconds leak into the offset.
  const flooredInstant = Math.floor(instant.getTime() / 60_000) * 60_000;
  return wallAsUtc - flooredInstant;
}

/**
 * The UTC instant at which the calendar day containing `instant` STARTS in
 * `timeZone`.
 *
 * Needed because "today" is a zone-dependent question while the API takes
 * absolute instants.
 *
 * Two-step rather than one: a single offset measurement taken at `instant`
 * is wrong across a DST boundary, because the offset in force at (say) noon
 * is not the offset in force at midnight the same day. Applying the noon
 * offset to midnight on a US spring-forward date lands at 23:00 the PREVIOUS
 * day — the day grouping then silently shifts by one for every event on that
 * date.
 *
 * So: estimate with the offset at `instant`, then re-measure the offset AT
 * the estimate and correct. The second measurement is taken in the correct
 * DST regime, which is what makes the result exact.
 */
export function startOfZonedDayUtc(instant: Date, timeZone: string): Date {
  const p = zonedParts(instant, timeZone);
  const wallMidnightAsUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    0,
    0,
    0,
    0,
  );

  const firstGuess = new Date(wallMidnightAsUtc - zoneOffsetMsAt(instant, timeZone));
  const corrected = new Date(wallMidnightAsUtc - zoneOffsetMsAt(firstGuess, timeZone));

  // On a spring-forward date the local day can begin at 01:00 because 00:00
  // does not exist. Re-deriving from the corrected instant's own parts keeps
  // the result inside the intended day rather than an hour before it.
  if (zonedDayKey(corrected, timeZone) !== zonedDayKey(instant, timeZone)) {
    return new Date(corrected.getTime() + 3_600_000);
  }
  return corrected;
}

/** Add whole days to an instant. */
export function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * 86_400_000);
}

/**
 * Fix 4 — the history view browses week by week. "Week" here means the same
 * Sun→Sat window Forex Factory's own feed uses (verified against the live
 * feed: events run Sunday through Saturday) — matching the source's own
 * boundary is what makes "go back one week" land exactly on the feed's
 * previous ingestion cycle rather than an arbitrary 7-day slide.
 *
 * Returns the UTC instant at which the zoned week containing `instant`
 * STARTS (the Sunday, at zoned midnight) — built on startOfZonedDayUtc,
 * which already does the DST-correct two-step truncation; this only adds
 * walking backward to the nearest Sunday in the SAME zone before truncating.
 */
export function startOfZonedWeekUtc(instant: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).formatToParts(
    instant,
  );
  const weekdayName = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const WEEKDAY_INDEX: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayIndex = WEEKDAY_INDEX[weekdayName] ?? 0;
  // Step back a day at a time rather than a flat `dayIndex * 86_400_000`
  // subtraction — a flat subtraction on the raw instant can walk across a
  // DST transition and land on the wrong zoned day; re-deriving the zoned
  // day start at each step keeps every intermediate step correct.
  let cursor = startOfZonedDayUtc(instant, timeZone);
  for (let i = 0; i < dayIndex; i++) {
    cursor = startOfZonedDayUtc(addDays(cursor, -1), timeZone);
  }
  return cursor;
}

/** YYYY-MM-DD of an instant as seen in `timeZone` — for <input type="date"> values and URL params. */
export function zonedDateInput(instant: Date, timeZone: string): string {
  return zonedDayKey(instant, timeZone);
}

/**
 * The UTC instant at which a YYYY-MM-DD date STARTS in `timeZone` — the
 * inverse of zonedDateInput, for turning a date-picker value back into an
 * absolute instant to send to the API.
 */
export function zonedDateInputToUtc(dateInput: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
  if (!match) return null;
  // Use noon UTC as the probe instant — comfortably clear of any DST
  // transition at the date boundary — then truncate to that DATE's zoned
  // start. This avoids the ambiguity of probing at midnight UTC, which for a
  // negative-offset zone could already be the previous day.
  const probe = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return startOfZonedDayUtc(probe, timeZone);
}

/** e.g. "3 Aug – 9 Aug 2026" for a week-range heading. */
export function zonedRangeLabel(fromUtc: Date, toExclusiveUtc: Date, timeZone: string): string {
  const lastDayInstant = addDays(toExclusiveUtc, -1);
  const fromLabel = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short" }).format(fromUtc);
  const toLabel = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(lastDayInstant);
  return `${fromLabel} – ${toLabel}`;
}

/**
 * Time until an instant, at minute resolution — "3h 42m", "18m", "now".
 *
 * Minute resolution is deliberate: a release schedule is not a stopwatch, and
 * second-by-second digits invite watching a countdown instead of reading a
 * calendar. It also means the ticker only needs to run often enough to keep
 * the minute honest, not every second.
 *
 * Timezone-independent — a duration between two instants is the same duration
 * in every zone, so the selected zone never enters this calculation.
 */
export function formatCountdown(target: Date, now: Date): string {
  const ms = target.getTime() - now.getTime();
  // Under a minute reads as "now" rather than "0m" — at minute resolution a
  // release 30 seconds out is, for scheduling purposes, happening.
  if (ms < 60_000) return "now";

  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * True when `value` is one of the zones the selector actually offers.
 *
 * Guards the persisted preference: a stored zone that has since been dropped
 * from TIMEZONE_OPTIONS, or a hand-edited localStorage value, must fall back
 * to the default rather than reach Intl and throw a RangeError at render.
 */
export function isKnownTimezone(value: string): boolean {
  return TIMEZONE_OPTIONS.some((tz) => tz.id === value);
}
