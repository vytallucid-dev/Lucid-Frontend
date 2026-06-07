import type { AdminIndicator } from "@/lib/api/admin";

// ─── Pipeline types ───────────────────────────────────────────────────────────

export type NiftyPipeline =
  | "manual"
  | "fred"
  | "nse_vix"
  | "nse_fii_dii"
  | "nse_participant_oi"
  | "ind9_bridge";

export type EdgefinderPipeline = "manual_rate" | "manual" | "fred" | "forex_factory" | "cftc";

// ─── NIFTY mapping (code → pipeline type) ────────────────────────────────────

const NIFTY_PIPELINE_MAP: Record<string, NiftyPipeline> = {
  IND_NIFTY_01_PMI_MFG: "manual",
  IND_NIFTY_02_PMI_SVC: "manual",
  IND_NIFTY_03_CPI: "manual",
  IND_NIFTY_04_RBI_RATE: "manual",
  IND_NIFTY_05_IIP: "manual",
  IND_NIFTY_06_FII_FLOW: "nse_fii_dii",
  IND_NIFTY_07_DII_ABSORPTION: "nse_fii_dii",
  IND_NIFTY_08_VIX: "nse_vix",
  IND_NIFTY_09_USD_WEAKNESS: "ind9_bridge",
  IND_NIFTY_10_DXY: "fred",
  IND_NIFTY_11_BRENT: "fred",
  IND_NIFTY_12_USDINR: "fred",
  IND_NIFTY_13_FII_LS_RATIO: "nse_participant_oi",
};

export function getNiftyPipeline(code: string): NiftyPipeline {
  return NIFTY_PIPELINE_MAP[code] ?? "manual";
}

// ─── EdgeFinder pipeline derivation ──────────────────────────────────────────

export function getEdgefinderPipeline(indicator: AdminIndicator): EdgefinderPipeline {
  // Rate decisions are manual entry (event-driven)
  if (indicator.code.endsWith("_RATE") || indicator.frequency === "event_driven") {
    return "manual_rate";
  }
  if (indicator.dataSource === "cftc") return "cftc";
  if (indicator.dataSource === "fred") return "fred";
  if (indicator.dataSource === "manual") return "manual";
  return "forex_factory";
}

// ─── Human-readable labels ────────────────────────────────────────────────────

export const DATA_SOURCE_LABELS: Record<string, string> = {
  fred: "FRED (US Fed Reserve)",
  nse_scrape: "NSE Scrape",
  cftc: "CFTC COT",
  manual: "Manual Entry",
  derived: "Derived",
  yahoo: "Yahoo Finance",
  forex_factory: "Forex Factory",
  eodhd: "EODHD (Market Data)",
  event_driven: "Event Driven",
};

export const DATA_SOURCE_COLORS: Record<string, string> = {
  fred: "#3B82F6",
  nse_scrape: "#F59E0B",
  cftc: "#8B5CF6",
  manual: "#A78BFA",
  derived: "#64748B",
  yahoo: "#EC4899",
  forex_factory: "#10B981",
  eodhd: "#14B8A6",
  event_driven: "#F97316",
};

export const PIPELINE_LABELS: Record<NiftyPipeline | EdgefinderPipeline, string> = {
  manual: "Manual Entry",
  manual_rate: "Manual Entry (Rate Decision)",
  fred: "FRED Data Fetch",
  nse_vix: "NSE VIX Scrape",
  nse_fii_dii: "NSE FII/DII Scrape",
  nse_participant_oi: "NSE Participant OI Scrape",
  ind9_bridge: "NIFTY Ind9 Bridge (EdgeFinder USD)",
  forex_factory: "Forex Factory Fetch",
  cftc: "CFTC COT Fetch",
};

// ─── Frequency labels ─────────────────────────────────────────────────────────

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  event_driven: "Event Driven",
};

// ─── Data staleness ───────────────────────────────────────────────────────────

export type FreshnessStatus = "fresh" | "stale" | "critical" | "never";

const STALE_THRESHOLDS: Record<string, number> = {
  daily: 2,      // 2 days
  weekly: 10,    // 10 days
  monthly: 45,   // 45 days
  quarterly: 100,// 100 days
  event_driven: 999,
};

export function getFreshnessStatus(indicator: AdminIndicator): FreshnessStatus {
  if (!indicator.latestDataPoint) return "never";
  const freq = indicator.frequency;
  const threshold = STALE_THRESHOLDS[freq] ?? 30;
  const daysSince =
    (Date.now() - new Date(indicator.latestDataPoint.fetchedAt).getTime()) /
    (1000 * 60 * 60 * 24);
  if (daysSince <= threshold * 0.5) return "fresh";
  if (daysSince <= threshold) return "stale";
  return "critical";
}

export const FRESHNESS_COLORS: Record<FreshnessStatus, string> = {
  fresh: "#10B981",
  stale: "#F59E0B",
  critical: "#EF4444",
  never: "#475569",
};

export const FRESHNESS_LABELS: Record<FreshnessStatus, string> = {
  fresh: "Fresh",
  stale: "Stale",
  critical: "Critical",
  never: "Never Fetched",
};

// ─── Date formatting ──────────────────────────────────────────────────────────

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
