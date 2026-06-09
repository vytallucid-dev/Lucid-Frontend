"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, AlertCircle, Loader2, BarChart2, Play, CheckCircle2, XCircle, Clock, Info, Pencil, X } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import {
  getAdminIndicators,
  getAdminLogs,
  triggerCronJob,
  getCycleStances,
  updateCycleStance,
  type AdminIndicator,
  type CronJobName,
  type FetchLog,
  type CycleStance,
  type CycleStanceRow,
  TRIGGER_TO_LOG_JOB_NAME,
} from "@/lib/api/admin";
import {
  getEdgefinderPipeline,
  DATA_SOURCE_COLORS,
  DATA_SOURCE_LABELS,
  getFreshnessStatus,
  FRESHNESS_COLORS,
  FRESHNESS_LABELS,
  formatRelativeDate,
  PIPELINE_LABELS,
} from "@/lib/admin-pipeline";

function IndicatorCard({ indicator }: { indicator: AdminIndicator }) {
  const pipeline = getEdgefinderPipeline(indicator);
  const freshness = getFreshnessStatus(indicator);
  const sourceColor = DATA_SOURCE_COLORS[indicator.dataSource] ?? "#64748B";
  const freshnessColor = FRESHNESS_COLORS[freshness];

  return (
    <Link
      href={`/data/edgefinder/${encodeURIComponent(indicator.code)}`}
      className="flex flex-col gap-3 rounded-xl p-4 transition-all duration-200 group hover:scale-[1.01]"
      style={{
        background: "rgba(10, 22, 40, 0.6)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(59,130,246,0.3)";
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 0 20px rgba(59,130,246,0.06)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.06)";
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "#F1F5F9" }}>
            {indicator.name}
          </p>
          <p className="text-[10px] font-mono truncate" style={{ color: "#475569" }}>
            {indicator.code}
          </p>
        </div>
        <ChevronRight
          size={14}
          className="shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
          style={{ color: "#334155" }}
        />
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            background: `${sourceColor}14`,
            color: sourceColor,
            border: `1px solid ${sourceColor}28`,
          }}
        >
          {DATA_SOURCE_LABELS[indicator.dataSource] ?? indicator.dataSource}
        </span>
        {(pipeline === "manual" || pipeline === "manual_rate") && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: "rgba(167,139,250,0.12)",
              color: "#A78BFA",
              border: "1px solid rgba(167,139,250,0.25)",
            }}
          >
            Manual Entry
          </span>
        )}
        {indicator.uiGroup && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "#64748B",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {indicator.uiGroup}
          </span>
        )}
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            background: `${freshnessColor}12`,
            color: freshnessColor,
            border: `1px solid ${freshnessColor}28`,
          }}
        >
          {FRESHNESS_LABELS[freshness]}
        </span>
      </div>

      {/* Last data point */}
      <div
        className="rounded-lg px-3 py-2 flex items-center justify-between"
        style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.04)" }}
      >
        {indicator.latestDataPoint ? (
          <>
            <div>
              <p className="text-[10px]" style={{ color: "#475569" }}>
                Last value
              </p>
              <p className="text-sm font-semibold" style={{ color: "#F1F5F9" }}>
                {indicator.latestDataPoint.value}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px]" style={{ color: "#475569" }}>
                As of
              </p>
              <p className="text-xs" style={{ color: "#94A3B8" }}>
                {indicator.latestDataPoint.observationDate}
              </p>
              <p className="text-[10px]" style={{ color: "#475569" }}>
                {formatRelativeDate(indicator.latestDataPoint.fetchedAt)}
              </p>
            </div>
          </>
        ) : (
          <p className="text-xs" style={{ color: "#475569" }}>
            No data yet
          </p>
        )}
      </div>

      <p className="text-[10px]" style={{ color: "#475569" }}>
        Pipeline:{" "}
        <span style={{ color: "#64748B" }}>{PIPELINE_LABELS[pipeline]}</span>
      </p>
    </Link>
  );
}

// ─── Cycle Stance Manager ─────────────────────────────────────────────────────

const CURRENCY_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
};

const STANCE_CONFIG: Record<CycleStance, { label: string; color: string; bg: string; border: string }> = {
  CUTTING: { label: "Cutting", color: "#F97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.3)" },
  NEUTRAL: { label: "Neutral", color: "#94A3B8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)" },
  HIKING:  { label: "Hiking",  color: "#10B981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.3)"  },
};

