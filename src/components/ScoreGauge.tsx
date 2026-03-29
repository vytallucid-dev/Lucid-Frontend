"use client";

import { useId } from "react";

interface ScoreGaugeProps {
  score: number;
  min?: number;
  max?: number;
  size?: number;
}

export function ScoreGauge({
  score,
  min = -8,
  max = 8,
  size = 220,
}: ScoreGaugeProps) {
  const id = useId().replace(/:/g, "_");
  const cx = size / 2;
  const cy = size / 2 + 4;
  const radius = size / 2 - 24;
  const strokeWidth = 14;

  const startAngle = 240;
  const totalSweep = 240;

  const normalized = Math.max(0, Math.min(1, (score - min) / (max - min)));
  const centerNorm = (0 - min) / (max - min);

  function polarToCartesian(angle: number, r: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function describeArc(
    startDeg: number,
    endDeg: number,
    r: number,
    clockwise = true
  ) {
    const s = polarToCartesian(startDeg, r);
    const e = polarToCartesian(endDeg, r);
    const diff = Math.abs(endDeg - startDeg);
    // Avoid degenerate arcs — if sweep is near-zero, don't draw
    if (diff < 0.5) return "";
    const sweep = diff % 360 || 360;
    const largeArc = sweep > 180 ? 1 : 0;
    const sweepFlag = clockwise ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${e.x} ${e.y}`;
  }

  function angleAt(norm: number) {
    return startAngle + norm * totalSweep;
  }

  // Score color
  const scoreColor =
    score >= 5
      ? "#10B981"
      : score >= 3
        ? "#34D399"
        : score >= -2
          ? "#64748B"
          : score >= -4
            ? "#F87171"
            : "#EF4444";

  const centerAngle = angleAt(centerNorm);
  const scoreAngle = angleAt(normalized);

  const svgH = size * 0.72;

  return (
    <svg
      width={size}
      height={svgH}
      viewBox={`0 0 ${size} ${svgH}`}
      className="mx-auto"
    >
      <defs>
        <filter id={`gg_${id}`}>
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background track */}
      <path
        d={describeArc(startAngle, angleAt(1), radius)}
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth={strokeWidth + 6}
        strokeLinecap="round"
      />

      {/* Active arc from center (0) to score */}
      {score !== 0 && (() => {
        const d =
          score > 0
            ? describeArc(centerAngle, scoreAngle, radius, true)
            : describeArc(scoreAngle, centerAngle, radius, true);
        if (!d) return null;
        return (
          <path
            d={d}
            fill="none"
            stroke={scoreColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={0.85}
            filter={`url(#gg_${id})`}
          />
        );
      })()}

      {/* Center dot for score=0 */}
      {score === 0 && (() => {
        const p = polarToCartesian(centerAngle, radius);
        return (
          <circle cx={p.x} cy={p.y} r={strokeWidth / 2} fill={scoreColor} opacity={0.6} />
        );
      })()}

      {/* Score number centered in gauge */}
      <text
        x={cx}
        y={cy - 16}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={scoreColor}
        fontSize={36}
        fontWeight={700}
        fontFamily="inherit"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {score > 0 ? `+${score}` : `${score}`}
      </text>
    </svg>
  );
}
