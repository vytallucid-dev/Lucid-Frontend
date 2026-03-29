import { type BiasType } from "./assets";

export type FxPairKey = "EURUSD" | "GBPUSD" | "USDJPY" | "EURJPY" | "GBPJPY";

export type ResultTag = "BEAT" | "MISS" | "MET" | "N/A";

export interface FxIndicatorRow {
  name: string;
  frequency?: string;
  currA: {
    result: ResultTag;
    actual: string;
    forecast?: string;
    surprise?: string;
  };
  currB: {
    result: ResultTag;
    actual: string;
    forecast?: string;
    surprise?: string;
  };
  pairScore: number | null; // null = excluded
}

export interface FxCategoryCard {
  label: string;
  color: string;
  subtotal: number;
  indicators: FxIndicatorRow[];
}

export interface FxCotSide {
  longPct: string;
  shortPct: string;
  changePct: string;
  direction: "Bullish" | "Bearish" | "Neutral";
}

export interface FxPairData {
  key: FxPairKey;
  label: string;
  currAName: string;
  currAFlag: string;
  currBName: string;
  currBFlag: string;
  totalScore: number;
  fundamentals: number;
  cotScore: number;
  bias: BiasType;
  cotA: FxCotSide;
  cotB: FxCotSide;
  cotNote: string;
  categories: FxCategoryCard[];
  scoreHistory: number[];
}

// ─── EURUSD ───
const EURUSD: FxPairData = {
  key: "EURUSD",
  label: "EUR / USD",
  currAName: "EUR",
  currAFlag: "🇪🇺",
  currBName: "USD",
  currBFlag: "🇺🇸",
  totalScore: -5,
  fundamentals: -3,
  cotScore: -2,
  bias: "Strong Bearish",
  cotA: { longPct: "68.51%", shortPct: "31.49%", changePct: "+3.78%", direction: "Bullish" },
  cotB: { longPct: "48.75%", shortPct: "51.25%", changePct: "+4.22%", direction: "Bullish" },
  cotNote: "USD Change stronger than EUR Change → USD wins → -2 for EURUSD",
  scoreHistory: [1, 0, -1, -1, -2, -2, -3, -3, -4, -4, -5, -5],
  categories: [
    {
      label: "ECONOMIC GROWTH",
      color: "#3B82F6",
      subtotal: 0,
      indicators: [
        {
          name: "GDP Growth QoQ", frequency: "Quarterly",
          currA: { result: "BEAT", actual: "0.2%", forecast: "0.1%", surprise: "+0.1%" },
          currB: { result: "BEAT", actual: "2.4%", forecast: "2.3%", surprise: "+0.1%" },
          pairScore: 0,
        },
        {
          name: "Manufacturing PMI", frequency: "Monthly",
          currA: { result: "MISS", actual: "47.6", forecast: "48.4", surprise: "-0.8" },
          currB: { result: "MISS", actual: "50.3", forecast: "51.5", surprise: "-1.2" },
          pairScore: 0,
        },
        {
          name: "Services PMI", frequency: "Monthly",
          currA: { result: "MISS", actual: "50.4", forecast: "51.2", surprise: "-0.8" },
          currB: { result: "BEAT", actual: "54.3", forecast: "53.0", surprise: "+1.3" },
          pairScore: -2,
        },
        {
          name: "Retail Sales MoM", frequency: "Monthly",
          currA: { result: "BEAT", actual: "0.3%", forecast: "0.2%", surprise: "+0.1%" },
          currB: { result: "MISS", actual: "0.2%", forecast: "0.6%", surprise: "-0.4%" },
          pairScore: 2,
        },
        {
          name: "Consumer Confidence", frequency: "Monthly",
          currA: { result: "MISS", actual: "-14.5", forecast: "-13.0", surprise: "-1.5" },
          currB: { result: "MISS", actual: "92.9", forecast: "94.0", surprise: "-1.1" },
          pairScore: 0,
        },
      ],
    },
    {
      label: "INFLATION",
      color: "#818CF8",
      subtotal: -4,
      indicators: [
        {
          name: "CPI YoY", frequency: "Monthly",
          currA: { result: "BEAT", actual: "2.0%", forecast: "2.0%", surprise: "0.0%" },
          currB: { result: "BEAT", actual: "3.1%", forecast: "2.9%", surprise: "+0.2%" },
          pairScore: 0,
        },
        {
          name: "PPI YoY", frequency: "Monthly",
          currA: { result: "MISS", actual: "1.2%", forecast: "0.9%", surprise: "+0.3%" },
          currB: { result: "BEAT", actual: "3.2%", forecast: "3.1%", surprise: "+0.1%" },
          pairScore: -2,
        },
        {
          name: "PCE YoY", frequency: "Monthly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "BEAT", actual: "2.8%", forecast: "2.7%", surprise: "+0.1%" },
          pairScore: -1,
        },
        {
          name: "US02 Yield 21d SMA", frequency: "Daily",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "BEAT", actual: "Rising (Hawkish)" },
          pairScore: -1,
        },
      ],
    },
    {
      label: "JOBS MARKET",
      color: "#F59E0B",
      subtotal: 1,
      indicators: [
        {
          name: "NFP", frequency: "Monthly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "MISS", actual: "-92K", forecast: "58K", surprise: "-150K" },
          pairScore: null,
        },
        {
          name: "Unemployment Rate", frequency: "Monthly",
          currA: { result: "MET", actual: "—", forecast: "—", surprise: "0.0%" },
          currB: { result: "MISS", actual: "4.4%", forecast: "4.3%", surprise: "+0.1%" },
          pairScore: 1,
        },
        {
          name: "Weekly Jobless Claims", frequency: "Weekly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "BEAT", actual: "213K", forecast: "215K", surprise: "-2K" },
          pairScore: null,
        },
        {
          name: "ADP Employment", frequency: "Monthly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "BEAT", actual: "63K", forecast: "50K", surprise: "+13K" },
          pairScore: null,
        },
        {
          name: "JOLTS Job Openings", frequency: "Monthly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "BEAT", actual: "6.95M", forecast: "6.76M", surprise: "+0.19M" },
          pairScore: null,
        },
        {
          name: "Employment Change", frequency: "Quarterly",
          currA: { result: "MET", actual: "0.1%", forecast: "0.1%", surprise: "0.0%" },
          currB: { result: "N/A", actual: "—" },
          pairScore: null,
        },
      ],
    },
  ],
};

