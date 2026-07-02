"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
} from "recharts";
import { X, ChevronDown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import type {
  AnalysisSubject,
  AnalysisToolConfig,
  TimeframeKey,
  SubjectOption,
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
  onClose: () => void;
}

// ─── small pieces ──────────────────────────────────────────────────────────────

function fmtSigned(n: number | null): string {
  if (n === null) return "—";
  return n > 0 ? `+${n}` : String(n);
}

function DeltaBadge({ delta, unit }: { delta: number | null; unit: string }) {
  if (delta === null) {
    return (
      <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
        —
      </span>
    );
  }
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const color = delta > 0 ? "var(--lucid-pos)" : delta < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)";
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold lt-num" style={{ color }}>
      <Icon size={13} />
      {delta > 0 ? `+${delta}` : delta} {unit}
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
  // Group options for a cleaner picker (Assets / Pairs, or economies).
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
          style={{
            background: "var(--lucid-surface-3)",
            border: "1px solid var(--lucid-line-2)",
            color: "var(--lucid-ink)",
          }}
        >
          {groups.map(([g, opts]) =>
            g ? (
              <optgroup key={g} label={g}>
                {opts.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.flag ? `${opt.flag} ` : ""}
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ) : (
              opts.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.flag ? `${opt.flag} ` : ""}
                  {opt.label}
                </option>
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
  if (score === null) {
    return (
      <span className="lt-num text-[11px]" style={{ color: "var(--lucid-ink-3)" }}>
        —
      </span>
    );
  }
  const color = score > 0 ? "var(--lucid-pos)" : score < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)";
  const bg = score > 0 ? "var(--lucid-pos-bg)" : score < 0 ? "var(--lucid-neg-bg)" : "var(--lucid-surface-3)";
  const bd = score > 0 ? "var(--lucid-pos-bd)" : score < 0 ? "var(--lucid-neg-bd)" : "var(--lucid-line-2)";
  return (
    <span
      className="inline-flex items-center justify-center min-w-7 px-1.5 py-0.5 rounded text-[11px] font-semibold lt-num"
      style={{ background: bg, color, border: `1px solid ${bd}` }}
    >
      {fmtSigned(score)}
    </span>
  );
}

// ─── chart ─────────────────────────────────────────────────────────────────────

function SeriesChart({
  subject,
  compareSubject,
  secondaryLabel,
  yDomain,
  valueUnit,
  onScrub,
}: {
  subject: AnalysisSubject;
  compareSubject: AnalysisSubject | null;
  secondaryLabel?: string;
  yDomain: [number, number] | "auto";
  valueUnit: string;
  onScrub: (index: number | null) => void;
}) {
  const data = useMemo(() => {
    const len = Math.max(subject.points.length, compareSubject?.points.length ?? 0);
    return Array.from({ length: len }, (_, i) => ({
      index: i,
      label: subject.points[i]?.label ?? compareSubject?.points[i]?.label ?? "",
      primary: subject.points[i]?.value ?? null,
      secondary: subject.points[i]?.secondary ?? null,
      compare: compareSubject?.points[i]?.value ?? null,
    }));
  }, [subject, compareSubject]);

  const flipPoints = subject.points.filter((p) => p.event);
  const hasSecondary = subject.points.some((p) => p.secondary != null);

  if (!subject.seriesAvailable) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center gap-3 rounded-lg text-center px-6"
        style={{ border: "1px dashed var(--lucid-line-2)", background: "var(--lucid-surface)" }}
      >
        <span className="lt-eyebrow" style={{ color: "var(--lucid-warn)" }}>
          No data in range
        </span>
        <p className="text-sm max-w-md" style={{ color: "var(--lucid-ink-2)" }}>
          {subject.seriesGapNote}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          onMouseMove={(state) => {
            if (state && typeof state.activeTooltipIndex === "number") onScrub(state.activeTooltipIndex);
          }}
          onMouseLeave={() => onScrub(null)}
          margin={{ top: 12, right: 20, bottom: 8, left: 8 }}
        >
          <CartesianGrid stroke="var(--lucid-line)" vertical={false} />
          {subject.bands?.map((band) => (
            <ReferenceArea
              key={band.label}
              y1={band.from}
              y2={band.to}
              fill={`var(${band.colorVar})`}
              fillOpacity={0.05}
              strokeWidth={0}
            />
          ))}
          {!subject.bands && <ReferenceLine y={0} stroke="var(--lucid-line-2)" strokeWidth={1} />}
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--lucid-ink-3)", fontSize: 10 }}
            axisLine={{ stroke: "var(--lucid-line-2)" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            domain={yDomain === "auto" ? ["auto", "auto"] : yDomain}
            tick={{ fill: "var(--lucid-ink-3)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "var(--lucid-surface-2)",
              border: "1px solid var(--lucid-line-2)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--lucid-ink-2)" }}
            itemStyle={{ color: "var(--lucid-ink)" }}
            formatter={(v) => `${v}${valueUnit === "%" ? "%" : ""}`}
          />
          {hasSecondary && (
            <Line
              type="monotone"
              dataKey="secondary"
              name={secondaryLabel ?? "Forecast"}
              stroke="var(--lucid-ink-3)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
            />
          )}
          <Line
            type="monotone"
            dataKey="primary"
            name={subject.name}
            stroke="var(--lucid-accent)"
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4, fill: "var(--lucid-accent)" }}
            connectNulls
          />
          {compareSubject && (
            <Line
              type="monotone"
              dataKey="compare"
              name={compareSubject.name}
              stroke="var(--lucid-cool)"
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 4, fill: "var(--lucid-cool)" }}
              connectNulls
            />
          )}
          {flipPoints.map((p) => (
            <ReferenceDot
              key={p.index}
              x={data[p.index]?.label}
              y={p.value ?? 0}
              r={4}
              fill={
                p.event?.kind === "flip-up" || p.event?.kind === "surprise-beat" || p.event?.kind === "extreme-high"
                  ? "var(--lucid-pos)"
                  : "var(--lucid-neg)"
              }
              stroke="var(--lucid-bg)"
              strokeWidth={1.5}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── side rail (per-date breakdown) ──────────────────────────────────────────────

function SideRail({
  subject,
  compareSubject,
  scrubIndex,
  valueUnit,
}: {
  subject: AnalysisSubject;
  compareSubject: AnalysisSubject | null;
  scrubIndex: number | null;
  valueUnit: string;
}) {
  // Default to the latest point when nothing is hovered.
  const idx = scrubIndex ?? subject.points.length - 1;
  const breakdown: DateBreakdown | undefined = subject.breakdownByIndex?.[idx];

  const railEmpty = !subject.breakdownByIndex || subject.railEmptyNote;

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 w-[340px] xl:w-[380px] overflow-y-auto"
      style={{ borderLeft: "1px solid var(--lucid-line)", background: "var(--lucid-surface)" }}
    >
      <div className="px-5 py-4 sticky top-0" style={{ borderBottom: "1px solid var(--lucid-line)", background: "var(--lucid-surface)" }}>
        <div className="lt-eyebrow">{subject.railHeading ?? "Detail"}</div>
        {breakdown && (
          <div className="flex items-baseline gap-2 mt-2">
            <span className="lt-num text-lg font-semibold" style={{ color: "var(--lucid-ink)" }}>
              {breakdown.label}
            </span>
            {breakdown.headline !== null && (
              <span className="lt-num text-sm" style={{ color: "var(--lucid-ink-2)" }}>
                {fmtSigned(breakdown.headline)}
                {valueUnit === "%" ? "%" : ""}
              </span>
            )}
            {breakdown.headlineLabel && (
              <span className="text-[11px]" style={{ color: "var(--lucid-ink-3)" }}>
                {breakdown.headlineLabel}
              </span>
            )}
          </div>
        )}
        <p className="text-[11px] mt-1" style={{ color: "var(--lucid-ink-3)" }}>
          {scrubIndex !== null ? "Hovered date" : "Latest date — hover the chart to scrub"}
        </p>
      </div>

      <div className="flex-1 px-5 py-4">
        {railEmpty ? (
          <div className="rounded-lg px-4 py-6 text-center" style={{ border: "1px dashed var(--lucid-line-2)" }}>
            <p className="text-xs leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>
              {subject.railEmptyNote ?? "No per-date breakdown for this subject."}
            </p>
          </div>
        ) : breakdown?.emptyNote ? (
          <div className="rounded-lg px-4 py-6 text-center" style={{ border: "1px dashed var(--lucid-line-2)" }}>
            <p className="text-xs leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>
              {breakdown.emptyNote}
            </p>
          </div>
        ) : breakdown ? (
          <div className="flex flex-col gap-5">
            {breakdown.groups.map((group) => (
              <div key={group.label}>
                <div className="lt-eyebrow mb-2">{group.label}</div>
                <div className="flex flex-col gap-1">
                  {group.rows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md"
                      style={{ background: "var(--lucid-surface-2)" }}
                    >
                      <span className="text-xs truncate" style={{ color: "var(--lucid-ink-2)" }} title={row.label}>
                        {row.label}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {row.detail && (
                          <span className="text-[11px] lt-num" style={{ color: "var(--lucid-ink-3)" }}>
                            {row.detail}
                          </span>
                        )}
                        {row.score !== null && <ScorePill score={row.score} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {compareSubject && (
          <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--lucid-line)" }}>
            <div className="lt-eyebrow mb-2">Comparing</div>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--lucid-ink-2)" }}>
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "var(--lucid-cool)" }} />
              {compareSubject.name}
              <span className="lt-num ml-auto">{fmtSigned(compareSubject.currentValue)}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── the cockpit ─────────────────────────────────────────────────────────────

export function FullScreenAnalysis({ config, initialSubjectId, onClose }: FullScreenAnalysisProps) {
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? config.defaultSubjectId);
  const [timeframe, setTimeframe] = useState<TimeframeKey>("3M");
  const [compareId, setCompareId] = useState<string | null>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);

  const subjectQuery = useQuery({
    queryKey: [...config.queryKeyPrefix, subjectId, timeframe],
    queryFn: () => config.fetchSubject(subjectId, timeframe),
  });

  const compareQuery = useQuery({
    queryKey: [...config.queryKeyPrefix, compareId, timeframe],
    queryFn: () => config.fetchSubject(compareId as string, timeframe),
    enabled: compareId !== null,
  });

  const subject = subjectQuery.data;
  const compareSubject = compareId ? (compareQuery.data ?? null) : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: "var(--lucid-bg)" }}>
      {/* ── DOCKED CONTROL BAR (does not scroll) ── */}
      <div
        className="shrink-0 flex flex-col"
        style={{ borderBottom: "1px solid var(--lucid-line)" }}
      >
        {/* Row 1: title + headline value + close */}
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
                  {subject.currentValue !== null
                    ? `${fmtSigned(subject.currentValue)}${config.valueUnit === "%" ? "%" : ""}`
                    : "—"}
                </span>
                {subject.band && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
                    style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "1px solid var(--lucid-accent-bd)" }}
                  >
                    {subject.band}
                  </span>
                )}
                <DeltaBadge delta={subject.delta} unit={config.valueUnit} />
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md transition-colors hover:bg-white/5 shrink-0"
            style={{ color: "var(--lucid-ink-3)" }}
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Row 2: controls */}
        <div className="flex items-center justify-between gap-4 px-5 pb-3 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <SubjectPicker options={config.subjectOptions} value={subjectId} onChange={setSubjectId} label="Subject" />
            {config.compareEnabled && (
              <SubjectPicker
                options={[{ id: "", label: "None" }, ...config.subjectOptions.filter((o) => o.id !== subjectId)]}
                value={compareId ?? ""}
                onChange={(id) => setCompareId(id === "" ? null : id)}
                label="Compare"
              />
            )}
          </div>
          <div className="flex items-center rounded-md overflow-hidden" style={{ border: "1px solid var(--lucid-line-2)" }}>
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                className="px-3.5 py-1.5 text-xs font-semibold transition-colors lt-num"
                style={{
                  background: timeframe === tf.key ? "var(--lucid-accent-bg)" : "transparent",
                  color: timeframe === tf.key ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN: full-width chart + side rail ── */}
      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 flex flex-col p-5">
          {subjectQuery.isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingState message={`Loading ${config.title}...`} />
            </div>
          ) : subjectQuery.error ? (
            <div className="flex-1 flex items-center justify-center">
              <ErrorState error={subjectQuery.error} onRetry={() => subjectQuery.refetch()} />
            </div>
          ) : !subject ? null : (
            <>
              <SeriesChart
                subject={subject}
                compareSubject={compareSubject}
                secondaryLabel={subject.secondaryLabel}
                yDomain={config.yDomain}
                valueUnit={config.valueUnit}
                onScrub={setScrubIndex}
              />
              {/* legend */}
              <div className="flex items-center gap-4 mt-3 text-xs flex-wrap shrink-0" style={{ color: "var(--lucid-ink-2)" }}>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--lucid-accent)" }} />
                  {subject.name}
                </span>
                {subject.secondaryLabel && subject.points.some((p) => p.secondary != null) && (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--lucid-ink-3)" }} />
                    {subject.secondaryLabel}
                  </span>
                )}
                {compareSubject && (
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-0.5 rounded" style={{ background: "var(--lucid-cool)" }} />
                    {compareSubject.name}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {subject && !subjectQuery.isLoading && !subjectQuery.error && (
          <SideRail
            subject={subject}
            compareSubject={compareSubject}
            scrubIndex={scrubIndex}
            valueUnit={config.valueUnit}
          />
        )}
      </div>
    </div>
  );
}
