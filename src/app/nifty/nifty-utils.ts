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
  { symbol: "⬆⬆", range: "≥ +0.75 / day", label: "Ceiling Recovery", cssVar: "--lucid-scale-4", min: 0.75 },
  { symbol: "↑", range: "+0.30 to +0.75", label: "Fast Repair", cssVar: "--lucid-scale-4", min: 0.30 },
  { symbol: "↗", range: "+0.10 to +0.30", label: "Slow Repair", cssVar: "--lucid-scale-3", min: 0.10 },
  { symbol: "→", range: "−0.10 to +0.10", label: "Flat", cssVar: "--lucid-scale-2", min: -0.10 },
  { symbol: "↘", range: "−0.10 to −0.30", label: "Mild Deterioration", cssVar: "--lucid-warn", min: -0.30 },
  { symbol: "↓", range: "−0.30 to −0.50", label: "Alert", cssVar: "--lucid-warn", min: -0.50 },
  { symbol: "⬇", range: "−0.50 to −1.00", label: "Warning", cssVar: "--lucid-scale-1", min: -1.00 },
  { symbol: "⬇⬇", range: "≤ −1.00 / day", label: "Emergency Deterioration", cssVar: "--lucid-scale-0", min: -Infinity },
];

/** Pick the tier matching a velocity value. */
export function velocityTier(vel: number) {
  for (const t of VELOCITY_TIERS) {
    if (vel >= t.min) return t;
  }
  // Unreachable — last tier has min = -Infinity.
  return VELOCITY_TIERS[VELOCITY_TIERS.length - 1];
}

// Band → theme token. Maps the 6 NIFTY bands onto the warm editorial scale:
// Strong Bullish = cool blue (scale-4), Bullish = green (scale-3),
// Neutral = gold (scale-2), Caution = warn amber, Bearish = orange (scale-1),
// Strong Bearish = red (scale-0). Returns a raw `var(--lucid-*)` reference.
export function bandColor(band: Band): string {
  switch (band) {
    case "Strong Bullish": return "var(--lucid-scale-4)";
    case "Bullish": return "var(--lucid-scale-3)";
    case "Neutral": return "var(--lucid-scale-2)";
    case "Caution": return "var(--lucid-warn)";
    case "Bearish": return "var(--lucid-scale-1)";
    case "Strong Bearish": return "var(--lucid-scale-0)";
  }
}

// Faint band-tinted surface: mix the band token into transparent so cards read
// as flat surfaces with a wash, not glass. No blur, no glow.
export function bandBg(band: Band): string {
  return `color-mix(in srgb, ${bandColor(band)} 10%, transparent)`;
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

function tokenPill(token: string): { bg: string; color: string; border: string } {
  return {
    bg: `color-mix(in srgb, var(${token}) 14%, transparent)`,
    color: `var(${token})`,
    border: `color-mix(in srgb, var(${token}) 32%, transparent)`,
  };
}

export function flagPillStyle(flag: CompositionFlag): { bg: string; color: string; border: string } {
  switch (flag) {
    case "INFLATION_LED":
      return tokenPill("--lucid-pos");
    case "DEMAND_DESTRUCTION":
      return tokenPill("--lucid-warn");
    case "MIXED":
      return tokenPill("--lucid-ctx");
    case "INFLATION_HOT":
      return tokenPill("--lucid-neg");
    case "DEMAND_REACCEL":
      return tokenPill("--lucid-pos");
    default:
      return tokenPill("--lucid-ctx");
  }
}

export function velocityColor(vel: number): string {
  return `var(${velocityTier(vel).cssVar})`;
}

export function patternTierStyle(tier: string): { bg: string; color: string; border: string } {
  switch (tier) {
    case "CONFIRMED":
      return tokenPill("--lucid-pos");
    case "OBSERVED":
      return tokenPill("--lucid-cool");
    case "HYPOTHESIS":
      return tokenPill("--lucid-accent");
    default:
      return tokenPill("--lucid-ctx");
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
