import { apiFetch } from './client';

// ─── Scalar types ─────────────────────────────────────────────────────────────

// Issue 2: widened to include "AU" (the AUD economy — grouped by owning
// asset, not raw country; see the backend's heatmapEconomyKeyForAsset).
export type OracleEconomy = 'US' | 'EU' | 'UK' | 'JP' | 'AU';
// 'aging' — renamed from 'stale' on the wire (see the shared backend comment
// on isAging in oracle-mappers.ts). Deliberately independent of `overdue`,
// which is carried on each type below as its own boolean, never folded into
// this union — aging and overdue are different facts and must never be
// merged into one marker.
export type OracleOutcome = 'scored' | 'carry_forward' | 'insufficient_data' | 'aging';
// Phase 7: widened to the full current registry (AUD, US30) so the picker
// types cover every instrument /api/oracle/assets can return. The picker
// UIs themselves derive their option lists from that response at runtime
// (see ASSET_TYPE_ORDER in scorecard/page.tsx and fx-scorecard/page.tsx) —
// these unions exist for call sites that need a concrete key type, not as
// the source of which instruments exist.
export type ScorecardAssetKey = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'Gold' | 'SPY' | 'NAS100' | 'US30';
export type FxPairKey =
  | 'EURUSD' | 'GBPUSD' | 'USDJPY' | 'EURJPY' | 'GBPJPY'
  | 'AUDUSD' | 'AUDJPY' | 'EURAUD' | 'GBPAUD';

// ─── Heatmap types ────────────────────────────────────────────────────────────

/**
 * The next scheduled occurrence for an indicator, from a stored calendar
 * event — never computed from cadence. `variant` is the release rung
 * (flash/final/prelim/...) when the indicator has a registered ladder, null
 * for a single-release indicator.
 */
export interface NextReleaseInfo {
  scheduledAt: string; // ISO-8601 UTC instant
  variant: string | null;
}

export interface PublicHeatmapIndicator {
  code: string;
  name: string;
  frequency: string;
  category: string;
  lastRelease: string;
  // Null when no future calendar event is stored for this indicator — the
  // common case, since the feed is current-week-only. Never a fabricated
  // date; render an honest "unknown" state, not a guess.
  nextRelease: NextReleaseInfo | null;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  surprise: string | null;
  score: number | null;
  outcome: OracleOutcome;
  reason: string | null;
  // Renamed from stale/staleDate — flat 60-day observationDate tolerance.
  aging?: boolean;
  agingDate?: string;
  // B1 — a scheduled release passed >24h ago with nothing entered.
  // Independent of `aging` above; never conflate the two into one marker.
  overdue?: boolean;
}

export type PublicHeatmapResponse = Record<OracleEconomy, PublicHeatmapIndicator[]>;

// ─── Asset Scorecard types ────────────────────────────────────────────────────

export interface PublicScorecardIndicator {
  name: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  surprise: string | null;
  score: number | null;
  outcome: OracleOutcome;
  reason: string | null;
  // Renamed from staleDate.
  agingDate?: string;
  // B1 — see PublicHeatmapIndicator.overdue.
  overdue?: boolean;
}

export interface PublicScorecardSection {
  label: string;
  color: string;
  subtotal: number;
  indicators: PublicScorecardIndicator[];
}

export interface PublicCotDetail {
  netPositioning: string;
  weeklyChange: string;
  cotScore: number;
  longPct: string;
  shortPct: string;
  deltaWeekly: string;
}

export interface PublicScorecardAsset {
  key: ScorecardAssetKey;
  name: string;
  flag: string;
  totalScore: number | null;
  fundamentals: number | null;
  cotScore: number | null;
  bias: AssetBias | null;
  cot: PublicCotDetail | null;
  sections: PublicScorecardSection[];
  scoreHistory: number[] | null;
  outcome: AssetOutcome;
  reason: string | null;
  lastUpdated: string | null;
}

// ─── FX Scorecard types ───────────────────────────────────────────────────────

export type FxResult = 'BEAT' | 'MISS' | 'MET' | 'N/A';

export interface PublicFxIndicatorSide {
  result: FxResult;
  actual: string | null;
  forecast?: string | null;
  surprise?: string | null;
  outcome: OracleOutcome;
  // Brought in line with the asset scorecard and heatmap (previously this
  // side had no aging/overdue concept at all).
  agingDate?: string;
  overdue?: boolean;
}

