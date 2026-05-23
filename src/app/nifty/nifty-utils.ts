// Shared NIFTY UI helpers
import type {
  PublicBand as Band,
  PublicIndicatorScore as IndicatorScore,
  PublicCompositionFlag as CompositionFlag,
  VelocityLabel,
} from "@/lib/api/nifty";

/**
 * Canonical velocity tier table — must match the backend's `VelocityLabel`
 * classifier. Both `velocityColor` and the Velocity page's tier reference
 * table read from this constant so they cannot drift apart.
 *
 * Boundaries: ≥ +0.75, +0.30 to +0.75, +0.10 to +0.30, −0.10 to +0.10,
 * −0.10 to −0.30, −0.30 to −0.50, −0.50 to −1.00, ≤ −1.00.
 */
export const VELOCITY_TIERS: Array<{
  symbol: string;
  range: string;
  label: VelocityLabel;
  cssVar: string;
  min: number; // inclusive lower bound; -Infinity for the bottom tier
}> = [
  { symbol: "⬆⬆", range: "≥ +0.75 / day", label: "Ceiling Recovery", cssVar: "--band-strong-bullish", min: 0.75 },
  { symbol: "↑", range: "+0.30 to +0.75", label: "Fast Repair", cssVar: "--band-strong-bullish", min: 0.30 },
  { symbol: "↗", range: "+0.10 to +0.30", label: "Slow Repair", cssVar: "--band-bullish", min: 0.10 },
  { symbol: "→", range: "−0.10 to +0.10", label: "Flat", cssVar: "--band-neutral", min: -0.10 },
  { symbol: "↘", range: "−0.10 to −0.30", label: "Mild Deterioration", cssVar: "--band-caution", min: -0.30 },
  { symbol: "↓", range: "−0.30 to −0.50", label: "Alert", cssVar: "--band-caution", min: -0.50 },
  { symbol: "⬇", range: "−0.50 to −1.00", label: "Warning", cssVar: "--band-bearish", min: -1.00 },
  { symbol: "⬇⬇", range: "≤ −1.00 / day", label: "Emergency Deterioration", cssVar: "--band-strong-bearish", min: -Infinity },
];

/** Pick the tier matching a velocity value. */
export function velocityTier(vel: number) {
  for (const t of VELOCITY_TIERS) {
    if (vel >= t.min) return t;
  }
  // Unreachable — last tier has min = -Infinity.
  return VELOCITY_TIERS[VELOCITY_TIERS.length - 1];
}

export function bandColor(band: Band): string {
  switch (band) {
    case "Strong Bullish": return "var(--band-strong-bullish)";
    case "Bullish": return "var(--band-bullish)";
    case "Neutral": return "var(--band-neutral)";
    case "Caution": return "var(--band-caution)";
    case "Bearish": return "var(--band-bearish)";
    case "Strong Bearish": return "var(--band-strong-bearish)";
  }
}

export function bandBg(band: Band): string {
  switch (band) {
    case "Strong Bullish": return "var(--band-strong-bullish-bg)";
    case "Bullish": return "var(--band-bullish-bg)";
    case "Neutral": return "var(--band-neutral-bg)";
    case "Caution": return "var(--band-caution-bg)";
    case "Bearish": return "var(--band-bearish-bg)";
    case "Strong Bearish": return "var(--band-strong-bearish-bg)";
  }
}

export function scorePillClass(score: IndicatorScore | null | undefined): string {
  if (score === null || score === undefined) return "score-pill score-zero";
  switch (score) {
    case 2: return "score-pill score-pos-2";
    case 1: return "score-pill score-pos-1";
    case 0: return "score-pill score-zero";
    case -1: return "score-pill score-neg-1";
    case -2: return "score-pill score-neg-2";
  }
}

export function scoreDisplay(score: IndicatorScore | null | undefined): string {
  if (score === null || score === undefined) return "\u2014"; // em-dash
  if (score > 0) return `+${score}`;
  if (score === 0) return "0";
  return `\u2212${Math.abs(score)}`; // unicode minus
}

export function netDisplay(net: number): string {
  if (net > 0) return `+${net}`;
  if (net === 0) return "0";
  return `\u2212${Math.abs(net)}`;
}

export function flagPillStyle(flag: CompositionFlag): { bg: string; color: string; border: string } {
  switch (flag) {
    case "INFLATION_LED":
      return { bg: "rgba(16,185,129,0.18)", color: "#10B981", border: "rgba(16,185,129,0.3)" };
    case "DEMAND_DESTRUCTION":
      return { bg: "rgba(245,158,11,0.18)", color: "#F59E0B", border: "rgba(245,158,11,0.3)" };
    case "MIXED":
      return { bg: "rgba(148,163,184,0.15)", color: "#94A3B8", border: "rgba(148,163,184,0.25)" };
    case "INFLATION_HOT":
      return { bg: "rgba(239,68,68,0.18)", color: "#EF4444", border: "rgba(239,68,68,0.3)" };
    case "DEMAND_REACCEL":
      return { bg: "rgba(52,211,153,0.18)", color: "#34D399", border: "rgba(52,211,153,0.3)" };
    default:
      return { bg: "rgba(100,116,139,0.1)", color: "#64748B", border: "rgba(100,116,139,0.2)" };
  }
}

export function velocityColor(vel: number): string {
  return `var(${velocityTier(vel).cssVar})`;
}

export function patternTierStyle(tier: string): { bg: string; color: string; border: string } {
  switch (tier) {
    case "CONFIRMED":
      return { bg: "rgba(16,185,129,0.15)", color: "#10B981", border: "rgba(16,185,129,0.3)" };
    case "OBSERVED":
      return { bg: "rgba(59,130,246,0.12)", color: "#60A5FA", border: "rgba(59,130,246,0.25)" };
    case "HYPOTHESIS":
      return { bg: "rgba(168,85,247,0.12)", color: "#A855F7", border: "rgba(168,85,247,0.25)" };
    default:
      return { bg: "rgba(100,116,139,0.1)", color: "#64748B", border: "rgba(100,116,139,0.2)" };
  }
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
