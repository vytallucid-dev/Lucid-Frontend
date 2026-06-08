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
}

interface CotEnvelope {
  success: boolean;
  data: PublicCotAsset[];
}

export async function getCotAssets(): Promise<PublicCotAsset[]> {
  const res = await apiFetch<CotEnvelope>('/api/oracle/cot');
  return res.data;
}