// ─── GBPUSD ───
const GBPUSD: FxPairData = {
  key: "GBPUSD",
  label: "GBP / USD",
  currAName: "GBP",
  currAFlag: "🇬🇧",
  currBName: "USD",
  currBFlag: "🇺🇸",
  totalScore: -1,
  fundamentals: 1,
  cotScore: -2,
  bias: "Neutral",
  cotA: { longPct: "42.10%", shortPct: "57.90%", changePct: "-0.60%", direction: "Bearish" },
  cotB: { longPct: "48.75%", shortPct: "51.25%", changePct: "+4.22%", direction: "Bullish" },
  cotNote: "GBP bearish change, USD bullish change → USD wins → -2 for GBPUSD",
  scoreHistory: [2, 1, 1, 0, 0, -1, -1, -1, -1, -1, -1, -1],
  categories: [
    {
      label: "ECONOMIC GROWTH",
      color: "#3B82F6",
      subtotal: 2,
      indicators: [
        {
          name: "GDP Growth", frequency: "Monthly",
          currA: { result: "BEAT", actual: "0.4%", forecast: "0.1%", surprise: "+0.3%" },
          currB: { result: "BEAT", actual: "2.4%", forecast: "2.3%", surprise: "+0.1%" },
          pairScore: 0,
        },
        {
          name: "Manufacturing PMI", frequency: "Monthly",
          currA: { result: "BEAT", actual: "51.9", forecast: "50.8", surprise: "+1.1" },
          currB: { result: "MISS", actual: "50.3", forecast: "51.5", surprise: "-1.2" },
          pairScore: 2,
        },
        {
          name: "Services PMI", frequency: "Monthly",
          currA: { result: "BEAT", actual: "53.2", forecast: "51.0", surprise: "+2.2" },
          currB: { result: "BEAT", actual: "54.3", forecast: "53.0", surprise: "+1.3" },
          pairScore: 0,
        },
        {
          name: "Retail Sales MoM", frequency: "Monthly",
          currA: { result: "MISS", actual: "-0.3%", forecast: "0.0%", surprise: "-0.3%" },
          currB: { result: "MISS", actual: "0.2%", forecast: "0.6%", surprise: "-0.4%" },
          pairScore: 0,
        },
        {
          name: "Consumer Confidence", frequency: "Monthly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "MISS", actual: "92.9", forecast: "94.0", surprise: "-1.1" },
          pairScore: 0,
        },
      ],
    },
    {
      label: "INFLATION",
      color: "#818CF8",
      subtotal: -1,
      indicators: [
        {
          name: "CPI YoY", frequency: "Monthly",
          currA: { result: "BEAT", actual: "3.4%", forecast: "3.3%", surprise: "+0.1%" },
          currB: { result: "BEAT", actual: "3.1%", forecast: "2.9%", surprise: "+0.2%" },
          pairScore: 0,
        },
        {
          name: "PPI YoY", frequency: "Monthly",
          currA: { result: "MET", actual: "2.4%", forecast: "2.4%", surprise: "0.0%" },
          currB: { result: "BEAT", actual: "3.2%", forecast: "3.1%", surprise: "+0.1%" },
          pairScore: -1,
        },
        {
          name: "PCE YoY", frequency: "Monthly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "BEAT", actual: "2.8%", forecast: "2.7%", surprise: "+0.1%" },
          pairScore: null,
        },
        {
          name: "US02 Yield 21d SMA", frequency: "Daily",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "BEAT", actual: "Rising (Hawkish)" },
          pairScore: null,
        },
      ],
    },
    {
      label: "JOBS MARKET",
      color: "#F59E0B",
      subtotal: 0,
      indicators: [
        {
          name: "Unemployment Rate", frequency: "Monthly",
          currA: { result: "MISS", actual: "4.5%", forecast: "4.4%", surprise: "+0.1%" },
          currB: { result: "MISS", actual: "4.4%", forecast: "4.3%", surprise: "+0.1%" },
          pairScore: 0,
        },
        {
          name: "NFP", frequency: "Monthly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "MISS", actual: "-92K", forecast: "58K", surprise: "-150K" },
          pairScore: null,
        },
        {
          name: "Weekly Jobless Claims", frequency: "Weekly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "BEAT", actual: "213K", forecast: "215K", surprise: "-2K" },
          pairScore: null,
        },
        {
          name: "ADP Employment", frequency: "Monthly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "BEAT", actual: "63K", forecast: "50K", surprise: "+13K" },
          pairScore: null,
        },
        {
          name: "JOLTS Job Openings", frequency: "Monthly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "BEAT", actual: "6.95M", forecast: "6.76M", surprise: "+0.19M" },
          pairScore: null,
        },
      ],
    },
  ],
};

