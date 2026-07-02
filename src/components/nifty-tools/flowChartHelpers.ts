// ─── Flow Tracker — shared chart helpers ────────────────────────────────────
//
// Domain/category logic shared by the primary FII chart and the DII/Ind13 mini
// charts, so all three canvases derive x-axis labels identically and stay
// pixel-aligned when read together.

import { IND13_LONG_BULLISH, IND13_LONG_BEARISH, type FlowTrackerPoint } from "./flowTrackerData";

/** "12 Mar" style short label, shared x-axis categories across all three charts. */
export function flowChartCategories(points: FlowTrackerPoint[]): string[] {
  return points.map((p) => {
    const d = new Date(p.date + "T00:00:00Z");
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
  });
}

/** Data-driven symmetric-ish domain around 0 for the signed FII flow series. */
export function fiiDomain(values: number[]): { min: number; max: number } | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  let lo = Math.min(...finite, 0);
  let hi = Math.max(...finite, 0);
  const range = hi - lo || Math.abs(hi) || 1;
  const pad = Math.max(range * 0.12, 1);
  lo -= pad;
  hi += pad;
  return { min: Math.floor(lo), max: Math.ceil(hi) };
}

/**
 * Ind 13 long% domain. Always keep the 40/50 band lines in view and give
 * headroom, but never hardcode a cap — expand to fit the actual data if it
 * strays outside the usual 35–65 window.
 */
export function longPctDomain(values: number[]): { min: number; max: number } {
  const finite = values.filter((v) => Number.isFinite(v));
  let lo = 35;
  let hi = 65;
  if (finite.length > 0) {
    lo = Math.min(lo, ...finite);
    hi = Math.max(hi, ...finite);
  }
  // Keep both band thresholds comfortably inside the view.
  lo = Math.min(lo, IND13_LONG_BEARISH - 3);
  hi = Math.max(hi, IND13_LONG_BULLISH + 3);
  const pad = Math.max((hi - lo) * 0.08, 1);
  return { min: Math.max(0, Math.floor(lo - pad)), max: Math.min(100, Math.ceil(hi + pad)) };
}
