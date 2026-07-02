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
import type { PublicScorecard } from "@/lib/api/nifty";
import type { OverlayMarker } from "./patternOverlays";

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

interface HistoryChartProps {
  /** Scorecards in ASCENDING date order (oldest → newest). */
  scorecards: PublicScorecard[];
  markers: OverlayMarker[];
  onSelectDate: (date: string) => void;
}

/**
 * 5-band scale zones for the NIFTY net score, mapped to the rating-rule bands
 * (Strong Bearish ≤ −7, Bearish −6..−3, Neutral −2..+2, Bullish +3..+6,
 * Strong Bullish +7..+13). Extended to the actual [min,max] so a deep print
 * still sits inside its zone.
 */
function scaleBands(t: ChartTokens, min: number, max: number) {
  const bands = [
    { y: min, y2: -6, color: t.scale0 },
    { y: -6, y2: -2, color: t.scale1 },
    { y: -2, y2: 3, color: t.scale2 },
    { y: 3, y2: 7, color: t.scale3 },
    { y: 7, y2: max, color: t.scale4 },
  ];
  return bands
    .filter((b) => b.y2 > b.y)
    .map((b) => ({
      y: b.y,
      y2: b.y2,
      fillColor: b.color,
      opacity: 0.06,
      borderColor: "transparent",
    }));
}

/**
 * Data-driven y-domain within the −13..+13 operative range. Always includes 0
 * and keeps the +7 (Strong Bullish) reference readable; pads the data so the
 * line never clips.
 */
function computeDomain(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: -13, max: 13 };
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const pad = Math.max(2, Math.round((hi - lo) * 0.12));
  return { min: Math.max(-13, lo - pad), max: Math.min(13, hi + pad) };
}

export function HistoryChart({ scorecards, markers, onSelectDate }: HistoryChartProps) {
  useApexThemeCss();
  const [tokens] = useState<ChartTokens | null>(() =>
    typeof window === "undefined" ? null : readChartTokens(),
  );

  const categories = useMemo(
    () =>
      scorecards.map((s) => {
        const d = new Date(s.date + "T00:00:00Z");
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
      }),
    [scorecards],
  );

  const { series, options } = useMemo(() => {
    if (!tokens) return { series: [] as ApexOptions["series"], options: {} as ApexOptions };
    const base = baseChartOptions(tokens);

    const nets = scorecards.map((s) => s.net_score);
    const dom = computeDomain(nets);

    // Index scorecards by date for marker placement + click handling.
    const dateToIndex = new Map(scorecards.map((s, i) => [s.date, i]));

    // One annotation point per marker, coloured by pattern. Multiple patterns on
    // the same date stack via small vertical offsets on the label.
    const seenPerDate = new Map<string, number>();
    const pointAnnotations = markers
      .map((m) => {
        const idx = dateToIndex.get(m.date);
        if (idx === undefined) return null;
        const sc = scorecards[idx];
        const stack = seenPerDate.get(m.date) ?? 0;
        seenPerDate.set(m.date, stack + 1);
        return {
          x: categories[idx],
          y: sc.net_score,
          marker: {
            size: 5,
            fillColor: m.color,
            strokeColor: tokens.surface,
            strokeWidth: 2,
            shape: m.kind === "instance" ? ("square" as const) : ("circle" as const),
          },
          label: {
            text: m.short,
            borderWidth: 0,
            offsetY: -8 - stack * 14,
            style: {
              background: "transparent",
              color: m.color,
              fontFamily: tokens.fontMono,
              fontSize: "9px",
            },
          },
        };
      })
      .filter(Boolean) as NonNullable<ApexOptions["annotations"]>["points"];

    const events: ApexOptions["chart"] = {
      events: {
        dataPointSelection: (_e, _ctx, cfg) => {
          const idx = cfg?.dataPointIndex;
          if (typeof idx === "number" && idx >= 0 && scorecards[idx]) {
            onSelectDate(scorecards[idx].date);
          }
        },
        markerClick: (_e, _ctx, cfg) => {
          const idx = cfg?.dataPointIndex;
          if (typeof idx === "number" && idx >= 0 && scorecards[idx]) {
            onSelectDate(scorecards[idx].date);
          }
        },
      },
    };

    return {
      series: [{ name: "Net score", type: "line", data: nets }],
      options: {
        ...base,
        chart: { ...base.chart, ...events, type: "line" },
        xaxis: { ...base.xaxis, categories },
        yaxis: {
          ...(base.yaxis as object),
          min: dom.min,
          max: dom.max,
          tickAmount: Math.min(dom.max - dom.min, 8),
          forceNiceScale: true,
        },
        colors: [tokens.accent],
        stroke: { curve: "smooth", width: 2.5, lineCap: "round" },
        markers: { size: 0, hover: { size: 5 } },
        annotations: {
          yaxis: [
            ...scaleBands(tokens, dom.min, dom.max),
            { y: 0, borderColor: tokens.line2, strokeDashArray: 0 },
          ],
          points: pointAnnotations,
        },
        tooltip: {
          ...base.tooltip,
          intersect: false,
          shared: false,
          custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
            const sc = scorecards[dataPointIndex];
            if (!sc) return "";
            const dayMarkers = markers.filter((m) => m.date === sc.date);
            const patternRows = dayMarkers
              .map((m) => `<div style="color:${m.color};font-size:10px">● ${m.short}</div>`)
              .join("");
            return `
              <div style="padding:8px 10px;font-family:var(--lucid-font-mono)">
                <div style="color:var(--lucid-ink-2);font-size:10px;margin-bottom:2px">${sc.date}</div>
                <div style="color:var(--lucid-ink);font-size:13px;font-weight:600">Net ${sc.net_score >= 0 ? "+" : "−"}${Math.abs(sc.net_score)} · ${sc.band}</div>
                <div style="color:var(--lucid-ink-3);font-size:10px;margin-top:2px">Dom ${sc.domestic_composite >= 0 ? "+" : "−"}${Math.abs(sc.domestic_composite)} · Ext ${sc.external_composite >= 0 ? "+" : "−"}${Math.abs(sc.external_composite)}</div>
                ${patternRows ? `<div style="margin-top:4px;border-top:1px solid var(--lucid-line);padding-top:4px">${patternRows}</div>` : ""}
              </div>`;
          },
        },
      } as ApexOptions,
    };
  }, [tokens, scorecards, categories, markers, onSelectDate]);

  if (!tokens) return <div className="w-full h-full" />;

  return (
    <div className="lt-apex w-full h-full">
      <ReactApexChart options={options} series={series} type="line" height="100%" width="100%" />
    </div>
  );
}
