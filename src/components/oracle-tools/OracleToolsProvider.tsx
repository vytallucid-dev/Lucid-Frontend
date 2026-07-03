"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ToolsLauncherDrawer, type ToolKey } from "./ToolsLauncherDrawer";
import { FullScreenAnalysis } from "./FullScreenAnalysis";
import { PairCorrelationView } from "./PairCorrelationView";
import { scoreTrendConfig, scoreComparisonConfig, cotTrajectoryConfig, cotComparisonConfig, buildIndicatorTrendConfig, listIndicatorSubjectOptions } from "./toolConfigs";

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

  const value = useMemo<OracleToolsContextValue>(
    () => ({ openDrawer, openScoreTrend, openIndicatorTrend, openCotTrajectory }),
    [openDrawer, openScoreTrend, openIndicatorTrend, openCotTrajectory],
  );

  return (
    <OracleToolsContext.Provider value={value}>
      {children}

      <ToolsLauncherDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onSelectTool={handleSelectTool} />

      {activeView?.tool === "score-trend" && (
        <FullScreenAnalysis config={scoreTrendConfig} initialSubjectId={activeView.subjectId} onClose={closeView} onCompare={openComparison} />
      )}
      {activeView?.tool === "score-comparison" && (
        <FullScreenAnalysis config={scoreComparisonConfig} initialSubjectId={activeView.subjectId} onClose={closeView} />
      )}
      {activeView?.tool === "indicator-trend" && indicatorTrendConfig.subjectOptions.length > 0 && (
        <FullScreenAnalysis config={indicatorTrendConfig} initialSubjectId={activeView.subjectId} onClose={closeView} />
      )}
      {activeView?.tool === "cot-trajectory" && (
        <FullScreenAnalysis config={cotTrajectoryConfig} initialSubjectId={activeView.subjectId} onClose={closeView} onCompare={openCotComparison} />
      )}
      {activeView?.tool === "cot-comparison" && (
        <FullScreenAnalysis config={cotComparisonConfig} initialSubjectId={activeView.subjectId} onClose={closeView} />
      )}
      {activeView?.tool === "pair-correlation" && <PairCorrelationView onClose={closeView} />}
    </OracleToolsContext.Provider>
  );
}