function StanceBadge({ stance }: { stance: CycleStance }) {
  const cfg = STANCE_CONFIG[stance];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

function CycleStanceCard({ row, onSaved }: { row: CycleStanceRow; onSaved: (msg: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [stance, setStance] = useState<CycleStance>(row.stance);
  const [effectiveFrom, setEffectiveFrom] = useState(row.effectiveFrom);
  const [notes, setNotes] = useState(row.notes ?? "");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      updateCycleStance(row.currencyCode, {
        stance,
        effectiveFrom: effectiveFrom || undefined,
        notes: notes || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "cycle-stances"] });
      const actionLabel =
        res.action === "updated" ? "Stance updated" :
        res.action === "created" ? "Stance created" :
        "No change";
      onSaved(`${row.currencyCode}: ${actionLabel}`);
      setEditing(false);
    },
  });

  // Sync form fields when the row is refreshed after a save
  useEffect(() => {
    setStance(row.stance);
    setEffectiveFrom(row.effectiveFrom);
    setNotes(row.notes ?? "");
  }, [row.stance, row.effectiveFrom, row.notes]);

  const inputStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#F1F5F9",
  } as const;

  const selectStyle = {
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#F1F5F9",
    colorScheme: "dark",
  } as const;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: "rgba(10,22,40,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{CURRENCY_FLAGS[row.currencyCode] ?? "🏦"}</span>
          <span className="text-sm font-semibold" style={{ color: "#F1F5F9" }}>
            {row.currencyCode}
          </span>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", color: "#64748B", border: "1px solid rgba(255,255,255,0.08)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
          >
            <Pencil size={11} /> Edit
          </button>
        ) : (
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg p-1 transition-colors"
            style={{ color: "#64748B" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#94A3B8"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#64748B"; }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Current stance display */}
      {!editing && (
        <>
          <StanceBadge stance={row.stance} />
          <p className="text-[10px]" style={{ color: "#475569" }}>
            Since {row.effectiveFrom}
          </p>
          {row.notes && (
            <p className="text-[10px]" style={{ color: "#64748B" }}>
              {row.notes}
            </p>
          )}
        </>
      )}

      {/* Edit form */}
      {editing && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>
              Stance <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <select
              value={stance}
              onChange={(e) => setStance(e.target.value as CycleStance)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={selectStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            >
              <option value="CUTTING" style={{ background: "#0f172a", color: "#F1F5F9" }}>Cutting</option>
              <option value="NEUTRAL" style={{ background: "#0f172a", color: "#F1F5F9" }}>Neutral</option>
              <option value="HIKING" style={{ background: "#0f172a", color: "#F1F5F9" }}>Hiking</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>
              Effective From (optional)
            </label>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ ...inputStyle, colorScheme: "dark" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "#64748B" }}>
              Notes (optional)
            </label>
            <input
              type="text"
              maxLength={500}
              placeholder="e.g. Fed data-dependent stance"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#3B82F6")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          {mutation.error && (
            <p className="text-xs" style={{ color: "#EF4444" }}>
              {(mutation.error as Error).message}
            </p>
          )}

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: mutation.isPending ? "rgba(59,130,246,0.3)" : "#3B82F6", color: "#fff" }}
          >
            {mutation.isPending ? (
              <><Loader2 size={13} className="animate-spin" /> Saving...</>
            ) : (
              "Save"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function CycleStanceManager() {
  const [toast, setToast] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "cycle-stances"],
    queryFn: getCycleStances,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div
      className="mb-6 rounded-2xl p-4 sm:p-5"
      style={{ background: "rgba(10,22,40,0.7)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "#F1F5F9" }}>
            Central Bank Cycle Stances
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
            Controls how CPI releases are scored per currency region.
          </p>
        </div>
        <div className="group relative shrink-0">
          <Info size={14} style={{ color: "#475569", cursor: "pointer" }} />
          <div
            className="absolute right-0 top-5 z-10 hidden group-hover:block w-64 sm:w-72 rounded-xl p-3 text-[11px] leading-relaxed shadow-xl"
            style={{
              background: "rgba(15,23,42,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#94A3B8",
            }}
          >
            During <span style={{ color: "#10B981" }}>HIKING</span> cycles, a CPI miss scores 0 (not &minus;1) because high
            inflation supports the hiking narrative. During{" "}
            <span style={{ color: "#F97316" }}>CUTTING</span> cycles, both beats and meets score +1 because lower
            inflation supports further cuts.
          </div>
        </div>
      </div>

      {toast && (
        <div
          className="mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          style={{
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.25)",
            color: "#6EE7B7",
          }}
        >
          <CheckCircle2 size={14} style={{ color: "#10B981" }} />
          {toast}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 py-6 justify-center" style={{ color: "#475569" }}>
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Loading stances…</span>
        </div>
      )}

      {error && (
        <div
          className="mt-4 rounded-xl p-3 flex items-center gap-2"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444" }}
        >
          <AlertCircle size={14} />
          <span className="text-xs">Failed to load cycle stances</span>
        </div>
      )}

      {data && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.stances.map((row) => (
            <CycleStanceCard key={row.currencyCode} row={row} onSaved={setToast} />
          ))}
        </div>
      )}
    </div>
  );
}

