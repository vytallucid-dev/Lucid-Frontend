"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import {
  readChartTokens,
  baseChartOptions,
  APEX_THEME_CSS,
  type ChartTokens,
} from "@/components/oracle-tools/chartTheme";
import {
  IND13_LONG_BULLISH,
  IND13_LONG_BEARISH,
  type FlowTrackerPoint,
} from "./flowTrackerData";

// ApexCharts touches `window` → never server-render it.
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

export type FlowChartType = "bar" | "line";

interface FlowTrackerChartProps {
  points: FlowTrackerPoint[];
  chartType: FlowChartType;
  /** Which of the three overlays are visible. FII flow is always the primary. */
  showDii: boolean;
  showInd13: boolean;
  onHoverIndex: (index: number | null) => void;
}

/** Data-driven symmetric-ish domain around 0 for the signed FII flow series. */
function fiiDomain(values: number[]): { min: number; max: number } | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;
  let lo = Math.min(...finite, 0);
  let hi = Math.max(...finite, 0);
  const range = hi - lo || Math.abs(hi) || 1;
  const pad = Math.max(range * 0.12, 1);
  lo -= pad;
  hi += pad;
  return { min: Math.floor(lo), max: Math.ceil(hi) };
}

/**
 * Ind 13 long% domain. Always keep the 40/50 band lines in view and give
 * headroom, but never hardcode a cap — expand to fit the actual data if it
 * strays outside the usual 35–65 window.
 */
function longPctDomain(values: number[]): { min: number; max: number } {
  const finite = values.filter((v) => Number.isFinite(v));
  let lo = 35;
  let hi = 65;
  if (finite.length > 0) {
    lo = Math.min(lo, ...finite);
    hi = Math.max(hi, ...finite);
  }
  // Keep both band thresholds comfortably inside the view.
  lo = Math.min(lo, IND13_LONG_BEARISH - 3);
  hi = Math.max(hi, IND13_LONG_BULLISH + 3);
  const pad = Math.max((hi - lo) * 0.08, 1);
  return { min: Math.max(0, Math.floor(lo - pad)), max: Math.min(100, Math.ceil(hi + pad)) };
}

