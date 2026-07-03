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
  const sourceColor = DATA_SOURCE_COLORS[indicator.dataSource] ?? "var(--lucid-ink-3)";
  const freshnessColor = FRESHNESS_COLORS[freshness];

  return (
    <Link
      href={`/data/nifty/${encodeURIComponent(indicator.code)}`}
      className="lt-card lt-hover flex flex-col gap-3 rounded-xl p-4 transition-all duration-200 group hover:scale-[1.01]"
    >
      {/* Top row: order badge + name + arrow */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {indicator.displayOrder !== null && (
            <span
              className="lt-num shrink-0 flex items-center justify-center rounded-lg text-xs font-bold"
              style={{
                width: 28,
                height: 28,
                background: "var(--lucid-accent-bg)",
                color: "var(--lucid-accent)",
                border: "1px solid var(--lucid-accent-bd)",
              }}
            >
              {indicator.displayOrder}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--lucid-ink)" }}>
              {indicator.name}
            </p>
            <p className="lt-num text-[10px] truncate" style={{ color: "var(--lucid-ink-3)" }}>
              {indicator.code}
            </p>
          </div>
        </div>
        <ChevronRight
          size={14}
          className="shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
          style={{ color: "var(--lucid-ink-3)" }}
        />
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            background: "var(--lucid-surface-2)",
            color: sourceColor,
            border: "1px solid var(--lucid-line-2)",
          }}
        >
          {DATA_SOURCE_LABELS[indicator.dataSource] ?? indicator.dataSource}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            background: "var(--lucid-surface-2)",
            color: "var(--lucid-ink-3)",
            border: "1px solid var(--lucid-line)",
          }}
        >
          {indicator.compositeGroup ?? "—"}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            background: "var(--lucid-surface-2)",
            color: freshnessColor,
            border: "1px solid var(--lucid-line-2)",
          }}
        >
          {FRESHNESS_LABELS[freshness]}
        </span>
      </div>

      {/* Last data point */}
      <div
        className="rounded-lg px-3 py-2 flex items-center justify-between"
        style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}
      >
        {indicator.latestDataPoint ? (
          <>
            <div>
              <p className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>
                Last value
              </p>
              <p className="lt-num text-sm font-semibold" style={{ color: "var(--lucid-ink)" }}>
                {indicator.latestDataPoint.value}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>
                As of
              </p>
              <p className="lt-num text-xs" style={{ color: "var(--lucid-ink-2)" }}>
                {indicator.latestDataPoint.observationDate}
              </p>
              <p className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>
                {formatRelativeDate(indicator.latestDataPoint.fetchedAt)}
              </p>
            </div>
          </>
        ) : (
          <p className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
            No data yet
          </p>
        )}
      </div>

      {/* Pipeline label */}
      <p className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>
        Pipeline:{" "}
        <span style={{ color: "var(--lucid-ink-3)" }}>{PIPELINE_LABELS[pipeline]}</span>
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
        <AlertCircle size={40} style={{ color: "var(--lucid-neg)" }} />
        <p className="lt-serif text-lg font-medium" style={{ color: "var(--lucid-ink)" }}>
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
      <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: "var(--lucid-ink-3)" }}>
        <Link href="/data" className="hover:opacity-80 transition-colors" style={{ color: "var(--lucid-ink-2)" }}>
          Data
        </Link>
        <ChevronRight size={14} />
        <span style={{ color: "var(--lucid-ink-2)" }}>NIFTY</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div
          className="p-2.5 rounded-xl shrink-0"
          style={{ background: "var(--lucid-pos-bg)", border: "1px solid var(--lucid-pos-bd)" }}
        >
          <Activity size={20} style={{ color: "var(--lucid-pos)" }} />
        </div>
        <div className="min-w-0">
          <h1 className="lt-serif text-xl font-bold" style={{ color: "var(--lucid-ink)" }}>
            NIFTY Indicators
          </h1>
          <p className="text-sm" style={{ color: "var(--lucid-ink-3)" }}>
            {isLoading ? "Loading..." : `${indicators.length} indicators`} — click any card to manage its data
          </p>
        </div>
      </div>

      {/* Scorecard trigger */}
      <div
        className="lt-card mb-6 rounded-2xl p-4 sm:p-5"
      >
        <h2 className="lt-serif text-sm font-semibold mb-1" style={{ color: "var(--lucid-ink)" }}>
          Pipeline Controls
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--lucid-ink-3)" }}>
          Manually trigger processing jobs for the NIFTY module.
        </p>
        <div className="flex flex-wrap gap-4 items-start">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => scorecardMutation.mutate()}
              disabled={scorecardMutation.isPending || isPolling}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-50"
              style={{
                background: (scorecardMutation.isPending || isPolling) ? "var(--lucid-pos-bg)" : "var(--lucid-pos)",
                color: "var(--lucid-bg)",
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
                <XCircle size={12} style={{ color: "var(--lucid-neg)" }} />
                <span className="text-xs" style={{ color: "var(--lucid-neg)" }}>{triggerError}</span>
              </div>
            )}

            {isPolling && !lastLog && (
              <div className="flex items-center gap-1.5">
                <Clock size={12} style={{ color: "var(--lucid-ink-3)" }} />
                <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>Waiting for scorecard to complete…</span>
              </div>
            )}

            {lastLog && (() => {
              const statusColor = lastLog.status === "success" ? "var(--lucid-pos)" : lastLog.status === "failed" ? "var(--lucid-neg)" : "var(--lucid-warn)";
              const statusBg = lastLog.status === "success" ? "var(--lucid-pos-bg)" : lastLog.status === "failed" ? "var(--lucid-neg-bg)" : "var(--lucid-warn-bg)";
              const statusBd = lastLog.status === "success" ? "var(--lucid-pos-bd)" : lastLog.status === "failed" ? "var(--lucid-neg-bd)" : "var(--lucid-warn-bd)";
              return (
                <div
                  className="rounded-lg px-3 py-2 flex flex-col gap-0.5"
                  style={{ background: statusBg, border: `1px solid ${statusBd}` }}
                >
                  <div className="flex items-center gap-1.5">
                    {lastLog.status === "success"
                      ? <CheckCircle2 size={12} style={{ color: "var(--lucid-pos)" }} />
                      : lastLog.status === "failed"
                      ? <XCircle size={12} style={{ color: "var(--lucid-neg)" }} />
                      : <AlertCircle size={12} style={{ color: "var(--lucid-warn)" }} />}
                    <span className="text-xs font-semibold capitalize" style={{ color: statusColor }}>{lastLog.status}</span>
                  </div>
                  <p className="lt-num text-[11px]" style={{ color: "var(--lucid-ink-3)" }}>
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
        <div className="flex items-center gap-2 py-20 justify-center" style={{ color: "var(--lucid-ink-3)" }}>
          <Loader2 size={20} className="animate-spin" />
          <span>Loading indicators...</span>
        </div>
      ) : error ? (
        <div
          className="rounded-xl p-4 flex items-center gap-2"
          style={{ background: "var(--lucid-neg-bg)", border: "1px solid var(--lucid-neg-bd)", color: "var(--lucid-neg)" }}
        >
          <AlertCircle size={16} />
          <span className="text-sm">Failed to load indicators</span>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {domestic.length > 0 && (
            <section>
              <h2 className="lt-serif text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: "var(--lucid-ink-3)" }}>
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
              <h2 className="lt-serif text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: "var(--lucid-ink-3)" }}>
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
              <h2 className="lt-serif text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: "var(--lucid-ink-3)" }}>
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