export interface PublicFxIndicatorRow {
  name: string;
  currA: PublicFxIndicatorSide;
  currB: PublicFxIndicatorSide;
  pairScore: number | null;
  /**
   * Phase 3 (backend) / Phase 7 (typed here): the row is present in the
   * template but neither side supplies an indicator for this pair (e.g. the
   * five USD-only rows in a pair with no USD) — pairScore is 0 because
   * there's nothing to score, not because the data came in neutral. A
   * hard-excluded row (neither side applicable) never reaches the frontend
   * at all; this flag only ever appears on rows that DO reach it.
   */
  inapplicable?: boolean;
}

export interface PublicFxCategory {
  label: string;
  color: string;
  subtotal: number;
  indicators: PublicFxIndicatorRow[];
}

export interface PublicFxCotSide {
  longPct: string;
  shortPct: string;
  changePct: string;
  direction: string;
}

export interface PublicFxPairData {
  key: string;
  label: string;
  currAName: string;
  currAFlag: string;
  currBName: string;
  currBFlag: string;
  totalScore: number | null;
  fundamentals: number | null;
  cotScore: number | null;
  bias: AssetBias | null;
  cotA: PublicFxCotSide | null;
  cotB: PublicFxCotSide | null;
  cotNote: string;
  categories: PublicFxCategory[];
  scoreHistory: number[] | null;
  outcome: AssetOutcome;
  reason: string | null;
  lastUpdated: string | null;
}

// ─── Response envelope types (internal) ───────────────────────────────────────

interface HeatmapEnvelope {
  success: boolean;
  data: PublicHeatmapResponse;
}

interface ScorecardAssetEnvelope {
  success: boolean;
  data: PublicScorecardAsset;
}

interface FxPairEnvelope {
  success: boolean;
  data: PublicFxPairData;
}

interface FxPairsEnvelope {
  success: boolean;
  data: PublicFxPairData[];
}

// ─── API functions ─────────────────────────────────────────────────────────────

export async function getHeatmap(): Promise<PublicHeatmapResponse> {
  const res = await apiFetch<HeatmapEnvelope>('/api/oracle/heatmap');
  return res.data;
}

export async function getScorecardAsset(key: ScorecardAssetKey): Promise<PublicScorecardAsset> {
  const res = await apiFetch<ScorecardAssetEnvelope>(`/api/oracle/scorecard?asset=${key}`);
  return res.data;
}

// Bug 2: there is deliberately no getAllScorecardAssets(). The backend's
// GET /api/oracle/scorecard requires ?asset= (no list-all branch) — a
// no-param call to it always 400s. Both former callers here (Score Trend's
// subject list, Pair Correlation's Gold lookup) now use the endpoint that
// actually matches what each one needs: getScorecardSubjects() for a lightweight
// list, getScorecardAsset() for one asset's live score.

export async function getFxPair(pair: string): Promise<PublicFxPairData> {
  const res = await apiFetch<FxPairEnvelope>(`/api/oracle/fx-scorecard?pair=${pair}`);
  return res.data;
}

export async function getAllFxPairs(): Promise<PublicFxPairData[]> {
  const res = await apiFetch<FxPairsEnvelope>('/api/oracle/fx-scorecard');
  return res.data;
}

// ─── Asset (Top Setups) types ─────────────────────────────────────────────────

export type AssetOutcome = 'scored' | 'insufficient_data' | 'deferred';

export type AssetBias =
  | 'Strong Bullish'
  | 'Bullish'
  | 'Neutral'
  | 'Bearish'
  | 'Strong Bearish';

export type AssetType = 'Forex' | 'Currency' | 'Commodity' | 'Index';

/** COT page row outcome — deferred = no CFTC ingestion planned yet (SPY, NAS100). */
export type CotOutcome = 'scored' | 'insufficient_data' | 'deferred';

