import { apiFetch } from './client';

// ─── Scalar types ─────────────────────────────────────────────────────────────

export type OracleEconomy = 'US' | 'EU' | 'UK' | 'JP';
export type OracleOutcome = 'scored' | 'carry_forward' | 'insufficient_data';
export type ScorecardAssetKey = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'Gold' | 'SPY' | 'NAS100';
export type FxPairKey = 'EURUSD' | 'GBPUSD' | 'USDJPY' | 'EURJPY' | 'GBPJPY';

// ─── Heatmap types ────────────────────────────────────────────────────────────

export interface PublicHeatmapIndicator {
  name: string;
  frequency: string;
  category: string;
  lastRelease: string;
  nextRelease: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  surprise: string | null;
  score: number | null;
  outcome: OracleOutcome;
  reason: string | null;
  stale?: boolean;
  staleDate?: string;
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
  staleDate?: string;
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
}

export interface PublicFxIndicatorRow {
  name: string;
  currA: PublicFxIndicatorSide;
  currB: PublicFxIndicatorSide;
  pairScore: number | null;
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

interface ScorecardAssetsEnvelope {
  success: boolean;
  data: PublicScorecardAsset[];
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

export async function getAllScorecardAssets(): Promise<PublicScorecardAsset[]> {
  const res = await apiFetch<ScorecardAssetsEnvelope>('/api/oracle/scorecard');
  return res.data;
}

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
  outcome: AssetOutcome;
  reason: string | null;
  lastUpdated: string | null;
}

interface AssetsEnvelope {
  success: boolean;
  data: PublicAssetData[];
}

export async function getAssets(): Promise<PublicAssetData[]> {
  const res = await apiFetch<AssetsEnvelope>('/api/oracle/assets');
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
  activeRegime: CompassRegime;
  candidateRegime: CompassRegime;
  crisisOverrideFired: boolean;
  greenWeight: number;
  redWeight: number;
  bands: Record<string, CompassBand>;
}

export interface PublicCompassSnapshot {
  current: {
    classificationDate: string;
    candidateRegime: CompassRegime;
    activeRegime: CompassRegime;
    persistenceDaysCount: number;
    crisisOverrideFired: boolean;
    daysStable: number;
    weights: { green: number; yellow: number; red: number; total: number };
  };
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
