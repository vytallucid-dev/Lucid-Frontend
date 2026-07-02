// ─── Flow Tracker — data adapter ────────────────────────────────────────────
//
// Pulls the RAW dated flow series (NOT their −2..+2 scores) for the three FII/DII
// indicators and aligns them onto a single date axis so the chart can read the
// relationship "FII sold hard — did DII absorb it or not" at a glance.
//
// CRITICAL data-correctness rules (see NIFTY recon):
//   • Ind 6  IND_NIFTY_06_FII_FLOW  raw daily net cash flow, unit ₹ crore,
//            SIGN: positive = FII net inflow / negative = outflow.
//   • Ind 7  IND_NIFTY_07_DII_ABSORPTION  ratio = diiBuy / |fiiSell|, unitless ≥0.
//            GENUINELY ABSENT on FII-net-buyer days (no data_points row). Those
//            dates must render as gaps (null), NEVER as zero.
//   • Ind 13 IND_NIFTY_13_FII_LS_RATIO  0–100 LONG PERCENTAGE (longPct), NOT a
//            >1/<1 ratio. Bands: >50 bullish / <40 bearish. May have historical
//            backfill gaps — render honestly as null, not zero.

import { getIndicatorDetail, type NiftyIndicatorDetailResponse } from "@/lib/api/nifty";

export const FII_FLOW_CODE = "IND_NIFTY_06_FII_FLOW";
export const DII_ABSORPTION_CODE = "IND_NIFTY_07_DII_ABSORPTION";
export const FII_LS_CODE = "IND_NIFTY_13_FII_LS_RATIO";

export const IND13_LONG_BULLISH = 50; // longPct > 50 → bullish positioning
export const IND13_LONG_BEARISH = 40; // longPct < 40 → bearish positioning

export interface FlowTrackerPoint {
  /** ISO YYYY-MM-DD */
  date: string;
  /** FII net cash flow, ₹ crore, signed. null = no reading that date. */
  fiiFlow: number | null;
  /** DII absorption ratio, unitless ≥0. null = FII was a net buyer (n/a), a real gap. */
  diiAbsorption: number | null;
  /** FII futures long %, 0–100. null = backfill gap, a real gap. */
  fiiLongPct: number | null;
}

export interface FlowTrackerData {
  points: FlowTrackerPoint[];
  /** How many DII-absorption dates were genuinely n/a (FII net-buyer days). */
  diiNaCount: number;
  /** How many dates in the window lack an Ind 13 reading (backfill gaps). */
  ind13GapCount: number;
  /** Whether each series has any data at all. */
  hasFii: boolean;
  hasDii: boolean;
  hasInd13: boolean;
}

function entryValues(res: NiftyIndicatorDetailResponse): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of res.entries) {
    const v = e.dataPoint?.value;
    if (typeof v === "number" && Number.isFinite(v)) m.set(e.observationDate.slice(0, 10), v);
  }
  return m;
}

/**
 * Fetch + align the three raw flow series over the last `limit` readings each.
 * The union of all three date sets forms the axis; a series with no reading on a
 * given date stays null (rendered as a gap, never zero-filled).
 */
export async function loadFlowTrackerData(limit = 90): Promise<FlowTrackerData> {
  const [fiiRes, diiRes, lsRes] = await Promise.all([
    getIndicatorDetail(FII_FLOW_CODE, { limit }),
    getIndicatorDetail(DII_ABSORPTION_CODE, { limit }),
    getIndicatorDetail(FII_LS_CODE, { limit }),
  ]);

  const fii = entryValues(fiiRes);
  const dii = entryValues(diiRes);
  const ls = entryValues(lsRes);

  // Axis = union of all dates, ascending (oldest → newest for the chart).
  const allDates = new Set<string>([...fii.keys(), ...dii.keys(), ...ls.keys()]);
  const dates = [...allDates].sort();

  let diiNaCount = 0;
  let ind13GapCount = 0;

  const points: FlowTrackerPoint[] = dates.map((date) => {
    const fiiFlow = fii.has(date) ? (fii.get(date) as number) : null;
    // DII absorption only exists on FII-net-seller days; its absence is meaningful.
    const diiAbsorption = dii.has(date) ? (dii.get(date) as number) : null;
    const fiiLongPct = ls.has(date) ? (ls.get(date) as number) : null;

    // Count DII "n/a" only where FII actually sold (net negative) but no ratio
    // exists — that's the genuine FII-buyer-day gap. Where FII flow itself is
    // missing we can't classify, so don't count it as a DII-specific gap.
    if (diiAbsorption === null && fiiFlow !== null && fiiFlow < 0) diiNaCount++;
    if (fiiLongPct === null) ind13GapCount++;

    return { date, fiiFlow, diiAbsorption, fiiLongPct };
  });

  return {
    points,
    diiNaCount,
    ind13GapCount,
    hasFii: fii.size > 0,
    hasDii: dii.size > 0,
    hasInd13: ls.size > 0,
  };
}