// ─── USDJPY ───
const USDJPY: FxPairData = {
  key: "USDJPY",
  label: "USD / JPY",
  currAName: "USD",
  currAFlag: "🇺🇸",
  currBName: "JPY",
  currBFlag: "🇯🇵",
  totalScore: 3,
  fundamentals: 1,
  cotScore: 2,
  bias: "Bullish",
  cotA: { longPct: "48.75%", shortPct: "51.25%", changePct: "+4.22%", direction: "Bullish" },
  cotB: { longPct: "61.30%", shortPct: "38.70%", changePct: "+4.10%", direction: "Bullish" },
  cotNote: "USD change slightly stronger than JPY change → USD wins → +2 for USDJPY",
  scoreHistory: [-1, 0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 3],
  categories: [
    {
      label: "ECONOMIC GROWTH",
      color: "#3B82F6",
      subtotal: 1,
      indicators: [
        {
          name: "GDP Growth QoQ", frequency: "Quarterly",
          currA: { result: "BEAT", actual: "2.4%", forecast: "2.3%", surprise: "+0.1%" },
          currB: { result: "MISS", actual: "-0.4%", forecast: "-0.3%", surprise: "-0.1%" },
          pairScore: 2,
        },
        {
          name: "Manufacturing PMI", frequency: "Monthly",
          currA: { result: "MISS", actual: "50.3", forecast: "51.5", surprise: "-1.2" },
          currB: { result: "MISS", actual: "49.0", forecast: "49.5", surprise: "-0.5" },
          pairScore: 0,
        },
        {
          name: "Services PMI", frequency: "Monthly",
          currA: { result: "BEAT", actual: "54.3", forecast: "53.0", surprise: "+1.3" },
          currB: { result: "MET", actual: "53.9", forecast: "—", surprise: "—" },
          pairScore: 1,
        },
        {
          name: "Retail Sales", frequency: "Monthly",
          currA: { result: "MISS", actual: "0.2%", forecast: "0.6%", surprise: "-0.4%" },
          currB: { result: "BEAT", actual: "1.4%", forecast: "0.9%", surprise: "+0.5%" },
          pairScore: -2,
        },
        {
          name: "Consumer Confidence", frequency: "Monthly",
          currA: { result: "MISS", actual: "92.9", forecast: "94.0", surprise: "-1.1" },
          currB: { result: "N/A", actual: "—" },
          pairScore: 0,
        },
      ],
    },
    {
      label: "INFLATION",
      color: "#818CF8",
      subtotal: 2,
      indicators: [
        {
          name: "CPI YoY", frequency: "Monthly",
          currA: { result: "BEAT", actual: "3.1%", forecast: "2.9%", surprise: "+0.2%" },
          currB: { result: "MISS", actual: "3.7%", forecast: "3.8%", surprise: "-0.1%" },
          pairScore: 2,
        },
        {
          name: "PPI YoY", frequency: "Monthly",
          currA: { result: "BEAT", actual: "3.2%", forecast: "3.1%", surprise: "+0.1%" },
          currB: { result: "BEAT", actual: "4.2%", forecast: "4.1%", surprise: "+0.1%" },
          pairScore: 0,
        },
        {
          name: "PCE YoY", frequency: "Monthly",
          currA: { result: "BEAT", actual: "2.8%", forecast: "2.7%", surprise: "+0.1%" },
          currB: { result: "N/A", actual: "—" },
          pairScore: null,
        },
        {
          name: "US02 Yield 21d SMA", frequency: "Daily",
          currA: { result: "BEAT", actual: "Rising (Hawkish)" },
          currB: { result: "N/A", actual: "—" },
          pairScore: null,
        },
      ],
    },
    {
      label: "JOBS MARKET",
      color: "#F59E0B",
      subtotal: -2,
      indicators: [
        {
          name: "Unemployment Rate", frequency: "Monthly",
          currA: { result: "MISS", actual: "4.4%", forecast: "4.3%", surprise: "+0.1%" },
          currB: { result: "BEAT", actual: "2.4%", forecast: "2.5%", surprise: "-0.1%" },
          pairScore: -2,
        },
        {
          name: "NFP", frequency: "Monthly",
          currA: { result: "MISS", actual: "-92K", forecast: "58K", surprise: "-150K" },
          currB: { result: "N/A", actual: "—" },
          pairScore: null,
        },
        {
          name: "Weekly Jobless Claims", frequency: "Weekly",
          currA: { result: "BEAT", actual: "213K", forecast: "215K", surprise: "-2K" },
          currB: { result: "N/A", actual: "—" },
          pairScore: null,
        },
        {
          name: "ADP Employment", frequency: "Monthly",
          currA: { result: "BEAT", actual: "63K", forecast: "50K", surprise: "+13K" },
          currB: { result: "N/A", actual: "—" },
          pairScore: null,
        },
        {
          name: "JOLTS Job Openings", frequency: "Monthly",
          currA: { result: "BEAT", actual: "6.95M", forecast: "6.76M", surprise: "+0.19M" },
          currB: { result: "N/A", actual: "—" },
          pairScore: null,
        },
        {
          name: "Household Spending", frequency: "Monthly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "MISS", actual: "-0.4%", forecast: "0.2%", surprise: "-0.6%" },
          pairScore: null,
        },
      ],
    },
  ],
};

