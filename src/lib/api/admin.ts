import { apiFetch, apiFetchRaw, ApiError } from "./client";

// ─── Indicator Types ──────────────────────────────────────────────────────────

export type DataSource =
  | "fred"
  | "nse_scrape"
  | "cftc"
  | "manual"
  | "derived"
  | "yahoo"
  | "forex_factory"
  | "eodhd"
  | "crude_price_api";

export type IndicatorFrequency =
  | "daily"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "event_driven";

export interface AdminIndicator {
  id: string;
  code: string;
  name: string;
  country: string | null;
  /**
   * Phase 6: the currency asset this indicator belongs to, derived from
   * asset_indicator_map (not the raw `country` field — an indicator's country
   * does not always match its owning asset, e.g. China PMI is country='CN'
   * but belongs to AUD). Null for indicators with no currency owner.
   */
  primaryAsset: string | null;
  uiGroup: string | null;
  compositeGroup: "domestic" | "external" | null;
  displayOrder: number | null;
  frequency: IndicatorFrequency;
  dataSource: DataSource;
  sourceSeriesId: string | null;
  isActive: boolean;
  description: string | null;
  latestDataPoint: {
    observationDate: string;
    value: number;
    source: string;
    fetchedAt: string;
  } | null;
  /**
   * B1/B4 — true when this indicator has at least one overdue calendar
   * event (a scheduled release >24h past with nothing entered). Always
   * false for NIFTY indicators (tool=nifty is served by the same route via
   * ?tool=nifty, and NIFTY has zero calendar events by construction — no
   * special-casing needed here or on the backend).
   */
  overdue: boolean;
}

export interface AdminIndicatorListResponse {
  success: boolean;
  count: number;
  data: AdminIndicator[];
}

export interface DataPoint {
  id: string;
  observationDate: string;
  /** Release variant (Flash/Final, Advance/Second/Third, ...), or null for a single-release indicator. */
  variant: string | null;
  /**
   * True only for rows that existed on this indicator before it had
   * registered variants — never inferred which variant they actually were.
   * Precedent: the 2025 AUD discontinuity flags. Display-only; not editable.
   */
  isLegacyVariant: boolean;
  value: number;
  forecastValue: number | null;
  previousValue: number | null;
  isCurrent: boolean;
  source: string;
  dataQualityFlag: string | null;
  sourceMetadata: Record<string, unknown> | null;
  notes: string | null;
  fetchedAt: string;
}

/** One allowed release variant for a multi-variant indicator, from IndicatorVariant. */
export interface IndicatorVariantOption {
  variant: string;
  ordinal: number;
  /** Marks the ladder's terminal rung (e.g. "final") — drives the history view's default filter. */
  isFinal: boolean;
}

export interface IndicatorLatestResponse {
  success: boolean;
  indicator: {
    code: string;
    name: string;
    unit: string | null;
    frequency: string;
    dataSource: string;
    compositeGroup: string | null;
    country: string | null;
    uiGroup: string | null;
    description: string | null;
  };
  /** Empty for single-release indicators. Non-empty means the variant selector should show on new entry. */
  variants: IndicatorVariantOption[];
  /** True for a straight two-rung Flash/Final pair — the history view defaults to Finals-only for these. */
  finalsOnlyDefault: boolean;
  /** Echoes whether this response applied the finals-only filter (false) or returned every variant (true). */
  allVariants: boolean;
  count: number;
  data: DataPoint[];
}

// ─── Fetch Log Types ──────────────────────────────────────────────────────────

export interface FetchLog {
  id: string;
  jobName: string;
  triggerType: "cron" | "manual" | "backfill";
  triggeredBy: string | null;
  status: "running" | "success" | "partial" | "failed";
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  rowsInserted: number;
  rowsUpdated: number;
  rowsSkipped: number;
  errors: unknown | null;
  metadata: Record<string, unknown> | null;
}

export interface AdminLogsResponse {
  success: boolean;
  totalCount: number;
  offset: number;
  limit: number;
  logs: FetchLog[];
}

// ─── Job Trigger Types ────────────────────────────────────────────────────────

export type CronJobName =
  | "fred_fetch"
  | "nse_vix"
  | "nse_fii_dii"
  | "nse_participant_oi"
  | "assemble_scorecard"
  | "forex_factory_fetch"
  | "cftc_cot_fetch"
  | "compass_inputs_fetch"
  | "compass_classifier_run"
  | "scorecard_assembly"
  | "pair_score_assembly"
  | "nifty_ind9_bridge";

// ─── API Functions ────────────────────────────────────────────────────────────

export async function getAdminIndicators(
  tool: "nifty" | "edgefinder",
): Promise<AdminIndicatorListResponse> {
  return apiFetch<AdminIndicatorListResponse>(
    `/api/admin/indicators/list?tool=${tool}`,
  );
}

