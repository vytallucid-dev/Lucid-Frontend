"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ChevronRight,
  AlertCircle,
  Loader2,
  Play,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Database,
  Info,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import {
  getIndicatorLatest,
  getAdminLogs,
  triggerCronJob,
  fetchFredIndicator,
  submitEdgefinderManualInput,
  isRevisionConfirmationRequired,
  getCotData,
  type FetchLog,
  type DataPoint,
  type CotDataPoint,
  type RevisionConfirmationRequired,
} from "@/lib/api/admin";
import {
  DATA_SOURCE_COLORS,
  DATA_SOURCE_LABELS,
  FREQUENCY_LABELS,
  formatRelativeDate,
} from "@/lib/admin-pipeline";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEfPipelineFromCode(code: string, dataSource: string, frequency: string) {
  if (code.endsWith("_RATE") || frequency === "event_driven") return "manual_rate";
  if (dataSource === "cftc") return "cftc";
  if (dataSource === "fred") return "fred";
  if (dataSource === "manual") return "manual";
  return "forex_factory";
}

function getEfLogJobName(code: string, dataSource: string, frequency: string) {
  const p = getEfPipelineFromCode(code, dataSource, frequency);
  if (p === "cftc") return "cftc_cot_fetch";
  if (p === "fred") return "fred_fetch";
  if (p === "forex_factory") return "forex_factory_fetch";
  return `manual_input_${code.toLowerCase()}`;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FetchLog["status"] }) {
  const config = {
    success: { color: "var(--lucid-pos)", Icon: CheckCircle2, label: "Success" },
    partial: { color: "var(--lucid-warn)", Icon: AlertCircle, label: "Partial" },
    failed: { color: "var(--lucid-neg)", Icon: XCircle, label: "Failed" },
    running: { color: "var(--lucid-accent)", Icon: Loader2, label: "Running" },
  }[status];

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: `color-mix(in srgb, ${config.color} 14%, transparent)`, color: config.color, border: `1px solid color-mix(in srgb, ${config.color} 28%, transparent)` }}
    >
      <config.Icon size={10} className={status === "running" ? "animate-spin" : ""} />
      {config.label}
    </span>
  );
}

function ResultBanner({
  success,
  message,
  onDismiss,
}: {
  success: boolean;
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-4 py-3"
      style={{
        background: success ? "var(--lucid-pos-bg)" : "var(--lucid-neg-bg)",
        border: `1px solid ${success ? "var(--lucid-pos-bd)" : "var(--lucid-neg-bd)"}`,
      }}
    >
      {success ? (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: "var(--lucid-pos)" }} />
      ) : (
        <XCircle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--lucid-neg)" }} />
      )}
      <p className="text-sm flex-1" style={{ color: success ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
        {message}
      </p>
      <button onClick={onDismiss} className="text-sm" style={{ color: "var(--lucid-ink-3)" }}>
        ✕
      </button>
    </div>
  );
}

// ─── Pipeline panels ──────────────────────────────────────────────────────────

