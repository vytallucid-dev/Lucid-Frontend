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
  IND_NIFTY_10_DXY: "fred_fetch",
  IND_NIFTY_11_BRENT: "fred_fetch",
  IND_NIFTY_12_USDINR: "fred_fetch",
  IND_NIFTY_13_FII_LS_RATIO: "nse_participant_oi",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function ResultBanner({ success, message, onDismiss }: { success: boolean; message: string; onDismiss: () => void }) {
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
        style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", color: "#C4B5FD" }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>This indicator requires manual data entry. Fill in the observed value for the desired date.</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "#94A3B8" }}>
            Observation Date <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-1"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#F1F5F9",
              colorScheme: "dark",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "#94A3B8" }}>
            Value <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <input
            type="number"
            step="any"
            placeholder="e.g. 54.6"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-1"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#F1F5F9",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
          />
        </div>
      </div>

      {isRbiRate && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "#94A3B8" }}>
            RBI Cycle State <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <select
            value={cycleState}
            onChange={(e) => setCycleState(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "#0f172a",
              border: `1px solid ${cycleState === "" ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
              color: cycleState === "" ? "#64748B" : "#F1F5F9",
              colorScheme: "dark",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
            onBlur={(e) =>
              (e.currentTarget.style.borderColor =
                cycleState === "" ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)")
            }
          >
            <option value="" disabled style={{ background: "#0f172a", color: "#64748B" }}>
              Select cycle state...
            </option>
            {RBI_CYCLE_STATES.map((s) => (
              <option key={s.value} value={s.value} style={{ background: "#0f172a", color: "#F1F5F9" }}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" style={{ color: "#94A3B8" }}>
          Notes (optional)
        </label>
        <textarea
          rows={2}
          placeholder="Source reference or context..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm outline-none resize-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#F1F5F9",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={allowOverwrite}
          onChange={(e) => setAllowOverwrite(e.target.checked)}
          className="rounded"
          style={{ accentColor: "#3B82F6" }}
        />
        <span className="text-xs" style={{ color: "#64748B" }}>
          Allow overwrite (creates new vintage even if value is identical)
        </span>
      </label>

      {mutation.error && (
        <p className="text-xs" style={{ color: "#EF4444" }}>
          Error: {(mutation.error as Error).message}
        </p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !value || !date || (isRbiRate && !cycleState)}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
        style={{
          background: mutation.isPending ? "rgba(59,130,246,0.3)" : "#3B82F6",
          color: "#fff",
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
          Fetches data from the US Federal Reserve (FRED) API. Optionally restrict the date range; omit both to fetch all available data.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "#94A3B8" }}>
            Date From (optional)
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#F1F5F9",
              colorScheme: "dark",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "#94A3B8" }}>
            Date To (optional)
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#F1F5F9",
              colorScheme: "dark",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
          />
        </div>
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
        style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#FCD34D" }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Scrapes live data from the NSE (National Stock Exchange of India) website. No parameters
          needed — fetches the latest available data.
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
        style={{ background: mutation.isPending ? "rgba(245,158,11,0.3)" : "#F59E0B", color: "#000" }}
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
        style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#FCD34D" }}
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
              background: mode === m ? "#3B82F6" : "rgba(255,255,255,0.04)",
              color: mode === m ? "#fff" : "#64748B",
              border: mode === m ? "1px solid #3B82F6" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {m === "today" ? "Today" : m === "single" ? "Specific Date" : "Date Range"}
          </button>
        ))}
      </div>

      {mode === "single" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: "#94A3B8" }}>
            Observation Date
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
      )}

      {mode === "range" && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Date From", value: dateFrom, set: setDateFrom },
            { label: "Date To", value: dateTo, set: setDateTo },
          ].map(({ label, value, set }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "#94A3B8" }}>
                {label}
              </label>
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
      )}

      {mutation.error && (
        <p className="text-xs" style={{ color: "#EF4444" }}>
          Error: {(mutation.error as Error).message}
        </p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || (mode === "range" && (!dateFrom || !dateTo))}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: mutation.isPending ? "rgba(245,158,11,0.3)" : "#F59E0B", color: "#000" }}
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
    lastLog?.status === "success" ? "#10B981" :
    lastLog?.status === "failed"  ? "#EF4444" : "#F59E0B";

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm"
        style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#A5B4FC" }}
      >
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          This is a derived indicator. The Ind9 Bridge reads the latest EdgeFinder USD asset scorecard total score and writes it as NIFTY&apos;s Section 9 (USD Weakness) data point. Run EdgeFinder scorecard assembly first.
        </span>
      </div>

      {triggerError && (
        <p className="text-xs" style={{ color: "#EF4444" }}>Error: {triggerError}</p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={isPending}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: isPending ? "rgba(99,102,241,0.3)" : "#6366F1", color: "#fff" }}
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
          <Clock size={13} style={{ color: "#64748B" }} />
          <span className="text-xs" style={{ color: "#64748B" }}>Waiting for job to complete…</span>
        </div>
      )}

      {lastLog && (
        <div
          className="rounded-lg px-3 py-2.5 flex flex-col gap-1"
          style={{ background: `${statusColor}08`, border: `1px solid ${statusColor}20` }}
        >
          <div className="flex items-center gap-1.5">
            {lastLog.status === "success"
              ? <CheckCircle2 size={13} style={{ color: "#10B981" }} />
              : lastLog.status === "failed"
              ? <XCircle size={13} style={{ color: "#EF4444" }} />
              : <AlertCircle size={13} style={{ color: "#F59E0B" }} />}
            <span className="text-xs font-semibold capitalize" style={{ color: statusColor }}>{lastLog.status}</span>
          </div>
          <p className="text-xs" style={{ color: "#475569" }}>
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
        <AlertCircle size={40} style={{ color: "#EF4444" }} />
        <p className="text-lg font-medium" style={{ color: "#F1F5F9" }}>
          Admin access required
        </p>
      </div>
    );
  }

  const indicator = latestData?.indicator;
  const dataPoints: DataPoint[] = latestData?.data ?? [];
  const logs: FetchLog[] = logsData?.logs ?? [];
  const sourceColor = DATA_SOURCE_COLORS["fred"] ?? "#64748B";

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto w-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm flex-wrap" style={{ color: "#475569" }}>
        <Link href="/data" className="hover:text-[#94A3B8] transition-colors">Data</Link>
        <ChevronRight size={14} />
        <Link href="/data/nifty" className="hover:text-[#94A3B8] transition-colors">NIFTY</Link>
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
                {DATA_SOURCE_LABELS[pipeline === "fred" ? "fred" : pipeline === "manual" ? "manual" : "nse_scrape"] ?? pipeline}
              </span>
              {indicator?.frequency && (
                <span className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: "rgba(255,255,255,0.04)", color: "#64748B", border: "1px solid rgba(255,255,255,0.06)" }}>
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

            {pipeline === "manual" && <ManualEntryPanel code={code} onSuccess={handleSuccess} />}
            {pipeline === "fred" && <FredFetchPanel code={code} onSuccess={handleSuccess} />}
            {pipeline === "nse_vix" && <NseSimplePanel type="vix" onSuccess={handleSuccess} />}
            {pipeline === "nse_fii_dii" && <NseSimplePanel type="fii_dii" onSuccess={handleSuccess} />}
            {pipeline === "nse_participant_oi" && <NseParticipantOiPanel onSuccess={handleSuccess} />}
            {pipeline === "ind9_bridge" && <Ind9BridgePanel onSuccess={handleSuccess} />}
          </div>
        </div>

        {/* Right: Recent data points */}
        <div className="lg:col-span-2">
          <div
            className="rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: "rgba(10,22,40,0.7)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "#F1F5F9" }}>
                  Recent Data Points
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                  Last 10 ingested values
                </p>
              </div>
              <button onClick={() => refetchLatest()} style={{ color: "#475569" }} title="Refresh">
                <RefreshCw size={14} />
              </button>
            </div>

            {latestLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={18} className="animate-spin" style={{ color: "#3B82F6" }} />
              </div>
            ) : dataPoints.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "#475569" }}>
                No data points yet
              </p>
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
                        {idx === 0 && (
                          <span className="ml-1.5 text-[9px] rounded-full px-1.5 py-0.5" style={{ background: "rgba(59,130,246,0.15)", color: "#60A5FA" }}>
                            current
                          </span>
                        )}
                      </p>
                      <p className="text-[10px]" style={{ color: "#475569" }}>
                        {dp.observationDate}
                      </p>
                    </div>
                    <div className="text-right">
                      {dp.dataQualityFlag && (
                        <p className="text-[9px] mb-0.5" style={{ color: "#F59E0B" }}>
                          {dp.dataQualityFlag}
                        </p>
                      )}
                      <p className="text-[10px]" style={{ color: "#334155" }}>
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
        className="mt-6 rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: "rgba(10,22,40,0.7)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "#F1F5F9" }}>
              Recent Fetch Logs
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
              Job: <span className="font-mono" style={{ color: "#475569" }}>{logJobName}</span>
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
          <p className="text-sm text-center py-6" style={{ color: "#475569" }}>
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
                      style={{ color: "#475569" }}
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
                      <span className="text-xs" style={{ color: "#64748B" }}>
                        {log.triggerType}
                      </span>
                    </td>
                    <td className="py-1 pr-4">
                      <div>
                        <p className="text-xs" style={{ color: "#94A3B8" }}>
                          {new Date(log.startedAt).toLocaleDateString()}
                        </p>
                        <p className="text-[10px]" style={{ color: "#475569" }}>
                          {new Date(log.startedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    </td>
                    <td className="py-1 pr-4">
                      <span className="text-xs" style={{ color: "#64748B" }}>
                        {log.durationMs != null
                          ? log.durationMs < 1000
                            ? `${log.durationMs}ms`
                            : `${(log.durationMs / 1000).toFixed(1)}s`
                          : "—"}
                      </span>
                    </td>
                    <td className="py-1 pr-4">
                      <span className="text-xs font-medium" style={{ color: "#10B981" }}>
                        +{log.rowsInserted}
                      </span>
                    </td>
                    <td className="py-1">
                      <span className="text-xs font-medium" style={{ color: "#F59E0B" }}>
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
