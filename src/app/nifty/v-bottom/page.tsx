"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useVBottomCheck } from "@/hooks/useVBottomCheck";
import { ApiError } from "@/lib/api/client";
import type {
  PublicVBottomExample,
  PublicVBottomResponse,
  VBottomClassification,
} from "@/lib/api/nifty";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import { formatDate } from "../nifty-utils";

// Threshold reference. Same thresholds the backend uses — kept in sync editorially
// for the static reference table. Colors pull from existing --band-* CSS variables.
const thresholdRows: Array<{
  raw: string;
  classification: VBottomClassification;
  expectation: string;
  cssVar: string;
}> = [
  { raw: "≤ 0", classification: "REAL_V_BOTTOM", expectation: "Recovery sustains", cssVar: "--band-strong-bullish" },
  { raw: "+1 to +4", classification: "AMBIGUOUS", expectation: "Needs External flip", cssVar: "--band-caution" },
  { raw: "≥ +5", classification: "COUNTER_TREND_BOUNCE", expectation: "Bounce will fail", cssVar: "--band-strong-bearish" },
];

function classificationDisplay(c: VBottomClassification): string {
  switch (c) {
    case "REAL_V_BOTTOM": return "REAL V-BOTTOM";
    case "AMBIGUOUS": return "AMBIGUOUS";
    case "COUNTER_TREND_BOUNCE": return "COUNTER-TREND BOUNCE";
  }
}

function classificationColor(c: VBottomClassification | null | undefined): string {
  if (!c) return "var(--text-secondary)";
  const row = thresholdRows.find((r) => r.classification === c);
  return row ? `var(${row.cssVar})` : "var(--text-secondary)";
}

function classifyByRaw(raw: number): VBottomClassification {
  if (raw <= 0) return "REAL_V_BOTTOM";
  if (raw <= 4) return "AMBIGUOUS";
  return "COUNTER_TREND_BOUNCE";
}

function formatRaw(raw: number): string {
  return raw >= 0 ? `+${raw}` : `${raw}`;
}

function is404(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 404;
}

