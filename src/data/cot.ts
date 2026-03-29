import type { AssetType } from "./assets";

export type CotScore = 2 | 1 | 0 | -1 | -2;

export interface CotAsset {
  asset: string;
  flag: string;
  type: AssetType;
  longContracts: number;
  shortContracts: number;
  deltaLong: number;
  deltaShort: number;
  longPct: number;
  shortPct: number;
  netPctChange: number;
  netPosition: number;
  cotScore: CotScore;
  scoreTooltip: string;
  trend: number[]; // 4-week Net % Change history
}

export const cotData: CotAsset[] = [
  {
    asset: "EURUSD",
    flag: "🇪🇺🇺🇸",
    type: "Forex",
    longContracts: 302301,
    shortContracts: 138940,
    deltaLong: 11965,
    deltaShort: -19262,
    longPct: 68.51,
    shortPct: 31.49,
    netPctChange: 3.78,
    netPosition: 163361,
    cotScore: -2,
    scoreTooltip: "EUR Change: Bullish · USD Change: Bullish · Pair Conflict → -2",
    trend: [-1.2, -0.8, 0.5, 3.78],
  },
  {
    asset: "GBPUSD",
    flag: "🇬🇧🇺🇸",
    type: "Forex",
    longContracts: 41832,
    shortContracts: 67445,
    deltaLong: -3211,
    deltaShort: 8934,
    longPct: 38.3,
    shortPct: 61.7,
    netPctChange: -4.21,
    netPosition: -25613,
    cotScore: -2,
    scoreTooltip: "GBP Change: Bearish · USD Change: Bullish · Combined: -2",
    trend: [-2.1, -3.4, -2.8, -4.21],
  },
  {
    asset: "USDJPY",
    flag: "🇺🇸🇯🇵",
    type: "Forex",
    longContracts: 16610,
    shortContracts: 17462,
    deltaLong: -1335,
    deltaShort: -4888,
    longPct: 48.75,
    shortPct: 51.25,
    netPctChange: 4.22,
    netPosition: -852,
    cotScore: 2,
    scoreTooltip: "USD Change: Bullish · JPY Change: Bearish · Combined: +2",
    trend: [1.1, 2.3, 3.1, 4.22],
  },
  {
    asset: "EURJPY",
    flag: "🇪🇺🇯🇵",
    type: "Forex",
    longContracts: 28441,
    shortContracts: 19832,
    deltaLong: 2341,
    deltaShort: 4102,
    longPct: 58.9,
    shortPct: 41.1,
    netPctChange: -1.84,
    netPosition: 8609,
    cotScore: -1,
    scoreTooltip: "EUR Change: Bearish · JPY Change: Neutral · Combined: -1",
    trend: [0.8, 0.2, -0.9, -1.84],
  },
  {
    asset: "GBPJPY",
    flag: "🇬🇧🇯🇵",
    type: "Forex",
    longContracts: 12334,
    shortContracts: 18921,
    deltaLong: -892,
    deltaShort: -2341,
    longPct: 39.5,
    shortPct: 60.5,
    netPctChange: 2.11,
    netPosition: -6587,
    cotScore: 0,
    scoreTooltip: "Net: Bearish · Change: Bullish · Conflict → 0",
    trend: [-3.2, -1.8, 0.4, 2.11],
  },
  {
    asset: "XAUUSD",
    flag: "🪙",
    type: "Commodity",
    longContracts: 189432,
    shortContracts: 44231,
    deltaLong: 8921,
    deltaShort: -3412,
    longPct: 81.07,
    shortPct: 18.93,
    netPctChange: 5.14,
    netPosition: 145201,
    cotScore: 2,
    scoreTooltip: "Net Positioning: Bullish · Weekly Change: Bullish · Combined: +2",
    trend: [2.1, 3.4, 4.2, 5.14],
  },
  {
    asset: "SPY",
    flag: "🇺🇸",
    type: "Index",
    longContracts: 412334,
    shortContracts: 389221,
    deltaLong: -18432,
    deltaShort: -24891,
    longPct: 51.4,
    shortPct: 48.6,
    netPctChange: 1.82,
    netPosition: 23113,
    cotScore: 1,
    scoreTooltip: "Net Positioning: Neutral · Weekly Change: Bullish · Combined: +1",
    trend: [-2.1, -0.8, 0.9, 1.82],
  },
  {
    asset: "NAS100",
    flag: "🇺🇸",
    type: "Index",
    longContracts: 28441,
    shortContracts: 34892,
    deltaLong: -2341,
    deltaShort: -5892,
    longPct: 44.9,
    shortPct: 55.1,
    netPctChange: -1.23,
    netPosition: -6451,
    cotScore: -1,
    scoreTooltip: "Net Positioning: Bearish · Weekly Change: Bearish · Combined: -1",
    trend: [1.2, 0.4, -0.6, -1.23],
  },
];
