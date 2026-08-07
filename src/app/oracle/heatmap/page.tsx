"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import { economies } from "@/data/heatmap";
import { useHeatmap } from "@/hooks/useHeatmap";
import { useOracleTools } from "@/components/oracle-tools/OracleToolsProvider";
import type {
  OracleEconomy,
  PublicHeatmapIndicator,
  NextReleaseInfo,
} from "@/lib/api/oracle";
import { PageSkeleton } from "@/components/state/PageSkeleton";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import { AnimatedNumber } from "@/components/motion";
import { zonedTime, zonedWeekday } from "@/lib/calendar-time";
import {
  subscribeTimezone,
  getTimezoneSnapshot,
  getTimezoneServerSnapshot,
} from "@/lib/calendar-timezone-store";

const CATEGORIES = ["ECONOMIC GROWTH", "INFLATION", "JOBS MARKET"] as const;

/**
 * Derives the backend indicator code from (economy, display name) for the
 * IndicatorTrend tool. The heatmap payload carries only `name`, not a `code`,
 * so this maps the common scored indicators; names it can't resolve return null
 * and the row is rendered without a (broken) click — never faked.
 *
 * Issue 2: AU's PPI and Unemployment codes don't follow the {economy}_{SUFFIX}
 * pattern the other four economies share (AU_PPI_YOY not AU_PPI_MOM;
 * AU_UNEMPLOYMENT not AU_UNEMP) — verified directly against the seed. Special-
 * cased here rather than guessed, so the newly-visible AU economy never
 * produces a wrong-but-non-null code (a broken click, worse than no click).
 */
function deriveIndicatorCode(economy: OracleEconomy, name: string): string | null {
  const n = name.toLowerCase();
  const p = economy; // US | EU | UK | JP | AU
  if (p === "AU" && n.includes("ppi")) return "AU_PPI_YOY";
  if (p === "AU" && n.includes("unemploy")) return "AU_UNEMPLOYMENT";
  // Issue 5: "JP Tokyo Core CPI YoY" also contains "cpi" — checked first so
  // it resolves to its own real code rather than colliding with plain CPI's
  // (the same collision that produced a duplicate React key in the tools
  // drawer's Indicator Trend picker, via adapters.ts's sibling function).
  if (n.includes("tokyo")) return "JP_TOKYO_CPI_YOY";
  if (n.includes("cpi")) return `${p}_CPI_YOY`;
  if (n.includes("ppi")) return `${p}_PPI_MOM`;
  if (n.includes("gdp")) return `${p}_GDP_QOQ`;
  if (n.includes("retail")) return `${p}_RETAIL_MOM`;
  if (n.includes("unemploy")) return `${p}_UNEMP`;
  if (n.includes("pce")) return "US_PCE_YOY";
  if (n.includes("nfp") || n.includes("payroll")) return "US_NFP";
  if (n.includes("jolts")) return "US_JOLTS";
  if (n.includes("adp")) return "US_ADP";
  if (n.includes("claims")) return "US_JOBLESS_CLAIMS";
  return null;
}

/**
 * Days from `today` to a stored next-release instant. Null covers both real
 * absence (no calendar event stored — the common case, since the feed is
 * current-week-only) and "Daily"/event-driven indicators, which never have a
 * calendar row to begin with — same null, same downstream treatment, no
 * special-casing needed here now that the arithmetic that used to distinguish
 * them is gone.
 */
