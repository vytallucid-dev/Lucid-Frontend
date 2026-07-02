"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, ChevronDown, TrendingUp, TrendingDown, Minus, LineChart, BarChart3, GitCompare } from "lucide-react";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { AnalysisChart } from "./AnalysisChart";
import { TimeframeControl, type CustomRange } from "@/components/shared/TimeframeControl";
import type {
  AnalysisSubject,
  AnalysisToolConfig,
  TimeframeKey,
  SubjectOption,
  ChartType,
  DateBreakdown,
} from "./types";

const TIMEFRAMES: { key: TimeframeKey; label: string }[] = [
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
];

interface FullScreenAnalysisProps {
  config: AnalysisToolConfig;
  initialSubjectId?: string;
  /** Optional pre-loaded compare subject (Score Comparison lands here). */
  initialCompareId?: string;
  onClose: () => void;
  /** Routes to the Score Comparison tool with `subjectId` as the first series. */
  onCompare?: (subjectId: string) => void;
}

/**
 * Windows a subject's points to an exact [from, to] date range and re-indexes
 * them 0..n-1 (re-keying breakdownByIndex to match) so AnalysisChart/SideRail
 * — which key purely off point index — keep working unmodified.
 */
function windowSubject(subject: AnalysisSubject, range: CustomRange): AnalysisSubject {
  const keptOldIndices: number[] = [];
  const points = subject.points
    .filter((p) => p.date >= range.from && p.date <= range.to)
    .map((p, i) => {
      keptOldIndices.push(p.index);
      return { ...p, index: i };
    });

  const breakdownByIndex = subject.breakdownByIndex
    ? keptOldIndices.reduce<Record<number, DateBreakdown>>((acc, oldIdx, newIdx) => {
        const bd = subject.breakdownByIndex?.[oldIdx];
        if (bd) acc[newIdx] = bd;
        return acc;
      }, {})
    : undefined;

  const lastPoint = points[points.length - 1];
  return {
    ...subject,
    points,
    breakdownByIndex,
    currentValue: lastPoint?.value ?? subject.currentValue,
    seriesAvailable: points.length > 0,
    seriesGapNote: points.length === 0 ? "No data in the selected custom range." : subject.seriesGapNote,
  };
}

function fmtSigned(n: number | null, unit: string): string {
  if (n === null) return "—";
  const s = n > 0 ? `+${n}` : String(n);
  return unit === "%" ? `${s}%` : s;
}

function DeltaBadge({ delta, unit }: { delta: number | null; unit: string }) {
  if (delta === null) {
    return <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>—</span>;
  }
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const color = delta > 0 ? "var(--lucid-pos)" : delta < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)";
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold lt-num" style={{ color }}>
      <Icon size={14} />
      {delta > 0 ? `+${delta}` : delta}{unit === "%" ? "%" : ` ${unit}`}
    </span>
  );
}

function SubjectPicker({
  options,
  value,
  onChange,
  label,
}: {
  options: SubjectOption[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, SubjectOption[]>();
    for (const o of options) {
      const g = o.group ?? "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(o);
    }
    return [...map.entries()];
  }, [options]);

  return (
    <label className="flex items-center gap-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--lucid-ink-3)" }}>
      {label}
      <span className="relative inline-flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none pl-3 pr-7 py-1.5 rounded-md text-xs font-medium cursor-pointer lt-num"
          style={{ background: "var(--lucid-surface-3)", border: "1px solid var(--lucid-line-2)", color: "var(--lucid-ink)" }}
        >
          {groups.map(([g, opts]) =>
            g ? (
              <optgroup key={g} label={g}>
                {opts.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.flag ? `${opt.flag} ` : ""}{opt.label}</option>
                ))}
              </optgroup>
            ) : (
              opts.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.flag ? `${opt.flag} ` : ""}{opt.label}</option>
              ))
            ),
          )}
        </select>
        <ChevronDown size={13} className="absolute right-2 pointer-events-none" style={{ color: "var(--lucid-ink-3)" }} />
      </span>
    </label>
  );
}

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return <span className="lt-num text-[11px]" style={{ color: "var(--lucid-ink-3)" }}>—</span>;
  const color = score > 0 ? "var(--lucid-pos)" : score < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)";
  const bg = score > 0 ? "var(--lucid-pos-bg)" : score < 0 ? "var(--lucid-neg-bg)" : "var(--lucid-surface-3)";
  const bd = score > 0 ? "var(--lucid-pos-bd)" : score < 0 ? "var(--lucid-neg-bd)" : "var(--lucid-line-2)";
  return (
    <span className="inline-flex items-center justify-center min-w-7 px-1.5 py-0.5 rounded text-[11px] font-semibold lt-num"
      style={{ background: bg, color, border: `1px solid ${bd}` }}>
      {score > 0 ? `+${score}` : score}
    </span>
  );
}

