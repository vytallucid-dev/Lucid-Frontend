export type EconomyKey = "US" | "EU" | "UK" | "JP";

export interface EconomyMeta {
  key: EconomyKey;
  label: string;
  flag: string;
}

export const economies: EconomyMeta[] = [
  { key: "US", label: "United States", flag: "🇺🇸" },
  { key: "EU", label: "Eurozone", flag: "🇪🇺" },
  { key: "UK", label: "United Kingdom", flag: "🇬🇧" },
  { key: "JP", label: "Japan", flag: "🇯🇵" },
];

export type IndicatorScore = 1 | 0 | -1;
export type Frequency = "Monthly" | "Quarterly" | "Weekly" | "Daily";

export interface HeatmapIndicator {
  name: string;
  frequency: Frequency;
  category: "ECONOMIC GROWTH" | "INFLATION" | "JOBS MARKET";
  lastRelease: string; // display date or "Daily"
  nextRelease: string; // display date or "Daily" or "—"
  actual: string;
  forecast: string; // "—" if none
  previous: string;
  surprise: string; // "+0.1%" or "—"
  score: IndicatorScore;
  stale?: boolean; // amber date warning
}

export const heatmapData: Record<EconomyKey, HeatmapIndicator[]> = {
  US: [
    // ECONOMIC GROWTH
    { name: "GDP Growth QoQ", frequency: "Quarterly", category: "ECONOMIC GROWTH", lastRelease: "Mar 27, 2026", nextRelease: "Jun 26, 2026", actual: "2.4%", forecast: "2.3%", previous: "3.1%", surprise: "+0.1%", score: 1 },
    { name: "Manufacturing PMI", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Mar 3, 2026", nextRelease: "Apr 1, 2026", actual: "50.3", forecast: "51.5", previous: "50.9", surprise: "-1.2", score: -1 },
    { name: "Services PMI", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Mar 5, 2026", nextRelease: "Apr 3, 2026", actual: "54.3", forecast: "53.0", previous: "52.9", surprise: "+1.3", score: 1 },
    { name: "Retail Sales MoM", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Mar 17, 2026", nextRelease: "Apr 16, 2026", actual: "0.2%", forecast: "0.6%", previous: "0.9%", surprise: "-0.4%", score: -1 },
    { name: "Consumer Confidence", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Mar 25, 2026", nextRelease: "Apr 29, 2026", actual: "92.9", forecast: "94.0", previous: "98.3", surprise: "-1.1", score: -1 },
    // INFLATION
    { name: "CPI YoY", frequency: "Monthly", category: "INFLATION", lastRelease: "Mar 12, 2026", nextRelease: "Apr 10, 2026", actual: "3.1%", forecast: "2.9%", previous: "3.0%", surprise: "+0.2%", score: 1 },
    { name: "PPI YoY", frequency: "Monthly", category: "INFLATION", lastRelease: "Mar 13, 2026", nextRelease: "Apr 11, 2026", actual: "3.2%", forecast: "3.1%", previous: "3.4%", surprise: "+0.1%", score: 1 },
    { name: "PCE YoY", frequency: "Monthly", category: "INFLATION", lastRelease: "Mar 28, 2026", nextRelease: "Apr 30, 2026", actual: "2.8%", forecast: "2.7%", previous: "2.6%", surprise: "+0.1%", score: 1 },
    { name: "US02 Yield 21d SMA", frequency: "Daily", category: "INFLATION", lastRelease: "Daily", nextRelease: "Daily", actual: "Rising", forecast: "—", previous: "—", surprise: "Hawkish", score: 1 },
    // JOBS MARKET
    { name: "NFP", frequency: "Monthly", category: "JOBS MARKET", lastRelease: "Mar 7, 2026", nextRelease: "Apr 4, 2026", actual: "-92K", forecast: "58K", previous: "151K", surprise: "-150K", score: -1 },
    { name: "Unemployment Rate", frequency: "Monthly", category: "JOBS MARKET", lastRelease: "Mar 7, 2026", nextRelease: "Apr 4, 2026", actual: "4.4%", forecast: "4.3%", previous: "4.1%", surprise: "+0.1%", score: -1 },
    { name: "Weekly Jobless Claims", frequency: "Weekly", category: "JOBS MARKET", lastRelease: "Mar 27, 2026", nextRelease: "Apr 3, 2026", actual: "213K", forecast: "215K", previous: "227K", surprise: "-2K", score: 1 },
    { name: "ADP Employment", frequency: "Monthly", category: "JOBS MARKET", lastRelease: "Mar 5, 2026", nextRelease: "Apr 2, 2026", actual: "63K", forecast: "50K", previous: "183K", surprise: "+13K", score: 1 },
    { name: "JOLTS Job Openings", frequency: "Monthly", category: "JOBS MARKET", lastRelease: "Mar 11, 2026", nextRelease: "Apr 8, 2026", actual: "6.95M", forecast: "6.76M", previous: "7.16M", surprise: "+0.19M", score: 1 },
  ],
  EU: [
    // ECONOMIC GROWTH
    { name: "GDP Growth QoQ", frequency: "Quarterly", category: "ECONOMIC GROWTH", lastRelease: "Mar 7, 2026", nextRelease: "Jun 6, 2026", actual: "0.2%", forecast: "0.1%", previous: "0.4%", surprise: "+0.1%", score: 1 },
    { name: "Manufacturing PMI", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Mar 21, 2026", nextRelease: "Apr 22, 2026", actual: "47.6", forecast: "48.4", previous: "47.6", surprise: "-0.8", score: -1 },
    { name: "Services PMI", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Mar 21, 2026", nextRelease: "Apr 22, 2026", actual: "50.4", forecast: "51.2", previous: "51.0", surprise: "-0.8", score: -1 },
    { name: "Retail Sales MoM", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Mar 5, 2026", nextRelease: "Apr 7, 2026", actual: "0.3%", forecast: "0.2%", previous: "-0.4%", surprise: "+0.1%", score: 1 },
    { name: "Consumer Confidence", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Mar 28, 2026", nextRelease: "Apr 29, 2026", actual: "-14.5", forecast: "-13.0", previous: "-13.6", surprise: "-1.5", score: -1 },
    // INFLATION
    { name: "CPI YoY (HICP)", frequency: "Monthly", category: "INFLATION", lastRelease: "Mar 18, 2026", nextRelease: "Apr 16, 2026", actual: "2.0%", forecast: "2.0%", previous: "2.4%", surprise: "0.0%", score: 0 },
    { name: "PPI YoY", frequency: "Monthly", category: "INFLATION", lastRelease: "Feb 28, 2026", nextRelease: "Mar 31, 2026", actual: "1.2%", forecast: "0.9%", previous: "0.8%", surprise: "+0.3%", score: -1 },
    // JOBS MARKET
    { name: "Employment Change", frequency: "Quarterly", category: "JOBS MARKET", lastRelease: "Jan 30, 2026", nextRelease: "Apr 30, 2026", actual: "0.1%", forecast: "0.1%", previous: "0.2%", surprise: "0.0%", score: 0 },
  ],
  UK: [
    // ECONOMIC GROWTH
    { name: "GDP Growth MoM", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Mar 12, 2026", nextRelease: "Apr 11, 2026", actual: "0.4%", forecast: "0.1%", previous: "0.4%", surprise: "+0.3%", score: 1 },
    { name: "Manufacturing PMI", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Mar 21, 2026", nextRelease: "Apr 22, 2026", actual: "51.9", forecast: "50.8", previous: "50.9", surprise: "+1.1", score: 1 },
    { name: "Services PMI", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Mar 21, 2026", nextRelease: "Apr 22, 2026", actual: "53.2", forecast: "51.0", previous: "51.0", surprise: "+2.2", score: 1 },
    { name: "Retail Sales MoM", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Mar 21, 2026", nextRelease: "Apr 24, 2026", actual: "-0.3%", forecast: "0.0%", previous: "1.7%", surprise: "-0.3%", score: -1 },
    // INFLATION
    { name: "CPI YoY", frequency: "Monthly", category: "INFLATION", lastRelease: "Mar 19, 2026", nextRelease: "Apr 16, 2026", actual: "3.4%", forecast: "3.3%", previous: "3.0%", surprise: "+0.1%", score: 1 },
    { name: "PPI YoY", frequency: "Monthly", category: "INFLATION", lastRelease: "Mar 19, 2026", nextRelease: "Apr 16, 2026", actual: "2.4%", forecast: "2.4%", previous: "2.6%", surprise: "0.0%", score: 0 },
    // JOBS MARKET
    { name: "Unemployment Rate", frequency: "Monthly", category: "JOBS MARKET", lastRelease: "Mar 18, 2026", nextRelease: "Apr 15, 2026", actual: "4.5%", forecast: "4.4%", previous: "4.4%", surprise: "+0.1%", score: -1 },
  ],
  JP: [
    // ECONOMIC GROWTH
    { name: "GDP Growth QoQ", frequency: "Quarterly", category: "ECONOMIC GROWTH", lastRelease: "Mar 10, 2026", nextRelease: "Jun 9, 2026", actual: "-0.4%", forecast: "-0.3%", previous: "0.3%", surprise: "-0.1%", score: -1 },
    { name: "Manufacturing PMI", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Mar 21, 2026", nextRelease: "Apr 22, 2026", actual: "49.0", forecast: "49.5", previous: "48.8", surprise: "-0.5", score: -1 },
    { name: "Services PMI", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Jul 24, 2024", nextRelease: "—", actual: "53.9", forecast: "—", previous: "49.4", surprise: "—", score: 0, stale: true },
    { name: "Retail Sales YoY", frequency: "Monthly", category: "ECONOMIC GROWTH", lastRelease: "Mar 28, 2026", nextRelease: "Apr 28, 2026", actual: "1.4%", forecast: "0.9%", previous: "3.9%", surprise: "+0.5%", score: 1 },
    // INFLATION
    { name: "CPI YoY", frequency: "Monthly", category: "INFLATION", lastRelease: "Mar 21, 2026", nextRelease: "Apr 18, 2026", actual: "3.7%", forecast: "3.8%", previous: "4.0%", surprise: "-0.1%", score: -1 },
    { name: "PPI YoY", frequency: "Monthly", category: "INFLATION", lastRelease: "Mar 12, 2026", nextRelease: "Apr 10, 2026", actual: "4.2%", forecast: "4.1%", previous: "4.2%", surprise: "+0.1%", score: 1 },
    // JOBS MARKET
    { name: "Household Spending", frequency: "Monthly", category: "JOBS MARKET", lastRelease: "Mar 7, 2026", nextRelease: "Apr 7, 2026", actual: "-0.4%", forecast: "0.2%", previous: "2.8%", surprise: "-0.6%", score: -1 },
    { name: "Unemployment Rate", frequency: "Monthly", category: "JOBS MARKET", lastRelease: "Mar 28, 2026", nextRelease: "Apr 25, 2026", actual: "2.4%", forecast: "2.5%", previous: "2.5%", surprise: "-0.1%", score: 1 },
  ],
};
