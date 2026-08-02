// ─── Trading sessions + a dot-matrix world ───────────────────────────────────
// Pure data and geometry for the Today band's globe. No React, no DOM, no
// fetching — the only input is the wall clock, which the band supplies.
//
// Ported from the design mock. The mock hard-coded a colour per session; here
// four of the five reuse existing semantic tokens and only Sydney needed a new
// one. Mumbai is --lucid-warn rather than the mock's gold, because gold is
// brand and interactive in this system and a market session is data.

export interface MarketSession {
  id: string;
  lat: number;
  lon: number;
  /** Opening hour, UTC. */
  start: number;
  /** Closing hour, UTC. Wraps past midnight when end < start. */
  end: number;
  /** CSS custom property this session is drawn in. */
  token: string;
}

export const SESSIONS: MarketSession[] = [
  { id: "SYDNEY", lat: -33.9, lon: 151.2, start: 22, end: 7, token: "--lucid-session-syd" },
  { id: "TOKYO", lat: 35.7, lon: 139.7, start: 0, end: 9, token: "--lucid-neg" },
  { id: "MUMBAI", lat: 19.1, lon: 72.9, start: 3.75, end: 10, token: "--lucid-warn" },
  { id: "LONDON", lat: 51.5, lon: -0.1, start: 7, end: 16, token: "--lucid-ctx" },
  { id: "NEW YORK", lat: 40.7, lon: -74, start: 12, end: 21, token: "--lucid-pos" },
];

/** Is this session trading at the given UTC hour? Handles the wrap at midnight. */
export function isSessionOpen(s: MarketSession, utcHours: number): boolean {
  return s.start < s.end
    ? utcHours >= s.start && utcHours < s.end
    : utcHours >= s.start || utcHours < s.end;
}

/** Hours until this session next opens, from the given UTC hour. */
export function hoursUntilOpen(s: MarketSession, utcHours: number): number {
  const d = s.start - utcHours;
  return d < 0 ? d + 24 : d;
}

/** The next session to open, and how far away it is. Null when all are open. */
export function nextOpening(
  utcHours: number,
): { session: MarketSession; hours: number } | null {
  let best: { session: MarketSession; hours: number } | null = null;
  for (const s of SESSIONS) {
    if (isSessionOpen(s, utcHours)) continue;
    const hours = hoursUntilOpen(s, utcHours);
    if (!best || hours < best.hours) best = { session: s, hours };
  }
  return best;
}

// Landmass as a coarse raster: key = latitude row (lat = 90 − row·5), value =
// runs of longitude columns (lon = −180 + col·5). Low fidelity on purpose —
// this reads as a globe, not as a map, and nothing is measured off it.
const LAND: Record<number, [number, number][]> = {
  3: [[14, 22], [24, 32]],
  4: [[3, 23], [25, 31], [40, 71]],
  5: [[2, 23], [25, 33], [38, 71]],
  6: [[3, 24], [26, 30], [37, 71]],
  7: [[4, 6], [10, 24], [34, 42], [44, 71]],
  8: [[11, 25], [35, 42], [44, 65]],
  9: [[11, 23], [36, 42], [44, 65]],
  10: [[11, 21], [34, 45], [47, 64]],
  11: [[12, 20], [34, 35], [38, 48], [50, 64]],
  12: [[12, 20], [34, 48], [50, 60]],
  13: [[14, 16], [19, 20], [33, 47], [49, 60]],
  14: [[15, 16], [19, 21], [32, 47], [50, 58]],
  15: [[17, 19], [21, 23], [32, 45], [50, 57]],
  16: [[18, 24], [33, 45], [51, 57], [60, 61]],
  17: [[20, 26], [34, 45], [56, 59]],
  18: [[20, 27], [37, 44], [56, 63]],
  19: [[20, 29], [38, 44], [56, 64]],
  20: [[20, 29], [38, 44], [57, 66]],
  21: [[21, 28], [38, 46], [60, 65]],
  22: [[22, 28], [38, 45], [59, 66]],
  23: [[22, 27], [38, 45], [58, 66]],
  24: [[21, 26], [39, 42], [59, 66]],
  25: [[21, 25], [39, 41], [59, 66]],
  26: [[21, 24], [70, 71]],
  27: [[21, 23]],
};

export type Vec3 = readonly [number, number, number];

/** Unit vector for a lat/lon in degrees. */
export function toVector(latDeg: number, lonDeg: number): Vec3 {
  const a = (latDeg * Math.PI) / 180;
  const o = (lonDeg * Math.PI) / 180;
  return [Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)];
}

/** Every land point as a unit vector. Built once at module load. */
export const LAND_POINTS: Vec3[] = (() => {
  const out: Vec3[] = [];
  for (const row of Object.keys(LAND)) {
    const lat = 90 - Number(row) * 5;
    for (const [from, to] of LAND[Number(row)]) {
      for (let col = from; col <= to; col++) out.push(toVector(lat, -180 + col * 5));
    }
  }
  return out;
})();

/**
 * The rotation that puts the currently-daylit meridian toward the viewer.
 * Used as the resting position under reduced motion: the globe still says
 * something true about the time of day, it just doesn't spin to say it.
 */
export function rotationForHour(utcHours: number): number {
  return -(((12 - utcHours) * 15 * Math.PI) / 180);
}
