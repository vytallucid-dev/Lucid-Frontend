"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { X } from "lucide-react";
import { ToolsLauncherDrawer, type ToolKey } from "./ToolsLauncherDrawer";
import { FullScreenAnalysis } from "./FullScreenAnalysis";
import { PairCorrelationView } from "./PairCorrelationView";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import {
  buildScoreTrendConfig,
  buildScoreComparisonConfig,
  buildCotTrajectoryConfig,
  buildCotComparisonConfig,
  buildIndicatorTrendConfig,
  listIndicatorSubjectOptions,
  listScoreTrendSubjectOptions,
  listCotTrajectorySubjectOptions,
} from "./toolConfigs";

// A tool view's subject-options query has three states worth showing
// (loading / errored / resolved-but-empty) before it ever has a subject list
// to hand FullScreenAnalysis. Every gated view below used to render nothing
// at all for any of the three — a click during that window looked like the
// drawer just closed. This is the shared fallback shell for that window,
// matching FullScreenAnalysis's own full-screen frame so the transition into
// the real view isn't jarring.
function ToolViewFallback({
  title,
  onClose,
  optionsQuery,
}: {
  title: string;
  onClose: () => void;
  optionsQuery: Pick<UseQueryResult<unknown, unknown>, "isLoading" | "error" | "refetch">;
}) {
  return (
    <div className="lt-fade-in fixed inset-0 z-[100] flex flex-col" style={{ background: "var(--lucid-bg)" }}>
      <div className="shrink-0 flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--lucid-line)" }}>
        <span className="lt-eyebrow">{title}</span>
        <button onClick={onClose} className="p-2 rounded-md transition-colors hover:bg-white/5" style={{ color: "var(--lucid-ink-3)" }} title="Close (Esc)">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center">
        {optionsQuery.isLoading ? (
          <LoadingState message={`Loading ${title}...`} />
        ) : (
          <ErrorState
            error={optionsQuery.error ?? new Error("No subjects are available for this tool right now.")}
            onRetry={() => optionsQuery.refetch()}
          />
        )}
      </div>
    </div>
  );
}

interface OracleToolsContextValue {
  openDrawer: () => void;
  openScoreTrend: (subjectId: string) => void;
  /** Opens Indicator Trend pre-loaded for a backend indicator CODE (e.g. "US_CPI_YOY"). */
  openIndicatorTrend: (code: string) => void;
  /** Opens COT Trajectory pre-loaded for an asset (USD/EUR/GBP/JPY/Gold). */
  openCotTrajectory: (asset: string) => void;
}

const OracleToolsContext = createContext<OracleToolsContextValue | null>(null);

export function useOracleTools(): OracleToolsContextValue {
  const ctx = useContext(OracleToolsContext);
  if (!ctx) throw new Error("useOracleTools must be used within OracleToolsProvider");
  return ctx;
}

type ActiveView = { tool: ToolKey; subjectId?: string } | null;

