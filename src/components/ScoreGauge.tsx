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
  const cy = size / 2;
  const radius = size / 2 - 28;
  const strokeWidth = 14;

  // Arc geometry: 240° sweep, opening at the bottom
  // -8 at bottom-left, 0 at top center, +8 at bottom-right
  const sweepDeg = 240;
  const gapDeg = 360 - sweepDeg; // 120° gap at bottom
  // Arc starts at 150° in standard SVG angle (bottom-left) going clockwise to 30° (bottom-right)
  // In our coordinate system: start = 150°, end = 390° (150 + 240)

  const totalArcLength = 2 * Math.PI * radius * (sweepDeg / 360);
  const halfArcLength = totalArcLength / 2;

  // Normalized score position: 0 = min (-8), 0.5 = center (0), 1 = max (+8)
  const normalized = Math.max(0, Math.min(1, (score - min) / (max - min)));

  // The fill arc length from center (0.5) to score position
  const fillFraction = Math.abs(normalized - 0.5);
  const fillLength = fillFraction * 2 * halfArcLength;

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

  // Build the full arc path (single arc from start to end, always the same)
  function toRad(deg: number) {
    return (deg * Math.PI) / 180;
  }

  // SVG angles: 0° = right, 90° = down, 180° = left, 270° = up
  // We want the arc to start at bottom-left (150°) and go clockwise 240° to bottom-right (30° = 390°)
  const arcStartDeg = 150; // bottom-left in SVG coords
  const arcEndDeg = arcStartDeg + sweepDeg; // 390° = 30°

  const sx = cx + radius * Math.cos(toRad(arcStartDeg));
  const sy = cy + radius * Math.sin(toRad(arcStartDeg));
  const ex = cx + radius * Math.cos(toRad(arcEndDeg));
  const ey = cy + radius * Math.sin(toRad(arcEndDeg));

  const arcPath = `M ${sx} ${sy} A ${radius} ${radius} 0 1 1 ${ex} ${ey}`;

  // For filling from center outward:
  // The path starts at -8 (left). Center (0) is at halfArcLength along the path.
  // For positive scores: fill from halfArcLength going forward (rightward)
  // For negative scores: fill from (halfArcLength - fillLength) going forward to halfArcLength

  let dashArray: string;
  let dashOffset: number;

  if (score === 0) {
    // No fill — just show background + number
    dashArray = `0 ${totalArcLength}`;
    dashOffset = 0;
  } else if (score > 0) {
    // Fill starts at center, extends right
    dashArray = `${fillLength} ${totalArcLength}`;
    dashOffset = -halfArcLength; // negative offset = shift pattern forward (start at center)
  } else {
    // Fill from left of center to center
    // Start the dash at (halfArcLength - fillLength), length = fillLength
    dashArray = `${fillLength} ${totalArcLength}`;
    dashOffset = -(halfArcLength - fillLength);
  }

  const svgH = size * 0.78;

  return (
    <svg
      width={size}
      height={svgH}
      viewBox={`0 0 ${size} ${svgH}`}
      className="mx-auto"
      overflow="visible"
    >
      <defs>
        <filter id={`glow_${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background track */}
      <path
        d={arcPath}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth + 4}
        strokeLinecap="round"
      />

      {/* Active fill arc */}
      {score !== 0 && (
        <path
          d={arcPath}
          fill="none"
          stroke={scoreColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
          opacity={0.9}
          filter={`url(#glow_${id})`}
        />
      )}

      {/* Score number centered */}
      <text
        x={cx}
        y={cy - 10}
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
