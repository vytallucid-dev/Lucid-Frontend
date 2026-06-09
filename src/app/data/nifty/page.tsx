"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronRight, AlertCircle, Loader2, Activity, Play, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import {
  getAdminIndicators,
  getAdminLogs,
  triggerCronJob,
  type AdminIndicator,
  type FetchLog,
  TRIGGER_TO_LOG_JOB_NAME,
} from "@/lib/api/admin";
import {
  getNiftyPipeline,
  DATA_SOURCE_COLORS,
  DATA_SOURCE_LABELS,
  getFreshnessStatus,
  FRESHNESS_COLORS,
  FRESHNESS_LABELS,
  formatRelativeDate,
  PIPELINE_LABELS,
} from "@/lib/admin-pipeline";

function IndicatorCard({ indicator }: { indicator: AdminIndicator }) {
  const pipeline = getNiftyPipeline(indicator.code);
  const freshness = getFreshnessStatus(indicator);
  const sourceColor = DATA_SOURCE_COLORS[indicator.dataSource] ?? "#64748B";
  const freshnessColor = FRESHNESS_COLORS[freshness];

  return (
    <Link
      href={`/data/nifty/${encodeURIComponent(indicator.code)}`}
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
      {/* Top row: order badge + name + arrow */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {indicator.displayOrder !== null && (
            <span
              className="shrink-0 flex items-center justify-center rounded-lg text-xs font-bold"
              style={{
                width: 28,
                height: 28,
                background: "rgba(59,130,246,0.12)",
                color: "#3B82F6",
                border: "1px solid rgba(59,130,246,0.2)",
              }}
            >
              {indicator.displayOrder}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "#F1F5F9" }}>
              {indicator.name}
            </p>
            <p className="text-[10px] font-mono truncate" style={{ color: "#475569" }}>
              {indicator.code}
            </p>
          </div>
        </div>
        <ChevronRight
          size={14}
          className="shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
          style={{ color: "#334155" }}
        />
      </div>

      {/* Badges row */}
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
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: "#64748B",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {indicator.compositeGroup ?? "—"}
        </span>
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

      {/* Pipeline label */}
      <p className="text-[10px]" style={{ color: "#475569" }}>
        Pipeline:{" "}
        <span style={{ color: "#64748B" }}>{PIPELINE_LABELS[pipeline]}</span>
      </p>
    </Link>
  );
}

export default function NiftyDataPage() {
  const { isAdmin } = useAuth();

  // ── Scorecard assembly polling ─────────────────────────────────────────────
  const SCORECARD_STORAGE_KEY = "poll:nifty:assemble_scorecard";
  const [triggerTime, setTriggerTime] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [lastLog, setLastLog] = useState<FetchLog | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore polling state from sessionStorage after navigation / refresh
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SCORECARD_STORAGE_KEY);
      if (!raw) return;
      const t = new Date(raw);
      const elapsed = Date.now() - t.getTime();
      if (elapsed > 90_000) { sessionStorage.removeItem(SCORECARD_STORAGE_KEY); return; }
      setTriggerTime(t);
      setIsPolling(true);
      pollTimerRef.current = setTimeout(() => {
        setIsPolling(false);
        try { sessionStorage.removeItem(SCORECARD_STORAGE_KEY); } catch {}
      }, 90_000 - elapsed);
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timer on unmount
  useEffect(() => () => { if (pollTimerRef.current) clearTimeout(pollTimerRef.current); }, []);

  const scorecardMutation = useMutation({
    mutationFn: () => triggerCronJob("assemble_scorecard"),
    onSuccess: () => {
      setTriggerError(null);
      setLastLog(null);
      const fired = new Date();
      setTriggerTime(fired);
      try { sessionStorage.setItem(SCORECARD_STORAGE_KEY, fired.toISOString()); } catch {}
      setTimeout(() => setIsPolling(true), 1500);
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      pollTimerRef.current = setTimeout(() => {
        setIsPolling(false);
        try { sessionStorage.removeItem(SCORECARD_STORAGE_KEY); } catch {}
      }, 90_000);
    },
    onError: (err: Error) => setTriggerError(err.message),
  });

  const { data: pollLogsData } = useQuery({
    queryKey: ["pollLogs", "assemble_scorecard"],
    queryFn: () => getAdminLogs({ job_name: TRIGGER_TO_LOG_JOB_NAME["assemble_scorecard"], limit: 3 }),
    enabled: isPolling,
    refetchInterval: 3_000,
    staleTime: 0,
  });

  useEffect(() => {
    if (!isPolling || !pollLogsData?.logs?.length || !triggerTime) return;
    const fresh = pollLogsData.logs.find(
      (l) => l.completedAt != null && new Date(l.startedAt) >= triggerTime,
    );
    if (fresh) {
      setLastLog(fresh);
      setIsPolling(false);
      try { sessionStorage.removeItem(SCORECARD_STORAGE_KEY); } catch {}
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    }
  }, [pollLogsData, isPolling, triggerTime]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "indicators", "nifty"],
    queryFn: () => getAdminIndicators("nifty"),
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
  const domestic = indicators.filter((i) => i.compositeGroup === "domestic");
  const external = indicators.filter((i) => i.compositeGroup === "external");
  const bridge = indicators.filter((i) => !i.compositeGroup);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: "#475569" }}>
        <Link href="/data" className="hover:text-[#94A3B8] transition-colors">
          Data
        </Link>
        <ChevronRight size={14} />
        <span style={{ color: "#94A3B8" }}>NIFTY</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div
          className="p-2.5 rounded-xl shrink-0"
          style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}
        >
          <Activity size={20} style={{ color: "#10B981" }} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold" style={{ color: "#F1F5F9" }}>
            NIFTY Indicators
          </h1>
          <p className="text-sm" style={{ color: "#64748B" }}>
            {isLoading ? "Loading..." : `${indicators.length} indicators`} — click any card to manage its data
          </p>
        </div>
      </div>

      {/* Scorecard trigger */}
      <div
        className="mb-6 rounded-2xl p-4 sm:p-5"
        style={{ background: "rgba(10,22,40,0.7)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <h2 className="text-sm font-semibold mb-1" style={{ color: "#F1F5F9" }}>
          Pipeline Controls
        </h2>
        <p className="text-xs mb-4" style={{ color: "#64748B" }}>
          Manually trigger processing jobs for the NIFTY module.
        </p>
        <div className="flex flex-wrap gap-4 items-start">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => scorecardMutation.mutate()}
              disabled={scorecardMutation.isPending || isPolling}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-50"
              style={{
                background: (scorecardMutation.isPending || isPolling) ? "rgba(16,185,129,0.3)" : "#10B981",
                color: "#000",
              }}
            >
              {scorecardMutation.isPending
                ? <><Loader2 size={13} className="animate-spin" /> Triggering...</>
                : isPolling
                ? <><Loader2 size={13} className="animate-spin" /> Running...</>
                : <><Play size={13} /> Assemble Scorecard</>}
            </button>

            {triggerError && (
              <div className="flex items-center gap-1.5">
                <XCircle size={12} style={{ color: "#EF4444" }} />
                <span className="text-xs" style={{ color: "#FCA5A5" }}>{triggerError}</span>
              </div>
            )}

            {isPolling && !lastLog && (
              <div className="flex items-center gap-1.5">
                <Clock size={12} style={{ color: "#64748B" }} />
                <span className="text-xs" style={{ color: "#64748B" }}>Waiting for scorecard to complete…</span>
              </div>
            )}

            {lastLog && (() => {
              const statusColor = lastLog.status === "success" ? "#10B981" : lastLog.status === "failed" ? "#EF4444" : "#F59E0B";
              return (
                <div
                  className="rounded-lg px-3 py-2 flex flex-col gap-0.5"
                  style={{ background: `${statusColor}08`, border: `1px solid ${statusColor}20` }}
                >
                  <div className="flex items-center gap-1.5">
                    {lastLog.status === "success"
                      ? <CheckCircle2 size={12} style={{ color: "#10B981" }} />
                      : lastLog.status === "failed"
                      ? <XCircle size={12} style={{ color: "#EF4444" }} />
                      : <AlertCircle size={12} style={{ color: "#F59E0B" }} />}
                    <span className="text-xs font-semibold capitalize" style={{ color: statusColor }}>{lastLog.status}</span>
                  </div>
                  <p className="text-[11px]" style={{ color: "#64748B" }}>
                    {lastLog.durationMs != null
                      ? lastLog.durationMs < 1000 ? `${lastLog.durationMs}ms` : `${(lastLog.durationMs / 1000).toFixed(1)}s`
                      : "—"}{" · "}
                    +{lastLog.rowsInserted} inserted · ~{lastLog.rowsUpdated} updated
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

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
          {domestic.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: "#475569" }}>
                Domestic Indicators ({domestic.length})
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {domestic.map((ind) => (
                  <IndicatorCard key={ind.id} indicator={ind} />
                ))}
              </div>
            </section>
          )}

          {external.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: "#475569" }}>
                External Indicators ({external.length})
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {external.map((ind) => (
                  <IndicatorCard key={ind.id} indicator={ind} />
                ))}
              </div>
            </section>
          )}

          {bridge.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: "#475569" }}>
                Bridge Indicators ({bridge.length})
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {bridge.map((ind) => (
                  <IndicatorCard key={ind.id} indicator={ind} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