function ForexFactoryPanel({
  code,
  indicatorName,
  lastActual,
  onSuccess,
}: {
  code: string;
  indicatorName: string;
  lastActual: { value: number; observationDate: string } | null;
  onSuccess: (msg: string) => void;
}) {
  const mutation = useMutation({
    mutationFn: () => triggerCronJob("forex_factory_fetch"),
    onSuccess: () =>
      onSuccess("Forex Factory fetch triggered. This fetches all economic calendar events for today."),
  });

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
        style={{ background: "var(--lucid-pos-bg)", border: "1px solid var(--lucid-pos-bd)", color: "var(--lucid-pos)" }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Fetches today&apos;s economic calendar data from Forex Factory for all tracked countries (US, EU, UK, JP).
          This updates all Forex Factory-sourced indicators at once.
        </span>
      </div>

      {mutation.error && (
        <p className="text-xs" style={{ color: "var(--lucid-neg)" }}>
          Error: {(mutation.error as Error).message}
        </p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: mutation.isPending ? "var(--lucid-pos-bg)" : "var(--lucid-pos)", color: "#000" }}
      >
        {mutation.isPending ? (
          <><Loader2 size={14} className="animate-spin" /> Fetching...</>
        ) : (
          <><Play size={14} /> Run Forex Factory Fetch</>
        )}
      </button>

      {/* Divider: the calendar fetch only covers the current week, so allow a
          manual entry for backfilling a missed release or correcting a value. */}
      <div className="flex items-center gap-3 pt-1">
        <div className="h-px flex-1" style={{ background: "var(--lucid-line-2)" }} />
        <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--lucid-ink-3)" }}>
          or enter a value manually
        </span>
        <div className="h-px flex-1" style={{ background: "var(--lucid-line-2)" }} />
      </div>

      <ManualEntryForm
        code={code}
        indicatorName={indicatorName}
        actualLabel="Actual Value"
        actualPlaceholder="e.g. 115 (for 115K)"
        submitLabel="Save Manual Value"
        autoFillPrevious={lastActual}
        onSuccess={onSuccess}
        instructions={
          <div
            className="flex flex-col gap-1.5 rounded-lg px-3 py-2.5 text-xs"
            style={{ background: "var(--lucid-ctx-bg)", border: "1px solid var(--lucid-ctx-bd)", color: "var(--lucid-ctx)" }}
          >
            <div className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>
                <strong>Manual entry / backfill / override.</strong> Use this to fill a release the
                calendar fetch missed, or to override a date Forex Factory already filled if the value
                looks wrong — your entry supersedes it and the prior value is kept as history.
              </span>
            </div>
            <ul className="list-disc pl-7 space-y-0.5" style={{ color: "var(--lucid-ink-2)" }}>
              <li><strong>Date</strong> = the release&apos;s date as shown in Recent Data Points (or on the Forex Factory calendar). Match that exact date so an override lands on the same row.</li>
              <li>
                Enter the number <strong>unit-stripped</strong>, exactly as it reads on Forex Factory
                without the K / M / B / % suffix — e.g. NFP &quot;115K&quot; → <strong>115</strong>,
                ISM &quot;52.7&quot; → <strong>52.7</strong>.
              </li>
              <li>Forecast / Previous are optional (also unit-stripped).</li>
              <li>Re-submitting the same date &amp; value does nothing; a changed value saves a correction.</li>
            </ul>
          </div>
        }
      />
    </div>
  );
}

function CftcPanel({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const mutation = useMutation({
    mutationFn: () => triggerCronJob("cftc_cot_fetch"),
    onSuccess: () =>
      onSuccess("CFTC COT fetch triggered. Fetches the latest weekly Commitment of Traders data for all assets."),
  });

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
        style={{ background: "var(--lucid-ctx-bg)", border: "1px solid var(--lucid-ctx-bd)", color: "var(--lucid-ctx)" }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Fetches the latest weekly CFTC Commitment of Traders (COT) data for all tracked assets (USD, EUR, GBP, JPY, Gold).
          Normally runs every Friday after market close.
        </span>
      </div>

      {mutation.error && (
        <p className="text-xs" style={{ color: "var(--lucid-neg)" }}>
          Error: {(mutation.error as Error).message}
        </p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: mutation.isPending ? "var(--lucid-ctx-bg)" : "var(--lucid-ctx)", color: "#fff" }}
      >
        {mutation.isPending ? (
          <><Loader2 size={14} className="animate-spin" /> Fetching...</>
        ) : (
          <><Play size={14} /> Run CFTC COT Fetch</>
        )}
      </button>
    </div>
  );
}

function FredFetchPanel({
  code,
  onSuccess,
}: {
  code: string;
  onSuccess: (msg: string) => void;
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      fetchFredIndicator({
        indicator_code: code,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
    onSuccess: () => onSuccess(`FRED fetch triggered for ${code}. Check logs for status.`),
  });

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
        style={{ background: "var(--lucid-accent-bg)", border: "1px solid var(--lucid-accent-bd)", color: "var(--lucid-accent)" }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Fetches data from FRED (Federal Reserve Economic Data). Optionally restrict the date range.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: "Date From (optional)", value: dateFrom, set: setDateFrom },
          { label: "Date To (optional)", value: dateTo, set: setDateTo },
        ].map(({ label, value, set }) => (
          <div key={label} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>{label}</label>
            <input
              type="date"
              value={value}
              onChange={(e) => set(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line-2)", color: "var(--lucid-ink)", colorScheme: "dark" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lucid-accent-bd)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--lucid-line-2)")}
            />
          </div>
        ))}
      </div>

      {mutation.error && (
        <p className="text-xs" style={{ color: "var(--lucid-neg)" }}>
          Error: {(mutation.error as Error).message}
        </p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: mutation.isPending ? "var(--lucid-accent-bg)" : "var(--lucid-accent)", color: "#fff" }}
      >
        {mutation.isPending ? (
          <><Loader2 size={14} className="animate-spin" /> Fetching...</>
        ) : (
          <><Play size={14} /> Fetch from FRED</>
        )}
      </button>
    </div>
  );
}