export interface PublicAssetData {
  asset: string;
  type: AssetType;
  flag: string;
  score: number | null;
  bias: AssetBias | null;
  cot: number | null;
  gdp: number | null;
  pmiM: number | null;
  pmiS: number | null;
  retail: number | null;
  consConf: number | null;
  cpi: number | null;
  ppi: number | null;
  pce: number | null;
  yield: number | null;
  nfp: number | null;
  unemp: number | null;
  claims: number | null;
  adp: number | null;
  jolts: number | null;
  // Phase 3 (backend) / Phase 7 (typed here): four slots that were computed
  // and stored but never rendered — see PAIR_ROW_TO_SLOT in the backend's
  // oracle-mappers.ts for the row-name → slot mapping this mirrors.
  cashEarnings: number | null;
  auEmpl: number | null;
  tokyoCpi: number | null;
  caixinPmi: number | null;
  outcome: AssetOutcome;
  reason: string | null;
  lastUpdated: string | null;
  /**
   * Phase 3 (backend) / Phase 7 (typed here): slot keys that are present but
   * inapplicable for this instrument (neither side of the underlying pair
   * row supplies an indicator — the five USD-only rows for a non-USD pair).
   * Distinct from null-because-hard-excluded (which the slot itself already
   * represents as `null`): a slot can be `null` because it's inapplicable,
   * OR because outcome is insufficient_data — this array disambiguates.
   */
  inapplicableSlots: string[];
}

interface AssetsEnvelope {
  success: boolean;
  data: PublicAssetData[];
}

export async function getAssets(): Promise<PublicAssetData[]> {
  const res = await apiFetch<AssetsEnvelope>('/api/oracle/assets');
  return res.data;
}

// ─── Scorecard subjects (Issue 1) ──────────────────────────────────────────────
// The Asset Scorecard picker's valid subject set — currencies + Gold, the same
// set the /scorecard endpoint itself validates against (registry.scorecardByKey
// backend-side). Distinct from /api/oracle/assets (the screener projection),
// which has never contained standalone currencies.

export interface PublicScorecardSubject {
  key: string;
  name: string;
  flag: string;
  type: AssetType;
}

interface ScorecardSubjectsEnvelope {
  success: boolean;
  data: PublicScorecardSubject[];
}

export async function getScorecardSubjects(): Promise<PublicScorecardSubject[]> {
  const res = await apiFetch<ScorecardSubjectsEnvelope>('/api/oracle/scorecard-subjects');
  return res.data;
}

// ─── COT types ────────────────────────────────────────────────────────────────

export interface PublicCotAsset {
  asset: string;
  flag: string;
  type: AssetType;
  longContracts: number | null;
  shortContracts: number | null;
  deltaLong: number | null;
  deltaShort: number | null;
  longPct: number | null;
  shortPct: number | null;
  netPctChange: number | null;
  netPosition: number | null;
  cotScore: number | null;
  scoreTooltip: string;
  trend: number[] | null;
  outcome: CotOutcome;
  reason: string | null;
  dataAsOf: string | null;
  releasedOn: string | null;
}

interface CotEnvelope {
  success: boolean;
  data: PublicCotAsset[];
}

export async function getCotAssets(): Promise<PublicCotAsset[]> {
  const res = await apiFetch<CotEnvelope>('/api/oracle/cot');
  return res.data;
}

// ─── Compass types ────────────────────────────────────────────────────────────

export type CompassRegime = 'Risk-On' | 'Caution' | 'Risk-Off';
export type CompassBand = 'GREEN' | 'YELLOW' | 'RED';

export interface PublicCompassSubCheck {
  name: string;
  value: string;
  detail: string;
  colorBand: CompassBand;
}

export interface PublicCompassInput {
  code: string;
  colorBand: CompassBand;
  weight: number;
  displayValue: string;
  displayDetail: string | null;
  subChecks: PublicCompassSubCheck[] | null;
  /** Phase 5: the input's own row was flagged stale beyond its limit at ingest. */
  stale: boolean;
  /** Phase 5: not enough clean history for the input's lookback. */
  insufficientHistory: boolean;
}

export interface PublicCompassOverrideRef {
  code: string;
  adjustment: number;
}

export interface PublicCompassScoreImpactRow {
  asset: string;
  kind: 'asset' | 'pair';
  baseScore: number;
  finalScore: number;
  adjustment: number;
  regime: CompassRegime | null;
  overrides: PublicCompassOverrideRef[];
}

export interface PublicCompassHistoryRow {
  date: string;
  /** The FINAL regime for the day (Risk-Off under a Trigger A shock). */
  finalRegime: CompassRegime;
  activeRegime: CompassRegime;
  candidateRegime: CompassRegime;
  shockAActive: boolean;
  shockBActive: boolean;
  greenWeight: number;
  redWeight: number;
  bands: Record<string, CompassBand>;
}