// ─── EURJPY ───
const EURJPY: FxPairData = {
  key: "EURJPY",
  label: "EUR / JPY",
  currAName: "EUR",
  currAFlag: "🇪🇺",
  currBName: "JPY",
  currBFlag: "🇯🇵",
  totalScore: -1,
  fundamentals: 0,
  cotScore: -1,
  bias: "Neutral",
  cotA: { longPct: "68.51%", shortPct: "31.49%", changePct: "+3.78%", direction: "Bullish" },
  cotB: { longPct: "61.30%", shortPct: "38.70%", changePct: "+4.10%", direction: "Bullish" },
  cotNote: "JPY change slightly stronger than EUR change → JPY wins → -1 for EURJPY",
  scoreHistory: [2, 1, 1, 0, 0, -1, -1, -1, -1, -1, -1, -1],
  categories: [
    {
      label: "ECONOMIC GROWTH",
      color: "#3B82F6",
      subtotal: 1,
      indicators: [
        {
          name: "GDP Growth QoQ", frequency: "Quarterly",
          currA: { result: "BEAT", actual: "0.2%", forecast: "0.1%", surprise: "+0.1%" },
          currB: { result: "MISS", actual: "-0.4%", forecast: "-0.3%", surprise: "-0.1%" },
          pairScore: 2,
        },
        {
          name: "Manufacturing PMI", frequency: "Monthly",
          currA: { result: "MISS", actual: "47.6", forecast: "48.4", surprise: "-0.8" },
          currB: { result: "MISS", actual: "49.0", forecast: "49.5", surprise: "-0.5" },
          pairScore: 0,
        },
        {
          name: "Services PMI", frequency: "Monthly",
          currA: { result: "MISS", actual: "50.4", forecast: "51.2", surprise: "-0.8" },
          currB: { result: "MET", actual: "53.9", forecast: "—", surprise: "—" },
          pairScore: -1,
        },
        {
          name: "Retail Sales", frequency: "Monthly",
          currA: { result: "BEAT", actual: "0.3%", forecast: "0.2%", surprise: "+0.1%" },
          currB: { result: "BEAT", actual: "1.4%", forecast: "0.9%", surprise: "+0.5%" },
          pairScore: 0,
        },
        {
          name: "Consumer Confidence", frequency: "Monthly",
          currA: { result: "MISS", actual: "-14.5", forecast: "-13.0", surprise: "-1.5" },
          currB: { result: "N/A", actual: "—" },
          pairScore: 0,
        },
      ],
    },
    {
      label: "INFLATION",
      color: "#818CF8",
      subtotal: 0,
      indicators: [
        {
          name: "CPI YoY", frequency: "Monthly",
          currA: { result: "BEAT", actual: "2.0%", forecast: "2.0%", surprise: "0.0%" },
          currB: { result: "MISS", actual: "3.7%", forecast: "3.8%", surprise: "-0.1%" },
          pairScore: 2,
        },
        {
          name: "PPI YoY", frequency: "Monthly",
          currA: { result: "MISS", actual: "1.2%", forecast: "0.9%", surprise: "+0.3%" },
          currB: { result: "BEAT", actual: "4.2%", forecast: "4.1%", surprise: "+0.1%" },
          pairScore: -2,
        },
      ],
    },
    {
      label: "JOBS MARKET",
      color: "#F59E0B",
      subtotal: -1,
      indicators: [
        {
          name: "Employment Change", frequency: "Quarterly",
          currA: { result: "MET", actual: "0.1%", forecast: "0.1%", surprise: "0.0%" },
          currB: { result: "N/A", actual: "—" },
          pairScore: null,
        },
        {
          name: "Unemployment Rate", frequency: "Monthly",
          currA: { result: "MET", actual: "—", forecast: "—", surprise: "0.0%" },
          currB: { result: "BEAT", actual: "2.4%", forecast: "2.5%", surprise: "-0.1%" },
          pairScore: -1,
        },
        {
          name: "Household Spending", frequency: "Monthly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "MISS", actual: "-0.4%", forecast: "0.2%", surprise: "-0.6%" },
          pairScore: null,
        },
      ],
    },
  ],
};