export async function getIndicatorLatest(
  code: string,
  limit = 10,
  allVariants = false,
): Promise<IndicatorLatestResponse> {
  return apiFetch<IndicatorLatestResponse>(
    `/api/admin/indicators/${encodeURIComponent(code)}/latest?limit=${limit}&allVariants=${allVariants}`,
  );
}

export async function getAdminLogs(params: {
  job_name?: string;
  status?: "success" | "partial" | "failed";
  trigger_type?: "cron" | "manual" | "backfill";
  limit?: number;
  offset?: number;
}): Promise<AdminLogsResponse> {
  const qs = new URLSearchParams();
  if (params.job_name) qs.set("job_name", params.job_name);
  if (params.status) qs.set("status", params.status);
  if (params.trigger_type) qs.set("trigger_type", params.trigger_type);
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  const query = qs.toString();
  return apiFetch<AdminLogsResponse>(`/api/admin/logs${query ? `?${query}` : ""}`);
}

// ─── Job Trigger ──────────────────────────────────────────────────────────────

export async function triggerCronJob(jobName: CronJobName): Promise<{
  success: boolean;
  message: string;
  job_name: string;
}> {
  return apiFetch("/api/admin/jobs/run", {
    method: "POST",
    body: JSON.stringify({ job_name: jobName }),
  });
}