export default function VBottomPage() {
  const [userDate, setUserDate] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useVBottomCheck({
    date: userDate ?? undefined,
  });

  // Input prefill: user's typed value wins; else last resolved date from a
  // successful fetch; else empty. Picker never blanks during error / loading.
  const dateInputValue = userDate ?? data?.date ?? "";

  function resetToLatest() {
    setUserDate(null);
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-350">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="lt-rise lt-stagger-1 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="lt-serif text-2xl font-bold" style={{ color: "var(--lucid-ink)" }}>V-Bottom</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>
            Discriminate real V-bottoms from counter-trend bounces.
          </p>
        </div>
        <div className="text-sm shrink-0" style={{ color: "var(--lucid-ink-3)" }}>
          Source: <span className="font-mono" style={{ color: "var(--lucid-accent)" }}>P15-2</span>
          {" · "}
          <span style={{ color: "var(--band-strong-bullish)" }}>CONFIRMED</span>
          {" · 5 instances"}
        </div>
      </div>

      {/* ── Date Picker (always mounted) ─────────────────────────────── */}
      <div
        className="lt-card lt-edge lt-rise lt-stagger-2 p-4 sm:p-5"
        style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
      >
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="vb-date"
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--lucid-ink-3)" }}
            >
              Scorecard date
            </label>
            <input
              id="vb-date"
              type="date"
              value={dateInputValue}
              onChange={(e) => setUserDate(e.target.value || null)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--lucid-surface-2)",
                border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)",
                color: "var(--lucid-ink)",
                colorScheme: "dark",
              }}
            />
            <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
              Defaults to latest scorecard
            </span>
          </div>

          {userDate !== null && (
            <button
              className="flex items-center gap-1.5 text-xs px-3 py-2"
              style={{ color: "var(--lucid-ink-3)" }}
              onClick={resetToLatest}
            >
              <RotateCcw size={12} />
              Reset to latest
            </button>
          )}
        </div>
      </div>

      {/* ── Result Area (swaps; chrome above stays mounted) ─────────── */}
      <ResultArea
        isLoading={isLoading}
        error={error}
        data={data}
        refetch={refetch}
      />

      {/* ── Threshold Reference Table (always mounted; highlights active row) ── */}
      <ThresholdTable classification={data?.classification ?? null} />

      

      {/* ── When NOT to Use (editorial; static, bottom of page) ─────── */}
      <div
        className="lt-card p-5"
        style={{ background: "var(--lucid-surface-2)", borderColor: "var(--lucid-line)" }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--lucid-ink-3)" }}>
          When NOT to Use V-Bottom
        </div>
        <p className="text-sm mb-4 font-medium" style={{ color: "var(--lucid-ink-2)" }}>
          This tool is NOT a buy signal generator.
        </p>
        <p className="text-xs mb-4" style={{ color: "var(--lucid-ink-3)" }}>
          It is a fundamental read on a moment YOU identify on the chart. The tool assumes price action is doing
          something V-shaped. It does not check that assumption.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--band-strong-bearish)" }}>Do NOT use to:</div>
            <ul className="space-y-1">
              {[
                "Decide whether a V-bottom is forming (that's your job, on the chart)",
                "Generate buy signals automatically",
                "Override your chart read when fundamentals disagree",
                "Predict price targets (fundamentals only)",
              ].map((t, i) => (
                <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                  <span style={{ color: "var(--band-strong-bearish)" }}>✕</span>{t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: "var(--band-strong-bullish)" }}>DO use to:</div>
            <ul className="space-y-1">
              {[
                "Filter out fake V-bottoms when chart looks promising but Ind 9 is sticky",
                "Add confidence to a real V-bottom when Ind 9 raw ≤ 0",
                "Understand why a bounce failed (after the fact — Ind 9 was ≥ +5)",
                "Calibrate recovery expectations in AMBIGUOUS zone",
              ].map((t, i) => (
                <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                  <span style={{ color: "var(--band-strong-bullish)" }}>✓</span>{t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThresholdTable({ classification }: { classification: VBottomClassification | null }) {
  return (
    <div className="lt-card p-5">
      <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--lucid-ink-3)" }}>
        The Rule — P15-2
      </div>

      <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)" }}>
        <table className="w-full text-sm" style={{ minWidth: 480 }}>
          <thead>
            <tr style={{ background: "var(--lucid-surface-2)" }}>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--lucid-ink-3)" }}>Ind 9 Raw at Trough</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--lucid-ink-3)" }}>Classification</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--lucid-ink-3)" }}>Forward Expectation</th>
            </tr>
          </thead>
          <tbody>
            {thresholdRows.map((row) => {
              const color = `var(${row.cssVar})`;
              const isActive = classification === row.classification;
              return (
                <tr
                  key={row.classification}
                  className="border-t"
                  style={{
                    borderColor: "var(--lucid-line)",
                    background: isActive
                      ? `color-mix(in srgb, ${color} 12%, transparent)`
                      : "transparent",
                    borderLeft: `3px solid ${isActive ? color : "transparent"}`,
                  }}
                >
                  <td className="px-4 py-3 font-mono text-sm" style={{ color: "var(--lucid-ink-2)" }}>{row.raw}</td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-1 rounded text-xs font-bold"
                      style={{
                        background: `color-mix(in srgb, ${color} 15%, transparent)`,
                        color,
                        border: `1px solid ${color}`,
                      }}
                    >
                      {classificationDisplay(row.classification)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--lucid-ink-3)" }}>{row.expectation}</td>
                  {isActive && <td className="pr-4 text-right text-xs" style={{ color: "var(--lucid-accent)" }}>◄ current</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-4 rounded-xl text-sm" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-3)" }}>
        <strong style={{ color: "var(--lucid-ink-2)" }}>Why depth matters:</strong>{" "}
        At the moment of trough, the question is whether USD regime is already broken (raw ≤ 0) or still intact (raw ≥ +5).
        A V-bottom forming with USD regime still strong is the market trying to bounce against the macro — it will fail.
        Real V-bottoms require USD already in retreat.
      </div>
    </div>
  );
}

function ResultArea({
  isLoading,
  error,
  data,
  refetch,
}: {
  isLoading: boolean;
  error: Error | null;
  data: PublicVBottomResponse | undefined;
  refetch: () => void;
}) {
  if (isLoading) {
    return <LoadingState stages={["Running diagnostic…", "Checking trough signature…", "Classifying the bounce…"]} />;
  }
  if (error) {
    if (is404(error)) {
      return (
        <div className="lt-card p-5 sm:p-8" style={{ background: "var(--lucid-line)" }}>
          <EmptyState
            title="No scorecard for selected date"
            description={`${error.message}. Pick a date with available data above.`}
          />
        </div>
      );
    }
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }
  if (!data) {
    return <EmptyState title="No V-Bottom data" />;
  }

  if (data.classification === null) {
    return (
      <div className="lt-card p-8" style={{ background: "var(--lucid-line)" }}>
        <EmptyState
          title="Classification unavailable"
          description="Ind 9 raw composite pending — verdict cannot be computed yet."
        />
      </div>
    );
  }

  return <SuccessView data={data} />;
}

function SuccessView({ data }: { data: PublicVBottomResponse }) {
  const { ind9_raw, classification, forward_expectation, examples } = data;
  // classification is non-null here (gated by ResultArea), but keep defensive
  const color = classificationColor(classification);

  return (
    <div className="space-y-5">
      {/* ── Hero Verdict Card ───────────────────────────────────────── */}
      <div
        className="lt-card p-5 sm:p-8 text-center"
        style={{
          background: `color-mix(in srgb, ${color} 8%, transparent)`,
          borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        }}
      >
        <div
          className="inline-flex items-center text-sm font-bold uppercase tracking-widest px-4 py-2 rounded-md mb-4"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
            border: `1px solid ${color}`,
          }}
        >
          {classification ? classificationDisplay(classification) : "—"}
        </div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--lucid-ink-3)" }}>
          Ind 9 Raw Composite
        </div>
        <div className="text-5xl font-bold tabular-nums leading-none mb-1" style={{ color: "var(--lucid-ink)" }}>
          {ind9_raw !== null ? formatRaw(ind9_raw) : "—"}
        </div>
        {ind9_raw === null && (
          <div className="text-xs mb-2" style={{ color: "var(--lucid-ink-3)" }}>
            Ind 9 raw pending
          </div>
        )}
        <div className="text-xs mb-4" style={{ color: "var(--lucid-ink-3)" }}>range −14 to +14</div>
        {forward_expectation && (
          <p className="text-sm leading-relaxed max-w-2xl mx-auto" style={{ color: "var(--lucid-ink-2)" }}>
            {forward_expectation}
          </p>
        )}
      </div>

      {/* ── Historical Examples ─────────────────────────────────────── */}
      <div className="lt-card p-5">
        <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--lucid-ink-3)" }}>
          Historical Instances ({examples.length})
        </div>
        {examples.length === 0 ? (
          <EmptyState
            title="No historical examples yet"
            description="Historical examples will populate as the V-Bottom classifier accumulates real-world instances."
          />
        ) : (
          <div className="space-y-3">
            {examples.map((ex, i) => (
              <HistoricalExample key={i} ex={ex} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoricalExample({ ex }: { ex: PublicVBottomExample }) {
  const inferredClass = classifyByRaw(ex.raw_at_trough);
  const color = classificationColor(inferredClass);

  return (
    <div
      className="p-4 rounded-xl flex items-start gap-4"
      style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <span className="text-sm font-medium" style={{ color: "var(--lucid-ink)" }}>
            {formatDate(ex.date)}
          </span>
          <span
            className="text-xs tabular-nums font-mono px-2 py-0.5 rounded"
            style={{
              color,
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
              border: `1px solid ${color}`,
            }}
          >
            Ind 9 raw: {formatRaw(ex.raw_at_trough)}
          </span>
        </div>
        <div className="text-sm mt-1" style={{ color: "var(--lucid-ink-2)" }}>
          {ex.description}
        </div>
        <div className="text-xs mt-1.5" style={{ color: "var(--lucid-ink-3)" }}>
          {ex.outcome}
        </div>
        <Link
          href={`/nifty/scorecard?date=${ex.date}`}
          className="text-xs mt-2 inline-flex items-center gap-1"
          style={{ color: "var(--lucid-accent)" }}
        >
          Open scorecard →
        </Link>
      </div>
      <span
        className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
        style={{
          background: `color-mix(in srgb, ${color} 15%, transparent)`,
          color,
          border: `1px solid ${color}`,
        }}
      >
        {classificationDisplay(inferredClass)}
      </span>
    </div>
  );
}
