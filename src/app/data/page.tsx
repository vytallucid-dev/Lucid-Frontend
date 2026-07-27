"use client";

import { useRouter } from "next/navigation";
import { Activity, BarChart2, ChevronRight, Database, AlertCircle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { getAdminIndicators, type AdminIndicator } from "@/lib/api/admin";

interface ModuleStat {
  label: string;
  value: number;
  /** True for a fixed fact not derived from the indicator query (e.g. a
   *  known country count) — always renders its value, never the query's
   *  loading/error state, since a fetch failure doesn't make it unknown. */
  static?: boolean;
}

function StatTile({ stat, loading, isError }: { stat: ModuleStat; loading: boolean; isError: boolean }) {
  const showLoading = loading && !stat.static;
  const showError = isError && !stat.static;
  return (
    <div className="lt-card-2 flex flex-col gap-1 rounded-xl px-2 sm:px-4 py-3">
      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider" style={{ color: "var(--lucid-ink-3)" }}>
        {stat.label}
      </span>
      {showLoading ? (
        <span className="lt-num text-base sm:text-lg font-bold" style={{ color: "var(--lucid-ink-3)" }}>—</span>
      ) : showError ? (
        <span className="lt-num text-base sm:text-lg font-bold flex items-center gap-1" style={{ color: "var(--lucid-neg)" }}>
          <AlertCircle size={14} />
          Error
        </span>
      ) : (
        <span
          className="lt-num text-base sm:text-lg font-bold"
          style={{ color: !stat.static && stat.value === 0 ? "var(--lucid-warn)" : "var(--lucid-ink)" }}
        >
          {stat.value}
        </span>
      )}
    </div>
  );
}

function ModuleCard({
  title,
  subtitle,
  description,
  icon: Icon,
  iconColor,
  stats,
  href,
  indicators,
  loading,
  isError,
}: {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  stats: ModuleStat[];
  href: string;
  indicators: AdminIndicator[];
  loading: boolean;
  isError: boolean;
}) {
  const router = useRouter();

  const manualCount = indicators.filter(
    (i) => i.dataSource === "manual" || i.frequency === "event_driven",
  ).length;
  const autoCount = indicators.length - manualCount;
  const neverFetched = indicators.filter((i) => !i.latestDataPoint).length;
  const staleCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const staleCount = indicators.filter(
    (i) =>
      i.latestDataPoint &&
      new Date(i.latestDataPoint.fetchedAt) < staleCutoff &&
      i.dataSource !== "manual",
  ).length;

  return (
    <div
      onClick={() => router.push(href)}
      className="lt-card lt-hover cursor-pointer flex flex-col gap-5 rounded-2xl p-4 sm:p-6 transition-all duration-300 hover:scale-[1.01] group"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{ background: `color-mix(in srgb, ${iconColor} 18%, transparent)`, border: `1px solid color-mix(in srgb, ${iconColor} 30%, transparent)` }}
          >
            <Icon size={22} style={{ color: iconColor }} />
          </div>
          <div>
            <h2 className="lt-serif text-lg font-semibold" style={{ color: "var(--lucid-ink)" }}>
              {title}
            </h2>
            <p className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
              {subtitle}
            </p>
          </div>
        </div>
        <ChevronRight
          size={18}
          className="mt-1 transition-transform group-hover:translate-x-1"
          style={{ color: "var(--lucid-ink-3)" }}
        />
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed" style={{ color: "var(--lucid-ink-2)" }}>
        {description}
      </p>

      {/* Stats row */}
      <div
        className="grid gap-2 sm:gap-3"
        style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}
      >
        {stats.map((s) => (
          <StatTile key={s.label} stat={s} loading={loading} isError={isError} />
        ))}
      </div>

      {/* Data source breakdown */}
      {loading ? (
        <div className="flex items-center gap-2" style={{ color: "var(--lucid-ink-3)" }}>
          <Loader2 size={14} className="animate-spin" />
          <span className="text-xs">Loading indicators...</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="lt-num inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: "var(--lucid-pos-bg)", color: "var(--lucid-pos)", border: "1px solid var(--lucid-pos-bd)" }}
          >
            {autoCount} auto-fetched
          </span>
          <span
            className="lt-num inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: "rgba(139,92,246,0.1)", color: "#A78BFA", border: "1px solid rgba(139,92,246,0.2)" }}
          >
            {manualCount} manual entry
          </span>
          {staleCount > 0 && (
            <span
              className="lt-num inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: "var(--lucid-warn-bg)", color: "var(--lucid-warn)", border: "1px solid var(--lucid-warn-bd)" }}
            >
              <AlertCircle size={11} />
              {staleCount} stale
            </span>
          )}
          {neverFetched > 0 && (
            <span
              className="lt-num inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: "var(--lucid-neg-bg)", color: "var(--lucid-neg)", border: "1px solid var(--lucid-neg-bd)" }}
            >
              {neverFetched} never fetched
            </span>
          )}
        </div>
      )}

      {/* Navigate CTA */}
      <div
        className="flex items-center gap-2 pt-1 text-sm font-medium transition-colors"
        style={{ color: iconColor }}
      >
        <span>View all indicators</span>
        <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
      </div>
    </div>
  );
}