/** Phase 6 per-override active/suppressed state + human reason. */
export interface PublicCompassOverrideState {
  code: string;
  id: number;
  active: boolean;
  suppressed: boolean;
  reason: string | null;
}

/** Phase 6 gate + shock state for the current day. */
export interface PublicCompassGateState {
  finalRegime: CompassRegime;
  shockAActive: boolean;
  shockAExpiry: string | null;
  shockBActive: boolean;
  shockBExpiry: string | null;
  rateGateHawkish: boolean;
  us02yClose: number | null;
  us02ySma21: number | null;
  override3SuppressedByGate: boolean;
  override5SuppressedByGate: boolean;
  fedConstraint: string;
  fedConstraintEffectiveFrom: string | null;
  override2SuppressedByConstraint: boolean;
  overridesActive: string[];
  overrides: PublicCompassOverrideState[];
}

export interface PublicCompassThresholds {
  redRiskOffAt: number;
  greenRiskOnAt: number;
  redRiskOnCeiling: number;
  daysToHigherSeverity: number;
  daysToLowerSeverity: number;
}

export interface PublicCompassSnapshot {
  current: {
    classificationDate: string;
    candidateRegime: CompassRegime;
    /** Standard machine active regime. */
    activeRegime: CompassRegime;
    /** The ACTUAL regime — Risk-Off under a Trigger A shock. The UI shows THIS. */
    finalRegime: CompassRegime;
    persistenceDaysCount: number;
    /** The pending candidate label building toward a flip, or null. */
    pendingLabel: CompassRegime | null;
    pendingCount: number;
    /** Days required for the pending flip (3 toward higher severity, 5 toward lower). */
    required: number;
    daysStable: number;
    weights: { green: number; yellow: number; red: number; total: number };
    thresholds: PublicCompassThresholds;
  };
  gate: PublicCompassGateState;
  inputs: PublicCompassInput[];
  scoreImpact: PublicCompassScoreImpactRow[];
  history: PublicCompassHistoryRow[];
}

interface CompassEnvelope {
  success: boolean;
  data: PublicCompassSnapshot | null;
}

/** Full Compass snapshot. `null` until the classifier has produced a regime. */
export async function getCompass(): Promise<PublicCompassSnapshot | null> {
  const res = await apiFetch<CompassEnvelope>('/api/oracle/compass');
  return res.data;
}

// ─── Dated-history endpoints (Oracle Tools engine) ─────────────────────────────
// Additive read endpoints exposing dated rows already stored in the backend.
// Shapes mirror the backend oracle.types.ts exactly.

export type HistoryRange = '1M' | '3M' | '6M' | '1Y';

export interface ScoreHistoryBreakdownEntry {
  indicatorCode: string;
  score: number | null;
  uiGroup: string | null;
  isCot: boolean;
  outcome: 'scored' | 'carry_forward' | 'insufficient_data' | 'absent';
  reason: string | null;
}

export interface ScoreHistoryPoint {
  date: string;
  totalScore: number;
  fundamentalsScore: number | null;
  cotScore: number | null;
  bias: AssetBias;
  indicatorBreakdown: ScoreHistoryBreakdownEntry[];
}

export interface ScoreHistoryResponse {
  subject: string;
  kind: 'asset' | 'pair';
  name: string;
  flag: string;
  range: HistoryRange;
  from: string | null;
  to: string | null;
  points: ScoreHistoryPoint[];
  outcome: 'scored' | 'insufficient_data';
  reason: string | null;
}

export interface IndicatorHistoryPoint {
  date: string;
  value: number;
  forecast: number | null;
  previous: number | null;
  surprise: number | null;
}

export interface IndicatorHistoryResponse {
  code: string;
  name: string;
  range: HistoryRange;
  from: string | null;
  to: string | null;
  points: IndicatorHistoryPoint[];
  outcome: 'scored' | 'insufficient_data';
  reason: string | null;
}

