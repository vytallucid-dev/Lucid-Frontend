"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { readChartTokens, baseChartOptions, APEX_THEME_CSS, type ChartTokens } from "../shared/chartTheme";
import type { AnalysisSubject, ChartType, ChartKind } from "./types";

// ApexCharts touches `window` → must never be server-rendered. Dynamic import
// with ssr:false keeps it fully client-side.
const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <div className="w-full h-full" />,
});

let cssInjected = false;
function useApexThemeCss() {
  useEffect(() => {
    if (cssInjected || typeof document === "undefined") return;
    const el = document.createElement("style");
    el.setAttribute("data-lt-apex", "");
    el.textContent = APEX_THEME_CSS;
    document.head.appendChild(el);
    cssInjected = true;
  }, []);
}

interface AnalysisChartProps {
  subject: AnalysisSubject;
  compareSubject: AnalysisSubject | null;
  chartKind: ChartKind;
  chartType: ChartType;
  yDomain: [number, number] | "auto";
  showBands: boolean;
  /** Called with the point index the cursor is over (null when the cursor leaves). */
  onHoverIndex: (index: number | null) => void;
}

/** Faint 5-band scale zones behind a score series. */
/**
 * 5-band scale zones, extended to cover the full dynamic [min,max] domain so a
 * +12 score still sits inside the "strong bullish" zone (bands don't stop at ±8).
 */
function scaleBands(t: ChartTokens, min: number, max: number) {
  const bands = [
    { y: min, y2: -4, color: t.scale0 }, // strong bearish — extends to domain floor
    { y: -4, y2: -2, color: t.scale1 },
    { y: -2, y2: 3, color: t.scale2 },
    { y: 3, y2: 5, color: t.scale3 },
    { y: 5, y2: max, color: t.scale4 }, // strong bullish — extends to domain ceiling
  ];
  return bands
    .filter((b) => b.y2 > b.y) // drop inverted bands if the domain is tight
    .map((b) => ({ y: b.y, y2: b.y2, fillColor: b.color, opacity: 0.07, borderColor: "transparent" }));
}

/** Collects finite numbers from one or more series. */
function collectValues(...lists: (number | null | undefined)[][]): number[] {
  const out: number[] = [];
  for (const list of lists) for (const v of list) if (typeof v === "number" && isFinite(v)) out.push(v);
  return out;
}

/**
 * Data-driven y-domain. `mode`:
 * - "score": always include 0, pad ~15% of range (min 2) each side — a +12 gets headroom.
 * - "indicator": pad ~65% of range so the series occupies ~⅓–½ height; min clamped to 0
 *   when all values are ≥ 0 (CPI/PMI etc. read against a 0 baseline).
 * - "cot": symmetric-ish around the data with ~15% pad; includes 0.
 */
function computeDomain(values: number[], mode: "score" | "indicator" | "cot"): { min: number; max: number } | null {
  if (values.length === 0) return null;
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const range = hi - lo || Math.abs(hi) || 1;

  if (mode === "score") {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
    const pad = Math.max(2, range * 0.15);
    return { min: Math.floor(lo - pad), max: Math.ceil(hi + pad) };
  }
  if (mode === "indicator") {
    const headroom = Math.max(range * 0.65, range === 0 ? Math.abs(hi) * 0.5 || 1 : 0);
    const allNonNeg = lo >= 0;
    const min = allNonNeg ? 0 : lo - headroom;
    return { min, max: hi + headroom };
  }
  // cot
  lo = Math.min(lo, 0);
  hi = Math.max(hi, 0);
  const pad = Math.max(range * 0.15, 1);
  return { min: lo - pad, max: hi + pad };
}