// ─── GBPJPY ───
const GBPJPY: FxPairData = {
  key: "GBPJPY",
  label: "GBP / JPY",
  currAName: "GBP",
  currAFlag: "🇬🇧",
  currBName: "JPY",
  currBFlag: "🇯🇵",
  totalScore: 2,
  fundamentals: 2,
  cotScore: 0,
  bias: "Neutral",
  cotA: { longPct: "42.10%", shortPct: "57.90%", changePct: "-0.60%", direction: "Bearish" },
  cotB: { longPct: "61.30%", shortPct: "38.70%", changePct: "+4.10%", direction: "Bullish" },
  cotNote: "GBP bearish, JPY bullish — conflicting → 0 for GBPJPY",
  scoreHistory: [3, 2, 2, 1, 1, 1, 2, 2, 2, 2, 2, 2],
  categories: [
    {
      label: "ECONOMIC GROWTH",
      color: "#3B82F6",
      subtotal: 3,
      indicators: [
        {
          name: "GDP Growth", frequency: "Monthly",
          currA: { result: "BEAT", actual: "0.4%", forecast: "0.1%", surprise: "+0.3%" },
          currB: { result: "MISS", actual: "-0.4%", forecast: "-0.3%", surprise: "-0.1%" },
          pairScore: 2,
        },
        {
          name: "Manufacturing PMI", frequency: "Monthly",
          currA: { result: "BEAT", actual: "51.9", forecast: "50.8", surprise: "+1.1" },
          currB: { result: "MISS", actual: "49.0", forecast: "49.5", surprise: "-0.5" },
          pairScore: 2,
        },
        {
          name: "Services PMI", frequency: "Monthly",
          currA: { result: "BEAT", actual: "53.2", forecast: "51.0", surprise: "+2.2" },
          currB: { result: "MET", actual: "53.9", forecast: "—", surprise: "—" },
          pairScore: 1,
        },
        {
          name: "Retail Sales", frequency: "Monthly",
          currA: { result: "MISS", actual: "-0.3%", forecast: "0.0%", surprise: "-0.3%" },
          currB: { result: "BEAT", actual: "1.4%", forecast: "0.9%", surprise: "+0.5%" },
          pairScore: -2,
        },
        {
          name: "Consumer Confidence", frequency: "Monthly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "N/A", actual: "—" },
          pairScore: 0,
        },
      ],
    },
    {
      label: "INFLATION",
      color: "#818CF8",
      subtotal: 1,
      indicators: [
        {
          name: "CPI YoY", frequency: "Monthly",
          currA: { result: "BEAT", actual: "3.4%", forecast: "3.3%", surprise: "+0.1%" },
          currB: { result: "MISS", actual: "3.7%", forecast: "3.8%", surprise: "-0.1%" },
          pairScore: 2,
        },
        {
          name: "PPI YoY", frequency: "Monthly",
          currA: { result: "MET", actual: "2.4%", forecast: "2.4%", surprise: "0.0%" },
          currB: { result: "BEAT", actual: "4.2%", forecast: "4.1%", surprise: "+0.1%" },
          pairScore: -1,
        },
      ],
    },
    {
      label: "JOBS MARKET",
      color: "#F59E0B",
      subtotal: -2,
      indicators: [
        {
          name: "Unemployment Rate", frequency: "Monthly",
          currA: { result: "MISS", actual: "4.5%", forecast: "4.4%", surprise: "+0.1%" },
          currB: { result: "BEAT", actual: "2.4%", forecast: "2.5%", surprise: "-0.1%" },
          pairScore: -2,
        },
        {
          name: "Household Spending", frequency: "Monthly",
          currA: { result: "N/A", actual: "—" },
          currB: { result: "MISS", actual: "-0.4%", forecast: "0.2%", surprise: "-0.6%" },
          pairScore: null,
        },
      ],
    },
  ],
};

export const fxPairs: FxPairData[] = [EURUSD, GBPUSD, USDJPY, EURJPY, GBPJPY];
