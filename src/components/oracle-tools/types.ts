// ─── Oracle Tools Engine — config interface ─────────────────────────────────
//
// The full-screen analysis engine (FullScreenAnalysis.tsx) renders any subject
// from an AnalysisToolConfig. Each tool (Score Trend, Indicator Trend, COT
// Trajectory, Score Comparison) is just a config object — no per-tool engine
// code. Pair Correlation is a bespoke view (grid, not a line chart). Deferred
// tools (Price vs Score, Calendar) reuse the same config shape so they can be
// wired in later without touching the engine.

export type TimeframeKey = "1M" | "3M" | "6M" | "1Y";

/** A notable event marked on the chart at a given point. */
export interface AnalysisEvent {
  kind: "flip-up" | "flip-down" | "surprise-beat" | "surprise-miss" | "extreme-high" | "extreme-low";
  label: string;
}

export interface AnalysisPoint {
  /** Index into the series. */
  index: number;
  /** Real ISO date (YYYY-MM-DD) of the point. */
  date: string;
  /** Short display label derived from the date, e.g. "Mar 14". */
  label: string;
  /** Primary series value at this point. Null = no data. */
  value: number | null;
  /** Optional secondary series (e.g. forecast for Indicator Trend). */
  secondary?: number | null;
  /** Marks a notable event at this point. */
  event?: AnalysisEvent;
}

export interface AnalysisBand {
  /** Faint horizontal zone, e.g. "Bullish" band from +3 to +8. */
  label: string;
  from: number;
  to: number;
  /** One of the --lucid-scale-* tokens. */
  colorVar: "--lucid-scale-0" | "--lucid-scale-1" | "--lucid-scale-2" | "--lucid-scale-3" | "--lucid-scale-4";
}

/** One row in a grouped breakdown (a single indicator's contribution). */
export interface BreakdownRow {
  label: string;
  /** Score pill value (-1/0/+1 etc), null when unscored. */
  score: number | null;
  /** Optional supporting text (actual value, reason). */
  detail?: string | null;
}

/** A named group of breakdown rows (e.g. "Growth", "Inflation", "Jobs"). */
export interface BreakdownGroup {
  label: string;
  rows: BreakdownRow[];
}

/** Per-date breakdown shown in the side rail as the user scrubs the chart. */
export interface DateBreakdown {
  date: string;
  label: string;
  /** Headline value for this date (the score / reading). */
  headline: number | null;
  headlineLabel: string | null;
  groups: BreakdownGroup[];
  /** Set when this date has no breakdown data (honest empty state, never faked). */
  emptyNote?: string;
}

export interface AnalysisSubject {
  id: string;
  name: string;
  flag?: string;
  /** Current headline value shown large in .lt-num. */
  currentValue: number | null;
  /** Band/label under the headline, e.g. "Bullish". */
  band: string | null;
  /** Delta vs previous period. */
  delta: number | null;
  /** Unit label for the delta/value (e.g. "pts", "%"). */
  points: AnalysisPoint[];
  bands?: AnalysisBand[];
  /** Label for the secondary line in the legend/tooltip (e.g. "Forecast"). */
  secondaryLabel?: string;
  /** Per-date breakdowns keyed by point index — powers the scrub side rail. */
  breakdownByIndex?: Record<number, DateBreakdown>;
  /** Heading for the side rail (e.g. "Indicator Breakdown"). */
  railHeading?: string;
  /** Set when the rail has no per-date data for this subject (e.g. FX pairs). */
  railEmptyNote?: string;
  /** True when a real dated series is available. */
  seriesAvailable: boolean;
  /** Shown when seriesAvailable is false — explains what's missing, never fabricated. */
  seriesGapNote?: string;
}

export interface SubjectOption {
  id: string;
  label: string;
  flag?: string;
  /** Optional group label for grouping in the picker (e.g. "Assets", "Pairs"). */
  group?: string;
}

export interface AnalysisToolConfig {
  key: string;
  title: string;
  description: string;
  subjectOptions: SubjectOption[];
  defaultSubjectId: string;
  /** Fetches the normalized series for one subject id at a timeframe. */
  fetchSubject: (subjectId: string, timeframe: TimeframeKey) => Promise<AnalysisSubject>;
  /** React Query key prefix for this subject fetch. */
  queryKeyPrefix: string[];
  /** Enables the "compare" affordance (second subject overlaid in --lucid-cool). */
  compareEnabled: boolean;
  /** Y-axis unit label, e.g. "pts" or "%". */
  valueUnit: string;
  /** Y-axis domain, or "auto" to let recharts fit the data. */
  yDomain: [number, number] | "auto";
}

export interface DeferredToolEntry {
  key: string;
  title: string;
  description: string;
  reason: string;
}
