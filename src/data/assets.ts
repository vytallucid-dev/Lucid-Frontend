export type BiasType = "Strong Bullish" | "Bullish" | "Neutral" | "Bearish" | "Strong Bearish";

export function getBias(score: number): BiasType {
  if (score >= 5) return "Strong Bullish";
  if (score >= 3) return "Bullish";
  if (score >= -2) return "Neutral";
  if (score >= -4) return "Bearish";
  return "Strong Bearish";
}

export function getBiasColor(bias: BiasType): string {
  switch (bias) {
    case "Strong Bullish": return "#10B981";
    case "Bullish": return "#34D399";
    case "Neutral": return "#64748B";
    case "Bearish": return "#F87171";
    case "Strong Bearish": return "#EF4444";
  }
}

export function getScoreColor(score: number): string {
  if (score >= 5) return "#10B981";
  if (score >= 3) return "#34D399";
  if (score >= -2) return "#64748B";
  if (score >= -4) return "#F87171";
  return "#EF4444";
}

export function getBiasPillClass(bias: BiasType): string {
  switch (bias) {
    case "Strong Bullish": return "pill-strong-bullish";
    case "Bullish": return "pill-bullish";
    case "Neutral": return "pill-neutral";
    case "Bearish": return "pill-bearish";
    case "Strong Bearish": return "pill-strong-bearish";
  }
}
