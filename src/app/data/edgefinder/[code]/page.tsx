"use client";

import { useState, type ReactNode } from "react";
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
  getCotData,
  type FetchLog,
  type DataPoint,
  type CotDataPoint,
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
    success: { color: "#10B981", Icon: CheckCircle2, label: "Success" },
    partial: { color: "#F59E0B", Icon: AlertCircle, label: "Partial" },
    failed: { color: "#EF4444", Icon: XCircle, label: "Failed" },
    running: { color: "#3B82F6", Icon: Loader2, label: "Running" },
  }[status];

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: `${config.color}14`, color: config.color, border: `1px solid ${config.color}28` }}
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
        background: success ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
        border: `1px solid ${success ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
      }}
    >
      {success ? (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: "#10B981" }} />
      ) : (
        <XCircle size={16} className="mt-0.5 shrink-0" style={{ color: "#EF4444" }} />
      )}
      <p className="text-sm flex-1" style={{ color: success ? "#6EE7B7" : "#FCA5A5" }}>
        {message}
      </p>
      <button onClick={onDismiss} className="text-sm" style={{ color: "#475569" }}>
        ✕
      </button>
    </div>
  );
}

// ─── Pipeline panels ──────────────────────────────────────────────────────────

function ForexFactoryPanel({ code, onSuccess }: { code: string; onSuccess: (msg: string) => void }) {
  const mutation = useMutation({
    mutationFn: () => triggerCronJob("forex_factory_fetch"),
    onSuccess: () =>
      onSuccess("Forex Factory fetch triggered. This fetches all economic calendar events for today."),
  });

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
        style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#6EE7B7" }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Fetches today&apos;s economic calendar data from Forex Factory for all tracked countries (US, EU, UK, JP).
          This updates all Forex Factory-sourced indicators at once.
        </span>
      </div>

      {mutation.error && (
        <p className="text-xs" style={{ color: "#EF4444" }}>
          Error: {(mutation.error as Error).message}
        </p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: mutation.isPending ? "rgba(16,185,129,0.3)" : "#10B981", color: "#000" }}
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
        <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
        <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#475569" }}>
          or enter a value manually
        </span>
        <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.08)" }} />
      </div>

      <ManualEntryForm
        code={code}
        actualLabel="Actual Value"
        actualPlaceholder="e.g. 115 (for 115K)"
        submitLabel="Save Manual Value"
        onSuccess={onSuccess}
        instructions={
          <div
            className="flex flex-col gap-1.5 rounded-lg px-3 py-2.5 text-xs"
            style={{ background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.2)", color: "#CBD5E1" }}
          >
            <div className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>
                <strong>Manual entry / backfill / override.</strong> Use this to fill a release the
                calendar fetch missed, or to override a date Forex Factory already filled if the value
                looks wrong — your entry supersedes it and the prior value is kept as history.
              </span>
            </div>
            <ul className="list-disc pl-7 space-y-0.5" style={{ color: "#94A3B8" }}>
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
        style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", color: "#C4B5FD" }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Fetches the latest weekly CFTC Commitment of Traders (COT) data for all tracked assets (USD, EUR, GBP, JPY, Gold).
          Normally runs every Friday after market close.
        </span>
      </div>

      {mutation.error && (
        <p className="text-xs" style={{ color: "#EF4444" }}>
          Error: {(mutation.error as Error).message}
        </p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: mutation.isPending ? "rgba(139,92,246,0.3)" : "#8B5CF6", color: "#fff" }}
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
        style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: "#93C5FD" }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Fetches data from FRED (Federal Reserve Economic Data). Optionally restrict the date range.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Date From (optional)", value: dateFrom, set: setDateFrom },
          { label: "Date To (optional)", value: dateTo, set: setDateTo },
        ].map(({ label, value, set }) => (
          <div key={label} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "#94A3B8" }}>{label}</label>
            <input
              type="date"
              value={value}
              onChange={(e) => set(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9", colorScheme: "dark" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>
        ))}
      </div>

      {mutation.error && (
        <p className="text-xs" style={{ color: "#EF4444" }}>
          Error: {(mutation.error as Error).message}
        </p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: mutation.isPending ? "rgba(59,130,246,0.3)" : "#3B82F6", color: "#fff" }}
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

// Reusable manual data-entry form. Posts to the EdgeFinder manual endpoint
// (data_points, vintage-aware idempotent upsert). Used by the manual / rate
// pipelines AND embedded in the Forex Factory panel for backfill/corrections.
function ManualEntryForm({
  code,
  instructions,
  actualLabel,
  actualPlaceholder,
  submitLabel = "Submit Value",
  onSuccess,
}: {
  code: string;
  instructions: ReactNode;
  actualLabel: string;
  actualPlaceholder: string;
  submitLabel?: string;
  onSuccess: (msg: string) => void;
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [actual, setActual] = useState("");
  const [forecast, setForecast] = useState("");
  const [previous, setPrevious] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      submitEdgefinderManualInput({
        indicatorCode: code,
        observationDate: date,
        actual: parseFloat(actual),
        forecast: forecast ? parseFloat(forecast) : undefined,
        previous: previous ? parseFloat(previous) : undefined,
        notes: notes || undefined,
      }),
    onSuccess: (res) => {
      onSuccess(
        `Value ${res.action}: ${res.value} for ${res.observationDate}${res.isRateDecision ? " (Rate Decision — value stored as bps change)" : ""}`,
      );
      setActual("");
      setForecast("");
      setPrevious("");
      setNotes("");
    },
  });

  return (
    <div className="flex flex-col gap-4">
      {instructions}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "#94A3B8" }}>
            Date <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9", colorScheme: "dark" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "#94A3B8" }}>
            {actualLabel}{" "}
            <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <input
            type="number"
            step="any"
            placeholder={actualPlaceholder}
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Forecast (optional)", value: forecast, set: setForecast },
          { label: "Previous (optional)", value: previous, set: setPrevious },
        ].map(({ label, value, set }) => (
          <div key={label} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "#94A3B8" }}>{label}</label>
            <input
              type="number"
              step="any"
              value={value}
              onChange={(e) => set(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "#94A3B8" }}>Notes (optional)</label>
        <textarea
          rows={2}
          placeholder="Source or context..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none resize-none"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F5F9" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
        />
      </div>

      {mutation.error && (
        <p className="text-xs" style={{ color: "#EF4444" }}>
          Error: {(mutation.error as Error).message}
        </p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !actual || !date}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: mutation.isPending ? "rgba(59,130,246,0.3)" : "#3B82F6", color: "#fff" }}
      >
        {mutation.isPending ? (
          <><Loader2 size={14} className="animate-spin" /> Submitting...</>
        ) : (
          <><Database size={14} /> {submitLabel}</>
        )}
      </button>
    </div>
  );
}

function ManualRatePanel({
  code,
  isRateDecision,
  onSuccess,
}: {
  code: string;
  isRateDecision: boolean;
  onSuccess: (msg: string) => void;
}) {
  const instructions = isRateDecision ? (
    <div
      className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
      style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", color: "#FDBA74" }}
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
      style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", color: "#C4B5FD" }}
    >
      <Info size={14} className="mt-0.5 shrink-0" />
      <span>This indicator requires manual data entry. Fill in the observed value (and optionally forecast/previous).</span>
    </div>
  );

  return (
    <ManualEntryForm
      code={code}
      instructions={instructions}
      actualLabel={isRateDecision ? "New Rate Level (%)" : "Actual Value"}
      actualPlaceholder={isRateDecision ? "e.g. 4.75" : "e.g. 2.1"}
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
        <AlertCircle size={40} style={{ color: "#EF4444" }} />
        <p className="text-lg font-medium" style={{ color: "#F1F5F9" }}>
          Admin access required
        </p>
      </div>
    );
  }

  const dataPoints: DataPoint[] = latestData?.data ?? [];
  // Merge fetch logs with manual-entry logs (FF only — other pipelines return an
  // empty manual set), newest first, capped at 8.
  const logs: FetchLog[] = [...(logsData?.logs ?? []), ...(manualLogsData?.logs ?? [])]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 8);
  const logJobLabel =
    pipeline === "forex_factory" ? `${logJobName} + ${manualJobName}` : logJobName;
  const sourceColor = DATA_SOURCE_COLORS[dataSource] ?? "#64748B";

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto w-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm flex-wrap" style={{ color: "#475569" }}>
        <Link href="/data" className="hover:text-[#94A3B8] transition-colors">Data</Link>
        <ChevronRight size={14} />
        <Link href="/data/edgefinder" className="hover:text-[#94A3B8] transition-colors">EdgeFinder</Link>
        <ChevronRight size={14} />
        <span style={{ color: "#94A3B8" }}>{latestLoading ? code : (indicator?.name ?? code)}</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        {latestLoading ? (
          <div className="flex items-center gap-2" style={{ color: "#475569" }}>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold" style={{ color: "#F1F5F9" }}>
              {indicator?.name ?? code}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-lg px-2 py-0.5 text-xs font-mono" style={{ background: "rgba(255,255,255,0.05)", color: "#64748B" }}>
                {code}
              </span>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ background: `${sourceColor}14`, color: sourceColor, border: `1px solid ${sourceColor}28` }}
              >
                {DATA_SOURCE_LABELS[dataSource] ?? dataSource}
              </span>
              {frequency && (
                <span className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: "rgba(255,255,255,0.04)", color: "#64748B", border: "1px solid rgba(255,255,255,0.06)" }}>
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
            className="rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: "rgba(10,22,40,0.7)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "#F1F5F9" }}>
                Data Pipeline
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                Trigger or submit data for this indicator
              </p>
            </div>

            {pipeline === "forex_factory" && <ForexFactoryPanel code={code} onSuccess={handleSuccess} />}
            {pipeline === "cftc" && <CftcPanel onSuccess={handleSuccess} />}
            {pipeline === "fred" && <FredFetchPanel code={code} onSuccess={handleSuccess} />}
            {(pipeline === "manual_rate" || pipeline === "manual") && (
              <ManualRatePanel
                code={code}
                isRateDecision={pipeline === "manual_rate"}
                onSuccess={handleSuccess}
              />
            )}
          </div>
        </div>

        {/* Recent data points / COT data */}
        <div className="lg:col-span-2">
          <div
            className="rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: "rgba(10,22,40,0.7)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "#F1F5F9" }}>
                  {pipeline === "cftc" ? "COT Data" : "Recent Data Points"}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                  {pipeline === "cftc" ? "Last 12 COT weekly reports" : "Last 10 ingested values"}
                </p>
              </div>
              <button
                onClick={() => pipeline === "cftc" ? refetchCot() : refetchLatest()}
                style={{ color: "#475569" }}
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {pipeline === "cftc" ? (
              // ── COT data display ──────────────────────────────────────────
              cotLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin" style={{ color: "#8B5CF6" }} />
                </div>
              ) : !cotData?.data?.length ? (
                <p className="text-sm text-center py-8" style={{ color: "#475569" }}>No COT data yet</p>
              ) : (
                <div className="flex flex-col gap-1.5 overflow-auto" style={{ maxHeight: 360 }}>
                  {cotData.data.map((row: CotDataPoint, idx: number) => {
                    const netLabel = row.netPositioningLabel ?? "—";
                    const netColor = netLabel === "Bullish" ? "#10B981" : netLabel === "Bearish" ? "#EF4444" : "#64748B";
                    return (
                      <div
                        key={row.id}
                        className="rounded-lg px-3 py-2.5"
                        style={{
                          background: idx === 0 ? "rgba(139,92,246,0.07)" : "rgba(255,255,255,0.02)",
                          border: idx === 0 ? "1px solid rgba(139,92,246,0.2)" : "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium" style={{ color: "#94A3B8" }}>
                            {row.reportDate}
                            {idx === 0 && (
                              <span className="ml-1.5 text-[9px] rounded-full px-1.5 py-0.5" style={{ background: "rgba(139,92,246,0.2)", color: "#C4B5FD" }}>latest</span>
                            )}
                          </span>
                          <span className="text-[9px] font-semibold rounded-full px-1.5 py-0.5" style={{ background: `${netColor}14`, color: netColor }}>
                            {netLabel}
                          </span>
                        </div>
                        <div className="flex gap-3">
                          <div>
                            <p className="text-[9px]" style={{ color: "#475569" }}>Long</p>
                            <p className="text-xs font-semibold" style={{ color: "#10B981" }}>
                              {row.longPct != null ? `${row.longPct.toFixed(1)}%` : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px]" style={{ color: "#475569" }}>Short</p>
                            <p className="text-xs font-semibold" style={{ color: "#EF4444" }}>
                              {row.shortPct != null ? `${row.shortPct.toFixed(1)}%` : "—"}
                            </p>
                          </div>
                          {row.weeklyChangePct != null && (
                            <div>
                              <p className="text-[9px]" style={{ color: "#475569" }}>Wk Chg</p>
                              <p className="text-xs" style={{ color: row.weeklyChangePct >= 0 ? "#10B981" : "#EF4444" }}>
                                {row.weeklyChangePct >= 0 ? "+" : ""}{row.weeklyChangePct.toFixed(1)}%
                              </p>
                            </div>
                          )}
                        </div>
                        {row.changeLabel && (
                          <p className="text-[9px] mt-1" style={{ color: "#64748B" }}>{row.changeLabel}</p>
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
                  <Loader2 size={18} className="animate-spin" style={{ color: "#3B82F6" }} />
                </div>
              ) : dataPoints.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "#475569" }}>No data points yet</p>
              ) : (
                <div className="flex flex-col gap-1.5 overflow-auto" style={{ maxHeight: 360 }}>
                  {dataPoints.map((dp, idx) => (
                    <div
                      key={dp.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{
                        background: idx === 0 ? "rgba(59,130,246,0.07)" : "rgba(255,255,255,0.02)",
                        border: idx === 0 ? "1px solid rgba(59,130,246,0.15)" : "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <div>
                        <p className="text-xs font-medium" style={{ color: "#F1F5F9" }}>
                          {dp.value}
                          {dp.forecastValue != null && (
                            <span className="ml-1 text-[9px]" style={{ color: "#64748B" }}>
                              F: {dp.forecastValue}
                            </span>
                          )}
                          {idx === 0 && (
                            <span className="ml-1.5 text-[9px] rounded-full px-1.5 py-0.5" style={{ background: "rgba(59,130,246,0.15)", color: "#60A5FA" }}>
                              current
                            </span>
                          )}
                        </p>
                        <p className="text-[10px]" style={{ color: "#475569" }}>{dp.observationDate}</p>
                      </div>
                      <div className="text-right">
                        {dp.dataQualityFlag && (
                          <p className="text-[9px] mb-0.5" style={{ color: "#F59E0B" }}>{dp.dataQualityFlag}</p>
                        )}
                        <p className="text-[10px]" style={{ color: "#334155" }}>
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
        className="mt-6 rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "rgba(10,22,40,0.7)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "#F1F5F9" }}>Recent Fetch Logs</h2>
            <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
              Job: <span className="font-mono" style={{ color: "#475569" }}>{logJobLabel}</span>
            </p>
          </div>
          <button onClick={() => refetchLogs()} style={{ color: "#475569" }} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        {logsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin" style={{ color: "#3B82F6" }} />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "#475569" }}>No logs yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead>
                <tr>
                  {["Status", "Trigger", "Started", "Duration", "Rows In", "Rows Up"].map((h) => (
                    <th key={h} className="text-left pb-2 text-[10px] uppercase tracking-wider font-medium" style={{ color: "#475569" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-1 pr-4"><StatusBadge status={log.status} /></td>
                    <td className="py-1 pr-4"><span className="text-xs" style={{ color: "#64748B" }}>{log.triggerType}</span></td>
                    <td className="py-1 pr-4">
                      <div>
                        <p className="text-xs" style={{ color: "#94A3B8" }}>{new Date(log.startedAt).toLocaleDateString()}</p>
                        <p className="text-[10px]" style={{ color: "#475569" }}>{new Date(log.startedAt).toLocaleTimeString()}</p>
                      </div>
                    </td>
                    <td className="py-1 pr-4">
                      <span className="text-xs" style={{ color: "#64748B" }}>
                        {log.durationMs != null ? (log.durationMs < 1000 ? `${log.durationMs}ms` : `${(log.durationMs / 1000).toFixed(1)}s`) : "—"}
                      </span>
                    </td>
                    <td className="py-1 pr-4"><span className="text-xs font-medium" style={{ color: "#10B981" }}>+{log.rowsInserted}</span></td>
                    <td className="py-1"><span className="text-xs font-medium" style={{ color: "#F59E0B" }}>~{log.rowsUpdated}</span></td>
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