const COUNTRY_GROUPS: { key: string; label: string; filter: (ind: AdminIndicator) => boolean }[] = [
  { key: "US", label: "United States (US)", filter: (i) => i.country === "US" && !i.code.endsWith("_RATE") && !i.code.endsWith("_COT") },
  { key: "EU", label: "Euro Zone (EU)", filter: (i) => i.country === "EU" && !i.code.endsWith("_RATE") && !i.code.endsWith("_COT") },
  { key: "UK", label: "United Kingdom (UK)", filter: (i) => i.country === "UK" && !i.code.endsWith("_RATE") && !i.code.endsWith("_COT") },
  { key: "JP", label: "Japan (JP)", filter: (i) => i.country === "JP" && !i.code.endsWith("_RATE") && !i.code.endsWith("_COT") },
  { key: "RATES", label: "Central Bank Rate Decisions", filter: (i) => i.code.endsWith("_RATE") || i.frequency === "event_driven" },
  { key: "COT", label: "CFTC Commitment of Traders (COT)", filter: (i) => i.dataSource === "cftc" || i.code.endsWith("_COT") },
];

const EF_PIPELINE_JOBS: { label: string; job: CronJobName; color: string; description: string }[] = [
  { label: "Forex Factory Fetch", job: "forex_factory_fetch", color: "#10B981", description: "Fetches weekly economic calendar events for all tracked currencies." },
  { label: "CFTC COT Fetch", job: "cftc_cot_fetch", color: "#8B5CF6", description: "Fetches weekly Commitment of Traders data (runs Fridays)." },
  { label: "Compass Inputs", job: "compass_inputs_fetch", color: "#3B82F6", description: "Ingests all 6 Compass regime input signals." },
  { label: "Compass Classifier", job: "compass_classifier_run", color: "#06B6D4", description: "Classifies today's regime from Compass inputs." },
  { label: "EF Scorecard", job: "scorecard_assembly", color: "#F59E0B", description: "Assembles EdgeFinder asset scorecards." },
  { label: "Pair Score", job: "pair_score_assembly", color: "#F97316", description: "Computes pair scores from asset scorecards + Compass regime." },
];

