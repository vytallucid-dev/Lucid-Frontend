"use client";

import { useState, useEffect, useRef } from "react";
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
  Clock,
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
  scrapeNseVix,
  scrapeNseFiiDii,
  scrapeNseParticipantOi,
  submitNiftyManualInput,
  type FetchLog,
  type DataPoint,
} from "@/lib/api/admin";
import {
  getNiftyPipeline,
  DATA_SOURCE_COLORS,
  DATA_SOURCE_LABELS,
  FREQUENCY_LABELS,
  formatRelativeDate,
} from "@/lib/admin-pipeline";

// ─── Pipeline job-name mapping ────────────────────────────────────────────────

const NIFTY_LOG_JOB_NAMES: Record<string, string> = {
  IND_NIFTY_01_PMI_MFG: "manual_input_ind_nifty_01_pmi_mfg",
  IND_NIFTY_02_PMI_SVC: "manual_input_ind_nifty_02_pmi_svc",
  IND_NIFTY_03_CPI: "manual_input_ind_nifty_03_cpi",
  IND_NIFTY_04_RBI_RATE: "manual_input_ind_nifty_04_rbi_rate",
  IND_NIFTY_05_IIP: "manual_input_ind_nifty_05_iip",
  IND_NIFTY_06_FII_FLOW: "nse_fii_dii",
  IND_NIFTY_07_DII_ABSORPTION: "nse_fii_dii",
  IND_NIFTY_08_VIX: "nse_vix",
  IND_NIFTY_09_USD_WEAKNESS: "nifty_ind9_bridge",
  IND_NIFTY_10_DXY: "eodhd",
  // Brent moved off EODHD to the Crude Price API: "crude" (contains-match) catches
  // both crude_price_fetch (orchestrator) and fetch_crude_brent (per-indicator).
  IND_NIFTY_11_BRENT: "crude",
  IND_NIFTY_12_USDINR: "eodhd",
  IND_NIFTY_13_FII_LS_RATIO: "nse_participant_oi",
};

// Short, button-friendly source names. DATA_SOURCE_LABELS are too long for a
// "Fetch from X" button, so the manual-fetch panel uses these to reflect the
// indicator's actual data_source (e.g. EODHD vs FRED) instead of hardcoding FRED.
const FETCH_SOURCE_LABELS: Record<string, string> = {
  fred: "FRED",
  eodhd: "EODHD",
  crude_price_api: "Crude Price",
  nse_scrape: "NSE",
};

function fetchSourceLabel(dataSource: string | undefined): string {
  if (!dataSource) return "FRED";
  return FETCH_SOURCE_LABELS[dataSource] ?? dataSource.toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FetchLog["status"] }) {
  const config = {
    success: { color: "var(--lucid-pos)", bg: "var(--lucid-pos-bg)", bd: "var(--lucid-pos-bd)", Icon: CheckCircle2, label: "Success" },
    partial: { color: "var(--lucid-warn)", bg: "var(--lucid-warn-bg)", bd: "var(--lucid-warn-bd)", Icon: AlertCircle, label: "Partial" },
    failed: { color: "var(--lucid-neg)", bg: "var(--lucid-neg-bg)", bd: "var(--lucid-neg-bd)", Icon: XCircle, label: "Failed" },
    running: { color: "var(--lucid-accent)", bg: "var(--lucid-accent-bg)", bd: "var(--lucid-accent-bd)", Icon: Loader2, label: "Running" },
  }[status];

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ background: config.bg, color: config.color, border: `1px solid ${config.bd}` }}
    >
      <config.Icon size={10} className={status === "running" ? "animate-spin" : ""} />
      {config.label}
    </span>
  );
}

