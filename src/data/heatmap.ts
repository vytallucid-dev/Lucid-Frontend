// Economy metadata for the Oracle heatmap — UI-only constants. Live data
// ships from /api/oracle/heatmap via useHeatmap / getHeatmap.
//
// Issue 2: this list previously had four fixed entries and the backend's
// AUD economy (keyed "AU") had nowhere to render even once the backend
// derivation was correct — the Economy Selector iterates THIS array, not the
// response's own keys. "AU" (not "AUD") matches the backend's economy key —
// see oracle.routes.ts's heatmapEconomyKeyForAsset — which itself matches
// the AU_-prefixed indicator codes; the label spells out "(AUD)" so the
// currency grouping is still obvious.

export type EconomyKey = "US" | "EU" | "UK" | "JP" | "AU";

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
  { key: "AU", label: "Australia (AUD)", flag: "🇦🇺" },
];
