"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import {
  readChartTokens,
  baseChartOptions,
  APEX_THEME_CSS,
  type ChartTokens,
} from "@/components/shared/chartTheme";
import { type FlowTrackerPoint } from "./flowTrackerData";
import { flowChartCategories, fiiDomain } from "./flowChartHelpers";

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
  onHoverIndex: (index: number | null) => void;
}

/** Primary, standalone FII net-flow chart — the sole readable signal on this canvas. */
export function FlowTrackerChart({ points, chartType, onHoverIndex }: FlowTrackerChartProps) {
  useApexThemeCss();
  const [tokens] = useState<ChartTokens | null>(() =>
    typeof window === "undefined" ? null : readChartTokens(),
  );

  const categories = useMemo(() => flowChartCategories(points), [points]);

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

    // FII flow — signed bars/line coloured by inflow/outflow.
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

    const fiiDom = fiiDomain(points.map((p) => p.fiiFlow ?? NaN));

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

    return {
      series: seriesArr,
      options: {
        ...base,
        chart: { ...base.chart, ...events, type: chartType === "bar" ? "bar" : "line", stacked: false },
        xaxis: { ...base.xaxis, categories },
        yaxis,
        colors: [tokens.accent],
        stroke: { curve: "smooth", width: [chartType === "bar" ? 0 : 2.5], lineCap: "round" },
        // Skip nulls to leave honest gaps — never bridge across a missing reading.
        connectNulls: false,
        plotOptions: { bar: { columnWidth: "62%", borderRadius: 2 } },
        fill: { type: "solid", opacity: chartType === "bar" ? 0.9 : 1 },
        markers: { size: 0, hover: { size: 5 } },
        annotations: {
          yaxis: [{ y: 0, yAxisIndex: 0, borderColor: tokens.line2, strokeDashArray: 0 }],
        },
        tooltip: { ...base.tooltip, shared: true, intersect: false },
      } as ApexOptions,
    };
  }, [tokens, points, categories, chartType, onHoverIndex]);

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
