// ─── Oracle Tools Engine — data adapters ────────────────────────────────────
//
// Converts the live dated Oracle history endpoints into the engine's normalized
// AnalysisSubject shape. Score Trend, Indicator Trend and COT Trajectory now
// bind to real dated series (score-history / indicator-history / cot-history).
// Pair Correlation uses the current-snapshot scorecard endpoints.

import {
  getAllScorecardAssets,
  getAllFxPairs,
  getHeatmap,
  getScoreHistory,
  getIndicatorHistory,
  getCotHistory,
  type PublicScorecardAsset,
  type PublicFxPairData,
  type OracleEconomy,
  type ScoreHistoryBreakdownEntry,
  type HistoryRange,
} from "@/lib/api/oracle";
import type {
  AnalysisPoint,
  AnalysisSubject,
  AnalysisBand,
  DateBreakdown,
  BreakdownGroup,
  TimeframeKey,
} from "./types";

// ─── shared helpers ──────────────────────────────────────────────────────────

export const SCORE_BANDS: AnalysisBand[] = [
  { label: "Strong Bearish", from: -8, to: -4, colorVar: "--lucid-scale-0" },
  { label: "Bearish", from: -4, to: -2, colorVar: "--lucid-scale-1" },
  { label: "Neutral", from: -2, to: 3, colorVar: "--lucid-scale-2" },
  { label: "Bullish", from: 3, to: 5, colorVar: "--lucid-scale-3" },
  { label: "Strong Bullish", from: 5, to: 8, colorVar: "--lucid-scale-4" },
];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ISO "2026-03-14" → "Mar 14". */
function dateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTH_SHORT[m - 1]} ${d}`;
}

/** The timeframe keys map 1:1 to the backend range param. */
function toRange(timeframe: TimeframeKey): HistoryRange {
  return timeframe;
}

/**
 * Human labels for indicator uiGroups so the side-rail groups read cleanly.
 * Backend uiGroup values: Growth / Sentiment / Inflation / Rates / Jobs.
 */
function uiGroupLabel(uiGroup: string | null): string {
  switch (uiGroup) {
    case "Growth":
      return "Economic Growth";
    case "Sentiment":
      return "Sentiment";
    case "Inflation":
      return "Inflation";
    case "Rates":
      return "Rates";
    case "Jobs":
      return "Jobs Market";
    default:
      return uiGroup ?? "Other";
  }
}

// ─── Score Trend (asset + pair) → /api/oracle/score-history ────────────────────

const FX_KEYS = new Set(["EURUSD", "GBPUSD", "USDJPY", "EURJPY", "GBPJPY"]);

/** Groups a date's indicatorBreakdown by uiGroup into rail groups. */
function groupBreakdown(entries: ScoreHistoryBreakdownEntry[]): BreakdownGroup[] {
  const order = ["Growth", "Sentiment", "Inflation", "Rates", "Jobs"];
  const byGroup = new Map<string, ScoreHistoryBreakdownEntry[]>();
  for (const e of entries) {
    if (e.isCot) continue; // COT shown separately if needed; keep fundamentals here
    const key = e.uiGroup ?? "Other";
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(e);
  }
  const cot = entries.filter((e) => e.isCot);
  const keys = [...byGroup.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const groups: BreakdownGroup[] = keys.map((k) => ({
    label: uiGroupLabel(k),
    rows: byGroup.get(k)!.map((e) => ({
      label: e.indicatorCode,
      score: e.score,
      detail: e.outcome !== "scored" ? e.outcome.replace(/_/g, " ") : null,
    })),
  }));
  if (cot.length > 0) {
    groups.push({
      label: "COT",
      rows: cot.map((e) => ({ label: e.indicatorCode, score: e.score, detail: null })),
    });
  }
  return groups;
}

export async function fetchScoreTrendSubject(
  id: string,
  timeframe: TimeframeKey,
): Promise<AnalysisSubject> {
  const res = await getScoreHistory(id, toRange(timeframe));
  const isPair = res.kind === "pair" || FX_KEYS.has(id);

  const points: AnalysisPoint[] = res.points.map((p, i) => {
    const point: AnalysisPoint = {
      index: i,
      date: p.date,
      label: dateLabel(p.date),
      value: p.totalScore,
    };
    if (i > 0) {
      const prev = res.points[i - 1].totalScore;
      if (prev < 3 && p.totalScore >= 3) point.event = { kind: "flip-up", label: "Flipped bullish" };
      else if (prev > -3 && p.totalScore <= -3) point.event = { kind: "flip-down", label: "Flipped bearish" };
    }
    return point;
  });

  const last = res.points[res.points.length - 1];
  const prev = res.points.length > 1 ? res.points[res.points.length - 2] : null;

  // Per-date breakdown rail — the centrepiece feature for assets. Pairs return
  // indicatorBreakdown: [] from the backend, so we surface an honest empty note.
  const breakdownByIndex: Record<number, DateBreakdown> = {};
  let hasAnyBreakdown = false;
  res.points.forEach((p, i) => {
    const groups = groupBreakdown(p.indicatorBreakdown);
    if (groups.length > 0) hasAnyBreakdown = true;
    breakdownByIndex[i] = {
      date: p.date,
      label: dateLabel(p.date),
      headline: p.totalScore,
      headlineLabel: p.bias,
      groups,
      emptyNote: groups.length === 0 ? "Per-date breakdown not available for pairs yet." : undefined,
    };
  });

  return {
    id: res.subject,
    name: res.name,
    flag: res.flag,
    currentValue: last?.totalScore ?? null,
    band: (last?.bias as string) ?? null,
    delta: last && prev ? last.totalScore - prev.totalScore : null,
    points,
    bands: SCORE_BANDS,
    railHeading: "Indicator Breakdown",
    railEmptyNote: isPair && !hasAnyBreakdown ? "Per-date breakdown not available for pairs yet." : undefined,
    breakdownByIndex: hasAnyBreakdown ? breakdownByIndex : undefined,
    seriesAvailable: points.length > 0,
    seriesGapNote:
      points.length === 0 ? res.reason ?? "No score history in the selected range." : undefined,
  };
}

/** Subject picker options for Score Trend / Comparison — assets + pairs. */
export async function listScoreTrendSubjectOptions() {
  const [assets, pairs] = await Promise.all([getAllScorecardAssets(), getAllFxPairs()]);
  const SCORE_HISTORY_ASSETS = new Set(["USD", "EUR", "GBP", "JPY", "Gold"]);
  return [
    ...assets
      .filter((a) => SCORE_HISTORY_ASSETS.has(a.key))
      .map((a) => ({ id: a.key, label: a.name, flag: a.flag, group: "Assets" })),
    ...pairs.map((p) => ({
      id: p.key,
      label: p.label,
      flag: `${p.currAFlag}${p.currBFlag}`,
      group: "Pairs",
    })),
  ];
}

// ─── Indicator Trend → /api/oracle/indicator-history ───────────────────────────

export async function fetchIndicatorSubject(
  code: string,
  timeframe: TimeframeKey,
): Promise<AnalysisSubject> {
  const res = await getIndicatorHistory(code, toRange(timeframe));

  const points: AnalysisPoint[] = res.points.map((p, i) => {
    const point: AnalysisPoint = {
      index: i,
      date: p.date,
      label: dateLabel(p.date),
      value: p.value,
      secondary: p.forecast,
    };
    if (p.surprise !== null && p.surprise !== 0) {
      point.event =
        p.surprise > 0
          ? { kind: "surprise-beat", label: `Beat forecast by ${p.surprise.toFixed(2)}` }
          : { kind: "surprise-miss", label: `Missed forecast by ${Math.abs(p.surprise).toFixed(2)}` };
    }
    return point;
  });

  const last = res.points[res.points.length - 1];
  const prev = res.points.length > 1 ? res.points[res.points.length - 2] : null;

  const breakdownByIndex: Record<number, DateBreakdown> = {};
  res.points.forEach((p, i) => {
    breakdownByIndex[i] = {
      date: p.date,
      label: dateLabel(p.date),
      headline: p.value,
      headlineLabel: null,
      groups: [
        {
          label: "Release",
          rows: [
            { label: "Actual", score: null, detail: fmt(p.value) },
            { label: "Forecast", score: null, detail: fmt(p.forecast) },
            { label: "Previous", score: null, detail: fmt(p.previous) },
            {
              label: "Surprise",
              score: p.surprise === null ? null : p.surprise > 0 ? 1 : p.surprise < 0 ? -1 : 0,
              detail: p.surprise !== null ? (p.surprise > 0 ? `+${p.surprise.toFixed(2)}` : p.surprise.toFixed(2)) : "—",
            },
          ],
        },
      ],
    };
  });

  return {
    id: res.code,
    name: res.name,
    currentValue: last?.value ?? null,
    band: null,
    delta: last && prev ? Number((last.value - prev.value).toFixed(2)) : null,
    points,
    secondaryLabel: "Forecast",
    railHeading: "Release Detail",
    breakdownByIndex: points.length > 0 ? breakdownByIndex : undefined,
    seriesAvailable: points.length > 0,
    seriesGapNote:
      points.length === 0 ? res.reason ?? "No releases in the selected range." : undefined,
  };
}

function fmt(n: number | null): string {
  return n === null ? "—" : String(n);
}

export async function listIndicatorSubjectOptions() {
  const heatmap = await getHeatmap();
  const economies = Object.keys(heatmap) as OracleEconomy[];
  // The indicator-history endpoint keys by indicator CODE. The heatmap exposes
  // name + economy but not the raw code, so we can't derive codes reliably from
  // it. Instead we expose the well-known scored indicator codes per economy.
  return economies.flatMap((economy) =>
    (heatmap[economy] ?? []).map((ind) => ({
      id: heatmapIndicatorCode(economy, ind.name),
      label: `${economy} — ${ind.name}`,
      group: economy,
    })),
  ).filter((o) => o.id !== null) as { id: string; label: string; group: string }[];
}

/**
 * Best-effort map from (economy, indicator display name) → backend indicator
 * code. Only the codes the backend actually stores history for are usable; the
 * engine flags a clean empty state for any that return no points.
 */
function heatmapIndicatorCode(economy: OracleEconomy, name: string): string | null {
  const n = name.toLowerCase();
  const prefix = economy === "US" ? "US" : economy === "EU" ? "EU" : economy === "UK" ? "UK" : "JP";
  if (n.includes("cpi")) return `${prefix}_CPI_YOY`;
  if (n.includes("ppi")) return `${prefix}_PPI_MOM`;
  if (n.includes("gdp")) return `${prefix}_GDP_QOQ`;
  if (n.includes("retail")) return `${prefix}_RETAIL_MOM`;
  if (n.includes("unemploy")) return `${prefix}_UNEMP`;
  if (n.includes("nfp") || n.includes("payroll")) return "US_NFP";
  if (n.includes("jolts")) return "US_JOLTS";
  if (n.includes("adp")) return "US_ADP";
  if (n.includes("claims")) return "US_JOBLESS_CLAIMS";
  if (n.includes("pce")) return "US_PCE_YOY";
  // Fallback: expose a synthesised code; the engine shows an honest empty state
  // if the backend has no history for it.
  return `${prefix}_${name.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}`;
}

// ─── COT Trajectory → /api/oracle/cot-history ──────────────────────────────────

export const COT_TRAJECTORY_ASSETS = ["USD", "EUR", "GBP", "JPY", "Gold"] as const;

export async function fetchCotSubject(
  asset: string,
  timeframe: TimeframeKey,
): Promise<AnalysisSubject> {
  const res = await getCotHistory(asset, toRange(timeframe));

  const netVals = res.points.map((p) => p.netPct).filter((v): v is number => v !== null);
  const maxNet = netVals.length ? Math.max(...netVals) : null;
  const minNet = netVals.length ? Math.min(...netVals) : null;

  const points: AnalysisPoint[] = res.points.map((p, i) => {
    const point: AnalysisPoint = {
      index: i,
      date: p.reportDate,
      label: dateLabel(p.reportDate),
      value: p.netPct,
    };
    if (p.netPct !== null && p.netPct === maxNet && maxNet !== minNet) {
      point.event = { kind: "extreme-high", label: "Positioning high" };
    } else if (p.netPct !== null && p.netPct === minNet && maxNet !== minNet) {
      point.event = { kind: "extreme-low", label: "Positioning low" };
    }
    return point;
  });

  const last = res.points[res.points.length - 1];
  const prev = res.points.length > 1 ? res.points[res.points.length - 2] : null;

  const breakdownByIndex: Record<number, DateBreakdown> = {};
  res.points.forEach((p, i) => {
    breakdownByIndex[i] = {
      date: p.reportDate,
      label: dateLabel(p.reportDate),
      headline: p.netPct,
      headlineLabel: p.netPositioningLabel,
      groups: [
        {
          label: "Positioning",
          rows: [
            { label: "Long %", score: null, detail: pct(p.longPct) },
            { label: "Short %", score: null, detail: pct(p.shortPct) },
            { label: "Net %", score: null, detail: pct(p.netPct) },
            { label: "Weekly Δ%", score: p.weeklyChangePct === null ? null : p.weeklyChangePct > 0 ? 1 : p.weeklyChangePct < 0 ? -1 : 0, detail: pct(p.weeklyChangePct) },
            { label: "Net stance", score: null, detail: p.netPositioningLabel ?? "—" },
            { label: "Weekly stance", score: null, detail: p.changeLabel ?? "—" },
          ],
        },
      ],
    };
  });

  return {
    id: res.asset,
    name: `${res.asset} — Institutional Positioning`,
    flag: res.flag,
    currentValue: last?.netPct ?? null,
    band: last?.netPositioningLabel ?? null,
    delta: last?.netPct != null && prev?.netPct != null ? Number((last.netPct - prev.netPct).toFixed(2)) : null,
    points,
    railHeading: "COT Detail",
    breakdownByIndex: points.length > 0 ? breakdownByIndex : undefined,
    seriesAvailable: points.length > 0,
    seriesGapNote:
      points.length === 0 ? res.reason ?? "No COT history in the selected range." : undefined,
  };
}

function pct(n: number | null): string {
  return n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// ─── Pair Correlation (current-snapshot alignment) ─────────────────────────────
// No true price-correlation source is wired into oracle.ts. This builds a
// score-direction alignment view across the six tracked instruments, labeled as
// such — it is NOT price correlation.

export const CORRELATION_INSTRUMENTS = [
  { id: "EURUSD", label: "EUR/USD", kind: "pair" as const },
  { id: "GBPUSD", label: "GBP/USD", kind: "pair" as const },
  { id: "USDJPY", label: "USD/JPY", kind: "pair" as const },
  { id: "EURJPY", label: "EUR/JPY", kind: "pair" as const },
  { id: "GBPJPY", label: "GBP/JPY", kind: "pair" as const },
  { id: "Gold", label: "Gold", kind: "asset" as const },
];

export interface CorrelationRow {
  id: string;
  label: string;
  score: number | null;
  bias: string | null;
  direction: "up" | "down" | "flat";
}

export async function fetchPairAlignmentSnapshot(): Promise<CorrelationRow[]> {
  const [assets, pairs] = await Promise.all([getAllScorecardAssets(), getAllFxPairs()]);
  const assetByKey = new Map<string, PublicScorecardAsset>(assets.map((a) => [a.key, a]));
  const pairByKey = new Map<string, PublicFxPairData>(pairs.map((p) => [p.key, p]));

  return CORRELATION_INSTRUMENTS.map((inst) => {
    const score =
      inst.kind === "pair" ? (pairByKey.get(inst.id)?.totalScore ?? null) : (assetByKey.get(inst.id)?.totalScore ?? null);
    const bias =
      inst.kind === "pair" ? (pairByKey.get(inst.id)?.bias ?? null) : (assetByKey.get(inst.id)?.bias ?? null);
    return {
      id: inst.id,
      label: inst.label,
      score,
      bias,
      direction: score === null || score === 0 ? "flat" : score > 0 ? "up" : "down",
    };
  });
}