// ─── docked detail rail ─────────────────────────────────────────────────────

function SideRail({
  subject,
  compareSubject,
  hoverIndex,
  valueUnit,
}: {
  subject: AnalysisSubject;
  compareSubject: AnalysisSubject | null;
  hoverIndex: number | null;
  valueUnit: string;
}) {
  const idx = hoverIndex ?? subject.points.length - 1;
  const breakdown: DateBreakdown | undefined = subject.breakdownByIndex?.[idx];
  const railEmpty = !subject.breakdownByIndex || subject.railEmptyNote;

  // Comparison delta rail
  const cmpBreakdown = compareSubject?.breakdownByIndex?.[idx];
  const aVal = subject.points[idx]?.value ?? null;
  const bVal = compareSubject?.points[idx]?.value ?? null;
  const spread = aVal !== null && bVal !== null ? aVal - bVal : null;

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 w-[340px] xl:w-[380px] overflow-y-auto"
      style={{ borderLeft: "1px solid var(--lucid-line)", background: "var(--lucid-surface)" }}
    >
      <div className="px-5 py-4 sticky top-0 z-10" style={{ borderBottom: "1px solid var(--lucid-line)", background: "var(--lucid-surface)" }}>
        <div className="lt-eyebrow">{subject.railHeading ?? "Detail"}</div>
        {breakdown && (
          <div className="flex items-baseline gap-2 mt-2">
            <span className="lt-num text-lg font-semibold" style={{ color: "var(--lucid-ink)" }}>{breakdown.label}</span>
            {breakdown.headline !== null && (
              <span className="lt-num text-sm" style={{ color: "var(--lucid-ink-2)" }}>
                {fmtSigned(breakdown.headline, valueUnit)}
              </span>
            )}
            {breakdown.headlineLabel && (
              <span className="text-[11px]" style={{ color: "var(--lucid-ink-3)" }}>{breakdown.headlineLabel}</span>
            )}
          </div>
        )}
        <p className="text-[11px] mt-1" style={{ color: "var(--lucid-ink-3)" }}>
          {hoverIndex !== null ? "Hovered date" : "Latest — hover the chart to scrub"}
        </p>
      </div>

      <div className="flex-1 px-5 py-4">
        {/* Comparison mode: side-by-side + spread */}
        {compareSubject ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md px-3 py-2" style={{ background: "var(--lucid-surface-2)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "var(--lucid-accent)" }} />
                  <span className="text-[11px] truncate" style={{ color: "var(--lucid-ink-2)" }}>{subject.name}</span>
                </div>
                <span className="lt-num text-lg font-semibold" style={{ color: "var(--lucid-ink)" }}>{fmtSigned(aVal, valueUnit)}</span>
              </div>
              <div className="rounded-md px-3 py-2" style={{ background: "var(--lucid-surface-2)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "var(--lucid-cool)" }} />
                  <span className="text-[11px] truncate" style={{ color: "var(--lucid-ink-2)" }}>{compareSubject.name}</span>
                </div>
                <span className="lt-num text-lg font-semibold" style={{ color: "var(--lucid-ink)" }}>{fmtSigned(bVal, valueUnit)}</span>
              </div>
            </div>
            <div className="rounded-md px-3 py-2 flex items-center justify-between" style={{ background: "var(--lucid-surface-3)" }}>
              <span className="lt-eyebrow">Spread</span>
              <span className="lt-num text-base font-semibold"
                style={{ color: spread === null ? "var(--lucid-ink-3)" : spread > 0 ? "var(--lucid-pos)" : spread < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)" }}>
                {spread === null ? "—" : spread > 0 ? `+${spread}` : spread}
              </span>
            </div>
            {(breakdown && breakdown.groups.length > 0) || (cmpBreakdown && cmpBreakdown.groups.length > 0) ? null : (
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>
                Per-indicator breakdown isn&apos;t shown in comparison view — open either subject in Score Trend to scrub its drivers.
              </p>
            )}
          </div>
        ) : railEmpty ? (
          <div className="rounded-lg px-4 py-6 text-center" style={{ border: "1px dashed var(--lucid-line-2)" }}>
            <p className="text-xs leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>
              {subject.railEmptyNote ?? "No per-date breakdown for this subject."}
            </p>
          </div>
        ) : breakdown?.emptyNote ? (
          <div className="rounded-lg px-4 py-6 text-center" style={{ border: "1px dashed var(--lucid-line-2)" }}>
            <p className="text-xs leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>{breakdown.emptyNote}</p>
          </div>
        ) : breakdown ? (
          <div className="flex flex-col gap-5">
            {breakdown.groups.map((group) => (
              <div key={group.label}>
                <div className="lt-eyebrow mb-2">{group.label}</div>
                <div className="flex flex-col gap-1">
                  {group.rows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md" style={{ background: "var(--lucid-surface-2)" }}>
                      <span className="text-xs truncate" style={{ color: "var(--lucid-ink-2)" }} title={row.label}>{row.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {row.detail && <span className="text-[11px] lt-num" style={{ color: "var(--lucid-ink-3)" }}>{row.detail}</span>}
                        {row.score !== null && <ScorePill score={row.score} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

// ─── the shell ──────────────────────────────────────────────────────────────

export function FullScreenAnalysis({ config, initialSubjectId, initialCompareId, onClose, onCompare }: FullScreenAnalysisProps) {
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? config.defaultSubjectId);
  const [compareId, setCompareId] = useState<string | null>(initialCompareId ?? null);
  const [timeframe, setTimeframe] = useState<TimeframeKey>("3M");
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);
  const [chartType, setChartType] = useState<ChartType>(config.defaultChartType);
  const [showBands, setShowBands] = useState(config.chartKind === "score");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const isComparison = config.chartKind === "comparison";

  // Oracle's history endpoints only accept a fixed range enum (no from/to) —
  // a custom range fetches the broadest preset and windows client-side below.
  const effectiveTimeframe = customRange ? "1Y" : timeframe;

  const subjectQuery = useQuery({
    queryKey: [...config.queryKeyPrefix, subjectId, effectiveTimeframe],
    queryFn: () => config.fetchSubject(subjectId, effectiveTimeframe),
  });

  const compareQuery = useQuery({
    queryKey: [...config.queryKeyPrefix, compareId, effectiveTimeframe],
    queryFn: () => config.fetchSubject(compareId as string, effectiveTimeframe),
    enabled: isComparison && compareId !== null,
  });

  const rawSubject = subjectQuery.data;
  const rawCompareSubject = isComparison && compareId ? (compareQuery.data ?? null) : null;

  const subject = useMemo(
    () => (rawSubject && customRange ? windowSubject(rawSubject, customRange) : rawSubject),
    [rawSubject, customRange],
  );
  const compareSubject = useMemo(
    () => (rawCompareSubject && customRange ? windowSubject(rawCompareSubject, customRange) : rawCompareSubject),
    [rawCompareSubject, customRange],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => { document.removeEventListener("keydown", handler); };
  }, [onClose]);

  return (
    <div className="absolute inset-x-0 top-11 bottom-0 z-20 flex flex-col" style={{ background: "var(--lucid-bg)" }}>
      {/* ── HEADER (Bloomberg-style panel header) ── */}
      <div className="shrink-0 flex flex-col" style={{ borderBottom: "1px solid var(--lucid-line)" }}>
        {/* Row 1: identity + headline value + delta + close */}
        <div className="flex items-center gap-4 px-5 py-3">
          <span className="lt-eyebrow shrink-0">{config.title}</span>
          <div className="flex items-baseline gap-3 min-w-0 flex-1">
            {subject && (
              <>
                <h1 className="lt-serif text-lg font-semibold flex items-center gap-2 truncate" style={{ color: "var(--lucid-ink)" }}>
                  {subject.flag && <span>{subject.flag}</span>}
                  {subject.name}
                </h1>
                <span className="lt-num text-2xl font-semibold" style={{ color: "var(--lucid-ink)" }}>
                  {fmtSigned(subject.currentValue, config.valueUnit)}
                </span>
                {subject.band && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
                    style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "1px solid var(--lucid-accent-bd)" }}>
                    {subject.band}
                  </span>
                )}
                <DeltaBadge delta={subject.delta} unit={config.valueUnit} />
              </>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-md transition-colors hover:bg-white/5 shrink-0" style={{ color: "var(--lucid-ink-3)" }} title="Close (Esc)">
            <X size={18} />
          </button>
        </div>

        {/* Row 2: subject pickers · chart-type toggle · bands · timeframe · compare */}
        <div className="flex items-center justify-between gap-4 px-5 pb-3 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <SubjectPicker options={config.subjectOptions} value={subjectId} onChange={setSubjectId} label="Subject" />
            {isComparison && (
              <SubjectPicker
                options={[{ id: "", label: "None" }, ...config.subjectOptions.filter((o) => o.id !== subjectId)]}
                value={compareId ?? ""}
                onChange={(id) => setCompareId(id === "" ? null : id)}
                label="vs"
              />
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Bands toggle (score / comparison only) */}
            {(config.chartKind === "score" || config.chartKind === "comparison") && (
              <button
                onClick={() => setShowBands((b) => !b)}
                className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors"
                style={{
                  background: showBands ? "var(--lucid-accent-bg)" : "var(--lucid-surface-3)",
                  color: showBands ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                  border: `1px solid ${showBands ? "var(--lucid-accent-bd)" : "var(--lucid-line)"}`,
                }}
                title="Toggle band zones"
              >
                Bands
              </button>
            )}

            {/* Bar / line toggle */}
            <div className="flex items-center rounded-md overflow-hidden" style={{ border: "1px solid var(--lucid-line-2)" }}>
              {([["line", LineChart], ["bar", BarChart3]] as const).map(([t, Icon]) => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className="px-2.5 py-1.5 transition-colors"
                  style={{
                    background: chartType === t ? "var(--lucid-accent-bg)" : "transparent",
                    color: chartType === t ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                  }}
                  title={`${t} chart`}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>

            {/* Timeframe (presets + custom range) */}
            <TimeframeControl
              presets={TIMEFRAMES.map((tf) => ({ key: tf.key, label: tf.label }))}
              activePresetKey={customRange ? null : timeframe}
              onSelectPreset={(key) => {
                setCustomRange(null);
                setTimeframe(key as TimeframeKey);
              }}
              customRange={customRange}
              onSelectCustomRange={setCustomRange}
              maxDate={new Date().toISOString().slice(0, 10)}
            />

            {/* Compare — routes to the Comparison tool (not inline) */}
            {config.compareEnabled && onCompare && (
              <button
                onClick={() => onCompare(subjectId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line-2)" }}
                title="Compare against another subject"
              >
                <GitCompare size={13} />
                Compare
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN: full-width chart + docked rail ── */}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 flex flex-col p-4">
          {subjectQuery.isLoading ? (
            <div className="flex-1 flex items-center justify-center"><LoadingState message={`Loading ${config.title}...`} /></div>
          ) : subjectQuery.error ? (
            <div className="flex-1 flex items-center justify-center"><ErrorState error={subjectQuery.error} onRetry={() => subjectQuery.refetch()} /></div>
          ) : !subject ? null : !subject.seriesAvailable ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-lg text-center px-6"
              style={{ border: "1px dashed var(--lucid-line-2)", background: "var(--lucid-surface)" }}>
              <span className="lt-eyebrow" style={{ color: "var(--lucid-warn)" }}>No data in range</span>
              <p className="text-sm max-w-md" style={{ color: "var(--lucid-ink-2)" }}>{subject.seriesGapNote}</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <AnalysisChart
                subject={subject}
                compareSubject={compareSubject}
                chartKind={config.chartKind}
                chartType={chartType}
                yDomain={config.yDomain}
                showBands={showBands}
                onHoverIndex={setHoverIndex}
              />
            </div>
          )}
        </div>

        {subject && !subjectQuery.isLoading && !subjectQuery.error && subject.seriesAvailable && (
          <SideRail subject={subject} compareSubject={compareSubject} hoverIndex={hoverIndex} valueUnit={config.valueUnit} />
        )}
      </div>
    </div>
  );
}
