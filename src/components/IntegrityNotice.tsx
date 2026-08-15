"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * States plainly that flagged trades have been left out of the numbers above.
 *
 * A silently changed win rate is worse than a wrong one: if trades drop out of
 * a statistic, the statistic has to say so, in the same view, without the
 * reader going looking. The count comes from the caller's `flaggedCount()` —
 * this component never derives it, and nothing here re-implements the
 * integrity check.
 *
 * Renders nothing when there is nothing to say.
 */
export function IntegrityNotice({
  count,
  total,
  /** Where "Review" goes. Defaults to the journal, pre-filtered to flagged. */
  href = "/trading/journal?flagged=1",
}: {
  count: number;
  /** Trades in view before exclusion, so the notice can say 3 of 22. */
  total?: number;
  href?: string;
}) {
  if (count <= 0) return null;
  const noun = count === 1 ? "trade" : "trades";
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2"
      style={{
        background: "var(--lucid-neg-bg)",
        border: "1px solid var(--lucid-neg-bd)",
        color: "var(--lucid-neg)",
        fontSize: 12.5,
      }}
    >
      <AlertTriangle size={13} style={{ flexShrink: 0 }} />
      <span style={{ fontWeight: 600 }}>
        {count} {noun} excluded
        {total != null ? ` of ${total}` : ""}
      </span>
      <span style={{ color: "var(--lucid-ink-2)" }}>
        {count === 1 ? "It needs" : "They need"} attention, so {count === 1 ? "it is" : "they are"} left out of every
        figure here — count and averages both. Still visible in the journal.
      </span>
      <Link
        href={href}
        style={{ marginLeft: "auto", fontWeight: 600, color: "var(--lucid-neg)", textDecoration: "underline", whiteSpace: "nowrap" }}
      >
        Review
      </Link>
    </div>
  );
}

/**
 * The compact form: a count chip for a page header. Clicking it filters the
 * journal to the flagged rows.
 */
export function IntegrityChip({ count, onClick }: { count: number; onClick?: () => void }) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${count} trade${count === 1 ? "" : "s"} need attention — excluded from every edge statistic`}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
      style={{
        background: "var(--lucid-neg-bg)",
        border: "1px solid var(--lucid-neg-bd)",
        color: "var(--lucid-neg)",
        fontSize: 12,
        fontWeight: 600,
        cursor: onClick ? "pointer" : "default",
        whiteSpace: "nowrap",
      }}
    >
      <AlertTriangle size={12} />
      {count} needs attention
    </button>
  );
}
