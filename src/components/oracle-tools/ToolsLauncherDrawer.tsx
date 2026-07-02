"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, BarChart3, GitCompare, Grid3x3, Layers, Lock } from "lucide-react";
import { DetailDrawer } from "@/components/DetailDrawer";
import { listIndicatorSubjectOptions } from "./adapters";
import { DEFERRED_TOOLS } from "./toolConfigs";
import { RateCycleStancePanel, ThisWeekCalendarPanel } from "./ReferencePanels";

export type ToolKey =
  | "score-trend"
  | "indicator-trend"
  | "cot-trajectory"
  | "score-comparison"
  | "pair-correlation";

interface ToolsLauncherDrawerProps {
  open: boolean;
  onClose: () => void;
  onSelectTool: (tool: ToolKey) => void;
}

const TOOL_ENTRIES: { key: ToolKey; title: string; description: string; icon: typeof TrendingUp }[] = [
  { key: "score-trend", title: "Score Trend", description: "Total score history + per-date indicator breakdown", icon: TrendingUp },
  { key: "indicator-trend", title: "Indicator Trend", description: "Release history — value vs forecast, surprises marked", icon: BarChart3 },
  { key: "cot-trajectory", title: "COT Trajectory", description: "Institutional net positioning over time per asset", icon: Layers },
  { key: "score-comparison", title: "Score Comparison", description: "Overlay two subjects on one chart", icon: GitCompare },
  { key: "pair-correlation", title: "Pair Correlation", description: "Score-direction alignment across active pairs", icon: Grid3x3 },
];

function ToolRow({
  title,
  description,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: typeof TrendingUp;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="lt-card lt-hover w-full flex items-start gap-3 p-4 text-left transition-colors"
    >
      <div
        className="shrink-0 flex items-center justify-center w-9 h-9 rounded-md"
        style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)" }}
      >
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="lt-serif text-sm font-semibold" style={{ color: "var(--lucid-ink)" }}>
          {title}
        </p>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>
          {description}
        </p>
      </div>
    </button>
  );
}

function DeferredToolRow({ title, description, reason }: { title: string; description: string; reason: string }) {
  return (
    <div
      className="w-full flex items-start gap-3 p-4 rounded-lg opacity-50 cursor-not-allowed"
      style={{ background: "var(--lucid-surface)", border: "1px solid var(--lucid-line)" }}
      title={reason}
    >
      <div
        className="shrink-0 flex items-center justify-center w-9 h-9 rounded-md"
        style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-3)" }}
      >
        <Lock size={15} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="lt-serif text-sm font-semibold" style={{ color: "var(--lucid-ink-2)" }}>
            {title}
          </p>
          <span
            className="lt-eyebrow px-1.5 py-0.5 rounded"
            style={{ background: "var(--lucid-surface-3)", fontSize: 9 }}
          >
            Coming in backend pass
          </span>
        </div>
        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>
          {description}
        </p>
      </div>
    </div>
  );
}

export function ToolsLauncherDrawer({ open, onClose, onSelectTool }: ToolsLauncherDrawerProps) {
  // Warms the indicator-options cache so Indicator Trend opens instantly;
  // harmless no-op fetch if the drawer never opens Indicator Trend.
  useQuery({
    queryKey: ["oracle", "tools", "indicator-options"],
    queryFn: listIndicatorSubjectOptions,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <DetailDrawer open={open} onClose={onClose} title="Oracle Tools">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="lt-eyebrow">
            Analysis Tools
            <span className="lt-eyebrow-ln" />
          </div>
          {TOOL_ENTRIES.map((tool) => (
            <ToolRow
              key={tool.key}
              title={tool.title}
              description={tool.description}
              icon={tool.icon}
              onClick={() => onSelectTool(tool.key)}
            />
          ))}
          {DEFERRED_TOOLS.map((tool) => (
            <DeferredToolRow key={tool.key} title={tool.title} description={tool.description} reason={tool.reason} />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="lt-eyebrow">
            Reference
            <span className="lt-eyebrow-ln" />
          </div>
          <RateCycleStancePanel />
          <ThisWeekCalendarPanel />
        </div>
      </div>
    </DetailDrawer>
  );
}