// Modal shown when the backend returns the 409 revision gate: the submitted
// previous differs from our last recorded actual. Three actions per spec.
function RevisionConfirmModal({
  info,
  indicatorName,
  isSubmitting,
  onConfirm,
  onRecheck,
  onCancel,
}: {
  info: RevisionConfirmationRequired;
  indicatorName: string;
  isSubmitting: boolean;
  onConfirm: () => void;
  onRecheck: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onCancel}
    >
      <div
        className="lt-card w-full max-w-md rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "var(--lucid-surface)", border: "1px solid var(--lucid-line-2)" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="mt-0.5 shrink-0" style={{ color: "var(--lucid-warn)" }} />
          <h2 className="lt-serif text-base font-semibold" style={{ color: "var(--lucid-ink)" }}>
            Previous value differs from our records
          </h2>
        </div>

        <p className="text-sm" style={{ color: "var(--lucid-ink-2)" }}>
          You entered a previous value of{" "}
          <span className="lt-num font-semibold" style={{ color: "var(--lucid-ink)" }}>
            {info.submittedPrevious}
          </span>{" "}
          for {indicatorName}, but our last recorded actual was{" "}
          <span className="lt-num font-semibold" style={{ color: "var(--lucid-ink)" }}>
            {info.storedActual}
          </span>{" "}
          (dated {info.storedActualDate}). This usually means the source revised last
          month&apos;s figure — or it&apos;s a typo.
        </p>

        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: "var(--lucid-accent)", color: "#fff" }}
          >
            {isSubmitting ? (
              <><Loader2 size={14} className="animate-spin" /> Saving...</>
            ) : (
              <><CheckCircle2 size={14} /> Confirm &amp; save</>
            )}
          </button>
          <button
            onClick={onRecheck}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink)", border: "1px solid var(--lucid-line-2)" }}
          >
            Let me re-check
          </button>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition-all disabled:opacity-50"
            style={{ color: "var(--lucid-ink-3)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Reusable manual data-entry form. Posts to the EdgeFinder manual endpoint
// (data_points, vintage-aware idempotent upsert). Used by the manual / rate
// pipelines AND embedded in the Forex Factory panel for backfill/corrections.
//
// When `autoFillPrevious` is set (non-rate entry with a prior data point), the
// `previous` field pre-fills from the last stored actual and shows an inline
// hint. On submit, a 409 revision gate opens the confirmation modal.
function ManualEntryForm({
  code,
  indicatorName,
  instructions,
  actualLabel,
  actualPlaceholder,
  submitLabel = "Submit Value",
  autoFillPrevious,
  onSuccess,
}: {
  code: string;
  indicatorName: string;
  instructions: ReactNode;
  actualLabel: string;
  actualPlaceholder: string;
  submitLabel?: string;
  // Last stored actual for this indicator — the value the `previous` field is
  // pre-filled from. Null/undefined for rate decisions or first releases, in
  // which case no pre-fill and no hint are shown.
  autoFillPrevious?: { value: number; observationDate: string } | null;
  onSuccess: (msg: string) => void;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [actual, setActual] = useState("");
  const [forecast, setForecast] = useState("");
  const [previous, setPrevious] = useState(
    autoFillPrevious ? String(autoFillPrevious.value) : "",
  );
  const [notes, setNotes] = useState("");
  // Set when the backend returns the 409 gate; drives the confirmation modal.
  const [pendingRevision, setPendingRevision] = useState<RevisionConfirmationRequired | null>(null);
  const previousInputRef = useRef<HTMLInputElement>(null);

  // Auto-fill the previous field from the last stored actual once it resolves,
  // but only while the user hasn't typed anything yet (don't clobber edits).
  const autoFillValue = autoFillPrevious?.value;
  const userTouchedPrevious = useRef(false);
  useEffect(() => {
    if (autoFillValue !== undefined && !userTouchedPrevious.current) {
      setPrevious(String(autoFillValue));
    }
  }, [autoFillValue]);

  const reset = () => {
    setActual("");
    setForecast("");
    setNotes("");
    // Re-seed previous from the (now newest) auto-fill; the parent refetches
    // latest after a successful write, so this reflects the value just entered.
    userTouchedPrevious.current = false;
    setPrevious(autoFillValue !== undefined ? String(autoFillValue) : "");
  };

  const mutation = useMutation({
    mutationFn: (confirmRevision?: boolean) =>
      submitEdgefinderManualInput({
        indicatorCode: code,
        observationDate: date,
        actual: parseFloat(actual),
        forecast: forecast ? parseFloat(forecast) : undefined,
        previous: previous ? parseFloat(previous) : undefined,
        notes: notes || undefined,
        ...(confirmRevision ? { confirmRevision: true } : {}),
      }),
    onSuccess: (res) => {
      if (isRevisionConfirmationRequired(res)) {
        // Hold the write; open the modal so the user can confirm/re-check.
        setPendingRevision(res);
        return;
      }
      setPendingRevision(null);
      onSuccess(
        `Value ${res.action}: ${res.value} for ${res.observationDate}${res.isRateDecision ? " (Rate Decision — value stored as bps change)" : ""}`,
      );
      reset();
    },
  });

  const autoFilled = autoFillPrevious != null && previous === String(autoFillPrevious.value);

  return (
    <div className="flex flex-col gap-4">
      {instructions}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>
            Date <span style={{ color: "var(--lucid-neg)" }}>*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line-2)", color: "var(--lucid-ink)", colorScheme: "dark" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lucid-accent-bd)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--lucid-line-2)")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>
            {actualLabel}{" "}
            <span style={{ color: "var(--lucid-neg)" }}>*</span>
          </label>
          <input
            type="number"
            step="any"
            placeholder={actualPlaceholder}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className="lt-num rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line-2)", color: "var(--lucid-ink)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lucid-accent-bd)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--lucid-line-2)")}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>Forecast (optional)</label>
          <input
            type="number"
            step="any"
            value={forecast}
            onChange={(e) => setForecast(e.target.value)}
            className="lt-num rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line-2)", color: "var(--lucid-ink)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lucid-accent-bd)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--lucid-line-2)")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>Previous (optional)</label>
          <input
            ref={previousInputRef}
            type="number"
            step="any"
            value={previous}
            onChange={(e) => {
              userTouchedPrevious.current = true;
              setPrevious(e.target.value);
            }}
            className="lt-num rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line-2)", color: "var(--lucid-ink)" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lucid-accent-bd)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--lucid-line-2)")}
          />
          {autoFilled && autoFillPrevious && (
            <p className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>
              auto-filled from last actual ({autoFillPrevious.observationDate}):{" "}
              <span className="lt-num" style={{ color: "var(--lucid-ink-2)" }}>{autoFillPrevious.value}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>Notes (optional)</label>
        <textarea
          rows={2}
          placeholder="Source or context..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none resize-none"
          style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line-2)", color: "var(--lucid-ink)" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lucid-accent-bd)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--lucid-line-2)")}
        />
      </div>

      {mutation.error && (
        <p className="text-xs" style={{ color: "var(--lucid-neg)" }}>
          Error: {(mutation.error as Error).message}
        </p>
      )}

      <button
        onClick={() => mutation.mutate(undefined)}
        disabled={mutation.isPending || !actual || !date}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: mutation.isPending ? "var(--lucid-accent-bg)" : "var(--lucid-accent)", color: "#fff" }}
      >
        {mutation.isPending ? (
          <><Loader2 size={14} className="animate-spin" /> Submitting...</>
        ) : (
          <><Database size={14} /> {submitLabel}</>
        )}
      </button>

      {pendingRevision && (
        <RevisionConfirmModal
          info={pendingRevision}
          indicatorName={indicatorName}
          isSubmitting={mutation.isPending}
          onConfirm={() => mutation.mutate(true)}
          onRecheck={() => {
            // Close, return focus to previous for a re-check, don't submit.
            setPendingRevision(null);
            userTouchedPrevious.current = true;
            previousInputRef.current?.focus();
          }}
          onCancel={() => setPendingRevision(null)}
        />
      )}
    </div>
  );
}