// Fetch a specific FRED indicator with optional date range
export async function fetchFredIndicator(params: {
  indicator_code: string;
  date_from?: string;
  date_to?: string;
}): Promise<{ success: boolean; result: unknown }> {
  return apiFetch("/api/admin/jobs/fetch-fred-indicator/run", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// Scrape NSE VIX (no params)
export async function scrapeNseVix(): Promise<{ success: boolean; result: unknown }> {
  return apiFetch("/api/admin/jobs/scrape-nse-vix/run", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// Scrape NSE FII/DII (no params)
export async function scrapeNseFiiDii(): Promise<{ success: boolean; result: unknown }> {
  return apiFetch("/api/admin/jobs/scrape-nse-fii-dii/run", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// Scrape NSE Participant OI with optional date params
export async function scrapeNseParticipantOi(params?: {
  observation_date?: string;
  date_from?: string;
  date_to?: string;
}): Promise<{ success: boolean; result: unknown }> {
  return apiFetch("/api/admin/jobs/scrape-nse-participant-oi/run", {
    method: "POST",
    body: JSON.stringify(params ?? {}),
  });
}

// ─── Manual Data Entry ────────────────────────────────────────────────────────

// NIFTY manual indicators (PMI, RBI Rate)
export async function submitNiftyManualInput(params: {
  indicator_code: string;
  observation_date: string;
  value: number;
  notes?: string;
  allow_overwrite?: boolean;
  source_metadata?: Record<string, unknown>;
}): Promise<{
  success: boolean;
  result: {
    indicatorCode: string;
    logId: string;
    action: "inserted" | "revised" | "skipped";
    observationDate: string;
    value: number;
  };
}> {
  return apiFetch("/api/admin/data/manual-input", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// Successful manual-entry write response (HTTP 200).
export interface ManualEntrySuccess {
  success: boolean;
  dataPointId: string;
  action: "inserted" | "revised" | "skipped";
  indicator: { code: string; name: string };
  observationDate: string;
  variant: string | null;
  value: number;
  isRateDecision: boolean;
  metadata: Record<string, unknown>;
}

// 409-style response: the submitted `previous` differs from our last stored
// actual. Nothing was written; the caller should confirm and re-submit with
// confirmRevision: true.
export interface RevisionConfirmationRequired {
  requiresRevisionConfirmation: true;
  indicatorCode: string;
  storedActual: number;
  storedActualDate: string;
  submittedPrevious: number;
}

export type ManualEntryResult = ManualEntrySuccess | RevisionConfirmationRequired;

export function isRevisionConfirmationRequired(
  result: ManualEntryResult,
): result is RevisionConfirmationRequired {
  return "requiresRevisionConfirmation" in result;
}

// EdgeFinder manual indicators (rate decisions + others).
//
// Resolves to a ManualEntrySuccess on a normal write, or a
// RevisionConfirmationRequired on the 409 gate (submitted previous ≠ last
// stored actual). Pass confirmRevision: true to acknowledge the mismatch and
// force the write. Other non-2xx statuses reject via ApiError as usual.
export async function submitEdgefinderManualInput(params: {
  indicatorCode: string;
  observationDate: string;
  actual: number;
  forecast?: number;
  previous?: number;
  notes?: string;
  confirmRevision?: boolean;
  /** Required only where the indicator has more than one registered release type (see IndicatorVariantOption). */
  variant?: string | null;
}): Promise<ManualEntryResult> {
  const response = await apiFetchRaw("/api/admin/data/manual", {
    method: "POST",
    body: JSON.stringify(params),
  });

  if (response.status === 409) {
    const body = (await response.json()) as RevisionConfirmationRequired;
    return body;
  }

  if (!response.ok) {
    let code = String(response.status);
    let message = response.statusText;
    try {
      const errBody = (await response.json()) as {
        error?: { message?: string; code?: string };
      };
      if (errBody.error) {
        message = errBody.error.message ?? message;
        code = errBody.error.code ?? code;
      }
    } catch {
      // body wasn't JSON — fall back to statusText already set above
    }
    throw new ApiError(response.status, code, message);
  }

  return (await response.json()) as ManualEntrySuccess;
}

// ─── Manual Data Edit (B4) ────────────────────────────────────────────────────
// Correcting an already-entered value in place. Separate from
// submitEdgefinderManualInput (which logs a NEW release and can trigger the
// revision-confirmation gate): this never creates a revision record, it
// overwrites the named row directly. No confirmation gate — this path exists
// specifically for typos, where the whole point is that nothing else moves.

export interface EditDataPointResult {
  success: boolean;
  dataPointId: string;
  indicator: { code: string; name: string };
  observationDate: string;
  variant: string | null;
  value: number;
  forecastValue: number | null;
  previousValue: number | null;
}

export async function editDataPoint(
  dataPointId: string,
  edits: {
    observationDate?: string;
    actual?: number;
    forecast?: number | null;
    previous?: number | null;
    variant?: string | null;
  },
): Promise<EditDataPointResult> {
  return apiFetch<EditDataPointResult>(
    `/api/admin/data/manual/${encodeURIComponent(dataPointId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(edits),
    },
  );
}

// ─── COT Data ─────────────────────────────────────────────────────────────────

export interface CotDataPoint {
  id: string;
  reportDate: string;
  releaseDate: string;
  longContracts: number | null;
  shortContracts: number | null;
  longPct: number | null;
  shortPct: number | null;
  changeInLongContracts: number | null;
  changeInShortContracts: number | null;
  weeklyChangePct: number | null;
  netPositioningLabel: string | null;
  changeLabel: string | null;
  fetchedAt: string;
}

export interface CotDataResponse {
  success: boolean;
  indicator: { code: string; name: string; country: string };
  contractCode: string;
  count: number;
  data: CotDataPoint[];
}

export async function getCotData(code: string): Promise<CotDataResponse> {
  return apiFetch<CotDataResponse>(
    `/api/admin/indicators/${encodeURIComponent(code)}/cot-data`,
  );
}

// ─── Job-name → actual log-table job_name mapping ─────────────────────────────
// Trigger keys and data_fetch_log job names are different.
// Use this to poll logs after a trigger fires.
export const TRIGGER_TO_LOG_JOB_NAME: Record<CronJobName, string> = {
  fred_fetch: "fred_daily_fetch",
  nse_vix: "scrape_nse_vix",
  nse_fii_dii: "scrape_nse_fii_dii",
  nse_participant_oi: "scrape_nse_participant_oi",
  assemble_scorecard: "assemble_scorecard",
  forex_factory_fetch: "forex_factory_weekly_fetch",
  cftc_cot_fetch: "cftc_cot_weekly_fetch",
  compass_inputs_fetch: "compass_inputs_daily_fetch",
  compass_classifier_run: "compass_classifier_daily_run",
  scorecard_assembly: "edgefinder_scorecard_assembly",
  pair_score_assembly: "edgefinder_pair_score_assembly",
  nifty_ind9_bridge: "nifty_ind9_bridge",
};

// ─── Cycle Stances ────────────────────────────────────────────────────────────

export type CycleStance = "CUTTING" | "NEUTRAL" | "HIKING";
/** Phase 6 (Addendum 8B): the Fed constraint for the gold override gate — USD only. */
export type FedConstraint = "FREE" | "CONSTRAINED";

export interface CycleStanceRow {
  id: string;
  currencyCode: string;
  stance: CycleStance;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  /** Only present/meaningful on the USD row; null for other currencies. */
  fedConstraint: FedConstraint | null;
}

export interface CycleStancesResponse {
  success: boolean;
  stances: CycleStanceRow[];
  validCurrencies: string[];
  validStances: CycleStance[];
  validFedConstraints: FedConstraint[];
}

export interface UpdateCycleStanceResponse {
  success: boolean;
  action: "updated" | "created" | "unchanged";
  triggeredBy: string;
  stance: CycleStanceRow;
}

export async function getCycleStances(): Promise<CycleStancesResponse> {
  return apiFetch<CycleStancesResponse>("/api/admin/cycle-stances");
}

export async function updateCycleStance(
  currencyCode: string,
  params: {
    stance: CycleStance;
    effectiveFrom?: string;
    notes?: string;
    /** USD only — sets the Fed constraint for the gold override gate (8B). */
    fedConstraint?: FedConstraint;
  },
): Promise<UpdateCycleStanceResponse> {
  return apiFetch<UpdateCycleStanceResponse>(
    `/api/admin/cycle-stances/${encodeURIComponent(currencyCode)}`,
    {
      method: "PUT",
      body: JSON.stringify(params),
    },
  );
}