export function FlowTrackerChart({
  points,
  chartType,
  showDii,
  showInd13,
  onHoverIndex,
}: FlowTrackerChartProps) {
  useApexThemeCss();
  const [tokens] = useState<ChartTokens | null>(() =>
    typeof window === "undefined" ? null : readChartTokens(),
  );

  const categories = useMemo(
    () =>
      points.map((p) => {
        // "12 Mar" style short label
        const d = new Date(p.date + "T00:00:00Z");
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
      }),
    [points],
  );

  const { series, options } = useMemo(() => {
    if (!tokens) return { series: [] as ApexOptions["series"], options: {} as ApexOptions };
    const base = baseChartOptions(tokens);

    const events: ApexOptions["chart"] = {
      events: {
        mouseMove: (_e, _ctx, cfg) => {
          const idx = cfg?.dataPointIndex;
          onHoverIndex(typeof idx === "number" && idx >= 0 ? idx : null);
        },
        mouseLeave: () => onHoverIndex(null),
      },
    };

    // ── FII flow (primary, y-axis 0) — signed bars coloured by inflow/outflow ──
    const fiiColored = points.map((p, i) => ({
      x: categories[i],
      y: p.fiiFlow,
      fillColor:
        p.fiiFlow == null ? tokens.ink3 : p.fiiFlow >= 0 ? tokens.pos : tokens.neg,
    }));

    const seriesArr: NonNullable<ApexOptions["series"]> = [
      {
        name: "FII net flow (₹ cr)",
        type: chartType === "bar" ? "column" : "line",
        data: fiiColored,
      },
    ];

    // ── DII absorption (overlay, y-axis 1) — ONLY on FII-selling days ──
    // Nulls (FII-buyer days) render as line gaps, never zero.
    if (showDii) {
      seriesArr.push({
        name: "DII absorption (×)",
        type: "line",
        data: points.map((p, i) => ({ x: categories[i], y: p.diiAbsorption })),
      });
    }

    // ── Ind 13 long% (overlay, y-axis 2) — positioning line with 40/50 bands ──
    if (showInd13) {
      seriesArr.push({
        name: "FII long %",
        type: "line",
        data: points.map((p, i) => ({ x: categories[i], y: p.fiiLongPct })),
      });
    }

    const fiiDom = fiiDomain(points.map((p) => p.fiiFlow ?? NaN));
    const lsDom = longPctDomain(points.map((p) => p.fiiLongPct ?? NaN));

    // Multi-axis: FII flow on the left; DII + Ind13 as opposite/hidden axes so
    // their scales don't distort the primary bars.
    const yaxis: ApexOptions["yaxis"] = [
      {
        seriesName: "FII net flow (₹ cr)",
        ...(fiiDom ? { min: fiiDom.min, max: fiiDom.max } : {}),
        forceNiceScale: true,
        tickAmount: 5,
        labels: {
          style: { colors: tokens.ink3, fontFamily: tokens.fontMono, fontSize: "11px" },
          formatter: (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString("en-IN") : ""),
        },
        title: { text: "₹ crore", style: { color: tokens.ink3, fontFamily: tokens.fontMono, fontSize: "10px" } },
      },
    ];
    if (showDii) {
      yaxis.push({
        seriesName: "DII absorption (×)",
        opposite: true,
        min: 0,
        forceNiceScale: true,
        labels: {
          style: { colors: tokens.warn, fontFamily: tokens.fontMono, fontSize: "10px" },
          formatter: (v: number) => (Number.isFinite(v) ? v.toFixed(1) : ""),
        },
      });
    }
    if (showInd13) {
      yaxis.push({
        seriesName: "FII long %",
        opposite: true,
        min: lsDom.min,
        max: lsDom.max,
        forceNiceScale: true,
        labels: {
          style: { colors: tokens.cool, fontFamily: tokens.fontMono, fontSize: "10px" },
          formatter: (v: number) => (Number.isFinite(v) ? `${Math.round(v)}%` : ""),
        },
      });
    }

    // Colours in series order: FII (per-bar via fillColor, needs a base), DII warn, Ind13 cool.
    const colors: string[] = [tokens.accent];
    if (showDii) colors.push(tokens.warn);
    if (showInd13) colors.push(tokens.cool);

    // Stroke widths per series: FII line thin (bars ignore it), overlays 2.
    const strokeWidths: number[] = [chartType === "bar" ? 0 : 2.5];
    if (showDii) strokeWidths.push(2);
    if (showInd13) strokeWidths.push(2);

    // Ind 13 band lines (40 / 50) drawn on its own axis.
    const ind13Annotations: YAxisAnnotations[] = showInd13
      ? [
          {
            y: IND13_LONG_BULLISH,
            yAxisIndex: showDii ? 2 : 1,
            borderColor: tokens.cool,
            strokeDashArray: 4,
            opacity: 0.5,
            label: {
              text: `long ${IND13_LONG_BULLISH}%`,
              position: "left",
              borderWidth: 0,
              style: { background: "transparent", color: tokens.cool, fontFamily: tokens.fontMono, fontSize: "9px" },
            },
          },
          {
            y: IND13_LONG_BEARISH,
            yAxisIndex: showDii ? 2 : 1,
            borderColor: tokens.cool,
            strokeDashArray: 4,
            opacity: 0.35,
            label: {
              text: `long ${IND13_LONG_BEARISH}%`,
              position: "left",
              borderWidth: 0,
              style: { background: "transparent", color: tokens.cool, fontFamily: tokens.fontMono, fontSize: "9px" },
            },
          },
        ]
      : [];

    return {
      series: seriesArr,
      options: {
        ...base,
        chart: { ...base.chart, ...events, type: chartType === "bar" ? "bar" : "line", stacked: false },
        xaxis: { ...base.xaxis, categories },
        yaxis,
        colors,
        stroke: { curve: "smooth", width: strokeWidths, lineCap: "round" },
        // Overlay lines must skip nulls to leave honest gaps.
        plotOptions: { bar: { columnWidth: "62%", borderRadius: 2 } },
        fill: { type: "solid", opacity: chartType === "bar" ? 0.9 : 1 },
        markers: { size: 0, hover: { size: 5 } },
        annotations: {
          yaxis: [
            { y: 0, yAxisIndex: 0, borderColor: tokens.line2, strokeDashArray: 0 },
            ...ind13Annotations,
          ],
        },
        tooltip: { ...base.tooltip, shared: true, intersect: false },
      } as ApexOptions,
    };
  }, [tokens, points, categories, chartType, showDii, showInd13, onHoverIndex]);

  if (!tokens) return <div className="w-full h-full" />;

  return (
    <div className="lt-apex w-full h-full">
      <ReactApexChart
        options={options}
        series={series}
        type={chartType === "bar" ? "bar" : "line"}
        height="100%"
        width="100%"
      />
    </div>
  );
}

// Local structural type for the yaxis annotation objects (apexcharts' exported
// type is loose; this keeps the array well-typed without an `any`).
interface YAxisAnnotations {
  y: number;
  yAxisIndex?: number;
  borderColor: string;
  strokeDashArray?: number;
  opacity?: number;
  label?: {
    text: string;
    position?: "left" | "right";
    borderWidth?: number;
    style?: { background?: string; color?: string; fontFamily?: string; fontSize?: string };
  };
}
