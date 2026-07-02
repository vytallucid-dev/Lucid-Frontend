// ─── History pattern overlays — client-side derivation ─────────────────────
//
// The confirmed NIFTY patterns are NOT stored per-date on the scorecard row.
// We derive "pattern-active on date X" client-side from the per-date fields that
// ARE stored (band, peak_score_active, conflict_flag, composition_flag,
// external_composite, ind9_raw_composite, velocity_short) using the SAME trigger
// vocabulary the Patterns tab's computePatternRelevance already speaks.
//
// Only patterns whose activation can be cleanly derived from those fields get a
// derived overlay. Everything else falls back to its hardcoded example_dates so
// we never fake an active state we can't stand behind.

import type { PublicScorecard, PublicPattern } from "@/lib/api/nifty";

export interface PatternOverlayDef {
  id: string;
  name: string;
  /** Short label shown on the chart annotation. */
  short: string;
  /** How this pattern's active state is decided. */
  mode: "derived" | "example_dates";
  /** True when the pattern is active on the given scorecard (derived mode only). */
  isActive?: (sc: PublicScorecard) => boolean;
  /** One-line explanation for the annotation tooltip. */
  note: string;
  color: string;
}

// The three CONFIRMED patterns the brief calls out, plus the CONFLICT pattern
// which is trivially derivable and useful on the timeline.
export const PATTERN_OVERLAYS: PatternOverlayDef[] = [
  {
    id: "P14-A1",
    name: "Peak-Score Ceiling",
    short: "P14-A1",
    mode: "derived",
    // Stored per-date as peak_score_active. Direct read — no guessing.
    isActive: (sc) => sc.peak_score_active === true,
    note: "Peak-score ceiling active — historical price-peak lag 8–15 sessions.",
    color: "var(--lucid-warn)",
  },
  {
    id: "P12-1",
    name: "Fade-Into-Top",
    short: "P12-1",
    mode: "derived",
    // Rule: Strong Bullish band + sustained negative velocity (≤ −0.15/day).
    // velocity_short is the per-date scoreVelocity1d; when absent we can't
    // confirm the velocity leg, so the pattern reads inactive (honest).
    isActive: (sc) =>
      sc.band === "Strong Bullish" &&
      sc.velocity_short !== undefined &&
      sc.velocity_short <= -0.15,
    note: "Fade-into-top — Strong Bullish band but velocity decaying; sell-into-strength window.",
    color: "var(--lucid-neg)",
  },
  {
    id: "P15-2",
    name: "V-Bottom Discriminator",
    short: "P15-2",
    mode: "example_dates",
    // A V-bottom is a trough *event*, not a standing state — it can't be cleanly
    // derived from a single row's fields without look-ahead. Mark only its known
    // instances (example_dates) rather than fake a derived active state.
    note: "Confirmed V-bottom instance (P15-2).",
    color: "var(--lucid-cool)",
  },
];

export interface OverlayMarker {
  /** ISO date the marker sits on. */
  date: string;
  patternId: string;
  short: string;
  note: string;
  color: string;
  /** derived = from stored fields; instance = hardcoded example date. */
  kind: "derived" | "instance";
}

/**
 * Given the full dated scorecard series (ascending) and the pattern catalog,
 * produce the set of chart markers. Derived patterns mark every date where their
 * condition holds; example_dates patterns mark only dates present in BOTH the
 * catalog's example_dates AND the loaded series.
 */
export function derivePatternMarkers(
  ascendingScorecards: PublicScorecard[],
  patterns: PublicPattern[] | undefined,
): OverlayMarker[] {
  const markers: OverlayMarker[] = [];
  const dateSet = new Set(ascendingScorecards.map((s) => s.date));
  const catalogById = new Map((patterns ?? []).map((p) => [p.id, p]));

  for (const def of PATTERN_OVERLAYS) {
    if (def.mode === "derived" && def.isActive) {
      for (const sc of ascendingScorecards) {
        if (def.isActive(sc)) {
          markers.push({
            date: sc.date,
            patternId: def.id,
            short: def.short,
            note: def.note,
            color: def.color,
            kind: "derived",
          });
        }
      }
    } else {
      // example_dates mode — intersect catalog example_dates with loaded series.
      const cat = catalogById.get(def.id);
      const exampleDates = cat?.example_dates ?? [];
      for (const d of exampleDates) {
        if (dateSet.has(d)) {
          markers.push({
            date: d,
            patternId: def.id,
            short: def.short,
            note: def.note,
            color: def.color,
            kind: "instance",
          });
        }
      }
    }
  }

  return markers;
}

/** Which pattern overlays actually produced markers (for a legend / honesty note). */
export function summarizeOverlays(markers: OverlayMarker[]): {
  derived: string[];
  instanceOnly: string[];
} {
  const derived = new Set<string>();
  const instanceOnly = new Set<string>();
  for (const m of markers) {
    if (m.kind === "derived") derived.add(m.patternId);
    else instanceOnly.add(m.patternId);
  }
  return { derived: [...derived], instanceOnly: [...instanceOnly] };
}
