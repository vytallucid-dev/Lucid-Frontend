// ─── Oracle Tools Engine — data adapters ────────────────────────────────────
//
// Converts the live dated Oracle history endpoints into the engine's normalized
// AnalysisSubject shape. Score Trend, Indicator Trend and COT Trajectory now
// bind to real dated series (score-history / indicator-history / cot-history).
// Pair Correlation uses the current-snapshot scorecard endpoints.

import {
  getScorecardSubjects,
  getScorecardAsset,
  getAllFxPairs,
  getHeatmap,
  getScoreHistory,
  getIndicatorHistory,
  getCotHistory,
  getCotAssets,
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
  const isPair = res.kind === "pair";

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

/**
 * Subject picker options for Score Trend / Comparison — assets + pairs.
 * Every scorecard asset the backend returns is included (no hardcoded
 * currency subset) — score-history is available for every registered
 * asset/pair now, not just USD/EUR/GBP/JPY/Gold.
 *
 * Bug 2: previously called getAllScorecardAssets(), which hit
 * GET /api/oracle/scorecard with no `asset` param — a required param the
 * backend has no list-all fallback for, so that call always 400'd and this
 * subject list was permanently empty (Score Trend and Score Comparison both
 * read it, hence both failing). getScorecardSubjects() is the lightweight
 * list endpoint built for exactly this — id/label/flag/group is all this
 * picker needs, and it actually returns data.
 */
export async function listScoreTrendSubjectOptions() {
  const [assets, pairs] = await Promise.all([getScorecardSubjects(), getAllFxPairs()]);
  return [
    ...assets.map((a) => ({ id: a.key, label: a.name, flag: a.flag, group: "Assets" })),
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
  // The indicator-history endpoint keys by indicator CODE. The heatmap payload
  // now carries that real backend code on every row directly (see
  // HeatmapIndicator.code), so no name-guessing or picker-side mapping table
  // is needed — every indicator the backend returns is selectable.
  return economies.flatMap((economy) =>
    (heatmap[economy] ?? []).map((ind) => ({
      id: ind.code,
      label: `${economy} — ${ind.name}`,
      group: economy,
    })),
  );
}

// ─── COT Trajectory → /api/oracle/cot-history ──────────────────────────────────

/**
 * Subject picker options for COT Trajectory / Comparison. Phase 7: derived
 * from /api/oracle/cot (the same source the COT page itself renders), scoped
 * to `outcome !== "deferred"` — no CFTC ingestion exists for that instrument
 * at all (SPY/NAS100/US30 today) — rather than a hardcoded currency list, so
 * a newly onboarded COT-eligible asset (AUD, once it has real CFTC data)
 * appears with no edit here.
 */
export async function listCotTrajectorySubjectOptions() {
  const assets = await getCotAssets();
  return assets
    .filter((a) => a.outcome !== "deferred")
    .map((a) => ({ id: a.asset, label: a.asset, flag: a.flag, group: "Assets" }));
}

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
// score-direction alignment view across the tracked instruments, labeled as
// such — it is NOT price correlation.
//
// Phase 7: pair membership is fully derived from getAllFxPairs() — every FX
// pair the backend returns (including the four AUD pairs) is included, not a
// fixed five. "Gold" is the one deliberately kept local addition: it's the
// only standalone asset with a score directly comparable to a pair's (via
// XAUUSD), which is why this view was framed around it in the first place —
// not an instrument-list gap the way the fixed five pairs were.

export interface CorrelationRow {
  id: string;
  label: string;
  score: number | null;
  bias: string | null;
  direction: "up" | "down" | "flat";
}

// Bug 2: previously fetched all scorecard assets (getAllScorecardAssets(),
// the same permanently-broken no-param call Score Trend relied on) just to
// pick Gold's score/bias back out of the list. This view only ever needed
// that one asset — getScorecardAsset("Gold") is the same endpoint used
// everywhere else a single scorecard is read, and Gold not resolving no
// longer takes the whole view down with it (caught below, degrades to a
// "flat/no data" Gold row instead of failing the pairs data too).
export async function fetchPairAlignmentSnapshot(): Promise<CorrelationRow[]> {
  const [pairs, gold] = await Promise.all([
    getAllFxPairs(),
    getScorecardAsset("Gold").catch(() => null),
  ]);

  const rows: CorrelationRow[] = pairs.map((p) => ({
    id: p.key,
    label: p.label,
    score: p.totalScore,
    bias: p.bias,
    direction: p.totalScore === null || p.totalScore === 0 ? "flat" : p.totalScore > 0 ? "up" : "down",
  }));

  rows.push({
    id: "Gold",
    label: "Gold",
    score: gold?.totalScore ?? null,
    bias: gold?.bias ?? null,
    direction:
      !gold?.totalScore ? "flat" : gold.totalScore > 0 ? "up" : "down",
  });

  return rows;
}
