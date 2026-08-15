// lib/journal-format.ts
//
// Formatting for the journal's Oracle snapshots and R figures, in one place so
// the table, the drawer and the detail page cannot disagree about what a dash
// means or how many decimals an R carries.
//
// None of these compute anything. Expected R and realised R are derived
// server-side and arrive on the DTO; a missing Oracle score arrives as null.
// Rendering a dash for null is the whole job — the value is never guessed,
// never carried forward from a nearby date, never back-filled in the client.
import type { Trade, Execution, OracleScoreSource } from './demo-data';

/** The dash every "no value here" cell shows. */
export const NO_VALUE = '—';

/** An Oracle score, or a dash when none was captured. */
export function formatOracleScore(score: number | null | undefined): string {
  return score == null ? NO_VALUE : String(score);
}

/**
 * Why a score reads the way it does, for a tooltip. Provenance matters: a
 * legacy value predates dated snapshots and belongs to no date, a manual value
 * is the user's own, and only 'snapshot' is a real read of that day's Oracle.
 */
export function oracleEntryTitle(trade: Trade): string {
  const score = trade.oracle_score_at_entry;
  const on = trade.oracle_score_entry_date;
  switch (trade.oracle_score_entry_source) {
    case 'snapshot':
      return `Oracle score ${score} for ${trade.pair} on ${on} — snapshotted when the trade was logged, never re-read since.`;
    case 'legacy':
      return `Oracle score ${score}, carried over from before dated snapshots existed. It belongs to no particular date.`;
    case 'manual':
      return `Oracle score ${score}, set by hand on this trade.`;
    default:
      return on
        ? `No Oracle score existed for ${trade.pair} on ${on}.`
        : 'No Oracle score stored for this trade.';
  }
}

/** Same, for the exit side — which is always a snapshot or nothing. */
export function oracleExitTitle(trade: Trade, execution: Execution): string {
  if (execution.oracle_score_at_exit == null) {
    return execution.oracle_score_exit_date
      ? `No Oracle score existed for ${trade.pair} on ${execution.oracle_score_exit_date}.`
      : 'This fill has not closed, so there is no exit score yet.';
  }
  return `Oracle score ${execution.oracle_score_at_exit} for ${trade.pair} on ${execution.oracle_score_exit_date} — snapshotted when this fill closed.`;
}

/** A short provenance tag for a score shown next to it. Null when it adds nothing. */
export function oracleSourceTag(source: OracleScoreSource | null): string | null {
  return source === 'legacy' ? 'legacy' : source === 'manual' ? 'manual' : null;
}

/** An R figure to two decimals, or a dash. */
export function formatRr(rr: number | null | undefined): string {
  return rr == null ? NO_VALUE : `${rr.toFixed(2)}R`;
}

/**
 * Realised R for a fill, or null while it is still open. `blended_rr` is 0 on
 * an open fill, which would otherwise render as a real "0.00R" result.
 */
export function realisedRr(execution: Execution): number | null {
  return execution.date_closed ? execution.blended_rr : null;
}
