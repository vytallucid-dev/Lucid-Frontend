"use client";

// ─── Score card = asset picker ───────────────────────────────────────────────
// The card that tells you WHICH instrument you are looking at is now the
// control that changes it. A separate picker sitting above a card naming the
// same thing was two controls for one idea.
//
// The popover itself is untouched — ScorecardPicker still owns search, the
// keyboard walk, Escape, Recent, focus return and score display. Only what it
// anchors to changed.
//
// Every value the card displayed before it displays now; nothing was removed or
// recomputed. The gauge, bias pill and identity line are the same nodes the
// pages rendered, just handed in.

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { ScoreGauge } from "@/components/ScoreGauge";
import { ScorecardPicker, type PickerOption } from "./ScorecardPicker";

/** Sign-aware background wash. Same thresholds and tokens both pages already
 *  used — moved, not changed. */
function washFor(score: number | null): string {
  const wash =
    score !== null && score >= 3
      ? "var(--lucid-pos-wash)"
      : score !== null && score <= -3
        ? "var(--lucid-neg-wash)"
        : "var(--lucid-accent-wash)";
  return `radial-gradient(120% 90% at 50% 0%, ${wash}, transparent 65%), var(--lucid-grad-surface)`;
}

export function ScorecardIdentityCard({
  score,
  bias,
  biasClass,
  identity,
  identityName,
  pending = false,
  pickerLabel,
  options,
  value,
  onChange,
  recentStorageKey,
}: {
  /** Total score — drives the gauge and the card's wash. */
  score: number | null;
  bias: string | null;
  /** The page's own bias-pill class (getBiasPillClass output). */
  biasClass: string;
  /** The identity line exactly as the page composes it (flags + name). */
  identity: ReactNode;
  /** Plain-text form of the same, for the accessible name. */
  identityName: string;
  /** A switch is in flight: ghost the stale numbers, show the incoming name. */
  pending?: boolean;
  pickerLabel: string;
  options: PickerOption[];
  value: string;
  onChange: (key: string) => void;
  recentStorageKey?: string;
}) {
  const selected = options.find((o) => o.key === value);

  // While the new scorecard is in flight the card still holds the OLD numbers,
  // so naming the old instrument next to them would be honest but useless — the
  // trader needs to see that the click registered. The name flips immediately
  // to the incoming selection and stays crisp; the numbers beside it ghost.
  const nameNode =
    pending && selected ? (
      <>
        {selected.glyph ? `${selected.glyph} ` : ""}
        {selected.label}
      </>
    ) : (
      identity
    );

  return (
    <div
      className="lt-card lt-edge w-full"
      style={{ background: washFor(score), boxShadow: "var(--lucid-elev-1)", padding: 12 }}
    >
      <ScorecardPicker
        label={pickerLabel}
        options={options}
        value={value}
        onChange={onChange}
        recentStorageKey={recentStorageKey}
        panelWidth="fixed"
        triggerClassName="lx-identity-trigger"
        triggerStyle={{ padding: "8px 8px 12px" }}
        triggerLabel={`${pickerLabel}: ${identityName}. Change ${pickerLabel.toLowerCase()}.`}
        triggerContent={
          <>
            {/* Numbers being replaced ghost; they are no longer current and
                should not be read as if they were. */}
            <span className={`lx-swap block ${pending ? "lx-swap-busy" : ""}`}>
              {score !== null && <ScoreGauge score={score} />}
              <span className="block mb-2 -mt-1">
                {bias && (
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${biasClass}`}>
                    {bias}
                  </span>
                )}
              </span>
            </span>

            <span className="flex items-center justify-center gap-1.5">
              <span
                className="lt-serif text-sm font-medium"
                style={{ color: "var(--lucid-ink-2)" }}
              >
                {nameNode}
              </span>
              <ChevronDown size={14} className="lx-identity-chev" aria-hidden="true" />
            </span>
          </>
        }
      />
    </div>
  );
}