export function AnalysisChart({
  subject,
  compareSubject,
  chartKind,
  chartType,
  yDomain,
  showBands,
  onHoverIndex,
}: AnalysisChartProps) {
  useApexThemeCss();
  // This component is dynamically imported ssr:false, so it only renders on the
  // client — reading theme tokens in a lazy initializer is safe (DOM is present).
  const [tokens] = useState<ChartTokens | null>(() =>
    typeof window === "undefined" ? null : readChartTokens(),
  );
  const hoverRef = useRef(onHoverIndex);
  useEffect(() => {
    hoverRef.current = onHoverIndex;
  }, [onHoverIndex]);

  const categories = useMemo(() => subject.points.map((p) => p.label), [subject.points]);

  const { series, options } = useMemo(() => {
    if (!tokens) return { series: [], options: {} as ApexOptions };
    const base = baseChartOptions(tokens);

    // Shared hover wiring: crosshair position → rail index.
    const events: ApexOptions["chart"] = {
      events: {
        mouseMove: (_e, _ctx, cfg) => {
          const idx = cfg?.dataPointIndex;
          hoverRef.current(typeof idx === "number" && idx >= 0 ? idx : null);
        },
        mouseLeave: () => hoverRef.current(null),
      },
    };

    const commonX: ApexOptions["xaxis"] = {
      ...base.xaxis,
      categories,
    };

    // Build a data-driven y-axis from a computed domain (falls back to Apex auto).
    const yFromDomain = (dom: { min: number; max: number } | null): ApexOptions["yaxis"] =>
      dom
        ? { ...(base.yaxis as object), min: dom.min, max: dom.max, tickAmount: 5, forceNiceScale: true }
        : (base.yaxis as ApexOptions["yaxis"]);

    // ── Indicator Trend: bar (actual) + forecast RED line with RED dots ──
    if (chartKind === "indicator") {
      // Per-bar colour = surprise sign (actual vs forecast).
      const coloredActual = subject.points.map((p, i) => ({
        x: categories[i],
        y: p.value,
        fillColor:
          p.secondary == null || p.value == null
            ? tokens.ink3
            : p.value > p.secondary
              ? tokens.pos
              : p.value < p.secondary
                ? tokens.neg
                : tokens.scale2,
      }));
      const forecast = subject.points.map((p, i) => ({ x: categories[i], y: p.secondary ?? null }));
      const dom = computeDomain(
        collectValues(subject.points.map((p) => p.value), subject.points.map((p) => p.secondary)),
        "indicator",
      );
      return {
        series: [
          { name: "Actual", type: "column", data: coloredActual },
          { name: subject.secondaryLabel ?? "Forecast", type: "line", data: forecast },
        ],
        options: {
          ...base,
          chart: { ...base.chart, ...events, type: "line" },
          xaxis: commonX,
          yaxis: yFromDomain(dom),
          // Forecast: solid RED line (--lucid-neg) + a RED dot on every point,
          // sitting over each actual bar so the beat/miss gap is instant.
          stroke: { curve: "straight", width: [0, 2], lineCap: "round" },
          plotOptions: { bar: { columnWidth: "55%", borderRadius: 2 } },
          colors: [tokens.ink3, tokens.neg],
          markers: {
            size: [0, 5],
            colors: [tokens.neg],
            strokeColors: tokens.surface,
            strokeWidth: 2,
            hover: { size: 6 },
          },
          tooltip: { ...base.tooltip, shared: true, intersect: false },
        } as ApexOptions,
      };
    }

    // ── COT Trajectory: NET POSITION (contracts) primary + extreme annotations ──
    if (chartKind === "cot") {
      const net = subject.points.map((p) => p.value);
      const extremes = subject.points
        .map((p, i) =>
          p.event?.kind === "extreme-high" || p.event?.kind === "extreme-low"
            ? { i, kind: p.event.kind, y: p.value }
            : null,
        )
        .filter(Boolean) as { i: number; kind: string; y: number | null }[];
      const dom = computeDomain(collectValues(net), "cot");
      return {
        series: [{ name: "Net Position", type: chartType === "bar" ? "column" : "area", data: net }],
        options: {
          ...base,
          chart: { ...base.chart, ...events, type: chartType === "bar" ? "bar" : "area" },
          xaxis: commonX,
          yaxis: yFromDomain(dom),
          colors: [tokens.accent],
          stroke: { curve: "smooth", width: chartType === "bar" ? 0 : 2.5, lineCap: "round" },
          fill:
            chartType === "bar"
              ? { type: "solid", opacity: 0.9 }
              : { type: "gradient", gradient: { shadeIntensity: 0.2, opacityFrom: 0.28, opacityTo: 0.02, stops: [0, 100] } },
          plotOptions: { bar: { columnWidth: "60%", borderRadius: 2 } },
          annotations: {
            yaxis: [{ y: 0, borderColor: tokens.line2, strokeDashArray: 0 }],
            points: extremes.map((e) => ({
              x: categories[e.i],
              y: e.y ?? 0,
              marker: {
                size: 5,
                fillColor: e.kind === "extreme-high" ? tokens.pos : tokens.neg,
                strokeColor: tokens.surface,
                strokeWidth: 2,
              },
              label: {
                text: e.kind === "extreme-high" ? "Most long" : "Most short",
                borderWidth: 0,
                offsetY: e.kind === "extreme-high" ? -6 : 18,
                style: {
                  background: "transparent",
                  color: e.kind === "extreme-high" ? tokens.pos : tokens.neg,
                  fontFamily: tokens.fontMono,
                  fontSize: "10px",
                },
              },
            })),
          },
          tooltip: { ...base.tooltip, intersect: false, shared: false },
        } as ApexOptions,
      };
    }

    // ── Score Trend / Comparison / COT Comparison (chartKind "comparison") ──
    const primary = subject.points.map((p) => p.value);
    const seriesArr: { name: string; type: string; data: (number | null)[] }[] = [
      { name: subject.name, type: chartType === "bar" ? "column" : "line", data: primary },
    ];
    if (compareSubject) {
      const cmp = categories.map((_, i) => compareSubject.points[i]?.value ?? null);
      seriesArr.push({ name: compareSubject.name, type: chartType === "bar" ? "column" : "line", data: cmp });
    }

    // Score charts include 0 + band scale; comparison of COT nets uses cot domain.
    const domainMode = chartKind === "comparison" && yDomain === "auto" ? "cot" : "score";
    const dom = computeDomain(
      collectValues(primary, compareSubject ? compareSubject.points.map((p) => p.value) : []),
      domainMode,
    );
    const scoreScaled = domainMode === "score";

    const flips = subject.points
      .map((p, i) => (p.event?.kind === "flip-up" || p.event?.kind === "flip-down" ? { i, kind: p.event.kind, y: p.value } : null))
      .filter(Boolean) as { i: number; kind: string; y: number | null }[];

    return {
      series: seriesArr,
      options: {
        ...base,
        chart: { ...base.chart, ...events, type: chartType === "bar" ? "bar" : "line" },
        xaxis: commonX,
        yaxis: yFromDomain(dom),
        colors: compareSubject ? [tokens.accent, tokens.cool] : [tokens.accent],
        stroke: { curve: "smooth", width: chartType === "bar" ? 0 : 2.5, lineCap: "round" },
        plotOptions: { bar: { columnWidth: "55%", borderRadius: 2 } },
        fill: { type: "solid", opacity: chartType === "bar" ? 0.9 : 1 },
        annotations: {
          // Bands only make sense on the score scale; extend to the computed domain.
          yaxis:
            showBands && scoreScaled && dom
              ? scaleBands(tokens, dom.min, dom.max)
              : [{ y: 0, borderColor: tokens.line2 }],
          points: compareSubject
            ? []
            : flips.map((f) => ({
                x: categories[f.i],
                y: f.y ?? 0,
                marker: {
                  size: 4,
                  fillColor: f.kind === "flip-up" ? tokens.pos : tokens.neg,
                  strokeColor: tokens.surface,
                  strokeWidth: 2,
                },
              })),
        },
        tooltip: { ...base.tooltip, shared: !!compareSubject, intersect: false },
      } as ApexOptions,
    };
  }, [tokens, subject, compareSubject, chartKind, chartType, categories, yDomain, showBands]);

  // Apex `type` prop: indicator is always a mixed line+column chart; others
  // follow the bar/line toggle (COT uses area for line).
  const apexType: "line" | "bar" | "area" =
    chartKind === "indicator" ? "line" : chartType === "bar" ? "bar" : chartKind === "cot" ? "area" : "line";

  if (!tokens) return <div className="w-full h-full" />;

  return (
    <div className="lt-apex w-full h-full">
      <ReactApexChart options={options} series={series as ApexOptions["series"]} type={apexType} height="100%" width="100%" />
    </div>
  );
}
