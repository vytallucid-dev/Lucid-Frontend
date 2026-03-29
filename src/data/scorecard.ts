import { type BiasType } from "./assets";

export type ScorecardAssetKey = "USD" | "EUR" | "GBP" | "JPY" | "Gold" | "SPY" | "NAS100";

export interface ScorecardIndicator {
  name: string;
  actual: string;
  forecast: string | null;
  previous: string;
  surprise: string | null;
  score: 1 | 0 | -1;
  staleDate?: string; // amber warning for stale data
}

export interface ScorecardSection {
  label: string;
  color: string;
  subtotal: number;
  indicators: ScorecardIndicator[];
}

export interface CotDetail {
  netPositioning: "Bullish" | "Bearish" | "Neutral";
  weeklyChange: "Bullish" | "Bearish" | "Neutral";
  cotScore: number;
  longPct: string;
  shortPct: string;
  deltaWeekly: string;
}

export interface ScorecardAsset {
  key: ScorecardAssetKey;
  name: string;
  flag: string;
  totalScore: number;
  fundamentals: number;
  cotScore: number;
  bias: BiasType;
  cot: CotDetail;
  sections: ScorecardSection[];
  scoreHistory: number[];
}

export const weekLabels = [
  "Jan5", "Jan12", "Jan19", "Jan26", "Feb2", "Feb9",
  "Feb16", "Feb23", "Mar2", "Mar9", "Mar16", "Mar23",
];

