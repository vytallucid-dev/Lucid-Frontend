import { apiFetch } from './client';

// ─── Scalar types ─────────────────────────────────────────────────────────────

export type PublicBand =
  | 'Strong Bullish'
  | 'Bullish'
  | 'Neutral'
  | 'Caution'
  | 'Bearish'
  | 'Strong Bearish';

export type PublicCompositionFlag =
  | 'INFLATION_LED'
  | 'DEMAND_DESTRUCTION'
  | 'MIXED'
  | 'INFLATION_HOT'
  | 'DEMAND_REACCEL'
  | null;

export type PublicComposite = 'Domestic' | 'External';

export type PublicIndicatorScore = -2 | -1 | 0 | 1 | 2;

export type PublicRegimeBucket =
  | 'BULL'
  | 'BEAR_DEEP'
  | 'BEAR_LIGHT'
  | 'TOP_CORRECTION'
  | 'MIXED';

// ─── Entity types ─────────────────────────────────────────────────────────────

export interface PublicIndicator {
  id: number;
  code: string;
  name: string;
  short: string;
  composite: PublicComposite;
  score: PublicIndicatorScore | null;
  value: string;
  magnitude: string;
  trajectory_3m_avg?: string;
  /** Rolling aggregate (window avg / % change) the score was computed from —
   *  set for window-scored indicators (Ind 6, 7, 10, 11, 12). */
  score_basis?: { label: string; value: string };
  last_change_date: string;
  prev_score?: PublicIndicatorScore;
  outcome: 'scored' | 'carry_forward' | 'insufficient_data';
  flags: string[];
  reason?: string;
}

export interface PublicScorecard {
  id: string;
  date: string;
  phase?: string;
  bucket?: PublicRegimeBucket;
  indicators: PublicIndicator[];
  domestic_composite: number;
  external_composite: number;
  net_score: number;
  band: PublicBand;
  ind9_raw_composite: number | null;
  ind9_sub_indicators: Record<string, PublicIndicatorScore>;
  composition_flag: PublicCompositionFlag;
  peak_score_active: boolean;
  peak_score_peak_date?: string;
  peak_score_peak_value?: number;
  velocity_short?: number;
  conflict_flag: boolean;
  notes?: string;
  catalysts: string[];
  missing_indicators: string[];
}

export interface PublicScorecardLite {
  id: string;
  date: string;
  net_score: number;
  domestic_composite: number;
  external_composite: number;
  band: PublicBand;
  conflict_flag: boolean;
  composition_flag: PublicCompositionFlag;
  peak_score_active: boolean;
  ind9_raw_composite: number | null;
}

export type PublicPatternTier = 'CONFIRMED' | 'OBSERVED' | 'HYPOTHESIS';
export type PublicPatternCategory =
  | 'Peak/Trough'
  | 'Composite'
  | 'Bear Regime'
  | 'Recovery'
  | 'Operational'
  | 'Structural';
export type PublicPatternSubtool =
  | 'Velocity'
  | 'Peak Ceiling'
  | 'V-Bottom'
  | 'Composition'
  | 'Section 9F';

export interface PublicPattern {
  id: string;
  name: string;
  tier: PublicPatternTier;
  category: PublicPatternCategory;
  instances: number;
  rule: string;
  example_dates: string[];
  description: string;
  drives_subtool?: PublicPatternSubtool;
  status: string;
  relevance_triggers: string[];
}

export interface PublicIndicatorMeta {
  id: number;
  code: string;
  name: string;
  short: string;
  composite: PublicComposite;
  output_range: string;
  cadence: string;
  data_source: string;
  unit: string | null;
  description: string | null;
  last_updated: string | null;
  is_active: boolean;
}

export type VelocityLabel =
  | 'Emergency Deterioration'
  | 'Warning'
  | 'Alert'
  | 'Mild Deterioration'
  | 'Flat'
  | 'Slow Repair'
  | 'Fast Repair'
  | 'Ceiling Recovery';

export interface PublicVelocityAutoAnchors {
  high_anchor_date: string | null;
  high_anchor_net: number | null;
  low_anchor_date: string | null;
  low_anchor_net: number | null;
  default_start_date: string | null;
  default_start_net: number | null;
}

