// ─── Oracle Tools — shared ApexCharts theme ─────────────────────────────────
//
// ApexCharts is styled through a JS options object, not CSS. This helper reads
// the real --lucid-* token values off :root (getComputedStyle) so every chart
// uses the warm editorial palette — no hardcoded hex, no leftover ApexCharts
// demo look. One base config, reused by all tools; per-tool builders extend it.

import type { ApexOptions } from "apexcharts";

export interface ChartTokens {
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  line2: string;
  surface: string;
  surface2: string;
  surface3: string;
  accent: string;
  cool: string;
  pos: string;
  neg: string;
  warn: string;
  scale0: string;
  scale1: string;
  scale2: string;
  scale3: string;
  scale4: string;
  fontSans: string;
  fontSerif: string;
  fontMono: string;
}

// Fallbacks mirror lucid-theme.css so charts still render if getComputedStyle
// runs before styles resolve (SSR guard already prevents server use).
const FALLBACK: ChartTokens = {
  ink: "#f1efe9",
  ink2: "#9b9c9c",
  ink3: "#62646c",
  line: "rgba(255,255,255,0.06)",
  line2: "rgba(255,255,255,0.10)",
  surface: "#111319",
  surface2: "#171a20",
  surface3: "#20242c",
  accent: "#cda74f",
  cool: "#4ea1e6",
  pos: "#48ba7c",
  neg: "#e2584d",
  warn: "#e0a13e",
  scale0: "#e2584d",
  scale1: "#e0913f",
  scale2: "#cda74f",
  scale3: "#48ba7c",
  scale4: "#4ea1e6",
  fontSans: "var(--font-inter), sans-serif",
  fontSerif: "var(--font-space-grotesk), sans-serif",
  fontMono: "var(--font-plex-mono), monospace",
};

/** Reads the live theme tokens off :root. Browser-only. */
export function readChartTokens(): ChartTokens {
  if (typeof window === "undefined") return FALLBACK;
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => {
    const val = s.getPropertyValue(name).trim();
    return val || fallback;
  };
  return {
    ink: v("--lucid-ink", FALLBACK.ink),
    ink2: v("--lucid-ink-2", FALLBACK.ink2),
    ink3: v("--lucid-ink-3", FALLBACK.ink3),
    line: v("--lucid-line", FALLBACK.line),
    line2: v("--lucid-line-2", FALLBACK.line2),
    surface: v("--lucid-surface", FALLBACK.surface),
    surface2: v("--lucid-surface-2", FALLBACK.surface2),
    surface3: v("--lucid-surface-3", FALLBACK.surface3),
    accent: v("--lucid-accent", FALLBACK.accent),
    cool: v("--lucid-cool", FALLBACK.cool),
    pos: v("--lucid-pos", FALLBACK.pos),
    neg: v("--lucid-neg", FALLBACK.neg),
    warn: v("--lucid-warn", FALLBACK.warn),
    scale0: v("--lucid-scale-0", FALLBACK.scale0),
    scale1: v("--lucid-scale-1", FALLBACK.scale1),
    scale2: v("--lucid-scale-2", FALLBACK.scale2),
    scale3: v("--lucid-scale-3", FALLBACK.scale3),
    scale4: v("--lucid-scale-4", FALLBACK.scale4),
    fontSans: v("--lucid-font-sans", FALLBACK.fontSans),
    fontSerif: v("--lucid-font-serif", FALLBACK.fontSerif),
    fontMono: v("--lucid-font-mono", FALLBACK.fontMono),
  };
}

/**
 * Base ApexCharts options with every default stripped and restyled to the theme:
 * no toolbar, our fonts, hairline gridlines, ink-3 axis text, surface tooltip.
 * Per-tool builders spread this and add series/annotations/type.
 */
export function baseChartOptions(t: ChartTokens): ApexOptions {
  return {
    chart: {
      type: "line",
      background: "transparent",
      fontFamily: t.fontMono,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: {
        enabled: true,
        speed: 260,
        animateGradually: { enabled: false, delay: 0 },
        dynamicAnimation: { enabled: true, speed: 260 },
      },
      parentHeightOffset: 0,
      redrawOnParentResize: true,
    },
    theme: { mode: "dark" },
    grid: {
      borderColor: t.line,
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { top: 8, right: 16, bottom: 0, left: 8 },
    },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 2.5, lineCap: "round" },
    xaxis: {
      axisBorder: { show: true, color: t.line2 },
      axisTicks: { show: false },
      labels: {
        style: { colors: t.ink3, fontFamily: t.fontMono, fontSize: "11px" },
        rotate: 0,
        hideOverlappingLabels: true,
      },
      crosshairs: {
        show: true,
        stroke: { color: t.line2, width: 1, dashArray: 3 },
      },
      tooltip: { enabled: false },
    },
    yaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: t.ink3, fontFamily: t.fontMono, fontSize: "11px" },
      },
    },
    legend: {
      show: false,
    },
    tooltip: {
      enabled: true,
      theme: "dark",
      style: { fontFamily: t.fontMono, fontSize: "12px" },
      x: { show: true },
      // Actual tooltip surface styling is done in CSS via .apexcharts-tooltip
      // overrides (chartTooltipCss) since Apex hardcodes some inline styles.
    },
    states: {
      hover: { filter: { type: "lighten" } },
      active: { filter: { type: "none" } },
    },
  };
}

/**
 * CSS injected once to override the few ApexCharts inline/hardcoded styles the
 * options object can't reach (tooltip surface, crosshair, selection). Scoped to
 * .lt-apex so it never bleeds into other charts elsewhere in the app.
 */
export const APEX_THEME_CSS = `
.lt-apex .apexcharts-tooltip {
  background: var(--lucid-surface-2) !important;
  border: 1px solid var(--lucid-line-2) !important;
  box-shadow: none !important;
  color: var(--lucid-ink) !important;
  font-family: var(--lucid-font-mono) !important;
}
.lt-apex .apexcharts-tooltip-title {
  background: var(--lucid-surface-3) !important;
  border-bottom: 1px solid var(--lucid-line) !important;
  font-family: var(--lucid-font-serif) !important;
  color: var(--lucid-ink-2) !important;
}
.lt-apex .apexcharts-xaxistooltip,
.lt-apex .apexcharts-yaxistooltip {
  background: var(--lucid-surface-2) !important;
  border: 1px solid var(--lucid-line-2) !important;
  color: var(--lucid-ink-2) !important;
}
.lt-apex .apexcharts-xaxistooltip::before,
.lt-apex .apexcharts-xaxistooltip::after { border-bottom-color: var(--lucid-line-2) !important; }
.lt-apex .apexcharts-gridline { stroke: var(--lucid-line); }
.lt-apex .apexcharts-text tspan { font-family: var(--lucid-font-mono); }
`;
