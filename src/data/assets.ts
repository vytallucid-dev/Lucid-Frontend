export type BiasType = "Strong Bullish" | "Bullish" | "Neutral" | "Bearish" | "Strong Bearish";

export type AssetType = "Forex" | "Commodity" | "Index";

export type IndicatorValue = 1 | 0 | -1 | null; // null = N/A
export type CotValue = 2 | 1 | 0 | -1 | -2;

export interface AssetData {
  asset: string;
  type: AssetType;
  flag: string;
  score: number;
  bias: BiasType;
  cot: CotValue;
  gdp: IndicatorValue;
  pmiM: IndicatorValue;
  pmiS: IndicatorValue;
  retail: IndicatorValue;
  consConf: IndicatorValue;
  cpi: IndicatorValue;
  ppi: IndicatorValue;
  pce: IndicatorValue;
  yield: IndicatorValue;
  nfp: IndicatorValue;
  unemp: IndicatorValue;
  claims: IndicatorValue;
  adp: IndicatorValue;
  jolts: IndicatorValue;
}

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

export const demoAssets: AssetData[] = [
  {
    asset: "EURUSD", type: "Forex", flag: "🇪🇺🇺🇸",
    score: -4, bias: "Bearish", cot: -2,
    gdp: 1, pmiM: -1, pmiS: -1, retail: 0, consConf: -1,
    cpi: 1, ppi: -1, pce: null, yield: null,
    nfp: 1, unemp: -1, claims: 0, adp: 1, jolts: -1,
  },
  {
    asset: "GBPUSD", type: "Forex", flag: "🇬🇧🇺🇸",
    score: -3, bias: "Bearish", cot: -1,
    gdp: 1, pmiM: 1, pmiS: 1, retail: 1, consConf: null,
    cpi: 1, ppi: 0, pce: null, yield: null,
    nfp: 1, unemp: -1, claims: 0, adp: 1, jolts: -1,
  },
  {
    asset: "USDJPY", type: "Forex", flag: "🇺🇸🇯🇵",
    score: 5, bias: "Strong Bullish", cot: 2,
    gdp: -1, pmiM: 1, pmiS: 0, retail: 1, consConf: null,
    cpi: 0, ppi: -1, pce: null, yield: null,
    nfp: 1, unemp: 1, claims: 1, adp: 1, jolts: 1,
  },
  {
    asset: "EURJPY", type: "Forex", flag: "🇪🇺🇯🇵",
    score: -2, bias: "Neutral", cot: -1,
    gdp: 1, pmiM: -1, pmiS: -1, retail: 0, consConf: -1,
    cpi: 1, ppi: -1, pce: null, yield: null,
    nfp: null, unemp: null, claims: null, adp: null, jolts: null,
  },
  {
    asset: "GBPJPY", type: "Forex", flag: "🇬🇧🇯🇵",
    score: -1, bias: "Neutral", cot: 0,
    gdp: 1, pmiM: 1, pmiS: 1, retail: 1, consConf: null,
    cpi: 1, ppi: 0, pce: null, yield: null,
    nfp: null, unemp: null, claims: null, adp: null, jolts: null,
  },
  {
    asset: "XAUUSD", type: "Commodity", flag: "🥇",
    score: -3, bias: "Bearish", cot: 2,
    gdp: -1, pmiM: -1, pmiS: -1, retail: -1, consConf: -1,
    cpi: -1, ppi: -1, pce: -1, yield: -1,
    nfp: -1, unemp: 1, claims: 1, adp: -1, jolts: -1,
  },
  {
    asset: "SPY", type: "Index", flag: "🇺🇸",
    score: 2, bias: "Neutral", cot: 1,
    gdp: 1, pmiM: 1, pmiS: 1, retail: 1, consConf: 1,
    cpi: -1, ppi: -1, pce: -1, yield: -1,
    nfp: 1, unemp: -1, claims: 1, adp: 1, jolts: 1,
  },
  {
    asset: "NAS100", type: "Index", flag: "🇺🇸",
    score: 3, bias: "Bullish", cot: 1,
    gdp: 1, pmiM: 1, pmiS: 1, retail: 1, consConf: 1,
    cpi: -1, ppi: -1, pce: -1, yield: -1,
    nfp: 1, unemp: -1, claims: 1, adp: 1, jolts: 1,
  },
];
