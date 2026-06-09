/**
 * Format an ISO date string (the data's observation/report date) for "last
 * updated" / "as of" labels. Returns "—" when the timestamp is missing.
 * The underlying data is date-granular, so no time-of-day is shown.
 */
export function formatUpdated(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
