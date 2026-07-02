"use client";

// ─── Shared timeframe + custom date-range control ───────────────────────────
//
// Data-model-agnostic preset row (used by Oracle's FullScreenAnalysis and
// NIFTY's FlowTrackerView, whose underlying fetch contracts differ) plus a
// themed custom from/to range, styled to match the native <input type="date">
// convention already established on V-Bottom/Velocity/USD-Lab — no external
// date-picker library.

import { useState } from "react";

export interface TimeframePreset {
  key: string;
  label: string;
}

export interface CustomRange {
  from: string;
  to: string;
}

interface TimeframeControlProps {
  presets: TimeframePreset[];
  /** Currently active preset key, or null when a custom range is active. */
  activePresetKey: string | null;
  onSelectPreset: (key: string) => void;
  /** Currently active custom range, or null when a preset is active. */
  customRange: CustomRange | null;
  onSelectCustomRange: (range: CustomRange) => void;
  minDate?: string;
  maxDate?: string;
}

export function TimeframeControl({
  presets,
  activePresetKey,
  onSelectPreset,
  customRange,
  onSelectCustomRange,
  minDate,
  maxDate,
}: TimeframeControlProps) {
  const [draftFrom, setDraftFrom] = useState(customRange?.from ?? "");
  const [draftTo, setDraftTo] = useState(customRange?.to ?? "");
  const [pickerOpen, setPickerOpen] = useState(false);

  const isCustomActive = activePresetKey === null;

  function commitIfValid(from: string, to: string) {
    if (from && to && from <= to) onSelectCustomRange({ from, to });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}>
        {presets.map((p) => {
          const active = !isCustomActive && p.key === activePresetKey;
          return (
            <button
              key={p.key}
              onClick={() => {
                setPickerOpen(false);
                onSelectPreset(p.key);
              }}
              className="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors lt-num"
              style={{
                background: active ? "var(--lucid-accent-bg)" : "transparent",
                color: active ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
              }}
            >
              {p.label}
            </button>
          );
        })}
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="px-2.5 py-1 rounded-md text-xs font-semibold transition-colors"
          style={{
            background: isCustomActive ? "var(--lucid-accent-bg)" : "transparent",
            color: isCustomActive ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
          }}
        >
          Custom
        </button>
      </div>

      {pickerOpen && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={draftFrom}
            min={minDate}
            max={draftTo || maxDate}
            onChange={(e) => {
              const from = e.target.value;
              setDraftFrom(from);
              commitIfValid(from, draftTo);
            }}
            className="px-2.5 py-1 rounded-md text-xs lt-num"
            style={{
              background: "var(--lucid-surface-2)",
              border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)",
              color: "var(--lucid-ink)",
              colorScheme: "dark",
            }}
          />
          <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>to</span>
          <input
            type="date"
            value={draftTo}
            min={draftFrom || minDate}
            max={maxDate}
            onChange={(e) => {
              const to = e.target.value;
              setDraftTo(to);
              commitIfValid(draftFrom, to);
            }}
            className="px-2.5 py-1 rounded-md text-xs lt-num"
            style={{
              background: "var(--lucid-surface-2)",
              border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)",
              color: "var(--lucid-ink)",
              colorScheme: "dark",
            }}
          />
        </div>
      )}
    </div>
  );
}
