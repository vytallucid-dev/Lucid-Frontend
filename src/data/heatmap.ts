// Economy metadata for the Oracle heatmap — UI-only constants. Live data
// ships from /api/oracle/heatmap via useHeatmap / getHeatmap.

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