export interface PublicVelocityResponse {
  velocity: number | null;
  label: VelocityLabel | null;
  sessions: number | null;
  start_date: string | null;
  end_date: string | null;
  start_net: number | null;
  end_net: number | null;
  reason: string | null;
  auto_anchors: PublicVelocityAutoAnchors;
  trajectory: Array<{ date: string; net: number }>;
}

export type VBottomClassification =
  | 'REAL_V_BOTTOM'
  | 'AMBIGUOUS'
  | 'COUNTER_TREND_BOUNCE';

export interface PublicVBottomExample {
  date: string;
  description: string;
  raw_at_trough: number;
  outcome: string;
}

export interface PublicVBottomResponse {
  date: string;
  ind9_raw: number | null;
  classification: VBottomClassification | null;
  forward_expectation: string;
  examples: PublicVBottomExample[];
}

export interface PublicIndicatorDetail extends PublicIndicatorMeta {
  latest_score: PublicIndicatorScore | null;
  latest_value: string | null;
  latest_value_raw: number | null;
  latest_observation_date: string | null;
  recent_scores?: Array<{
    date: string;
    score: PublicIndicatorScore;
    value: string;
    flags: string[];
  }>;
  recent_data_points?: Array<{
    date: string;
    value: number;
    source: string;
    is_revised: boolean;
  }>;
}

// ─── Response envelope types (internal) ───────────────────────────────────────

type ScorecardEnvelope = { success: boolean; data: PublicScorecard };
type HistoryEnvelope = {
  success: boolean;
  items: PublicScorecard[] | PublicScorecardLite[];
  count: number;
  limit: number;
};
type PatternsEnvelope = { success: boolean; count: number; data: PublicPattern[] };

type VelocityEnvelope = { success: boolean; data: PublicVelocityResponse };

type VBottomEnvelope = { success: boolean; data: PublicVBottomResponse };

type IndicatorsListEnvelope = {
  success: boolean;
  count: number;
  items: PublicIndicatorMeta[];
};
type IndicatorDetailEnvelope = { success: boolean; data: PublicIndicatorDetail };
type DataPointsEnvelope = {
  success: boolean;
  indicator: unknown;
  count: number;
  dataPoints: unknown[];
};

// ─── API functions ─────────────────────────────────────────────────────────────

export async function getLatestScorecard(): Promise<PublicScorecard> {
  const res = await apiFetch<ScorecardEnvelope>('/api/nifty/scorecard/latest');
  return res.data;
}

// Overloads: includeBreakdown=true (or omitted) → full PublicScorecard[];
// includeBreakdown=false → PublicScorecardLite[]. The literal value drives the
// return type, so callers don't need post-call casts.
export async function getScorecardHistory(opts: {
  includeBreakdown: true;
  limit?: number;
  from?: string;
  to?: string;
}): Promise<PublicScorecard[]>;
export async function getScorecardHistory(opts: {
  includeBreakdown: false;
  limit?: number;
  from?: string;
  to?: string;
}): Promise<PublicScorecardLite[]>;
export async function getScorecardHistory(opts?: {
  limit?: number;
  from?: string;
  to?: string;
}): Promise<PublicScorecard[]>;
export async function getScorecardHistory(opts?: {
  from?: string;
  to?: string;
  limit?: number;
  includeBreakdown?: boolean;
}): Promise<PublicScorecard[] | PublicScorecardLite[]> {
  const params = new URLSearchParams();
  if (opts?.from) params.set('from', opts.from);
  if (opts?.to) params.set('to', opts.to);
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.includeBreakdown !== undefined)
    params.set('include_breakdown', String(opts.includeBreakdown));

  const qs = params.toString();
  const res = await apiFetch<HistoryEnvelope>(
    `/api/nifty/scorecard/history${qs ? `?${qs}` : ''}`,
  );
  return res.items;
}

export async function getScorecardByDate(date: string): Promise<PublicScorecard> {
  const res = await apiFetch<ScorecardEnvelope>(`/api/nifty/scorecard/${date}`);
  return res.data;
}

