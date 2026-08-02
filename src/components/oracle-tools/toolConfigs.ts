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
  listCotTrajectorySubjectOptions,
} from "./adapters";
import type { AnalysisToolConfig, DeferredToolEntry, SubjectOption } from "./types";

// Score Trend / Comparison — subject list is asset+pair-backed (fetched
// lazily via listScoreTrendSubjectOptions, same lazy-load pattern as
// Indicator Trend below), so a newly registered asset or pair (AUD, the four
// AUD pairs) appears with no edit here.
export function buildScoreTrendConfig(subjectOptions: SubjectOption[]): AnalysisToolConfig {
  return {
    key: "score-trend",
    title: "Score Trend",
    description: "Total score over time for any asset or FX pair, with the indicator breakdown behind each date's score.",
    subjectOptions,
    defaultSubjectId: subjectOptions[0]?.id ?? "",
    fetchSubject: fetchScoreTrendSubject,
    queryKeyPrefix: ["oracle", "tools", "score-trend"],
    compareEnabled: true,
    valueUnit: "pts",
    yDomain: [-8, 8],
    chartKind: "score",
    defaultChartType: "line",
  };
}

export function buildScoreComparisonConfig(subjectOptions: SubjectOption[]): AnalysisToolConfig {
  return {
    ...buildScoreTrendConfig(subjectOptions),
    key: "score-comparison",
    title: "Score Comparison",
    description: "Compare total score trends between two assets or FX pairs on the same chart.",
    queryKeyPrefix: ["oracle", "tools", "score-comparison"],
    compareEnabled: false,
    chartKind: "comparison",
    defaultChartType: "line",
  };
}

// COT Trajectory — subject list is COT-endpoint-backed (fetched lazily via
// listCotTrajectorySubjectOptions), scoped to non-deferred assets.
export function buildCotTrajectoryConfig(subjectOptions: SubjectOption[]): AnalysisToolConfig {
  return {
    key: "cot-trajectory",
    title: "COT Trajectory",
    description: "Institutional net positioning over time per asset, with extremes marked.",
    subjectOptions,
    defaultSubjectId: subjectOptions[0]?.id ?? "",
    fetchSubject: fetchCotSubject,
    queryKeyPrefix: ["oracle", "tools", "cot-trajectory"],
    compareEnabled: true,
    valueUnit: "",
    yDomain: "auto",
    chartKind: "cot",
    defaultChartType: "line",
  };
}

// COT Comparison — two assets' net-position series on one chart (the COT
// Compare handoff lands here). Same net-position adapter; comparison chart kind.
export function buildCotComparisonConfig(subjectOptions: SubjectOption[]): AnalysisToolConfig {
  return {
    ...buildCotTrajectoryConfig(subjectOptions),
    key: "cot-comparison",
    title: "COT Comparison",
    description: "Compare institutional net positioning between two assets on one chart.",
    queryKeyPrefix: ["oracle", "tools", "cot-comparison"],
    compareEnabled: false,
    chartKind: "comparison",
    defaultChartType: "line",
  };
}

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
    chartKind: "indicator",
    defaultChartType: "bar",
  };
}

export { listScoreTrendSubjectOptions, listIndicatorSubjectOptions, listCotTrajectorySubjectOptions };

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
