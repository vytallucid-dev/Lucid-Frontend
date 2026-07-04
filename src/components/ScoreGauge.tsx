"use client";

import { useId } from "react";
import { useAnimatedValue } from "@/components/motion";

interface ScoreGaugeProps {
  score: number;
  min?: number;
  max?: number;
  size?: number;
}

/** Score → theme color (warm scale: red → light red → gold → light green → green). */
function gaugeColor(score: number): string {
  if (score >= 5) return "#48ba7c";
  if (score >= 3) return "#71c795";
  if (score >= -2) return "#cda74f";
  if (score >= -4) return "#e87c72";
  return "#e2584d";
}

export function ScoreGauge({
  score,
  // Full scale of a total score: 14 fundamental indicators at ±1 each plus a
  // COT score of ±2 → ±16. (The old ±8 default silently pinned larger scores.)
  min = -16,
  max = 16,
  size = 220,
}: ScoreGaugeProps) {
  const id = useId().replace(/:/g, "_");
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 28;
  const strokeWidth = 14;

  // Symmetric scale bound — extends automatically if a score ever exceeds the
  // configured range, so the needle can never pin against a stale ceiling.
  const bound = Math.max(Math.abs(min), Math.abs(max), Math.ceil(Math.abs(score)));
  const lo = -bound;
  const hi = bound;

  // Animated score — sweeps from 0 on mount, and from the previous score when
  // the asset changes, so the gauge visibly "measures" instead of jumping.
  const animated = useAnimatedValue(score, 1200);
  const shown = Math.max(lo, Math.min(hi, animated));

  // Arc geometry: 240° sweep, opening at the bottom
  // lo at bottom-left, 0 at top center, hi at bottom-right
  const sweepDeg = 240;

  const totalArcLength = 2 * Math.PI * radius * (sweepDeg / 360);
  const halfArcLength = totalArcLength / 2;

  // Normalized score position: 0 = lo, 0.5 = center (0), 1 = hi
  const normalized = Math.max(0, Math.min(1, (shown - lo) / (hi - lo)));

  // The fill arc length from center (0.5) to score position
  const fillFraction = Math.abs(normalized - 0.5);
  const fillLength = fillFraction * 2 * halfArcLength;

  // Color follows the animated value, so a big retarget sweeps through tiers.
  const scoreColor = gaugeColor(shown);
  const displayScore = Math.round(shown);

  // Build the full arc path (single arc from start to end, always the same)
  function toRad(deg: number) {
    return (deg * Math.PI) / 180;
  }

  // SVG angles: 0° = right, 90° = down, 180° = left, 270° = up
  // Arc starts at bottom-left (150°) and goes clockwise 240° to bottom-right (30° = 390°)
  const arcStartDeg = 150;
  const arcEndDeg = arcStartDeg + sweepDeg;

  const sx = cx + radius * Math.cos(toRad(arcStartDeg));
  const sy = cy + radius * Math.sin(toRad(arcStartDeg));
  const ex = cx + radius * Math.cos(toRad(arcEndDeg));
  const ey = cy + radius * Math.sin(toRad(arcEndDeg));

  const arcPath = `M ${sx} ${sy} A ${radius} ${radius} 0 1 1 ${ex} ${ey}`;

  // For filling from center outward:
  // The path starts at min (left). Center (0) is at halfArcLength along the path.
  // Positive: fill from center going forward (rightward).
  // Negative: fill from (center - fillLength) forward to center.
  let dashArray: string;
  let dashOffset: number;

  if (fillLength < 0.5) {
    dashArray = `0 ${totalArcLength}`;
    dashOffset = 0;
  } else if (shown > 0) {
    dashArray = `${fillLength} ${totalArcLength}`;
    dashOffset = -halfArcLength;
  } else {
    dashArray = `${fillLength} ${totalArcLength}`;
    dashOffset = -(halfArcLength - fillLength);
  }

  // Tip indicator — rides the end of the fill (at center when score is 0).
  const tipDeg = arcStartDeg + normalized * sweepDeg;
  const tipX = cx + radius * Math.cos(toRad(tipDeg));
  const tipY = cy + radius * Math.sin(toRad(tipDeg));

  // Zero tick at top center of the track.
  const zeroDeg = arcStartDeg + sweepDeg / 2;
  const zx1 = cx + (radius - strokeWidth / 2 - 5) * Math.cos(toRad(zeroDeg));
  const zy1 = cy + (radius - strokeWidth / 2 - 5) * Math.sin(toRad(zeroDeg));
  const zx2 = cx + (radius + strokeWidth / 2 + 5) * Math.cos(toRad(zeroDeg));
  const zy2 = cy + (radius + strokeWidth / 2 + 5) * Math.sin(toRad(zeroDeg));

  // Min / max labels just past the arc ends.
  const lblR = radius + 16;
  const minX = cx + lblR * Math.cos(toRad(arcStartDeg));
  const minY = cy + lblR * Math.sin(toRad(arcStartDeg));
  const maxX = cx + lblR * Math.cos(toRad(arcEndDeg));
  const maxY = cy + lblR * Math.sin(toRad(arcEndDeg));

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

      {/* Zero tick */}
      <line
        x1={zx1}
        y1={zy1}
        x2={zx2}
        y2={zy2}
        stroke="rgba(255,255,255,0.16)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      {/* Active fill arc */}
      {fillLength >= 0.5 && (
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

      {/* Tip indicator — glow halo + core */}
      <circle cx={tipX} cy={tipY} r={7} fill={scoreColor} opacity={0.3} />
      <circle
        cx={tipX}
        cy={tipY}
        r={3.5}
        fill={scoreColor}
        filter={`url(#glow_${id})`}
      />

      {/* Min / max labels — reflect the effective (auto-extended) scale */}
      <text
        x={minX}
        y={minY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.28)"
        fontSize={9}
        fontFamily="inherit"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {lo}
      </text>
      <text
        x={maxX}
        y={maxY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="rgba(255,255,255,0.28)"
        fontSize={9}
        fontFamily="inherit"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {hi > 0 ? `+${hi}` : hi}
      </text>

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
        {displayScore > 0 ? `+${displayScore}` : `${displayScore}`}
      </text>
    </svg>
  );
}