export async function getVelocity(opts?: {
  startDate?: string;
  endDate?: string;
}): Promise<PublicVelocityResponse> {
  const params = new URLSearchParams();
  if (opts?.startDate) params.set('start_date', opts.startDate);
  if (opts?.endDate) params.set('end_date', opts.endDate);

  const qs = params.toString();
  const res = await apiFetch<VelocityEnvelope>(
    `/api/nifty/velocity${qs ? `?${qs}` : ''}`,
  );
  return res.data;
}

export async function getVBottomCheck(opts?: {
  date?: string;
}): Promise<PublicVBottomResponse> {
  const params = new URLSearchParams();
  if (opts?.date) params.set('date', opts.date);

  const qs = params.toString();
  const res = await apiFetch<VBottomEnvelope>(
    `/api/nifty/v-bottom-check${qs ? `?${qs}` : ''}`,
  );
  return res.data;
}

export async function getPatterns(): Promise<PublicPattern[]> {
  const res = await apiFetch<PatternsEnvelope>('/api/nifty/patterns');
  return res.data;
}

export async function getIndicators(): Promise<PublicIndicatorMeta[]> {
  const res = await apiFetch<IndicatorsListEnvelope>('/api/nifty/indicators');
  return res.items;
}

export async function getIndicatorByCode(
  code: string,
  opts?: { includeHistory?: boolean },
): Promise<PublicIndicatorDetail> {
  const params = new URLSearchParams();
  if (opts?.includeHistory !== undefined)
    params.set('include_history', String(opts.includeHistory));

  const qs = params.toString();
  const res = await apiFetch<IndicatorDetailEnvelope>(
    `/api/nifty/indicators/${encodeURIComponent(code)}${qs ? `?${qs}` : ''}`,
  );
  return res.data;
}

export async function getIndicatorDataPoints(
  code: string,
  opts?: { limit?: number },
): Promise<{ indicator: unknown; dataPoints: unknown[] }> {
  const params = new URLSearchParams();
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));

  const qs = params.toString();
  const res = await apiFetch<DataPointsEnvelope>(
    `/api/nifty/indicators/${encodeURIComponent(code)}/data-points${qs ? `?${qs}` : ''}`,
  );
  return { indicator: res.indicator, dataPoints: res.dataPoints };
}

// ─── Indicator Detail Endpoint ─────────────────────────────────────────────

export interface NiftyIndicatorDetailEntry {
  observationDate: string;
  dataPoint: {
    id: string;
    value: number;
    forecastValue: number | null;
    previousValue: number | null;
    dataQualityFlag: string | null;
    source: string;
    sourceMetadata: Record<string, unknown> | null;
    notes: string | null;
    enteredBy: string | null;
    vintageDate: string;
  };
  score: {
    id: string;
    value: PublicIndicatorScore;
    flag: string | null;
    computedAt: string;
    outcome: 'scored' | 'carry_forward' | 'insufficient_data';
    flags: string[];
    computationDetail: Record<string, unknown> | null;
    rule: {
      version: number;
      ruleType: string;
      ruleDefinition: Record<string, unknown>;
    };
  } | null;
}

export interface NiftyIndicatorDetailResponse {
  indicator: {
    code: string;
    name: string;
    frequency: string;
    dataSource: string;
    unit: string | null;
    displayOrder: number;
    compositeGroup: string | null;
    country: string | null;
    uiGroup: string | null;
  };
  activeRule: {
    version: number;
    ruleType: string;
    ruleDefinition: Record<string, unknown>;
  } | null;
  count: number;
  entries: NiftyIndicatorDetailEntry[];
}

export async function getIndicatorDetail(
  code: string,
  opts?: { limit?: number; from?: string; to?: string },
): Promise<NiftyIndicatorDetailResponse> {
  const params = new URLSearchParams();
  if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts?.from) params.set('from', opts.from);
  if (opts?.to) params.set('to', opts.to);
  const qs = params.toString();
  const res = await apiFetch<{ success: boolean } & NiftyIndicatorDetailResponse>(
    `/api/nifty/indicators/${encodeURIComponent(code)}/detail${qs ? `?${qs}` : ''}`,
  );
  return res;
}