function PipelineButton({ label, job, color, description }: { label: string; job: CronJobName; color: string; description: string }) {
  const logJobName = TRIGGER_TO_LOG_JOB_NAME[job];
  const storageKey = `poll:ef:${job}`;

  const [triggerTime, setTriggerTime] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [lastLog, setLastLog] = useState<FetchLog | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore polling state from sessionStorage after navigation / refresh
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const t = new Date(raw);
      const elapsed = Date.now() - t.getTime();
      if (elapsed > 90_000) { sessionStorage.removeItem(storageKey); return; }
      setTriggerTime(t);
      setIsPolling(true);
      pollTimerRef.current = setTimeout(() => {
        setIsPolling(false);
        try { sessionStorage.removeItem(storageKey); } catch {}
      }, 90_000 - elapsed);
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timer on unmount
  useEffect(() => () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); }, []);

  const mutation = useMutation({
    mutationFn: () => triggerCronJob(job),
    onSuccess: () => {
      setTriggerError(null);
      setLastLog(null);
      const fired = new Date();
      setTriggerTime(fired);
      try { sessionStorage.setItem(storageKey, fired.toISOString()); } catch {}
      // small delay so the job has time to insert a log row
      setTimeout(() => setIsPolling(true), 1500);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      pollTimerRef.current = setTimeout(() => {
        setIsPolling(false);
        try { sessionStorage.removeItem(storageKey); } catch {}
      }, 90_000);
    },
    onError: (err: Error) => setTriggerError(err.message),
  });

  const { data: logsData } = useQuery({
    queryKey: ["pollLogs", logJobName],
    queryFn: () => getAdminLogs({ job_name: logJobName, limit: 3 }),
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
      try { sessionStorage.removeItem(storageKey); } catch {}
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    }
  }, [logsData, isPolling, triggerTime, storageKey]);

  const isPending = mutation.isPending || isPolling;
  const statusColor = lastLog?.status === "success" ? "#10B981" : lastLog?.status === "failed" ? "#EF4444" : "#F59E0B";

  return (
    <div className="flex flex-col gap-2 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="text-xs font-medium" style={{ color: "#94A3B8" }}>{label}</p>
      <p className="text-[10px]" style={{ color: "#475569" }}>{description}</p>
      <button
        onClick={() => { mutation.mutate(); }}
        disabled={isPending}
        className="flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 mt-1"
        style={{ background: isPending ? `${color}40` : color, color: "#000" }}
      >
        {mutation.isPending
          ? <><Loader2 size={11} className="animate-spin" /> Triggering...</>
          : isPolling
          ? <><Loader2 size={11} className="animate-spin" /> Running...</>
          : <><Play size={11} /> Run</>}
      </button>

      {triggerError && (
        <div className="flex items-center gap-1.5">
          <XCircle size={11} style={{ color: "#EF4444" }} />
          <span className="text-[10px]" style={{ color: "#FCA5A5" }}>{triggerError}</span>
        </div>
      )}

      {isPolling && !lastLog && (
        <div className="flex items-center gap-1.5">
          <Clock size={11} style={{ color: "#64748B" }} />
          <span className="text-[10px]" style={{ color: "#64748B" }}>Waiting for job to complete…</span>
        </div>
      )}

      {lastLog && (
        <div
          className="rounded-lg px-2.5 py-2 flex flex-col gap-0.5"
          style={{ background: `${statusColor}08`, border: `1px solid ${statusColor}20` }}
        >
          <div className="flex items-center gap-1">
            {lastLog.status === "success"
              ? <CheckCircle2 size={11} style={{ color: "#10B981" }} />
              : lastLog.status === "failed"
              ? <XCircle size={11} style={{ color: "#EF4444" }} />
              : <AlertCircle size={11} style={{ color: "#F59E0B" }} />}
            <span className="text-[10px] font-semibold capitalize" style={{ color: statusColor }}>{lastLog.status}</span>
          </div>
          <p className="text-[10px]" style={{ color: "#475569" }}>
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

export default function EdgefinderDataPage() {
  const { isAdmin } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "indicators", "edgefinder"],
    queryFn: () => getAdminIndicators("edgefinder"),
    enabled: isAdmin,
    staleTime: 60_000,
  });

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

  const indicators = data?.data ?? [];

  return (
    <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: "#475569" }}>
        <Link href="/data" className="hover:text-[#94A3B8] transition-colors">
          Data
        </Link>
        <ChevronRight size={14} />
        <span style={{ color: "#94A3B8" }}>EdgeFinder</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div
          className="p-2.5 rounded-xl shrink-0"
          style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}
        >
          <BarChart2 size={20} style={{ color: "#3B82F6" }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold" style={{ color: "#F1F5F9" }}>
            EdgeFinder Indicators
          </h1>
          <p className="text-sm" style={{ color: "#64748B" }}>
            {isLoading ? "Loading..." : `${indicators.length} indicators`} — click any card to manage its data
          </p>
        </div>
      </div>

      {/* Pipeline Controls */}
      <div
        className="mb-6 rounded-2xl p-4 sm:p-5"
        style={{ background: "rgba(10,22,40,0.7)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <h2 className="text-sm font-semibold mb-1" style={{ color: "#F1F5F9" }}>
          Pipeline Controls
        </h2>
        <p className="text-xs mb-4" style={{ color: "#64748B" }}>
          Manually trigger EdgeFinder processing jobs.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {EF_PIPELINE_JOBS.map((j) => (
            <PipelineButton key={j.job} {...j} />
          ))}
        </div>
      </div>

      {/* Cycle Stance Manager */}
      <CycleStanceManager />

      {isLoading ? (
        <div className="flex items-center gap-2 py-20 justify-center" style={{ color: "#475569" }}>
          <Loader2 size={20} className="animate-spin" />
          <span>Loading indicators...</span>
        </div>
      ) : error ? (
        <div
          className="rounded-xl p-4 flex items-center gap-2"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444" }}
        >
          <AlertCircle size={16} />
          <span className="text-sm">Failed to load indicators</span>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {COUNTRY_GROUPS.map(({ key, label, filter }) => {
            const group = indicators.filter(filter);
            if (group.length === 0) return null;
            return (
              <section key={key}>
                <h2 className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: "#475569" }}>
                  {label} ({group.length})
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.map((ind) => (
                    <IndicatorCard key={ind.id} indicator={ind} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
