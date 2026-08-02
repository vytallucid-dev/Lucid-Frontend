"use client";

// ─── Score history → trajectory ──────────────────────────────────────────────
// The 12-week chart is now the door to the trajectory view. The pairing is the
// point: this chart has no date axis because its data carries none, and the
// trajectory view is precisely where the dated version lives. Opening it from
// the gauge was arbitrary; opening it from the chart is the obvious gesture.
//
// A real <button>, so Enter and Space work for free and focus-visible is the
// browser's. The hint is visible at rest — nobody should have to hover a chart
// to find out it does something.

import { Maximize2 } from "lucide-react";
import { ScoreHistoryChart } from "@/components/ScoreHistoryChart";

export function ScoreHistoryTrigger({
  data,
  onOpen,
  subjectName,
  hint = "Trajectory",
}: {
  data: number[];
  onOpen: () => void;
  /** Named in the accessible label so the target is unambiguous. */
  subjectName: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="lt-card lx-chart-trigger p-4"
      aria-label={`Open the score trajectory view for ${subjectName}`}
    >
      <span className="flex items-center justify-between gap-3 mb-3">
        <span className="lt-eyebrow">SCORE HISTORY (12 WEEKS)</span>
        <span className="lx-chart-hint lx-micro">
          <Maximize2 size={11} aria-hidden="true" />
          {hint}
        </span>
      </span>
      <ScoreHistoryChart data={data} />
    </button>
  );
}