export function OracleToolsProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>(null);

  const indicatorOptionsQuery = useQuery({
    queryKey: ["oracle", "tools", "indicator-options"],
    queryFn: listIndicatorSubjectOptions,
    staleTime: 5 * 60 * 1000,
  });

  const scoreTrendOptionsQuery = useQuery({
    queryKey: ["oracle", "tools", "score-trend-options"],
    queryFn: listScoreTrendSubjectOptions,
    staleTime: 5 * 60 * 1000,
  });

  const cotTrajectoryOptionsQuery = useQuery({
    queryKey: ["oracle", "tools", "cot-trajectory-options"],
    queryFn: listCotTrajectorySubjectOptions,
    staleTime: 5 * 60 * 1000,
  });

  const openDrawer = useCallback(() => setDrawerOpen(true), []);

  const openScoreTrend = useCallback((subjectId: string) => {
    setDrawerOpen(false);
    setActiveView({ tool: "score-trend", subjectId });
  }, []);

  const openIndicatorTrend = useCallback((code: string) => {
    setDrawerOpen(false);
    setActiveView({ tool: "indicator-trend", subjectId: code });
  }, []);

  const openCotTrajectory = useCallback((asset: string) => {
    setDrawerOpen(false);
    setActiveView({ tool: "cot-trajectory", subjectId: asset });
  }, []);

  // Compare handoff: score trend → Score Comparison with the current subject
  // pre-loaded as the first series.
  const openComparison = useCallback((subjectId: string) => {
    setActiveView({ tool: "score-comparison", subjectId });
  }, []);

  // COT compare handoff: COT Trajectory → COT Comparison (net-position series).
  const openCotComparison = useCallback((subjectId: string) => {
    setActiveView({ tool: "cot-comparison", subjectId });
  }, []);

  const handleSelectTool = useCallback((tool: ToolKey) => {
    setDrawerOpen(false);
    setActiveView({ tool });
  }, []);

  const closeView = useCallback(() => setActiveView(null), []);

  // When a shortcut pre-loads an indicator code that isn't already in the
  // heatmap-derived options, inject it so the picker shows it selected.
  const indicatorTrendConfig = useMemo(() => {
    const opts = indicatorOptionsQuery.data ?? [];
    const preloadCode = activeView?.tool === "indicator-trend" ? activeView.subjectId : undefined;
    const withPreload =
      preloadCode && !opts.some((o) => o.id === preloadCode)
        ? [{ id: preloadCode, label: preloadCode, group: "Selected" }, ...opts]
        : opts;
    return buildIndicatorTrendConfig(withPreload);
  }, [indicatorOptionsQuery.data, activeView]);

  const scoreTrendConfig = useMemo(
    () => buildScoreTrendConfig(scoreTrendOptionsQuery.data ?? []),
    [scoreTrendOptionsQuery.data],
  );
  const scoreComparisonConfig = useMemo(
    () => buildScoreComparisonConfig(scoreTrendOptionsQuery.data ?? []),
    [scoreTrendOptionsQuery.data],
  );
  const cotTrajectoryConfig = useMemo(
    () => buildCotTrajectoryConfig(cotTrajectoryOptionsQuery.data ?? []),
    [cotTrajectoryOptionsQuery.data],
  );
  const cotComparisonConfig = useMemo(
    () => buildCotComparisonConfig(cotTrajectoryOptionsQuery.data ?? []),
    [cotTrajectoryOptionsQuery.data],
  );

  const value = useMemo<OracleToolsContextValue>(
    () => ({ openDrawer, openScoreTrend, openIndicatorTrend, openCotTrajectory }),
    [openDrawer, openScoreTrend, openIndicatorTrend, openCotTrajectory],
  );

  return (
    <OracleToolsContext.Provider value={value}>
      <div className="relative">
        {children}

        <ToolsLauncherDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onSelectTool={handleSelectTool} />

        {activeView?.tool === "score-trend" && (
          scoreTrendConfig.subjectOptions.length > 0 ? (
            <FullScreenAnalysis config={scoreTrendConfig} initialSubjectId={activeView.subjectId} onClose={closeView} onCompare={openComparison} />
          ) : (
            <ToolViewFallback title={scoreTrendConfig.title} onClose={closeView} optionsQuery={scoreTrendOptionsQuery} />
          )
        )}
        {activeView?.tool === "score-comparison" && (
          scoreComparisonConfig.subjectOptions.length > 0 ? (
            <FullScreenAnalysis config={scoreComparisonConfig} initialSubjectId={activeView.subjectId} onClose={closeView} />
          ) : (
            <ToolViewFallback title={scoreComparisonConfig.title} onClose={closeView} optionsQuery={scoreTrendOptionsQuery} />
          )
        )}
        {activeView?.tool === "indicator-trend" && (
          indicatorTrendConfig.subjectOptions.length > 0 ? (
            <FullScreenAnalysis config={indicatorTrendConfig} initialSubjectId={activeView.subjectId} onClose={closeView} />
          ) : (
            <ToolViewFallback title={indicatorTrendConfig.title} onClose={closeView} optionsQuery={indicatorOptionsQuery} />
          )
        )}
        {activeView?.tool === "cot-trajectory" && (
          cotTrajectoryConfig.subjectOptions.length > 0 ? (
            <FullScreenAnalysis config={cotTrajectoryConfig} initialSubjectId={activeView.subjectId} onClose={closeView} onCompare={openCotComparison} />
          ) : (
            <ToolViewFallback title={cotTrajectoryConfig.title} onClose={closeView} optionsQuery={cotTrajectoryOptionsQuery} />
          )
        )}
        {activeView?.tool === "cot-comparison" && (
          cotComparisonConfig.subjectOptions.length > 0 ? (
            <FullScreenAnalysis config={cotComparisonConfig} initialSubjectId={activeView.subjectId} onClose={closeView} />
          ) : (
            <ToolViewFallback title={cotComparisonConfig.title} onClose={closeView} optionsQuery={cotTrajectoryOptionsQuery} />
          )
        )}
        {activeView?.tool === "pair-correlation" && <PairCorrelationView onClose={closeView} />}
      </div>
    </OracleToolsContext.Provider>
  );
}