export interface CotHistoryPoint {
  reportDate: string;
  releaseDate: string;
  longContracts: number | null;
  shortContracts: number | null;
  longPct: number | null;
  shortPct: number | null;
  netPct: number | null;
  weeklyChangePct: number | null;
  netPositioningLabel: 'Bullish' | 'Bearish' | 'Neutral' | null;
  changeLabel: 'Bullish' | 'Bearish' | 'Neutral' | null;
}

export interface CotHistoryResponse {
  asset: string;
  flag: string;
  range: HistoryRange;
  from: string | null;
  to: string | null;
  points: CotHistoryPoint[];
  outcome: 'scored' | 'insufficient_data';
  reason: string | null;
}

export interface CycleStanceEntry {
  currencyCode: string;
  stance: 'CUTTING' | 'NEUTRAL' | 'HIKING';
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

export interface CycleStancesResponse {
  stances: CycleStanceEntry[];
}

// /api/oracle/assets (and other endpoints keyed off the DB asset code) return
// Gold's identifier as "XAUUSD", but /api/oracle/score-history's `subject` enum
// uses "Gold" (matching /api/oracle/scorecard's convention). Normalize here so
// every caller — sparklines, oracle-tools adapters, Top Setups click handlers —
// can pass either spelling without needing to know about the mismatch.
// Idempotent: "Gold" is untouched, so callers that already pass "Gold" are safe.
export function toScoreHistorySubject(subject: string): string {
  return subject === "XAUUSD" ? "Gold" : subject;
}

// ─── Scorecard routing (single source of truth) ────────────────────────────
//
// The one place in the frontend deciding where an instrument's scorecard
// lives. Branches on the instrument's own `type` as the API reports it —
// never on the code's length, characters, or membership in a hardcoded list.
// A prior version of this logic (duplicated per call site) checked "is it
// XAUUSD → asset scorecard, else → FX scorecard" and "always → asset
// scorecard" at two different call sites — the indices (Index type, added
// Phase 4) matched neither author's assumption correctly, routing them to a
// page that can't render them. Any current or future instrument type not
// handled below falls through to Top Setups rather than a scorecard that
// doesn't know it — never a page that can't render the selection.
//
// `type` is typed as `string`, not `AssetType`, deliberately: this is read
// from an HTTP response, and the fallback branch must be reachable at
// runtime for a type the frontend's own union doesn't yet know about, not
// dead code a stricter type would make unreachable.
export function scorecardHrefFor(instrument: { asset: string; type: string }): string {
  if (instrument.type === "Forex") {
    return `/oracle/fx-scorecard?asset=${encodeURIComponent(instrument.asset)}`;
  }
  if (instrument.type === "Currency" || instrument.type === "Commodity" || instrument.type === "Index") {
    return `/oracle/scorecard?asset=${encodeURIComponent(toScoreHistorySubject(instrument.asset))}`;
  }
  return "/oracle";
}

/** Dated total-score series for an asset (USD/EUR/GBP/JPY/Gold) or FX pair. */
export async function getScoreHistory(
  subject: string,
  range: HistoryRange,
): Promise<ScoreHistoryResponse> {
  const res = await apiFetch<{ success: boolean; data: ScoreHistoryResponse }>(
    `/api/oracle/score-history?subject=${encodeURIComponent(toScoreHistorySubject(subject))}&range=${range}`,
  );
  return res.data;
}

/** Dated release series for a single indicator (value/forecast/previous/surprise). */
export async function getIndicatorHistory(
  code: string,
  range: HistoryRange,
): Promise<IndicatorHistoryResponse> {
  const res = await apiFetch<{ success: boolean; data: IndicatorHistoryResponse }>(
    `/api/oracle/indicator-history?code=${encodeURIComponent(code)}&range=${range}`,
  );
  return res.data;
}

/** Dated CFTC positioning series per asset (USD/EUR/GBP/JPY/Gold). */
export async function getCotHistory(
  asset: string,
  range: HistoryRange,
): Promise<CotHistoryResponse> {
  const res = await apiFetch<{ success: boolean; data: CotHistoryResponse }>(
    `/api/oracle/cot-history?asset=${encodeURIComponent(asset)}&range=${range}`,
  );
  return res.data;
}

/** Active central-bank cycle stance per currency (effective-dated). */
export async function getCycleStances(): Promise<CycleStancesResponse> {
  const res = await apiFetch<{ success: boolean; data: CycleStancesResponse }>(
    '/api/oracle/cycle-stances',
  );
  return res.data;
}