export const scorecardAssets: ScorecardAsset[] = [
  // ─── USD ───
  {
    key: "USD",
    name: "US Dollar",
    flag: "🇺🇸",
    totalScore: 6,
    fundamentals: 4,
    cotScore: 2,
    bias: "Strong Bullish",
    cot: {
      netPositioning: "Bullish",
      weeklyChange: "Bullish",
      cotScore: 2,
      longPct: "68.5%",
      shortPct: "31.5%",
      deltaWeekly: "+3.8%",
    },
    scoreHistory: [-2, -1, 0, 1, 2, 3, 4, 4, 5, 5, 6, 6],
    sections: [
      {
        label: "ECONOMIC GROWTH",
        color: "#3B82F6",
        subtotal: -1,
        indicators: [
          { name: "GDP Growth QoQ", actual: "2.4%", forecast: "2.3%", previous: "3.1%", surprise: "+0.1%", score: 1 },
          { name: "Manufacturing PMI", actual: "50.3", forecast: "51.5", previous: "50.9", surprise: "-1.2", score: -1 },
          { name: "Services PMI", actual: "54.3", forecast: "53.0", previous: "52.9", surprise: "+1.3", score: 1 },
          { name: "Retail Sales MoM", actual: "0.2%", forecast: "0.6%", previous: "0.9%", surprise: "-0.4%", score: -1 },
          { name: "Consumer Confidence", actual: "92.9", forecast: "94.0", previous: "98.3", surprise: "-1.1", score: -1 },
        ],
      },
      {
        label: "INFLATION",
        color: "#818CF8",
        subtotal: 4,
        indicators: [
          { name: "CPI YoY", actual: "3.1%", forecast: "2.9%", previous: "3.0%", surprise: "+0.2%", score: 1 },
          { name: "PPI YoY", actual: "3.2%", forecast: "3.1%", previous: "3.4%", surprise: "+0.1%", score: 1 },
          { name: "PCE YoY", actual: "2.8%", forecast: "2.7%", previous: "2.6%", surprise: "+0.1%", score: 1 },
          { name: "US02 Yield 21d SMA", actual: "Rising (Hawkish)", forecast: null, previous: "—", surprise: null, score: 1 },
        ],
      },
      {
        label: "JOBS MARKET",
        color: "#F59E0B",
        subtotal: 1,
        indicators: [
          { name: "NFP", actual: "-92K", forecast: "58K", previous: "151K", surprise: "-150K", score: -1 },
          { name: "Unemployment Rate", actual: "4.4%", forecast: "4.3%", previous: "4.1%", surprise: "+0.1%", score: -1 },
          { name: "Weekly Jobless Claims", actual: "213K", forecast: "215K", previous: "227K", surprise: "-2K", score: 1 },
          { name: "ADP Employment", actual: "63K", forecast: "50K", previous: "183K", surprise: "+13K", score: 1 },
          { name: "JOLTS Job Openings", actual: "6.95M", forecast: "6.76M", previous: "7.16M", surprise: "+0.19M", score: 1 },
        ],
      },
    ],
  },

  // ─── EUR ───
  {
    key: "EUR",
    name: "Euro",
    flag: "🇪🇺",
    totalScore: -3,
    fundamentals: -1,
    cotScore: -2,
    bias: "Bearish",
    cot: {
      netPositioning: "Bearish",
      weeklyChange: "Bearish",
      cotScore: -2,
      longPct: "35.2%",
      shortPct: "64.8%",
      deltaWeekly: "-2.4%",
    },
    scoreHistory: [1, 0, -1, -1, -2, -2, -3, -3, -3, -4, -3, -3],
    sections: [
      {
        label: "ECONOMIC GROWTH",
        color: "#3B82F6",
        subtotal: -1,
        indicators: [
          { name: "GDP Growth QoQ", actual: "0.2%", forecast: "0.1%", previous: "0.4%", surprise: "+0.1%", score: 1 },
          { name: "Manufacturing PMI", actual: "47.6", forecast: "48.4", previous: "47.6", surprise: "-0.8", score: -1 },
          { name: "Services PMI", actual: "50.4", forecast: "51.2", previous: "51.0", surprise: "-0.8", score: -1 },
          { name: "Retail Sales MoM", actual: "0.3%", forecast: "0.2%", previous: "-0.4%", surprise: "+0.1%", score: 1 },
          { name: "Consumer Confidence", actual: "-14.5", forecast: "-13.0", previous: "-13.6", surprise: "-1.5", score: -1 },
        ],
      },
      {
        label: "INFLATION",
        color: "#818CF8",
        subtotal: 0,
        indicators: [
          { name: "CPI YoY (HICP)", actual: "2.0%", forecast: "2.0%", previous: "2.4%", surprise: "0.0%", score: 1 },
          { name: "PPI YoY", actual: "1.2%", forecast: "0.9%", previous: "0.8%", surprise: "+0.3%", score: -1 },
        ],
      },
      {
        label: "JOBS MARKET",
        color: "#F59E0B",
        subtotal: 0,
        indicators: [
          { name: "Employment Change", actual: "0.1%", forecast: "0.1%", previous: "0.2%", surprise: "0.0%", score: 0 },
        ],
      },
    ],
  },

  // ─── GBP ───
  {
    key: "GBP",
    name: "British Pound",
    flag: "🇬🇧",
    totalScore: 1,
    fundamentals: 2,
    cotScore: -1,
    bias: "Neutral",
    cot: {
      netPositioning: "Bearish",
      weeklyChange: "Neutral",
      cotScore: -1,
      longPct: "42.1%",
      shortPct: "57.9%",
      deltaWeekly: "-0.6%",
    },
    scoreHistory: [-2, -1, 0, 0, 1, 1, 2, 1, 1, 1, 1, 1],
    sections: [
      {
        label: "ECONOMIC GROWTH",
        color: "#3B82F6",
        subtotal: 2,
        indicators: [
          { name: "GDP Growth MoM", actual: "0.4%", forecast: "0.1%", previous: "0.4%", surprise: "+0.3%", score: 1 },
          { name: "Manufacturing PMI", actual: "51.9", forecast: "50.8", previous: "50.9", surprise: "+1.1", score: 1 },
          { name: "Services PMI", actual: "53.2", forecast: "51.0", previous: "51.0", surprise: "+2.2", score: 1 },
          { name: "Retail Sales MoM", actual: "-0.3%", forecast: "0.0%", previous: "1.7%", surprise: "-0.3%", score: -1 },
        ],
      },
      {
        label: "INFLATION",
        color: "#818CF8",
        subtotal: 1,
        indicators: [
          { name: "CPI YoY", actual: "3.4%", forecast: "3.3%", previous: "3.0%", surprise: "+0.1%", score: 1 },
          { name: "PPI YoY", actual: "2.4%", forecast: "2.4%", previous: "2.6%", surprise: "0.0%", score: 0 },
        ],
      },
      {
        label: "JOBS MARKET",
        color: "#F59E0B",
        subtotal: -1,
        indicators: [
          { name: "Unemployment Rate", actual: "4.5%", forecast: "4.4%", previous: "4.4%", surprise: "+0.1%", score: -1 },
        ],
      },
    ],
  },

  // ─── JPY ───
  {
    key: "JPY",
    name: "Japanese Yen",
    flag: "🇯🇵",
    totalScore: 1,
    fundamentals: -1,
    cotScore: 2,
    bias: "Neutral",
    cot: {
      netPositioning: "Bullish",
      weeklyChange: "Bullish",
      cotScore: 2,
      longPct: "61.3%",
      shortPct: "38.7%",
      deltaWeekly: "+4.1%",
    },
    scoreHistory: [3, 2, 2, 1, 1, 0, 1, 1, 1, 1, 1, 1],
    sections: [
      {
        label: "ECONOMIC GROWTH",
        color: "#3B82F6",
        subtotal: -1,
        indicators: [
          { name: "GDP Growth QoQ", actual: "-0.4%", forecast: "-0.3%", previous: "0.3%", surprise: "-0.1%", score: -1 },
          { name: "Manufacturing PMI", actual: "49.0", forecast: "49.5", previous: "48.8", surprise: "-0.5", score: -1 },
          { name: "Services PMI", actual: "53.9", forecast: null, previous: "49.4", surprise: null, score: 0, staleDate: "Jul 24, 2024" },
          { name: "Retail Sales YoY", actual: "1.4%", forecast: "0.9%", previous: "3.9%", surprise: "+0.5%", score: 1 },
        ],
      },
      {
        label: "INFLATION",
        color: "#818CF8",
        subtotal: 0,
        indicators: [
          { name: "CPI YoY", actual: "3.7%", forecast: "3.8%", previous: "4.0%", surprise: "-0.1%", score: -1 },
          { name: "PPI YoY", actual: "4.2%", forecast: "4.1%", previous: "4.2%", surprise: "+0.1%", score: 1 },
        ],
      },
      {
        label: "JOBS MARKET",
        color: "#F59E0B",
        subtotal: 0,
        indicators: [
          { name: "Household Spending", actual: "-0.4%", forecast: "0.2%", previous: "2.8%", surprise: "-0.6%", score: -1 },
          { name: "Unemployment Rate", actual: "2.4%", forecast: "2.5%", previous: "2.5%", surprise: "-0.1%", score: 1 },
        ],
      },
    ],
  },

  // ─── GOLD (XAUUSD) ───
  {
    key: "Gold",
    name: "Gold (XAUUSD)",
    flag: "🥇",
    totalScore: -2,
    fundamentals: -4,
    cotScore: 2,
    bias: "Neutral",
    cot: {
      netPositioning: "Bullish",
      weeklyChange: "Bullish",
      cotScore: 2,
      longPct: "72.3%",
      shortPct: "27.7%",
      deltaWeekly: "+2.9%",
    },
    scoreHistory: [4, 3, 2, 1, 0, -1, -1, -2, -2, -2, -2, -2],
    sections: [
      {
        label: "ECONOMIC GROWTH",
        color: "#3B82F6",
        subtotal: 1,
        indicators: [
          { name: "GDP Growth QoQ", actual: "2.4%", forecast: "2.3%", previous: "3.1%", surprise: "+0.1%", score: -1 },
          { name: "Manufacturing PMI", actual: "50.3", forecast: "51.5", previous: "50.9", surprise: "-1.2", score: 1 },
          { name: "Services PMI", actual: "54.3", forecast: "53.0", previous: "52.9", surprise: "+1.3", score: -1 },
          { name: "Retail Sales MoM", actual: "0.2%", forecast: "0.6%", previous: "0.9%", surprise: "-0.4%", score: 1 },
          { name: "Consumer Confidence", actual: "92.9", forecast: "94.0", previous: "98.3", surprise: "-1.1", score: 1 },
        ],
      },
      {
        label: "INFLATION",
        color: "#818CF8",
        subtotal: -4,
        indicators: [
          { name: "CPI YoY", actual: "3.1%", forecast: "2.9%", previous: "3.0%", surprise: "+0.2%", score: -1 },
          { name: "PPI YoY", actual: "3.2%", forecast: "3.1%", previous: "3.4%", surprise: "+0.1%", score: -1 },
          { name: "PCE YoY", actual: "2.8%", forecast: "2.7%", previous: "2.6%", surprise: "+0.1%", score: -1 },
          { name: "US02 Yield 21d SMA", actual: "Rising (Hawkish)", forecast: null, previous: "—", surprise: null, score: -1 },
        ],
      },
      {
        label: "JOBS MARKET",
        color: "#F59E0B",
        subtotal: -1,
        indicators: [
          { name: "NFP", actual: "-92K", forecast: "58K", previous: "151K", surprise: "-150K", score: 1 },
          { name: "Unemployment Rate", actual: "4.4%", forecast: "4.3%", previous: "4.1%", surprise: "+0.1%", score: 1 },
          { name: "Weekly Jobless Claims", actual: "213K", forecast: "215K", previous: "227K", surprise: "-2K", score: -1 },
          { name: "ADP Employment", actual: "63K", forecast: "50K", previous: "183K", surprise: "+13K", score: -1 },
          { name: "JOLTS Job Openings", actual: "6.95M", forecast: "6.76M", previous: "7.16M", surprise: "+0.19M", score: -1 },
        ],
      },
    ],
  },

  // ─── SPY ───
  {
    key: "SPY",
    name: "S&P 500 (SPY)",
    flag: "📈",
    totalScore: -3,
    fundamentals: -4,
    cotScore: 1,
    bias: "Bearish",
    cot: {
      netPositioning: "Bullish",
      weeklyChange: "Neutral",
      cotScore: 1,
      longPct: "55.8%",
      shortPct: "44.2%",
      deltaWeekly: "+0.9%",
    },
    scoreHistory: [2, 1, 0, 0, -1, -1, -2, -2, -3, -3, -3, -3],
    sections: [
      {
        label: "ECONOMIC GROWTH",
        color: "#3B82F6",
        subtotal: -1,
        indicators: [
          { name: "GDP Growth QoQ", actual: "2.4%", forecast: "2.3%", previous: "3.1%", surprise: "+0.1%", score: 1 },
          { name: "Manufacturing PMI", actual: "50.3", forecast: "51.5", previous: "50.9", surprise: "-1.2", score: -1 },
          { name: "Services PMI", actual: "54.3", forecast: "53.0", previous: "52.9", surprise: "+1.3", score: 1 },
          { name: "Retail Sales MoM", actual: "0.2%", forecast: "0.6%", previous: "0.9%", surprise: "-0.4%", score: -1 },
          { name: "Consumer Confidence", actual: "92.9", forecast: "94.0", previous: "98.3", surprise: "-1.1", score: -1 },
        ],
      },
      {
        label: "INFLATION",
        color: "#818CF8",
        subtotal: -4,
        indicators: [
          { name: "CPI YoY", actual: "3.1%", forecast: "2.9%", previous: "3.0%", surprise: "+0.2%", score: -1 },
          { name: "PPI YoY", actual: "3.2%", forecast: "3.1%", previous: "3.4%", surprise: "+0.1%", score: -1 },
          { name: "PCE YoY", actual: "2.8%", forecast: "2.7%", previous: "2.6%", surprise: "+0.1%", score: -1 },
          { name: "US02 Yield 21d SMA", actual: "Rising (Hawkish)", forecast: null, previous: "—", surprise: null, score: -1 },
        ],
      },
      {
        label: "JOBS MARKET",
        color: "#F59E0B",
        subtotal: 1,
        indicators: [
          { name: "NFP", actual: "-92K", forecast: "58K", previous: "151K", surprise: "-150K", score: -1 },
          { name: "Unemployment Rate", actual: "4.4%", forecast: "4.3%", previous: "4.1%", surprise: "+0.1%", score: -1 },
          { name: "Weekly Jobless Claims", actual: "213K", forecast: "215K", previous: "227K", surprise: "-2K", score: 1 },
          { name: "ADP Employment", actual: "63K", forecast: "50K", previous: "183K", surprise: "+13K", score: 1 },
          { name: "JOLTS Job Openings", actual: "6.95M", forecast: "6.76M", previous: "7.16M", surprise: "+0.19M", score: 1 },
        ],
      },
    ],
  },

  // ─── NAS100 ───
  {
    key: "NAS100",
    name: "Nasdaq 100",
    flag: "💻",
    totalScore: -5,
    fundamentals: -4,
    cotScore: -1,
    bias: "Strong Bearish",
    cot: {
      netPositioning: "Bearish",
      weeklyChange: "Bearish",
      cotScore: -1,
      longPct: "41.2%",
      shortPct: "58.8%",
      deltaWeekly: "-1.7%",
    },
    scoreHistory: [1, 0, 0, -1, -2, -2, -3, -4, -4, -5, -5, -5],
    sections: [
      {
        label: "ECONOMIC GROWTH",
        color: "#3B82F6",
        subtotal: -1,
        indicators: [
          { name: "GDP Growth QoQ", actual: "2.4%", forecast: "2.3%", previous: "3.1%", surprise: "+0.1%", score: 1 },
          { name: "Manufacturing PMI", actual: "50.3", forecast: "51.5", previous: "50.9", surprise: "-1.2", score: -1 },
          { name: "Services PMI", actual: "54.3", forecast: "53.0", previous: "52.9", surprise: "+1.3", score: 1 },
          { name: "Retail Sales MoM", actual: "0.2%", forecast: "0.6%", previous: "0.9%", surprise: "-0.4%", score: -1 },
          { name: "Consumer Confidence", actual: "92.9", forecast: "94.0", previous: "98.3", surprise: "-1.1", score: -1 },
        ],
      },
      {
        label: "INFLATION",
        color: "#818CF8",
        subtotal: -4,
        indicators: [
          { name: "CPI YoY", actual: "3.1%", forecast: "2.9%", previous: "3.0%", surprise: "+0.2%", score: -1 },
          { name: "PPI YoY", actual: "3.2%", forecast: "3.1%", previous: "3.4%", surprise: "+0.1%", score: -1 },
          { name: "PCE YoY", actual: "2.8%", forecast: "2.7%", previous: "2.6%", surprise: "+0.1%", score: -1 },
          { name: "US02 Yield 21d SMA", actual: "Rising (Hawkish)", forecast: null, previous: "—", surprise: null, score: -1 },
        ],
      },
      {
        label: "JOBS MARKET",
        color: "#F59E0B",
        subtotal: 1,
        indicators: [
          { name: "NFP", actual: "-92K", forecast: "58K", previous: "151K", surprise: "-150K", score: -1 },
          { name: "Unemployment Rate", actual: "4.4%", forecast: "4.3%", previous: "4.1%", surprise: "+0.1%", score: -1 },
          { name: "Weekly Jobless Claims", actual: "213K", forecast: "215K", previous: "227K", surprise: "-2K", score: 1 },
          { name: "ADP Employment", actual: "63K", forecast: "50K", previous: "183K", surprise: "+13K", score: 1 },
          { name: "JOLTS Job Openings", actual: "6.95M", forecast: "6.76M", previous: "7.16M", surprise: "+0.19M", score: 1 },
        ],
      },
    ],
  },
];