function ResultBanner({ success, message, onDismiss }: { success: boolean; message: string; onDismiss: () => void }) {
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

const RBI_CYCLE_STATES: { value: string; label: string }[] = [
  { value: "cutting", label: "Cutting \u2013 RBI is actively cutting rates" },
  { value: "paused_after_hikes", label: "Paused After Hikes \u2013 hold following a hike cycle" },
  { value: "hold_neutral", label: "Hold / Neutral \u2013 no strong bias" },
  { value: "hawkish_hold", label: "Hawkish Hold \u2013 hold but tone is hawkish" },
  { value: "hiking", label: "Hiking \u2013 RBI is actively hiking rates" },
];

function ManualEntryPanel({
  code,
  onSuccess,
}: {
  code: string;
  onSuccess: (msg: string) => void;
}) {
  const isRbiRate = code === "IND_NIFTY_04_RBI_RATE";
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [cycleState, setCycleState] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      submitNiftyManualInput({
        indicator_code: code,
        observation_date: date,
        value: parseFloat(value),
        notes: notes || undefined,
        allow_overwrite: allowOverwrite,
        source_metadata: isRbiRate ? { state: cycleState } : undefined,
      }),
    onSuccess: (res) => {
      const action = res.result?.action ?? "submitted";
      onSuccess(`Value ${action}: ${res.result?.value} for ${res.result?.observationDate}`);
      setValue("");
      setNotes("");
      if (isRbiRate) setCycleState("");
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
        style={{ background: "var(--lucid-accent-bg)", border: "1px solid var(--lucid-accent-bd)", color: "var(--lucid-accent)" }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>This indicator requires manual data entry. Fill in the observed value for the desired date.</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>
            Observation Date <span style={{ color: "var(--lucid-neg)" }}>*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="lt-num rounded-lg px-3 py-2 text-sm outline-none focus:ring-1"
            style={{
              background: "var(--lucid-surface-2)",
              border: "1px solid var(--lucid-line-2)",
              color: "var(--lucid-ink)",
              colorScheme: "dark",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lucid-accent-bd)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--lucid-line-2)")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>
            Value <span style={{ color: "var(--lucid-neg)" }}>*</span>
          </label>
          <input
            type="number"
            step="any"
            placeholder="e.g. 54.6"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="lt-num rounded-lg px-3 py-2 text-sm outline-none focus:ring-1"
            style={{
              background: "var(--lucid-surface-2)",
              border: "1px solid var(--lucid-line-2)",
              color: "var(--lucid-ink)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lucid-accent-bd)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--lucid-line-2)")}
          />
        </div>
      </div>

      {isRbiRate && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>
            RBI Cycle State <span style={{ color: "var(--lucid-neg)" }}>*</span>
          </label>
          <select
            value={cycleState}
            onChange={(e) => setCycleState(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--lucid-surface-2)",
              border: `1px solid ${cycleState === "" ? "var(--lucid-neg-bd)" : "var(--lucid-line-2)"}`,
              color: cycleState === "" ? "var(--lucid-ink-3)" : "var(--lucid-ink)",
              colorScheme: "dark",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lucid-accent-bd)")}
            onBlur={(e) =>
              (e.currentTarget.style.borderColor =
                cycleState === "" ? "var(--lucid-neg-bd)" : "var(--lucid-line-2)")
            }
          >
            <option value="" disabled style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-3)" }}>
              Select cycle state...
            </option>
            {RBI_CYCLE_STATES.map((s) => (
              <option key={s.value} value={s.value} style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink)" }}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>
          Notes (optional)
        </label>
        <textarea
          rows={2}
          placeholder="Source reference or context..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none resize-none"
          style={{
            background: "var(--lucid-surface-2)",
            border: "1px solid var(--lucid-line-2)",
            color: "var(--lucid-ink)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lucid-accent-bd)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--lucid-line-2)")}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={allowOverwrite}
          onChange={(e) => setAllowOverwrite(e.target.checked)}
          className="rounded"
          style={{ accentColor: "var(--lucid-accent)" }}
        />
        <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
          Allow overwrite (creates new vintage even if value is identical)
        </span>
      </label>

      {mutation.error && (
        <p className="text-xs" style={{ color: "var(--lucid-neg)" }}>
          Error: {(mutation.error as Error).message}
        </p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !value || !date || (isRbiRate && !cycleState)}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
        style={{
          background: mutation.isPending ? "var(--lucid-accent-bg)" : "var(--lucid-accent)",
          color: "var(--lucid-bg)",
        }}
      >
        {mutation.isPending ? (
          <><Loader2 size={14} className="animate-spin" /> Submitting...</>
        ) : (
          <><Database size={14} /> Submit Value</>
        )}
      </button>
    </div>
  );
}

function FredFetchPanel({
  code,
  dataSource,
  onSuccess,
}: {
  code: string;
  dataSource?: string;
  onSuccess: (msg: string) => void;
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const sourceLabel = fetchSourceLabel(dataSource);

  const mutation = useMutation({
    mutationFn: () =>
      fetchFredIndicator({
        indicator_code: code,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
    onSuccess: () => onSuccess(`${sourceLabel} fetch triggered for ${code}. Check logs for status.`),
  });

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
        style={{ background: "var(--lucid-accent-bg)", border: "1px solid var(--lucid-accent-bd)", color: "var(--lucid-accent)" }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Fetches data from the {sourceLabel} API. Optionally restrict the date range; omit both to fetch all available data.
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>
            Date From (optional)
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="lt-num rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--lucid-surface-2)",
              border: "1px solid var(--lucid-line-2)",
              color: "var(--lucid-ink)",
              colorScheme: "dark",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lucid-accent-bd)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--lucid-line-2)")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>
            Date To (optional)
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="lt-num rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--lucid-surface-2)",
              border: "1px solid var(--lucid-line-2)",
              color: "var(--lucid-ink)",
              colorScheme: "dark",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lucid-accent-bd)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--lucid-line-2)")}
          />
        </div>
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
        style={{ background: mutation.isPending ? "var(--lucid-accent-bg)" : "var(--lucid-accent)", color: "var(--lucid-bg)" }}
      >
        {mutation.isPending ? (
          <><Loader2 size={14} className="animate-spin" /> Fetching...</>
        ) : (
          <><Play size={14} /> Fetch from {sourceLabel}</>
        )}
      </button>
    </div>
  );
}

function NseSimplePanel({
  type,
  onSuccess,
}: {
  type: "vix" | "fii_dii";
  onSuccess: (msg: string) => void;
}) {
  const mutation = useMutation({
    mutationFn: () => (type === "vix" ? scrapeNseVix() : scrapeNseFiiDii()),
    onSuccess: () =>
      onSuccess(
        `NSE ${type === "vix" ? "VIX" : "FII/DII"} scrape triggered. Check logs for status.`,
      ),
  });

  const label = type === "vix" ? "NSE VIX" : "NSE FII/DII";

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
        style={{ background: "var(--lucid-warn-bg)", border: "1px solid var(--lucid-warn-bd)", color: "var(--lucid-warn)" }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Scrapes live data from the NSE (National Stock Exchange of India) website. No parameters
          needed — fetches the latest available data.
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
        style={{ background: mutation.isPending ? "var(--lucid-warn-bg)" : "var(--lucid-warn)", color: "var(--lucid-bg)" }}
      >
        {mutation.isPending ? (
          <><Loader2 size={14} className="animate-spin" /> Scraping...</>
        ) : (
          <><Play size={14} /> Scrape {label}</>
        )}
      </button>
    </div>
  );
}

function NseParticipantOiPanel({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const [mode, setMode] = useState<"today" | "single" | "range">("today");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === "today") return scrapeNseParticipantOi();
      if (mode === "single") return scrapeNseParticipantOi({ observation_date: date });
      return scrapeNseParticipantOi({ date_from: dateFrom, date_to: dateTo });
    },
    onSuccess: () => onSuccess("NSE Participant OI scrape triggered. Check logs for status."),
  });

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
        style={{ background: "var(--lucid-warn-bg)", border: "1px solid var(--lucid-warn-bd)", color: "var(--lucid-warn)" }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>Scrapes NSE Participant Open Interest data. Choose today, a specific date, or a date range for backfill.</span>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        {(["today", "single", "range"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all capitalize"
            style={{
              background: mode === m ? "var(--lucid-accent)" : "var(--lucid-surface-2)",
              color: mode === m ? "var(--lucid-bg)" : "var(--lucid-ink-3)",
              border: mode === m ? "1px solid var(--lucid-accent)" : "1px solid var(--lucid-line)",
            }}
          >
            {m === "today" ? "Today" : m === "single" ? "Specific Date" : "Date Range"}
          </button>
        ))}
      </div>

      {mode === "single" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>
            Observation Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="lt-num rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line-2)", color: "var(--lucid-ink)", colorScheme: "dark" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lucid-accent-bd)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--lucid-line-2)")}
          />
        </div>
      )}

      {mode === "range" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Date From", value: dateFrom, set: setDateFrom },
            { label: "Date To", value: dateTo, set: setDateTo },
          ].map(({ label, value, set }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--lucid-ink-2)" }}>
                {label}
              </label>
              <input
                type="date"
                value={value}
                onChange={(e) => set(e.target.value)}
                className="lt-num rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line-2)", color: "var(--lucid-ink)", colorScheme: "dark" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--lucid-accent-bd)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--lucid-line-2)")}
              />
            </div>
          ))}
        </div>
      )}

      {mutation.error && (
        <p className="text-xs" style={{ color: "var(--lucid-neg)" }}>
          Error: {(mutation.error as Error).message}
        </p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || (mode === "range" && (!dateFrom || !dateTo))}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: mutation.isPending ? "var(--lucid-warn-bg)" : "var(--lucid-warn)", color: "var(--lucid-bg)" }}
      >
        {mutation.isPending ? (
          <><Loader2 size={14} className="animate-spin" /> Scraping...</>
        ) : (
          <><Play size={14} /> Scrape NSE Participant OI</>
        )}
      </button>
    </div>
  );
}

