// ─── Oracle Tools Engine — the tool configs ─────────────────────────────────
//
// Each config below is consumed by <FullScreenAnalysis config={...} />. Adding
// a new tool means adding one config here (or a bespoke view, like Pair
// Correlation, for shapes the line-chart engine doesn't fit) — the engine
// itself never changes.

import {
  fetchScoreTrendSubject,
  fetchIndicatorSubject,
  fetchCotSubject,
  listScoreTrendSubjectOptions,
  listIndicatorSubjectOptions,
  COT_TRAJECTORY_ASSETS,
} from "./adapters";
import type { AnalysisToolConfig, DeferredToolEntry, SubjectOption } from "./types";

// Score Trend / Comparison — assets (score-history supports USD/EUR/GBP/JPY/Gold)
// plus the five FX pairs. SPY/NAS100 are excluded (deferred scoring, no history).
const SCORE_TREND_SUBJECTS: SubjectOption[] = [
  { id: "USD", label: "USD", flag: "🇺🇸", group: "Assets" },
  { id: "EUR", label: "EUR", flag: "🇪🇺", group: "Assets" },
  { id: "GBP", label: "GBP", flag: "🇬🇧", group: "Assets" },
  { id: "JPY", label: "JPY", flag: "🇯🇵", group: "Assets" },
  { id: "Gold", label: "Gold", flag: "🥇", group: "Assets" },
  { id: "EURUSD", label: "EUR/USD", group: "Pairs" },
  { id: "GBPUSD", label: "GBP/USD", group: "Pairs" },
  { id: "USDJPY", label: "USD/JPY", group: "Pairs" },
  { id: "EURJPY", label: "EUR/JPY", group: "Pairs" },
  { id: "GBPJPY", label: "GBP/JPY", group: "Pairs" },
];

export const scoreTrendConfig: AnalysisToolConfig = {
  key: "score-trend",
  title: "Score Trend",
  description: "Total score over time for any asset or FX pair, with the indicator breakdown behind each date's score.",
  subjectOptions: SCORE_TREND_SUBJECTS,
  defaultSubjectId: "USD",
  fetchSubject: fetchScoreTrendSubject,
  queryKeyPrefix: ["oracle", "tools", "score-trend"],
  compareEnabled: true,
  valueUnit: "pts",
  yDomain: [-8, 8],
};

export const scoreComparisonConfig: AnalysisToolConfig = {
  ...scoreTrendConfig,
  key: "score-comparison",
  title: "Score Comparison",
  description: "Compare total score trends between two assets or FX pairs on the same chart.",
  queryKeyPrefix: ["oracle", "tools", "score-comparison"],
};

// COT Trajectory — asset-level only (USD/EUR/GBP/JPY/Gold), net positioning over
// time from /api/oracle/cot-history.
const COT_SUBJECTS: SubjectOption[] = COT_TRAJECTORY_ASSETS.map((a) => ({
  id: a,
  label: a,
  flag: a === "USD" ? "🇺🇸" : a === "EUR" ? "🇪🇺" : a === "GBP" ? "🇬🇧" : a === "JPY" ? "🇯🇵" : "🥇",
  group: "Assets",
}));

export const cotTrajectoryConfig: AnalysisToolConfig = {
  key: "cot-trajectory",
  title: "COT Trajectory",
  description: "Institutional net positioning over time per asset, with extremes marked.",
  subjectOptions: COT_SUBJECTS,
  defaultSubjectId: "USD",
  fetchSubject: fetchCotSubject,
  queryKeyPrefix: ["oracle", "tools", "cot-trajectory"],
  compareEnabled: false,
  valueUnit: "%",
  yDomain: "auto",
};

// Indicator Trend — subject list is heatmap-backed (fetched lazily); the config
// is built once the indicator options load. Now a real dated series.
export function buildIndicatorTrendConfig(subjectOptions: SubjectOption[]): AnalysisToolConfig {
  return {
    key: "indicator-trend",
    title: "Indicator Trend",
    description: "Release history for any single indicator — value vs forecast, with surprises marked.",
    subjectOptions,
    defaultSubjectId: subjectOptions[0]?.id ?? "",
    fetchSubject: fetchIndicatorSubject,
    queryKeyPrefix: ["oracle", "tools", "indicator-trend"],
    compareEnabled: false,
    valueUnit: "",
    yDomain: "auto",
  };
}

export { listScoreTrendSubjectOptions, listIndicatorSubjectOptions };

// Still deferred — backend not yet built. Engine hooks (config shape) remain
// ready so these become one config object each when the endpoints ship.
export const DEFERRED_TOOLS: DeferredToolEntry[] = [
  {
    key: "price-vs-score",
    title: "Price vs Score",
    description: "Overlay Gold/DXY price action against its Oracle score.",
    reason: "Needs a price-history table aligned to score dates. Coming in a later backend pass.",
  },
  {
    key: "calendar",
    title: "This-Week Calendar",
    description: "Upcoming releases across the six instruments this week.",
    reason: "Needs an aggregated economic-calendar endpoint. Coming in a later backend pass.",
  },
];
