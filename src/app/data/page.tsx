"use client";

import { useRouter } from "next/navigation";
import { Activity, BarChart2, ChevronRight, Database, AlertCircle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-context";
import { getAdminIndicators, type AdminIndicator } from "@/lib/api/admin";

function ModuleCard({
  title,
  subtitle,
  description,
  icon: Icon,
  iconColor,
  glowColor,
  stats,
  href,
  indicators,
  loading,
}: {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  glowColor: string;
  stats: { label: string; value: string }[];
  href: string;
  indicators: AdminIndicator[];
  loading: boolean;
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
      className="cursor-pointer flex flex-col gap-5 rounded-2xl p-4 sm:p-6 transition-all duration-300 hover:scale-[1.01] group"
      style={{
        background: "rgba(10, 22, 40, 0.7)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: `0 0 0 1px transparent`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 40px ${glowColor}22, 0 0 0 1px ${glowColor}33`;
        (e.currentTarget as HTMLDivElement).style.borderColor = `${glowColor}44`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 1px transparent`;
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)";
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}30` }}
          >
            <Icon size={22} style={{ color: iconColor }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "#F1F5F9" }}>
              {title}
            </h2>
            <p className="text-xs" style={{ color: "#64748B" }}>
              {subtitle}
            </p>
          </div>
        </div>
        <ChevronRight
          size={18}
          className="mt-1 transition-transform group-hover:translate-x-1"
          style={{ color: "#334155" }}
        />
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed" style={{ color: "#94A3B8" }}>
        {description}
      </p>

      {/* Stats row */}
      <div
        className="grid gap-2 sm:gap-3"
        style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col gap-1 rounded-xl px-2 sm:px-4 py-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider" style={{ color: "#475569" }}>
              {s.label}
            </span>
            <span className="text-base sm:text-lg font-bold" style={{ color: "#F1F5F9" }}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Data source breakdown */}
      {loading ? (
        <div className="flex items-center gap-2" style={{ color: "#475569" }}>
          <Loader2 size={14} className="animate-spin" />
          <span className="text-xs">Loading indicators...</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: "rgba(16,185,129,0.1)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)" }}
          >
            {autoCount} auto-fetched
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: "rgba(139,92,246,0.1)", color: "#A78BFA", border: "1px solid rgba(139,92,246,0.2)" }}
          >
            {manualCount} manual entry
          </span>
          {staleCount > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: "rgba(245,158,11,0.1)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.2)" }}
            >
              <AlertCircle size={11} />
              {staleCount} stale
            </span>
          )}
          {neverFetched > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}
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
  } = useQuery({
    queryKey: ["admin", "indicators", "nifty"],
    queryFn: () => getAdminIndicators("nifty"),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const {
    data: edgefinderData,
    isLoading: efLoading,
  } = useQuery({
    queryKey: ["admin", "indicators", "edgefinder"],
    queryFn: () => getAdminIndicators("edgefinder"),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={24} className="animate-spin" style={{ color: "#3B82F6" }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle size={40} style={{ color: "#EF4444" }} />
        <p className="text-lg font-medium" style={{ color: "#F1F5F9" }}>
          Admin access required
        </p>
        <p className="text-sm" style={{ color: "#64748B" }}>
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
          style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)" }}
        >
          <Database size={20} style={{ color: "#3B82F6" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#F1F5F9" }}>
            Data Management
          </h1>
          <p className="text-sm" style={{ color: "#64748B" }}>
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
          iconColor="#10B981"
          glowColor="#10B981"
          stats={[
            { label: "Total Indicators", value: niftyLoading ? "—" : String(niftyIndicators.length || 13) },
            { label: "Domestic", value: niftyLoading ? "—" : String(niftyIndicators.filter((i) => i.compositeGroup === "domestic").length || 8) },
            { label: "External", value: niftyLoading ? "—" : String(niftyIndicators.filter((i) => i.compositeGroup === "external").length || 5) },
          ]}
          href="/data/nifty"
          indicators={niftyIndicators}
          loading={niftyLoading}
        />

        <ModuleCard
          title="EdgeFinder"
          subtitle="Forex & Asset Scoring Engine"
          description="41-indicator system scoring USD, EUR, GBP, JPY, Gold and FX pairs across growth, inflation, employment, sentiment, rates, and positioning data."
          icon={BarChart2}
          iconColor="#3B82F6"
          glowColor="#3B82F6"
          stats={[
            { label: "Total Indicators", value: efLoading ? "—" : String(edgefinderIndicators.length || 41) },
            { label: "Countries", value: "4" },
            { label: "COT + Rates", value: "9" },
          ]}
          href="/data/edgefinder"
          indicators={edgefinderIndicators}
          loading={efLoading}
        />
      </div>

      {/* Bottom info strip */}
      <div
        className="mt-6 rounded-xl px-5 py-4 flex items-start gap-3"
        style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)" }}
      >
        <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: "#3B82F6" }} />
        <p className="text-sm leading-relaxed" style={{ color: "#94A3B8" }}>
          Triggered jobs run asynchronously. After triggering a pipeline, check the{" "}
          <span style={{ color: "#60A5FA" }}>Logs</span> tab on the indicator detail page to monitor
          status. Jobs that are already running will be skipped by the job guard.
        </p>
      </div>
    </div>
  );
}
