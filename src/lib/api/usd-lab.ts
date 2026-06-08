import { apiFetch } from './client';

// ─── USD Lab (NIFTY Indicator 9) types — mirror lucid-backend usd-lab.types.ts ──

export type Ind9Category =
  | 'Absolute Threshold'
  | 'vs Forecast'
  | 'Direction vs Prior'
  | 'Direction vs Prior (INVERTED)'
  | 'SMA Direction';

export type Ind9Cluster = 'INFLATION' | 'GROWTH' | 'LABOR' | 'SENTIMENT';

/** USD-strength convention: +1 = USD strong, −1 = USD weak. */
export type Ind9SubScore = -1 | 0 | 1 | null;

export type Ind9Cadence = 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly';

export type Ind9CompositionFlag =
  | 'INFLATION_LED'
  | 'DEMAND_DESTRUCTION'
  | 'MIXED'
  | 'INFLATION_HOT'
  | 'DEMAND_REACCEL'
  | 'MIXED_HOT'
  | null;

export type ReferenceKind = 'forecast' | 'prior' | 'threshold' | 'sma_5d' | 'none';

export interface UsdLabSubIndicator {
  id: number;
  code: string;
  name: string;
  short: string;
  category: Ind9Category;
  cluster: Ind9Cluster;
  score: Ind9SubScore;
  actual: string | null;
  forecast: string | null;
  prior: string | null;
  threshold: string | null;
  reference: string | null;
  referenceKind: ReferenceKind;
  reasoning: string;
  lastReleaseDate: string | null;
  cadence: Ind9Cadence;
  dataSource: string;
  isStale: boolean;
  staleDays: number | null;
  fallbackUsed: boolean;
}

export interface UsdLabTier {
  min: number | null;
  max: number | null;
  niftyScore: number;
  read: string;
  current: boolean;
}

export interface UsdLabCluster {
  cluster: Ind9Cluster;
  sum: number;
  negCount: number;
  posCount: number;
  includedInFlag: boolean;
}

export interface UsdLabFlagCheck {
  flag: Exclude<Ind9CompositionFlag, null>;
  passed: boolean;
  detail: string;
}

export interface UsdLabComposition {
  flag: Ind9CompositionFlag;
  activated: boolean;
  side: 'weak' | 'strong' | null;
  iNeg: number;
  glNeg: number;
  iPos: number;
  glPos: number;
  checks: UsdLabFlagCheck[];
  read: string;
}

export interface UsdLabHistoryPoint {
  date: string;
  rawComposite: number;
  niftyScore: number;
  compositionFlag: Ind9CompositionFlag;
}

export type UsdLabComputability = 'FULL' | 'DEGRADED' | 'SUPPRESSED';

export interface UsdLabDataQuality {
  dataCount: number;
  parseableCount: number;
  staleCount: number;
  computability: UsdLabComputability;
  suppressed: boolean;
}

export interface UsdLabResponse {
  asOf: string;
  rawComposite: number | null;
  niftyScore: number | null;
  tiers: UsdLabTier[];
  composition: UsdLabComposition;
  subIndicators: UsdLabSubIndicator[];
  clusters: UsdLabCluster[];
  history: UsdLabHistoryPoint[];
  dataQuality: UsdLabDataQuality;
}

export interface UsdLabReleaseRow {
  date: string;
  actual: string | null;
  reference: string | null;
  referenceKind: ReferenceKind;
  score: Ind9SubScore;
}

export interface UsdLabSubIndicatorDetail {
  code: string;
  name: string;
  short: string;
  category: Ind9Category;
  cluster: Ind9Cluster;
  cadence: Ind9Cadence;
  dataSource: string;
  releases: UsdLabReleaseRow[];
}

// ─── Response envelopes ────────────────────────────────────────────────────────

interface UsdLabEnvelope {
  success: boolean;
  data: UsdLabResponse;
}

interface UsdLabSubEnvelope {
  success: boolean;
  data: UsdLabSubIndicatorDetail;
}

// ─── API functions ─────────────────────────────────────────────────────────────

export async function getUsdLab(): Promise<UsdLabResponse> {
  const res = await apiFetch<UsdLabEnvelope>('/api/nifty/usd-lab');
  return res.data;
}

export async function getUsdLabSubIndicator(code: string): Promise<UsdLabSubIndicatorDetail> {
  const res = await apiFetch<UsdLabSubEnvelope>(
    `/api/nifty/usd-lab/sub-indicator/${encodeURIComponent(code)}`,
  );
  return res.data;
}