function Ind9BridgePanel({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const LOG_JOB = "nifty_ind9_bridge";
  const STORAGE_KEY = "poll:nifty:ind9_bridge";

  const [triggerTime, setTriggerTime] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [lastLog, setLastLog] = useState<FetchLog | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore polling state across navigation / page refresh
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const t = new Date(raw);
      const elapsed = Date.now() - t.getTime();
      if (elapsed > 90_000) { sessionStorage.removeItem(STORAGE_KEY); return; }
      setTriggerTime(t);
      setIsPolling(true);
      pollTimerRef.current = setTimeout(() => {
        setIsPolling(false);
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      }, 90_000 - elapsed);
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); }, []);

  const mutation = useMutation({
    mutationFn: () => triggerCronJob("nifty_ind9_bridge"),
    onSuccess: () => {
      setTriggerError(null);
      setLastLog(null);
      const fired = new Date();
      setTriggerTime(fired);
      try { sessionStorage.setItem(STORAGE_KEY, fired.toISOString()); } catch {}
      setTimeout(() => setIsPolling(true), 1500);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      pollTimerRef.current = setTimeout(() => {
        setIsPolling(false);
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      }, 90_000);
    },
    onError: (err: Error) => setTriggerError(err.message),
  });

  const { data: logsData } = useQuery({
    queryKey: ["pollLogs", LOG_JOB],
    queryFn: () => getAdminLogs({ job_name: LOG_JOB, limit: 3 }),
    enabled: isPolling,
    refetchInterval: 3_000,
    staleTime: 0,
  });

  useEffect(() => {
    if (!isPolling || !logsData?.logs?.length || !triggerTime) return;
    const fresh = logsData.logs.find(
      (l) => l.completedAt != null && new Date(l.startedAt) >= triggerTime,
    );
    if (fresh) {
      setLastLog(fresh);
      setIsPolling(false);
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (fresh.status === "success") {
        onSuccess("Ind9 Bridge completed — USD score written as NIFTY Ind9.");
      }
    }
  }, [logsData, isPolling, triggerTime, onSuccess]);

  const isPending = mutation.isPending || isPolling;
  const statusColor =
    lastLog?.status === "success" ? "var(--lucid-pos)" :
    lastLog?.status === "failed"  ? "var(--lucid-neg)" : "var(--lucid-warn)";
  const statusBg =
    lastLog?.status === "success" ? "var(--lucid-pos-bg)" :
    lastLog?.status === "failed"  ? "var(--lucid-neg-bg)" : "var(--lucid-warn-bg)";
  const statusBd =
    lastLog?.status === "success" ? "var(--lucid-pos-bd)" :
    lastLog?.status === "failed"  ? "var(--lucid-neg-bd)" : "var(--lucid-warn-bd)";

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
        style={{ background: "var(--lucid-ctx-bg)", border: "1px solid var(--lucid-ctx-bd)", color: "var(--lucid-ctx)" }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          This is a derived indicator. The Ind9 Bridge reads the latest EdgeFinder USD asset scorecard total score and writes it as NIFTY&apos;s Section 9 (USD Weakness) data point. Run EdgeFinder scorecard assembly first.
        </span>
      </div>

      {triggerError && (
        <p className="text-xs" style={{ color: "var(--lucid-neg)" }}>Error: {triggerError}</p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={isPending}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: isPending ? "var(--lucid-accent-bg)" : "var(--lucid-accent)", color: "var(--lucid-bg)" }}
      >
        {mutation.isPending ? (
          <><Loader2 size={14} className="animate-spin" /> Triggering...</>
        ) : isPolling ? (
          <><Loader2 size={14} className="animate-spin" /> Running...</>
        ) : (
          <><RefreshCw size={14} /> Run Ind9 Bridge</>
        )}
      </button>

      {isPolling && !lastLog && (
        <div className="flex items-center gap-1.5">
          <Clock size={13} style={{ color: "var(--lucid-ink-3)" }} />
          <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>Waiting for job to complete…</span>
        </div>
      )}

      {lastLog && (
        <div
          className="rounded-lg px-3 py-2.5 flex flex-col gap-1"
          style={{ background: statusBg, border: `1px solid ${statusBd}` }}
        >
          <div className="flex items-center gap-1.5">
            {lastLog.status === "success"
              ? <CheckCircle2 size={13} style={{ color: "var(--lucid-pos)" }} />
              : lastLog.status === "failed"
              ? <XCircle size={13} style={{ color: "var(--lucid-neg)" }} />
              : <AlertCircle size={13} style={{ color: "var(--lucid-warn)" }} />}
            <span className="text-xs font-semibold capitalize" style={{ color: statusColor }}>{lastLog.status}</span>
          </div>
          <p className="lt-num text-xs" style={{ color: "var(--lucid-ink-3)" }}>
            {lastLog.durationMs != null
              ? lastLog.durationMs < 1000 ? `${lastLog.durationMs}ms` : `${(lastLog.durationMs / 1000).toFixed(1)}s`
              : "—"}
            {" · "}+{lastLog.rowsInserted} in · ~{lastLog.rowsUpdated} up
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NiftyIndicatorDetailPage() {
  const params = useParams();
  const code = decodeURIComponent(params.code as string);
  const { isAdmin } = useAuth();

  const [banner, setBanner] = useState<{ success: boolean; message: string } | null>(null);

  const pipeline = getNiftyPipeline(code);
  const logJobName = NIFTY_LOG_JOB_NAMES[code] ?? "fred_fetch";

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

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ["admin", "logs", logJobName],
    queryFn: () => getAdminLogs({ job_name: logJobName, limit: 8 }),
    enabled: isAdmin,
    staleTime: 30_000,
  });

  const handleSuccess = (msg: string) => {
    setBanner({ success: true, message: msg });
    setTimeout(() => {
      refetchLatest();
      refetchLogs();
    }, 2000);
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle size={40} style={{ color: "var(--lucid-neg)" }} />
        <p className="lt-serif text-lg font-medium" style={{ color: "var(--lucid-ink)" }}>
          Admin access required
        </p>
      </div>
    );
  }

  const indicator = latestData?.indicator;
  const dataPoints: DataPoint[] = latestData?.data ?? [];
  const logs: FetchLog[] = logsData?.logs ?? [];
  // Prefer the indicator's actual data_source; fall back to the pipeline only
  // when it's unavailable (e.g. still loading). Keeps the header chip consistent
  // with the list page (e.g. EODHD/teal for DXY/Brent/USD-INR, not FRED/blue).
  const sourceKey = indicator?.dataSource ?? pipeline;
  const sourceColor = DATA_SOURCE_COLORS[sourceKey] ?? "var(--lucid-ink-3)";

  return (
    <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm flex-wrap" style={{ color: "var(--lucid-ink-3)" }}>
        <Link href="/data" className="hover:opacity-80 transition-colors" style={{ color: "var(--lucid-ink-2)" }}>Data</Link>
        <ChevronRight size={14} />
        <Link href="/data/nifty" className="hover:opacity-80 transition-colors" style={{ color: "var(--lucid-ink-2)" }}>NIFTY</Link>
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="lt-num rounded-lg px-2 py-0.5 text-xs" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-3)" }}>
                {code}
              </span>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ background: "var(--lucid-surface-2)", color: sourceColor, border: "1px solid var(--lucid-line-2)" }}
              >
                {DATA_SOURCE_LABELS[sourceKey] ?? sourceKey}
              </span>
              {indicator?.frequency && (
                <span className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-3)", border: "1px solid var(--lucid-line)" }}>
                  {FREQUENCY_LABELS[indicator.frequency] ?? indicator.frequency}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Banner */}
      {banner && (
        <div className="mb-4">
          <ResultBanner
            success={banner.success}
            message={banner.message}
            onDismiss={() => setBanner(null)}
          />
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Pipeline panel */}
        <div className="lg:col-span-3">
          <div
            className="lt-card rounded-2xl p-4 sm:p-5 flex flex-col gap-4"
          >
            <div>
              <h2 className="lt-serif text-sm font-semibold" style={{ color: "var(--lucid-ink)" }}>
                Data Pipeline
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>
                Trigger or submit data for this indicator
              </p>
            </div>

            {pipeline === "manual" && <ManualEntryPanel code={code} onSuccess={handleSuccess} />}
            {pipeline === "fred" && <FredFetchPanel code={code} dataSource={indicator?.dataSource} onSuccess={handleSuccess} />}
            {pipeline === "nse_vix" && <NseSimplePanel type="vix" onSuccess={handleSuccess} />}
            {pipeline === "nse_fii_dii" && <NseSimplePanel type="fii_dii" onSuccess={handleSuccess} />}
            {pipeline === "nse_participant_oi" && <NseParticipantOiPanel onSuccess={handleSuccess} />}
            {pipeline === "ind9_bridge" && <Ind9BridgePanel onSuccess={handleSuccess} />}
          </div>
        </div>

        {/* Right: Recent data points */}
        <div className="lg:col-span-2">
          <div
            className="lt-card rounded-2xl p-4 sm:p-5 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="lt-serif text-sm font-semibold" style={{ color: "var(--lucid-ink)" }}>
                  Recent Data Points
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>
                  Last 10 ingested values
                </p>
              </div>
              <button onClick={() => refetchLatest()} style={{ color: "var(--lucid-ink-3)" }} title="Refresh">
                <RefreshCw size={14} />
              </button>
            </div>

            {latestLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin" style={{ color: "var(--lucid-accent)" }} />
              </div>
            ) : dataPoints.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "var(--lucid-ink-3)" }}>
                No data points yet
              </p>
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
                        {idx === 0 && (
                          <span className="ml-1.5 text-[9px] rounded-full px-1.5 py-0.5" style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)" }}>
                            current
                          </span>
                        )}
                      </p>
                      <p className="lt-num text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>
                        {dp.observationDate}
                      </p>
                    </div>
                    <div className="text-right">
                      {dp.dataQualityFlag && (
                        <p className="text-[9px] mb-0.5" style={{ color: "var(--lucid-warn)" }}>
                          {dp.dataQualityFlag}
                        </p>
                      )}
                      <p className="lt-num text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>
                        {formatRelativeDate(dp.fetchedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
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
            <h2 className="lt-serif text-sm font-semibold" style={{ color: "var(--lucid-ink)" }}>
              Recent Fetch Logs
            </h2>
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--lucid-ink-3)" }}>
              Job: <span className="lt-num" style={{ color: "var(--lucid-ink-3)" }}>{logJobName}</span>
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
          <p className="text-sm text-center py-6" style={{ color: "var(--lucid-ink-3)" }}>
            No logs yet for this job
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: "0 4px" }}>
              <thead>
                <tr>
                  {["Status", "Trigger", "Started", "Duration", "Rows In", "Rows Up"].map((h) => (
                    <th
                      key={h}
                      className="text-left pb-2 text-[10px] uppercase tracking-wider font-medium"
                      style={{ color: "var(--lucid-ink-3)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-1 pr-4">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="py-1 pr-4">
                      <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                        {log.triggerType}
                      </span>
                    </td>
                    <td className="py-1 pr-4">
                      <div>
                        <p className="lt-num text-xs" style={{ color: "var(--lucid-ink-2)" }}>
                          {new Date(log.startedAt).toLocaleDateString()}
                        </p>
                        <p className="lt-num text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>
                          {new Date(log.startedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </td>
                    <td className="py-1 pr-4">
                      <span className="lt-num text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                        {log.durationMs != null
                          ? log.durationMs < 1000
                            ? `${log.durationMs}ms`
                            : `${(log.durationMs / 1000).toFixed(1)}s`
                          : "—"}
                      </span>
                    </td>
                    <td className="py-1 pr-4">
                      <span className="lt-num text-xs font-medium" style={{ color: "var(--lucid-pos)" }}>
                        +{log.rowsInserted}
                      </span>
                    </td>
                    <td className="py-1">
                      <span className="lt-num text-xs font-medium" style={{ color: "var(--lucid-warn)" }}>
                        ~{log.rowsUpdated}
                      </span>
                    </td>
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