function ManualRatePanel({
  code,
  indicatorName,
  isRateDecision,
  lastActual,
  onSuccess,
}: {
  code: string;
  indicatorName: string;
  isRateDecision: boolean;
  lastActual: { value: number; observationDate: string } | null;
  onSuccess: (msg: string) => void;
}) {
  const instructions = isRateDecision ? (
    <div
      className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
      style={{ background: "var(--lucid-warn-bg)", border: "1px solid var(--lucid-warn-bd)", color: "var(--lucid-warn)" }}
    >
      <Info size={14} className="mt-0.5 shrink-0" />
      <span>
        <strong>Rate Decision</strong> — enter the new rate <em>level</em> (e.g. 4.75 for 4.75%).
        The system will automatically compute the basis-point change from the prior rate and store
        both the level and the delta.
      </span>
    </div>
  ) : (
    <div
      className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
      style={{ background: "var(--lucid-ctx-bg)", border: "1px solid var(--lucid-ctx-bd)", color: "var(--lucid-ctx)" }}
    >
      <Info size={14} className="mt-0.5 shrink-0" />
      <span>This indicator requires manual data entry. Fill in the observed value (and optionally forecast/previous).</span>
    </div>
  );

  return (
    <ManualEntryForm
      code={code}
      indicatorName={indicatorName}
      instructions={instructions}
      actualLabel={isRateDecision ? "New Rate Level (%)" : "Actual Value"}
      actualPlaceholder={isRateDecision ? "e.g. 4.75" : "e.g. 2.1"}
      // Rate decisions don't use `previous` (bps delta is computed), so no
      // auto-fill or revision gate applies there — only the plain manual case.
      autoFillPrevious={isRateDecision ? null : lastActual}
      onSuccess={onSuccess}
    />
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EdgefinderIndicatorDetailPage() {
  const params = useParams();
  const code = decodeURIComponent(params.code as string);
  const { isAdmin } = useAuth();

  const [banner, setBanner] = useState<{ success: boolean; message: string } | null>(null);

  const {
    data: latestData,
    isLoading: latestLoading,
    refetch: refetchLatest,
  } = useQuery({
    queryKey: ["admin", "indicator-latest", code],
    queryFn: () => getIndicatorLatest(code, 10),
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const indicator = latestData?.indicator;
  const dataSource = indicator?.dataSource ?? "forex_factory";
  const frequency = indicator?.frequency ?? "monthly";
  const pipeline = getEfPipelineFromCode(code, dataSource, frequency);
  const logJobName = getEfLogJobName(code, dataSource, frequency);
  const manualJobName = `manual_input_${code.toLowerCase()}`;

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ["admin", "logs", logJobName],
    queryFn: () => getAdminLogs({ job_name: logJobName, limit: 8 }),
    enabled: isAdmin,
    staleTime: 30_000,
  });

  // Forex Factory indicators can also receive manual overrides/backfills, which
  // log per-indicator as manual_input_<code>. Pull those too and merge into the
  // log panel so manual entries are visible alongside the calendar fetches.
  // (Manual/rate pipelines already use manual_input_<code> as their primary
  // logJobName, so this second query is only needed for the FF pipeline.)
  const { data: manualLogsData, refetch: refetchManualLogs } = useQuery({
    queryKey: ["admin", "logs", manualJobName],
    queryFn: () => getAdminLogs({ job_name: manualJobName, limit: 8 }),
    enabled: isAdmin && pipeline === "forex_factory",
    staleTime: 30_000,
  });

  // For CFTC indicators data lives in cot_data, not data_points
  const { data: cotData, isLoading: cotLoading, refetch: refetchCot } = useQuery({
    queryKey: ["admin", "cot-data", code],
    queryFn: () => getCotData(code),
    enabled: isAdmin && pipeline === "cftc",
    staleTime: 30_000,
  });

  const handleSuccess = (msg: string) => {
    setBanner({ success: true, message: msg });
    setTimeout(() => {
      refetchLatest();
      refetchLogs();
      refetchManualLogs();
    }, 2000);
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle size={40} style={{ color: "var(--lucid-neg)" }} />
        <p className="text-lg font-medium" style={{ color: "var(--lucid-ink)" }}>
          Admin access required
        </p>
      </div>
    );
  }

  const dataPoints: DataPoint[] = latestData?.data ?? [];
  const indicatorName = indicator?.name ?? code;
  // Last stored actual = the most recent current data point (latest is
  // observationDate-desc, isCurrent). This is the same value the backend
  // auto-fills from and revision-checks against. Null when there is no prior
  // data point, so the previous field stays blank (not pre-filled with 0).
  const lastActual =
    dataPoints.length > 0
      ? { value: dataPoints[0].value, observationDate: dataPoints[0].observationDate }
      : null;
  // Merge fetch logs with manual-entry logs (FF only — other pipelines return an
  // empty manual set), newest first, capped at 8.
  const logs: FetchLog[] = [...(logsData?.logs ?? []), ...(manualLogsData?.logs ?? [])]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 8);
  const logJobLabel =
    pipeline === "forex_factory" ? `${logJobName} + ${manualJobName}` : logJobName;
  const sourceColor = DATA_SOURCE_COLORS[dataSource] ?? "var(--lucid-ink-2)";

  return (
    <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm flex-wrap" style={{ color: "var(--lucid-ink-3)" }}>
        <Link href="/data" className="hover:text-(--lucid-ink-2) transition-colors">Data</Link>
        <ChevronRight size={14} />
        <Link href="/data/edgefinder" className="hover:text-(--lucid-ink-2) transition-colors">EdgeFinder</Link>
        <ChevronRight size={14} />
        <span style={{ color: "var(--lucid-ink-2)" }}>{latestLoading ? code : (indicator?.name ?? code)}</span>
      </div>

      {/* Header */}
      <div className="mb-6 min-w-0">
        {latestLoading ? (
          <div className="flex items-center gap-2" style={{ color: "var(--lucid-ink-3)" }}>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <h1 className="lt-serif text-xl font-bold wrap-break-word" style={{ color: "var(--lucid-ink)" }}>
              {indicator?.name ?? code}
            </h1>
            {indicator?.description && (
              <p className="text-xs mt-0.5 wrap-break-word" style={{ color: "var(--lucid-ink-3)" }}>
                {indicator.description}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="lt-num rounded-lg px-2 py-0.5 text-xs font-mono" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-2)" }}>
                {code}
              </span>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ background: `color-mix(in srgb, ${sourceColor} 14%, transparent)`, color: sourceColor, border: `1px solid color-mix(in srgb, ${sourceColor} 28%, transparent)` }}
              >
                {DATA_SOURCE_LABELS[dataSource] ?? dataSource}
              </span>
              {frequency && (
                <span className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line)" }}>
                  {FREQUENCY_LABELS[frequency] ?? frequency}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {banner && (
        <div className="mb-4">
          <ResultBanner success={banner.success} message={banner.message} onDismiss={() => setBanner(null)} />
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Pipeline panel */}
        <div className="lg:col-span-3">
          <div
            className="lt-card rounded-2xl p-4 sm:p-5 flex flex-col gap-4"
          >
            <div>
              <h2 className="lt-serif text-sm font-semibold" style={{ color: "var(--lucid-ink)" }}>
                Data Pipeline
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--lucid-ink-2)" }}>
                Trigger or submit data for this indicator
              </p>
            </div>

            {pipeline === "forex_factory" && (
              <ForexFactoryPanel
                code={code}
                indicatorName={indicatorName}
                lastActual={lastActual}
                onSuccess={handleSuccess}
              />
            )}
            {pipeline === "cftc" && <CftcPanel onSuccess={handleSuccess} />}
            {pipeline === "fred" && <FredFetchPanel code={code} onSuccess={handleSuccess} />}
            {(pipeline === "manual_rate" || pipeline === "manual") && (
              <ManualRatePanel
                code={code}
                indicatorName={indicatorName}
                isRateDecision={pipeline === "manual_rate"}
                lastActual={lastActual}
                onSuccess={handleSuccess}
              />
            )}
          </div>
        </div>

        {/* Recent data points / COT data */}
        <div className="lg:col-span-2">
          <div
            className="lt-card rounded-2xl p-4 sm:p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="lt-serif text-sm font-semibold" style={{ color: "var(--lucid-ink)" }}>
                  {pipeline === "cftc" ? "COT Data" : "Recent Data Points"}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--lucid-ink-2)" }}>
                  {pipeline === "cftc" ? "Last 12 COT weekly reports" : "Last 10 ingested values"}
                </p>
              </div>
              <button
                onClick={() => pipeline === "cftc" ? refetchCot() : refetchLatest()}
                style={{ color: "var(--lucid-ink-3)" }}
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {pipeline === "cftc" ? (
              // ── COT data display ──────────────────────────────────────────
              cotLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin" style={{ color: "var(--lucid-ctx)" }} />
                </div>
              ) : !cotData?.data?.length ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--lucid-ink-3)" }}>No COT data yet</p>
              ) : (
                <div className="flex flex-col gap-1.5 overflow-auto" style={{ maxHeight: 360 }}>
                  {cotData.data.map((row: CotDataPoint, idx: number) => {
                    const netLabel = row.netPositioningLabel ?? "—";
                    const netColor = netLabel === "Bullish" ? "var(--lucid-pos)" : netLabel === "Bearish" ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
                    return (
                      <div
                        key={row.id}
                        className="rounded-lg px-3 py-2.5"
                        style={{
                          background: idx === 0 ? "var(--lucid-ctx-bg)" : "var(--lucid-surface-2)",
                          border: idx === 0 ? "1px solid var(--lucid-ctx-bd)" : "1px solid var(--lucid-line)",
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium" style={{ color: "var(--lucid-ink-2)" }}>
                            {row.reportDate}
                            {idx === 0 && (
                              <span className="ml-1.5 text-[9px] rounded-full px-1.5 py-0.5" style={{ background: "var(--lucid-ctx-bg)", color: "var(--lucid-ctx)" }}>latest</span>
                            )}
                          </span>
                          <span className="lt-num text-[9px] font-semibold rounded-full px-1.5 py-0.5" style={{ background: `color-mix(in srgb, ${netColor} 14%, transparent)`, color: netColor }}>
                            {netLabel}
                          </span>
                        </div>
                        <div className="flex gap-3">
                          <div>
                            <p className="text-[9px]" style={{ color: "var(--lucid-ink-3)" }}>Long</p>
                            <p className="lt-num text-xs font-semibold" style={{ color: "var(--lucid-pos)" }}>
                              {row.longPct != null ? `${row.longPct.toFixed(1)}%` : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px]" style={{ color: "var(--lucid-ink-3)" }}>Short</p>
                            <p className="lt-num text-xs font-semibold" style={{ color: "var(--lucid-neg)" }}>
                              {row.shortPct != null ? `${row.shortPct.toFixed(1)}%` : "—"}
                            </p>
                          </div>
                          {row.weeklyChangePct != null && (
                            <div>
                              <p className="text-[9px]" style={{ color: "var(--lucid-ink-3)" }}>Wk Chg</p>
                              <p className="lt-num text-xs" style={{ color: row.weeklyChangePct >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                                {row.weeklyChangePct >= 0 ? "+" : ""}{row.weeklyChangePct.toFixed(1)}%
                              </p>
                            </div>
                          )}
                        </div>
                        {row.changeLabel && (
                          <p className="text-[9px] mt-1" style={{ color: "var(--lucid-ink-2)" }}>{row.changeLabel}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              // ── Regular data_points display ───────────────────────────────
              latestLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin" style={{ color: "var(--lucid-accent)" }} />
                </div>
              ) : dataPoints.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--lucid-ink-3)" }}>No data points yet</p>
              ) : (
                <div className="flex flex-col gap-1.5 overflow-auto" style={{ maxHeight: 360 }}>
                  {dataPoints.map((dp, idx) => (
                    <div
                      key={dp.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{
                        background: idx === 0 ? "var(--lucid-accent-bg)" : "var(--lucid-surface-2)",
                        border: idx === 0 ? "1px solid var(--lucid-accent-bd)" : "1px solid var(--lucid-line)",
                      }}
                    >
                      <div>
                        <p className="lt-num text-xs font-medium" style={{ color: "var(--lucid-ink)" }}>
                          {dp.value}
                          {dp.forecastValue != null && (
                            <span className="ml-1 text-[9px]" style={{ color: "var(--lucid-ink-2)" }}>
                              F: {dp.forecastValue}
                            </span>
                          )}
                          {idx === 0 && (
                            <span className="ml-1.5 text-[9px] rounded-full px-1.5 py-0.5" style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)" }}>
                              current
                            </span>
                          )}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>{dp.observationDate}</p>
                      </div>
                      <div className="text-right">
                        {dp.dataQualityFlag && (
                          <p className="text-[9px] mb-0.5" style={{ color: "var(--lucid-warn)" }}>{dp.dataQualityFlag}</p>
                        )}
                        <p className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>
                          {formatRelativeDate(dp.fetchedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Fetch Logs */}
      <div
        className="lt-card mt-6 rounded-2xl p-4 sm:p-5 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="lt-serif text-sm font-semibold" style={{ color: "var(--lucid-ink)" }}>Recent Fetch Logs</h2>
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--lucid-ink-2)" }}>
              Job: <span className="font-mono" style={{ color: "var(--lucid-ink-3)" }}>{logJobLabel}</span>
            </p>
          </div>
          <button onClick={() => refetchLogs()} style={{ color: "var(--lucid-ink-3)" }} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        {logsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin" style={{ color: "var(--lucid-accent)" }} />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--lucid-ink-3)" }}>No logs yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead>
                <tr>
                  {["Status", "Trigger", "Started", "Duration", "Rows In", "Rows Up"].map((h) => (
                    <th key={h} className="text-left pb-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: "var(--lucid-ink-3)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-1 pr-4"><StatusBadge status={log.status} /></td>
                    <td className="py-1 pr-4"><span className="text-xs" style={{ color: "var(--lucid-ink-2)" }}>{log.triggerType}</span></td>
                    <td className="py-1 pr-4">
                      <div>
                        <p className="lt-num text-xs" style={{ color: "var(--lucid-ink-2)" }}>{new Date(log.startedAt).toLocaleDateString()}</p>
                        <p className="lt-num text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>{new Date(log.startedAt).toLocaleTimeString()}</p>
                      </div>
                    </td>
                    <td className="py-1 pr-4">
                      <span className="lt-num text-xs" style={{ color: "var(--lucid-ink-2)" }}>
                        {log.durationMs != null ? (log.durationMs < 1000 ? `${log.durationMs}ms` : `${(log.durationMs / 1000).toFixed(1)}s`) : "—"}
                      </span>
                    </td>
                    <td className="py-1 pr-4"><span className="lt-num text-xs font-medium" style={{ color: "var(--lucid-pos)" }}>+{log.rowsInserted}</span></td>
                    <td className="py-1"><span className="lt-num text-xs font-medium" style={{ color: "var(--lucid-warn)" }}>~{log.rowsUpdated}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