export default function DataPage() {
  const { isAdmin, loading: authLoading } = useAuth();

  const {
    data: niftyData,
    isLoading: niftyLoading,
    isError: niftyIsError,
  } = useQuery({
    queryKey: ["admin", "indicators", "nifty"],
    queryFn: () => getAdminIndicators("nifty"),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const {
    data: edgefinderData,
    isLoading: efLoading,
    isError: efIsError,
  } = useQuery({
    queryKey: ["admin", "indicators", "edgefinder"],
    queryFn: () => getAdminIndicators("edgefinder"),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--lucid-accent)" }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle size={40} style={{ color: "var(--lucid-neg)" }} />
        <p className="lt-serif text-lg font-medium" style={{ color: "var(--lucid-ink)" }}>
          Admin access required
        </p>
        <p className="text-sm" style={{ color: "var(--lucid-ink-3)" }}>
          This page is only accessible to administrators.
        </p>
      </div>
    );
  }

  const niftyIndicators = niftyData?.data ?? [];
  const edgefinderIndicators = edgefinderData?.data ?? [];

  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl mx-auto w-full">
      {/* Page header */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div
          className="p-2 rounded-lg"
          style={{ background: "var(--lucid-accent-bg)", border: "1px solid var(--lucid-accent-bd)" }}
        >
          <Database size={20} style={{ color: "var(--lucid-accent)" }} />
        </div>
        <div>
          <h1 className="lt-serif text-xl font-bold" style={{ color: "var(--lucid-ink)" }}>
            Data Management
          </h1>
          <p className="text-sm" style={{ color: "var(--lucid-ink-3)" }}>
            Trigger data pipelines, ingest manual values, and monitor fetch logs
          </p>
        </div>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ModuleCard
          title="NIFTY"
          subtitle="India Fundamental Bias Scoring"
          description="13-indicator scoring system tracking India's macroeconomic health across domestic activity, equity flows, and external environment signals."
          icon={Activity}
          iconColor="var(--lucid-pos)"
          stats={[
            { label: "Total Indicators", value: niftyIndicators.length },
            { label: "Domestic", value: niftyIndicators.filter((i) => i.compositeGroup === "domestic").length },
            { label: "External", value: niftyIndicators.filter((i) => i.compositeGroup === "external").length },
          ]}
          href="/data/nifty"
          indicators={niftyIndicators}
          loading={niftyLoading}
          isError={niftyIsError}
        />

        <ModuleCard
          title="EdgeFinder"
          subtitle="Forex & Asset Scoring Engine"
          description="41-indicator system scoring USD, EUR, GBP, JPY, Gold and FX pairs across growth, inflation, employment, sentiment, rates, and positioning data."
          icon={BarChart2}
          iconColor="var(--lucid-accent)"
          stats={[
            { label: "Total Indicators", value: edgefinderIndicators.length },
            { label: "Countries", value: 4, static: true },
            { label: "COT + Rates", value: 9, static: true },
          ]}
          href="/data/edgefinder"
          indicators={edgefinderIndicators}
          loading={efLoading}
          isError={efIsError}
        />
      </div>

      {/* Bottom info strip */}
      <div
        className="mt-6 rounded-xl px-5 py-4 flex items-start gap-3"
        style={{ background: "var(--lucid-accent-bg)", border: "1px solid var(--lucid-accent-bd)" }}
      >
        <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--lucid-accent)" }} />
        <p className="text-sm leading-relaxed" style={{ color: "var(--lucid-ink-2)" }}>
          Triggered jobs run asynchronously. After triggering a pipeline, check the{" "}
          <span style={{ color: "var(--lucid-accent)" }}>Logs</span> tab on the indicator detail page to monitor
          status. Jobs that are already running will be skipped by the job guard.
        </p>
      </div>
    </div>
  );
}
