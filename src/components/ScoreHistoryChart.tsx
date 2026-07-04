"use client";

import { weekLabels } from "@/data/scorecard";

interface ScoreHistoryChartProps {
  data: number[];
  width?: number;
  height?: number;
}

export function ScoreHistoryChart({
  data,
  width = 248,
  height = 140,
}: ScoreHistoryChartProps) {
  const padding = { top: 12, right: 8, bottom: 24, left: 28 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Symmetric auto-scale: at least ±8, expanding to fit the data (total scores
  // can reach ±16 — a fixed ±8 window drew large scores outside the chart).
  const bound = Math.max(8, ...data.map((v) => Math.ceil(Math.abs(v))));
  const minY = -bound;
  const maxY = bound;
  const range = maxY - minY;
  const halfTick = Math.ceil(bound / 2);
  const gridValues = [-bound, -halfTick, 0, halfTick, bound];

  const barWidth = Math.max(8, (chartW / data.length) * 0.6);
  const gap = (chartW - barWidth * data.length) / (data.length - 1 || 1);

  function yPos(val: number) {
    return padding.top + chartH - ((val - minY) / range) * chartH;
  }

  const zeroY = yPos(0);
  const thresholdPosY = yPos(3);
  const thresholdNegY = yPos(-3);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
    >
      {/* Grid lines */}
      {gridValues.map((v) => (
        <line
          key={v}
          x1={padding.left}
          x2={width - padding.right}
          y1={yPos(v)}
          y2={yPos(v)}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={1}
        />
      ))}

      {/* Threshold dashed lines at +3 and -3 */}
      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={thresholdPosY}
        y2={thresholdPosY}
        stroke="rgba(205,167,79,0.3)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={thresholdNegY}
        y2={thresholdNegY}
        stroke="rgba(205,167,79,0.3)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />

      {/* Zero line */}
      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={zeroY}
        y2={zeroY}
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={1}
      />

      {/* Y-axis labels */}
      {gridValues.map((v) => (
        <text
          key={v}
          x={padding.left - 4}
          y={yPos(v) + 3}
          textAnchor="end"
          fill="#334155"
          fontSize={9}
          fontFamily="inherit"
        >
          {v > 0 ? `+${v}` : v}
        </text>
      ))}

      {/* Bars */}
      {data.map((val, i) => {
        const x = padding.left + i * (barWidth + gap);
        const isPositive = val >= 0;
        const barH = Math.abs((val / range) * chartH);
        const y = isPositive ? zeroY - barH : zeroY;
        const fill = isPositive
          ? "rgba(16, 185, 129, 0.7)"
          : "rgba(239, 68, 68, 0.7)";

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(1, barH)}
              rx={2}
              fill={fill}
            />
            {/* X-axis labels — show every other */}
            {i % 2 === 0 && (
              <text
                x={x + barWidth / 2}
                y={height - 4}
                textAnchor="middle"
                fill="#334155"
                fontSize={7}
                fontFamily="inherit"
              >
                {weekLabels[i]?.slice(0, 5) ?? ""}
              </text>
            )}
          </g>
        );
      })}

      {/* Line connecting bar tops */}
      <polyline
        points={data
          .map((val, i) => {
            const x = padding.left + i * (barWidth + gap) + barWidth / 2;
            const y = yPos(val);
            return `${x},${y}`;
          })
          .join(" ")}
        fill="none"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1}
      />
    </svg>
  );
}
