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
import { longPctDomain } from "./flowChartHelpers";

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

export type MiniChartSeriesKey = "diiAbsorption" | "fiiLongPct";

interface FlowTrackerMiniChartProps {
  points: FlowTrackerPoint[];
  categories: string[];
  seriesKey: MiniChartSeriesKey;
  onHoverIndex: (index: number | null) => void;
}

/** Small, single-series context chart — DII absorption or Ind13 long%, own canvas/axis. */
export function FlowTrackerMiniChart({ points, categories, seriesKey, onHoverIndex }: FlowTrackerMiniChartProps) {
  useApexThemeCss();
  const [tokens] = useState<ChartTokens | null>(() =>
    typeof window === "undefined" ? null : readChartTokens(),
  );

  const { series, options } = useMemo(() => {
    if (!tokens) return { series: [] as ApexOptions["series"], options: {} as ApexOptions };
    const base = baseChartOptions(tokens);
    const isDii = seriesKey === "diiAbsorption";

    const events: ApexOptions["chart"] = {
      events: {
        mouseMove: (_e, _ctx, cfg) => {
          const idx = cfg?.dataPointIndex;
          onHoverIndex(typeof idx === "number" && idx >= 0 ? idx : null);
        },
        mouseLeave: () => onHoverIndex(null),
      },
    };

    const seriesArr: NonNullable<ApexOptions["series"]> = [
      {
        name: isDii ? "DII absorption (×)" : "FII long %",
        type: "line",
        data: points.map((p, i) => ({ x: categories[i], y: p[seriesKey] })),
      },
    ];

    const yaxis: ApexOptions["yaxis"] = isDii
      ? [
          {
            seriesName: "DII absorption (×)",
            min: 0,
            forceNiceScale: true,
            labels: {
              style: { colors: tokens.warn, fontFamily: tokens.fontMono, fontSize: "10px" },
              formatter: (v: number) => (Number.isFinite(v) ? v.toFixed(1) : ""),
            },
          },
        ]
      : (() => {
          const lsDom = longPctDomain(points.map((p) => p.fiiLongPct ?? NaN));
          return [
            {
              seriesName: "FII long %",
              min: lsDom.min,
              max: lsDom.max,
              forceNiceScale: true,
              labels: {
                style: { colors: tokens.cool, fontFamily: tokens.fontMono, fontSize: "10px" },
                formatter: (v: number) => (Number.isFinite(v) ? `${Math.round(v)}%` : ""),
              },
            },
          ];
        })();

    const ind13Annotations: YAxisAnnotations[] = isDii
      ? []
      : [
          {
            y: IND13_LONG_BULLISH,
            yAxisIndex: 0,
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
            yAxisIndex: 0,
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
        ];

    return {
      series: seriesArr,
      options: {
        ...base,
        chart: { ...base.chart, ...events, type: "line", stacked: false },
        xaxis: { ...base.xaxis, categories },
        yaxis,
        colors: [isDii ? tokens.warn : tokens.cool],
        stroke: { curve: "smooth", width: 2, lineCap: "round" },
        // Skip nulls to leave honest gaps — DII n/a days, Ind13 backfill gaps.
        connectNulls: false,
        markers: { size: 0, hover: { size: 4 } },
        annotations: { yaxis: ind13Annotations },
        tooltip: { ...base.tooltip, shared: true, intersect: false },
      } as ApexOptions,
    };
  }, [tokens, points, categories, seriesKey, onHoverIndex]);

  if (!tokens) return <div className="w-full h-full" />;

  return (
    <div className="lt-apex w-full h-full">
      <ReactApexChart options={options} series={series} type="line" height="100%" width="100%" />
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