function daysUntil(next: NextReleaseInfo | null, today: Date): number | null {
  if (!next) return null;
  const d = new Date(next.scheduledAt);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

function nextReleaseStyle(next: NextReleaseInfo | null, today: Date): React.CSSProperties {
  const days = daysUntil(next, today);
  if (days === null) return { color: "var(--lucid-ink-3)" };
  if (days <= 2) return { color: "var(--lucid-warn)", fontWeight: 500 };
  if (days <= 7) return { color: "var(--lucid-ink-2)", fontWeight: 500 };
  return { color: "var(--lucid-ink-3)" };
}

/**
 * "Tue 14:45 · Final" or "Tue 14:45" for a single-release indicator.
 * "Not scheduled" when no future calendar event is stored — a clearly-labelled
 * unknown, never a fabricated date. This is the ordinary state for most
 * indicators most of the time, not an error: the feed only ever holds the
 * current week.
 *
 * B5 — reads the SAME persisted timezone preference the calendar page reads
 * and writes (calendar-timezone-store.ts, defaults to IST). Previously this
 * used the browser's implicit local zone via toLocaleDateString/
 * toLocaleTimeString with no `timeZone` option — a viewer in London and a
 * viewer in Mumbai would see the same UTC instant rendered as two different
 * clock times on this page, while the calendar page (right next to it in the
 * dock) showed a third, IST-anchored answer. Same event must read the same
 * time everywhere; unifying on one stored preference is what makes that true
 * rather than aspirational.
 */
function formatNextRelease(next: NextReleaseInfo | null, timeZone: string): string {
  if (!next) return "Not scheduled";
  const d = new Date(next.scheduledAt);
  if (isNaN(d.getTime())) return "Not scheduled";
  const day = zonedWeekday(d, timeZone);
  const time = zonedTime(d, timeZone);
  return next.variant ? `${day} ${time} · ${capitalize(next.variant)}` : `${day} ${time}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Surprise cell colouring: beat = pos, miss = neg (color-coded actual vs forecast). */
function surpriseStyle(surprise: string | null): React.CSSProperties {
  if (surprise === null || surprise === "—") return { color: "var(--lucid-ink-3)" };
  if (surprise === "Hawkish") return { background: "var(--lucid-pos-bg)", color: "var(--lucid-pos)" };
  if (surprise === "Dovish") return { background: "var(--lucid-neg-bg)", color: "var(--lucid-neg)" };
  const num = parseFloat(surprise);
  if (isNaN(num)) return { color: "var(--lucid-ink-3)" };
  if (num > 0) return { background: "var(--lucid-pos-bg)", color: "var(--lucid-pos)" };
  if (num < 0) return { background: "var(--lucid-neg-bg)", color: "var(--lucid-neg)" };
  return { color: "var(--lucid-ink-3)" };
}

function actualColor(surprise: string | null): string {
  if (surprise === null || surprise === "—") return "var(--lucid-ink)";
  if (surprise === "Hawkish") return "var(--lucid-pos)";
  if (surprise === "Dovish") return "var(--lucid-neg)";
  const num = parseFloat(surprise);
  if (isNaN(num) || num === 0) return "var(--lucid-ink)";
  return num > 0 ? "var(--lucid-pos)" : "var(--lucid-neg)";
}

function ScorePill({ score }: { score: number }) {
  const color = score > 0 ? "var(--lucid-pos)" : score < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)";
  const bg = score > 0 ? "var(--lucid-pos-bg)" : score < 0 ? "var(--lucid-neg-bg)" : "var(--lucid-surface-3)";
  const bd = score > 0 ? "var(--lucid-pos-bd)" : score < 0 ? "var(--lucid-neg-bd)" : "var(--lucid-line-2)";
  return (
    <span
      className="inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-semibold lt-num"
      style={{ background: bg, color, border: `1px solid ${bd}` }}
    >
      {score > 0 ? "+" : ""}{score}
    </span>
  );
}

function biasColor(pct: number): string {
  if (pct < 35) return "var(--lucid-neg)";
  if (pct > 65) return "var(--lucid-pos)";
  return "var(--lucid-ink-2)";
}

function biasLabel(pct: number): string {
  if (pct >= 65) return "Bullish";
  if (pct <= 35) return "Bearish";
  return "Neutral";
}

function formatToday(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function HeatmapPage() {
  const [economy, setEconomy] = useState<OracleEconomy>("US");
  const { data: heatmap, isLoading, error, refetch } = useHeatmap();
  const { openIndicatorTrend } = useOracleTools();
  const TODAY = useMemo(() => new Date(), []);
  // B5 — same store the calendar page reads/writes; see formatNextRelease's doc.
  const timeZone = useSyncExternalStore(
    subscribeTimezone,
    getTimezoneSnapshot,
    getTimezoneServerSnapshot,
  );

  const indicators: PublicHeatmapIndicator[] = useMemo(
    () => (heatmap ? heatmap[economy] ?? [] : []),
    [heatmap, economy],
  );

  const stats = useMemo(() => {
    const total = indicators.length;
    const scored = indicators.filter((i) => i.outcome !== "insufficient_data");
    const bullish = scored.filter((i) => i.score === 1).length;
    const bearish = scored.filter((i) => i.score === -1).length;
    const neutral = scored.filter((i) => i.score === 0).length;
    const denom = scored.length - neutral;
    const bullishPct = denom > 0 ? (bullish / denom) * 100 : 50;
    const allInsufficient = scored.length === 0 && total > 0;
    return { total, bullish, bearish, neutral, bullishPct, allInsufficient };
  }, [indicators]);

  const grouped = useMemo(() => {
    const map = new Map<string, PublicHeatmapIndicator[]>();
    for (const cat of CATEGORIES) {
      map.set(cat, indicators.filter((i) => i.category === cat));
    }
    return map;
  }, [indicators]);

  if (isLoading) return <PageSkeleton cards={0} blocks={1} rows={12} />;
  if (error) return <div className="p-4 sm:p-6"><ErrorState error={error} onRetry={() => refetch()} /></div>;
  if (!heatmap) return <div className="p-4 sm:p-6"><EmptyState title="No heatmap data available" /></div>;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Page Header */}
      <div className="lt-rise lt-stagger-1 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="lt-serif text-xl font-semibold truncate" style={{ color: "var(--lucid-ink)" }}>
            Economic Heatmap
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>
            Macro release data and surprise indicators by economy
          </p>
        </div>
        <p className="text-xs shrink-0 sm:text-right lt-num" style={{ color: "var(--lucid-ink-3)" }}>
          Viewed {formatToday(TODAY)}
        </p>
      </div>

      {/* Economy Selector */}
      <div className="lt-rise lt-stagger-2 flex gap-2 flex-wrap">
        {economies.map((e) => {
          const active = economy === e.key;
          return (
            <button
              key={e.key}
              onClick={() => setEconomy(e.key)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={
                active
                  ? { background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "1px solid var(--lucid-accent-bd)", boxShadow: "0 0 18px rgba(205, 167, 79, 0.16)" }
                  : { background: "var(--lucid-surface-3)", border: "1px solid var(--lucid-line)", color: "var(--lucid-ink-3)" }
              }
            >
              {e.flag} {e.label}
            </button>
          );
        })}
      </div>

      {/* Summary Cards */}
      <div className="lt-rise lt-stagger-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Indicators Tracked", value: stats.total, color: "var(--lucid-ink-2)" },
          { label: "Bullish", value: stats.bullish, color: "var(--lucid-pos)" },
          { label: "Bearish", value: stats.bearish, color: "var(--lucid-neg)" },
          { label: "Neutral", value: stats.neutral, color: "var(--lucid-ink-3)" },
          {
            label: "Bullish %",
            value: stats.allInsufficient ? "—" : `${stats.bullishPct.toFixed(1)}%`,
            color: stats.allInsufficient ? "var(--lucid-warn)" : biasColor(stats.bullishPct),
          },
        ].map((card) => (
          <div key={card.label} className="lt-metric px-4 py-3">
            <p className="lt-eyebrow">{card.label}</p>
            <p className="lt-num text-lg font-semibold mt-1" style={{ color: card.color }}>
              {typeof card.value === "number" ? (
                <AnimatedNumber value={card.value} format={(n) => `${Math.round(n)}`} />
              ) : (
                card.value
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div
        className="lt-card lt-edge lt-rise lt-stagger-4 overflow-x-auto"
        style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
      >
        {indicators.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No indicators for this economy"
              description="The backend returned an empty set for the selected economy."
            />
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
                {["INDICATOR", "LAST RELEASE", "NEXT RELEASE", "ACTUAL", "FORECAST", "PREVIOUS", "SURPRISE", "SCORE"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left lt-eyebrow whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => {
                const rows = grouped.get(cat);
                if (!rows || rows.length === 0) return null;
                return <CategoryGroup key={cat} category={cat} rows={rows} today={TODAY} economy={economy} onOpen={openIndicatorTrend} timeZone={timeZone} />;
              })}
              {(() => {
                const otherRows = indicators.filter((i) => !CATEGORIES.includes(i.category as typeof CATEGORIES[number]));
                if (otherRows.length === 0) return null;
                return <CategoryGroup key="OTHER" category="OTHER" rows={otherRows} today={TODAY} economy={economy} onOpen={openIndicatorTrend} timeZone={timeZone} />;
              })()}
            </tbody>
          </table>
        )}
      </div>

      {/* Overall Economy Score */}
      <div
        className="lt-card lt-edge lt-rise lt-stagger-5 p-5"
        style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="lt-eyebrow">Overall Bullish Bias</p>
            <div className="flex items-baseline gap-3 mt-1">
              {stats.allInsufficient ? (
                <span className="lt-num text-2xl font-semibold" style={{ color: "var(--lucid-warn)" }}>No data</span>
              ) : (
                <>
                  <span className="lt-num text-2xl font-semibold" style={{ color: biasColor(stats.bullishPct) }}>
                    <AnimatedNumber value={stats.bullishPct} format={(n) => `${n.toFixed(1)}%`} />
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--lucid-ink-2)" }}>{biasLabel(stats.bullishPct)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--lucid-surface-3)" }}>
          <div
            className="lt-bar h-full rounded-full transition-all duration-500"
            style={{ width: stats.allInsufficient ? "0%" : `${stats.bullishPct}%`, background: biasColor(stats.bullishPct) }}
          />
        </div>

        <p className="text-xs mt-3" style={{ color: "var(--lucid-ink-3)" }}>
          <span className="lt-num" style={{ color: "var(--lucid-pos)" }}>{stats.bullish} Bullish</span>
          {" · "}
          <span className="lt-num" style={{ color: "var(--lucid-neg)" }}>{stats.bearish} Bearish</span>
          {" · "}
          <span className="lt-num" style={{ color: "var(--lucid-ink-3)" }}>{stats.neutral} Neutral</span>
        </p>
      </div>
    </div>
  );
}

/* ─── Category group with section divider ─── */
function CategoryGroup({
  category,
  rows,
  today,
  economy,
  onOpen,
  timeZone,
}: {
  category: string;
  rows: PublicHeatmapIndicator[];
  today: Date;
  economy: OracleEconomy;
  onOpen: (code: string) => void;
  timeZone: string;
}) {
  return (
    <>
      {/* Section divider */}
      <tr>
        <td colSpan={8} className="px-3 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <span className="lt-eyebrow whitespace-nowrap">{category}</span>
            <div className="flex-1 h-px" style={{ background: "var(--lucid-line)" }} />
          </div>
        </td>
      </tr>
      {rows.map((ind) => {
        const isInsufficient = ind.outcome === "insufficient_data";
        // Three independent, visually distinct facts — never merged into one
        // marker (see the shared comment on isAging in oracle-mappers.ts):
        //   OVERDUE — a specific scheduled release passed with nothing
        //     entered. The most actionable state; reads as urgent (neg red).
        //   AGING (renamed from "stale") — the value on file is old in
        //     absolute terms, independent of whether anything is newly due.
        //     Reads as a caution (warn amber) — real data, just old.
        //   INAPPLICABLE / insufficient_data — not this row's concern here
        //     (handled by isInsufficient above); genuinely different from
        //     both of the above, never conflated with either.
        const agingTooltip = ind.aging
          ? ind.agingDate
            ? `Data is more than 60 days old (last observation ${ind.agingDate})`
            : "Data is more than 60 days old"
          : undefined;
        const overdueTooltip = ind.overdue
          ? "A scheduled release passed more than 24h ago with nothing entered"
          : undefined;
        const code = deriveIndicatorCode(economy, ind.name);
        const clickable = code !== null && !isInsufficient;
        return (
          <tr
            key={ind.name}
            className={clickable ? "transition-colors cursor-pointer" : "transition-colors"}
            style={{ borderBottom: "1px solid var(--lucid-line)" }}
            onClick={clickable ? () => onOpen(code!) : undefined}
            onMouseEnter={clickable ? (e) => { e.currentTarget.style.background = "var(--lucid-surface-2)"; } : undefined}
            onMouseLeave={clickable ? (e) => { e.currentTarget.style.background = "transparent"; } : undefined}
            title={clickable ? `Open Indicator Trend for ${ind.name}` : undefined}
          >
            {/* Indicator */}
            <td className="px-3 py-2.5">
              <span className="font-semibold" style={{ color: "var(--lucid-ink)" }}>{ind.name}</span>
              {/* OVERDUE first — the more actionable of the two, and neg-red
                  so it visually outranks aging's amber when both are true
                  for the same row (a genuinely old value that ALSO just
                  missed a fresh scheduled release). */}
              {ind.overdue && (
                <span
                  title={overdueTooltip}
                  className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider align-middle"
                  style={{ background: "var(--lucid-neg-bg)", color: "var(--lucid-neg)", border: "1px solid var(--lucid-neg-bd)" }}
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--lucid-neg)" }} aria-hidden="true" />
                  overdue
                </span>
              )}
              {ind.aging && (
                <span
                  title={agingTooltip}
                  className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider align-middle"
                  style={{ background: "var(--lucid-warn-bg)", color: "var(--lucid-warn)", border: "1px solid var(--lucid-warn-bd)" }}
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--lucid-warn)" }} aria-hidden="true" />
                  aging
                </span>
              )}
              <br />
              <span className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>{ind.frequency}</span>
            </td>

            {/* Last Release */}
            <td
              className="px-3 py-2.5 lt-num whitespace-nowrap"
              style={{ color: ind.aging ? "var(--lucid-warn)" : "var(--lucid-ink-2)" }}
              title={ind.aging ? agingTooltip : undefined}
            >
              {ind.lastRelease}
            </td>

            {/* Next Release — from a stored calendar event, or a clearly-
                labelled unknown when none is stored (the common case: the
                feed is current-week-only). Never a guessed date. */}
            <td className="px-3 py-2.5 lt-num whitespace-nowrap" style={nextReleaseStyle(ind.nextRelease, today)}>
              {formatNextRelease(ind.nextRelease, timeZone)}
            </td>

            {/* Actual */}
            <td
              className="px-3 py-2.5 font-medium lt-num"
              style={{ color: isInsufficient || ind.actual === null ? "var(--lucid-ink-2)" : actualColor(ind.surprise) }}
            >
              {isInsufficient || ind.actual === null ? "—" : ind.actual}
            </td>

            {/* Forecast */}
            <td className="px-3 py-2.5 lt-num" style={{ color: "var(--lucid-ink)" }}>
              {isInsufficient || ind.forecast === null ? "—" : ind.forecast}
            </td>

            {/* Previous */}
            <td className="px-3 py-2.5 lt-num" style={{ color: "var(--lucid-ink-3)" }}>
              {isInsufficient || ind.previous === null ? "—" : ind.previous}
            </td>

            {/* Surprise */}
            <td className="px-3 py-2.5">
              {isInsufficient || ind.surprise === null ? (
                <span className="inline-block px-2 py-0.5 rounded font-bold lt-num" style={{ color: "var(--lucid-ink-3)" }}>—</span>
              ) : (
                <span className="inline-block px-2 py-0.5 rounded font-bold lt-num" style={surpriseStyle(ind.surprise)}>
                  {ind.surprise}
                </span>
              )}
            </td>

            {/* Score */}
            <td className="px-3 py-2.5">
              {isInsufficient || ind.score === null ? (
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold"
                  style={{ background: "var(--lucid-warn-bg)", color: "var(--lucid-warn)", border: "1px solid var(--lucid-warn-bd)" }}
                  title={ind.reason ?? undefined}
                >
                  No data
                </span>
              ) : (
                <ScorePill score={ind.score} />
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
