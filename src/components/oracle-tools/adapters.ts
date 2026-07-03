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
  let res;
  try {
    res = await getIndicatorHistory(code, toRange(timeframe));
  } catch {
    // Unresolved/unknown code (e.g. a name→code mapping the backend doesn't
    // store) → graceful "data unavailable" state, never a crash screen.
    return {
      id: code,
      name: code,
      currentValue: null,
      band: null,
      delta: null,
      points: [],
      seriesAvailable: false,
      seriesGapNote: `No history available for "${code}". This indicator isn't served by the history endpoint yet.`,
    };
  }

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
  // name + economy but not the raw code, so we map the well-known scored codes
  // per economy. Names we can't map to a REAL backend code are dropped from the
  // picker entirely (no synthesised codes → no 404 crash on selection).
  return economies.flatMap((economy) =>
    (heatmap[economy] ?? [])
      .map((ind): { id: string; label: string; group: string } | null => {
        const id = heatmapIndicatorCode(economy, ind.name);
        return id ? { id, label: `${economy} — ${ind.name}`, group: economy } : null;
      })
      .filter((o): o is { id: string; label: string; group: string } => o !== null),
  );
}

/**
 * Maps (economy, indicator display name) → a REAL backend indicator code.
 * Returns null when it can't map to a code the backend actually stores — the
 * caller drops those so the picker never offers a code that would 404.
 *
 * Guards against double-prefixing: US-scoped names already containing "US ISM"
 * etc. must not become `US_US_...`. The prefix is only applied to the fixed
 * code suffix below (never to the raw name), so double-prefixing cannot occur.
 */
export function heatmapIndicatorCode(economy: OracleEconomy, name: string): string | null {
  const n = name.toLowerCase();
  const prefix = economy; // "US" | "EU" | "UK" | "JP" — used ONLY on fixed suffixes
  // US-only single-country indicators (no per-economy variant in the backend).
  if (n.includes("nfp") || n.includes("payroll") || n.includes("non-farm") || n.includes("nonfarm")) return "US_NFP";
  if (n.includes("jolts")) return "US_JOLTS";
  if (n.includes("adp")) return "US_ADP";
  if (n.includes("jobless") || n.includes("claims")) return "US_JOBLESS_CLAIMS";
  if (n.includes("pce")) return "US_PCE_YOY";
  // Per-economy indicators — prefix applied to a KNOWN suffix only.
  if (n.includes("cpi")) return `${prefix}_CPI_YOY`;
  if (n.includes("ppi")) return `${prefix}_PPI_MOM`;
  if (n.includes("gdp")) return `${prefix}_GDP_QOQ`;
  if (n.includes("retail")) return `${prefix}_RETAIL_MOM`;
  if (n.includes("unemploy")) return `${prefix}_UNEMP`;
  // Unmappable → null (dropped from picker; never synthesised).
  return null;
}

// ─── COT Trajectory → /api/oracle/cot-history ──────────────────────────────────

export const COT_TRAJECTORY_ASSETS = ["USD", "EUR", "GBP", "JPY", "Gold"] as const;

/** Net position in contracts = long − short (the primary COT signal). */
function netPosition(p: { longContracts: number | null; shortContracts: number | null }): number | null {
  if (p.longContracts === null || p.shortContracts === null) return null;
  return p.longContracts - p.shortContracts;
}

export async function fetchCotSubject(
  asset: string,
  timeframe: TimeframeKey,
): Promise<AnalysisSubject> {
  const res = await getCotHistory(asset, toRange(timeframe));

  const netVals = res.points.map(netPosition).filter((v): v is number => v !== null);
  const maxNet = netVals.length ? Math.max(...netVals) : null;
  const minNet = netVals.length ? Math.min(...netVals) : null;

  const points: AnalysisPoint[] = res.points.map((p, i) => {
    const net = netPosition(p);
    const point: AnalysisPoint = {
      index: i,
      date: p.reportDate,
      label: dateLabel(p.reportDate),
      value: net, // PRIMARY = net position (contracts)
      secondary: p.weeklyChangePct, // demoted overlay
    };
    if (net !== null && net === maxNet && maxNet !== minNet) {
      point.event = { kind: "extreme-high", label: "Most long in window" };
    } else if (net !== null && net === minNet && maxNet !== minNet) {
      point.event = { kind: "extreme-low", label: "Most short in window" };
    }
    return point;
  });

  const lastPt = res.points[res.points.length - 1];
  const prevPt = res.points.length > 1 ? res.points[res.points.length - 2] : null;
  const lastNet = lastPt ? netPosition(lastPt) : null;
  const prevNet = prevPt ? netPosition(prevPt) : null;

  const breakdownByIndex: Record<number, DateBreakdown> = {};
  res.points.forEach((p, i) => {
    breakdownByIndex[i] = {
      date: p.reportDate,
      label: dateLabel(p.reportDate),
      headline: netPosition(p),
      headlineLabel: p.netPositioningLabel,
      groups: [
        {
          label: "Positioning",
          rows: [
            { label: "Long", score: null, detail: contracts(p.longContracts) },
            { label: "Short", score: null, detail: contracts(p.shortContracts) },
            { label: "Net", score: null, detail: contracts(netPosition(p)) },
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
    name: `${res.asset} — Net Position`,
    flag: res.flag,
    currentValue: lastNet,
    band: lastPt?.netPositioningLabel ?? null,
    delta: lastNet != null && prevNet != null ? lastNet - prevNet : null,
    points,
    secondaryLabel: "Weekly Δ%",
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

function contracts(n: number | null): string {
  return n === null ? "—" : `${n > 0 ? "+" : ""}${n.toLocaleString()}`;
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
