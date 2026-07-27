"use client";

import { useState, useEffect, Suspense } from "react";
import { ChevronDown, ExternalLink, ChevronRight, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { patterns } from "@/lib/nifty-demo-data";
import {
  getScorecardHistory,
  getScorecardByDate,
  getIndicatorDetail,
} from "@/lib/api/nifty";
import { DetailDrawer } from "@/components/DetailDrawer";
import { AnimatedNumber } from "@/components/motion";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import {
  bandColor,
  bandBg,
  netDisplay,
  scoreDisplay,
  scorePillClass,
  formatDate,
} from "../nifty-utils";

// Scoring rules per indicator, keyed by backend indicator code.
const SCORING_RULES: Record<string, string> = {
  IND_NIFTY_01_PMI_MFG: "India PMI Manufacturing: Score +1 if PMI ≥ 52 (expansion); Score 0 if 48 ≤ PMI < 52 (contraction zone watch); Score −1 if PMI < 48 (contraction). Cadence: Monthly.",
  IND_NIFTY_02_PMI_SVC: "India PMI Services: Score +1 if PMI ≥ 52 (expansion); Score 0 if 48 ≤ PMI < 52 (contraction zone watch); Score −1 if PMI < 48 (contraction). Cadence: Monthly.",
  IND_NIFTY_03_CPI: "India CPI YoY: Two-component rule. Threshold (current value): Score +1 if CPI ≤ 5.0%; Score 0 if 5.0% < CPI ≤ 6.0%; Score −1 if CPI > 6.0%. Trajectory (3-month average): adjusts score by +/−1 if trend opposes threshold reading. Cadence: Monthly.",
  IND_NIFTY_04_RBI_RATE: "RBI Repo Rate Direction: Cycle-regime scoring. Score +1 if cutting / paused-after-hikes (easing bias); Score 0 if neutral hold; Score −1 if hawkish-hold / hiking (tightening bias). Cadence: Event-driven (RBI MPC meetings, every 2 months).",
  IND_NIFTY_05_IIP: "India Industrial Production YoY: Score +1 if IIP ≥ 4.0%; Score 0 if 0% ≤ IIP < 4.0%; Score −1 if IIP < 0%. Cadence: Monthly.",
  IND_NIFTY_06_FII_FLOW: "FII 10-day Rolling Cash Flow (₹ Cr): Tiered scoring on 10-day rolling sum. Score +2 if ≥ +₹15,000 Cr; +1 if +₹5,000 to +₹15,000 Cr; 0 if −₹5,000 to +₹5,000 Cr; −1 if −₹5,000 to −₹15,000 Cr; −2 if ≤ −₹15,000 Cr. Cadence: Daily.",
  IND_NIFTY_07_DII_ABSORPTION: "DII Absorption Ratio: Rolling ratio of DII buys to FII sells over 5 sessions, excluding zero-FII days. Score +1 if ratio ≥ 1.0 (DII fully absorbing FII outflows); Score 0 if 0.5 ≤ ratio < 1.0 (partial absorption); Score −1 if ratio < 0.5 (DII not absorbing). Cadence: Daily.",
  IND_NIFTY_08_VIX: "India VIX: Value-in-band with contrarian flag. Score +1 if VIX < 13 (complacency — bearish setup); Score 0 if 13 ≤ VIX ≤ 20 (normal); Score −1 if VIX > 20 (elevated fear — short-term bullish setup at extremes). Cadence: Daily.",
  IND_NIFTY_09_USD_WEAKNESS: "USD Weakness (NIFTY-facing): Derived from EdgeFinder's USD raw composite (range −14 to +14). 5-tier scoring: Score +2 if raw ≤ −7 (USD very weak); +1 if −7 < raw ≤ −3; 0 if −3 < raw ≤ +3; −1 if +3 < raw ≤ +7; −2 if raw > +7 (USD very strong). Cadence: Daily (derived).",
  IND_NIFTY_10_DXY: "DXY 10-day Direction: Score +1 if 10-day % change ≤ −1% (DXY weakening — bullish NIFTY); Score 0 if −1% < change < +1%; Score −1 if change ≥ +1% (DXY strengthening — bearish NIFTY). Cadence: Daily.",
  IND_NIFTY_11_BRENT: "Brent Crude 10-day Direction: Score +1 if 10-day % change ≤ −3% (oil falling — bullish NIFTY via reduced import burden); Score 0 if −3% < change < +3%; Score −1 if change ≥ +3% (oil rising). Cadence: Daily.",
  IND_NIFTY_12_USDINR: "USD/INR 10-day Direction: 5-tier scoring on 10-day % change. Score +2 if ≤ −1% (INR strengthening sharply); +1 if −1% to −0.3%; 0 if −0.3% to +0.3%; −1 if +0.3% to +1%; −2 if ≥ +1% (INR weakening sharply). Cadence: Daily.",
  IND_NIFTY_13_FII_LS_RATIO: "FII Long/Short Ratio (Index Futures): Multi-band lookup on FII long share of total positions. Score +2 if long share ≥ 65%; +1 if 55% to 65%; 0 if 45% to 55%; −1 if 35% to 45%; −2 if long share < 35%. Cadence: Daily.",
};

function getRelatedPatterns(indId: number) {
  return patterns.filter((p) =>
    p.relevance_triggers.some((t) => t.includes(`Ind${indId}`) || t.includes(`Ind${indId}:`)) ||
    (indId === 9 && p.drives_subtool === "Composition") ||
    (indId === 9 && (p.id === "P15-8" || p.id === "P22-3" || p.id === "P15-2")) ||
    (indId === 3 && p.id === "P15-9") ||
    (indId === 4 && p.id === "P15-7") ||
    (indId === 7 && p.id === "P7-1") ||
    (indId === 12 && p.id === "P14-5"),
  ).slice(0, 3);
}



export default function ScorecardPage() {
  // Suspense-wrap because the inner uses useSearchParams, which forces a
  // bailout from static prerendering unless boundaries are explicit.
  return (
    <Suspense fallback={<div className="p-4 sm:p-6"><LoadingState message="Loading scorecards..." /></div>}>
      <ScorecardPageInner />
    </Suspense>
  );
}

function ScorecardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedScId, setSelectedScId] = useState<string | null>(null);
  const [drawerIndId, setDrawerIndId] = useState<number | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [drawerLimit, setDrawerLimit] = useState(30);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // 1. Lite history for the date selector (no per-indicator breakdown)
  const { data: historyLite, isLoading: historyLoading, error: historyError, refetch } = useQuery({
    queryKey: ["nifty", "scorecard", "history-lite"],
    queryFn: () => getScorecardHistory({ includeBreakdown: false, limit: 100 }),
    staleTime: 60_000,
  });

  // Resolve selected date from lite history
  const selectedLite = historyLite?.find((s) => s.id === selectedScId) ?? historyLite?.[0];
  const selectedDate = selectedLite?.date;

  // 2. Full scorecard for the selected date (lazy per-date fetch)
  const { data: sc, isLoading: scLoading } = useQuery({
    queryKey: ["nifty", "scorecard", "by-date", selectedDate],
    queryFn: () => getScorecardByDate(selectedDate!),
    enabled: !!selectedDate,
    staleTime: 60_000,
  });

  // 3. Per-indicator detail — fetched lazily only when the drawer opens
  const drawerInd = drawerIndId !== null ? sc?.indicators.find((i) => i.id === drawerIndId) : null;
  const drawerCode = drawerInd?.code ?? null;

  const { data: indicatorDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["nifty", "indicator-detail", drawerCode, drawerLimit],
    queryFn: () => getIndicatorDetail(drawerCode!, { limit: drawerLimit }),
    enabled: !!drawerCode,
    staleTime: 30_000,
  });

  // URL param: preselect date on mount
  const dateParam = searchParams.get("date");
  useEffect(() => {
    if (!dateParam || !historyLite || historyLite.length === 0) return;
    const match = historyLite.find((s) => s.date === dateParam);
    if (match) {
      setSelectedScId(match.id);
    } else {
      console.warn(`[scorecard] ?date=${dateParam} not found in fetched history; using latest`);
    }
  }, [dateParam, historyLite]);

  // Reset row expansion when drawer indicator changes
  useEffect(() => {
    setExpandedRows(new Set());
  }, [drawerCode]);

  if (historyLoading || (!!selectedDate && scLoading && !sc)) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingState stages={["Loading scorecards…", "Scoring 13 indicators…", "Building composites…"]} />
      </div>
    );
  }

  if (historyError) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState error={historyError} onRetry={() => refetch()} />
      </div>
    );
  }

  if (!historyLite || historyLite.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState title="No scorecards available" />
      </div>
    );
  }

  if (!sc) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingState message="Loading scorecard..." />
      </div>
    );
  }

  const missingCount = sc.missing_indicators.length;

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="lt-rise lt-stagger-1 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="lt-serif text-2xl font-bold" style={{ color: "var(--lucid-ink)" }}>Scorecard</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>
            All 13 indicators, current readings, magnitudes.
          </p>
        </div>

        {/* Scorecard selector */}
        <div className="relative shrink-0">
          <button
            className="flex items-center gap-2 lt-card px-4 py-2 text-sm"
            onClick={() => setSelectorOpen((o) => !o)}
          >
            <span style={{ color: "var(--lucid-ink)" }}>{formatDate(sc.date)}</span>
            <ChevronDown size={14} style={{ color: "var(--lucid-ink-3)" }} />
          </button>
          {selectorOpen && (
            <div
              className="lt-modal-enter absolute right-0 top-11 z-50 rounded-xl overflow-hidden"
              style={{
                background: "var(--lucid-grad-surface-2)",
                border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)",
                boxShadow: "var(--lucid-elev-2)",
                width: 260,
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              {historyLite.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-white/5 transition-colors"
                  style={{ color: s.id === sc.id ? "var(--lucid-accent)" : "var(--lucid-ink-2)" }}
                  onClick={() => { setSelectedScId(s.id); setSelectorOpen(false); }}
                >
                  <span>{formatDate(s.date)}</span>
                  <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                    {netDisplay(s.net_score)}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="text-xs mt-1 text-right flex items-center justify-end gap-2" style={{ color: "var(--lucid-ink-3)" }}>
            {sc.phase && <span>{sc.phase}</span>}
            {sc.phase && sc.bucket && <span>·</span>}
            {sc.bucket && <span>{sc.bucket}</span>}
            {(sc.phase || sc.bucket) && <span>·</span>}
            <span>{formatDate(sc.date)}</span>
          </div>
          {missingCount > 0 && (
            <div className="text-xs mt-1 text-right" style={{ color: "var(--lucid-warn)" }}>
              {missingCount} indicator{missingCount !== 1 ? "s" : ""} unavailable
            </div>
          )}
        </div>
      </div>

      {/* ── Summary Strip ───────────────────────────────────────────── */}
      <div
        className="lt-card lt-edge lt-rise lt-stagger-2 px-4 sm:px-6 py-5 grid grid-cols-3 gap-2 sm:gap-4"
        style={{
          background: `radial-gradient(120% 140% at 0% 0%, ${bandBg(sc.band)}, transparent 60%), var(--lucid-grad-surface)`,
          borderColor: `color-mix(in srgb, ${bandColor(sc.band)} 30%, transparent)`,
          boxShadow: "var(--lucid-elev-1)",
        }}
      >
        {[
          { label: "Domestic", value: sc.domestic_composite, desc: "Structural floor", color: "var(--lucid-accent)" },
          { label: "External", value: sc.external_composite, desc: "Cycle reading", color: "var(--lucid-cool)" },
          { label: "Net", value: sc.net_score, desc: sc.band, isNet: true, color: bandColor(sc.band) },
        ].map(({ label, value, desc, isNet, color }, i) => (
          <div
            key={label}
            className="flex flex-col gap-0.5"
            style={i > 0 ? { borderLeft: "1px solid var(--lucid-line)", paddingLeft: "1rem" } : undefined}
          >
            <div className="lt-eyebrow" style={{ color: "var(--lucid-ink-3)" }}>{label}</div>
            <div
              className="lt-num text-3xl sm:text-4xl font-bold leading-none"
              style={{ color: isNet ? bandColor(sc.band) : color }}
            >
              <AnimatedNumber value={value} format={(n) => netDisplay(Math.round(n))} />
            </div>
            <div className="text-xs mt-0.5 truncate" style={{ color: "var(--lucid-ink-2)" }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* ── Indicator Grid — grouped by composite ───────────────────── */}
      {(() => {
        const domestic = sc.indicators.filter((i) => i.composite === "Domestic" && i.id !== 13);
        const external = sc.indicators.filter((i) => i.composite === "External" && i.id !== 13);
        const standalone = sc.indicators.filter((i) => i.id === 13);
        const groups: { key: string; label: string; sub: string; accent: string; items: typeof sc.indicators }[] = [
          { key: "dom", label: "Domestic", sub: "The structural floor", accent: "var(--lucid-accent)", items: domestic },
          { key: "ext", label: "External", sub: "The trade-relevant cycle", accent: "var(--lucid-cool)", items: external },
          { key: "std", label: "Futures Positioning", sub: "Standalone — scored outside the composites", accent: "var(--lucid-ink-2)", items: standalone },
        ];
        return (
          <div className="space-y-5">
            {groups.filter((g) => g.items.length > 0).map((group) => {
              const groupSum = group.items.reduce((a, ind) => a + (ind.score ?? 0), 0);
              return (
                <div key={group.key} className="lt-rise lt-stagger-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="lt-eyebrow" style={{ color: group.accent }}>{group.label}</span>
                    <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>{group.sub}</span>
                    <span className="flex-1 h-px" style={{ background: "var(--lucid-line)" }} />
                    <span className="lt-num text-sm font-semibold" style={{ color: group.accent }}>
                      {netDisplay(groupSum)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {group.items.map((ind, cardIdx) => {
                      const safeScore = ind.score ?? 0;
                      const isCarried = ind.outcome === "carry_forward";
                      const isInsufficient = ind.outcome === "insufficient_data";
                      const borderColor = isInsufficient
                        ? "var(--lucid-warn)"
                        : isCarried
                        ? "var(--lucid-line-3)"
                        : safeScore >= 1
                        ? "var(--lucid-pos)"
                        : safeScore <= -1
                        ? "var(--lucid-neg)"
                        : "var(--lucid-scale-2)";
                      return (
                      <button
                        key={ind.id}
                        className="lt-card lt-lift lt-rise p-4 text-left group"
                        style={{
                          borderLeft: `3px solid ${borderColor}`,
                          background: "var(--lucid-grad-surface)",
                          boxShadow: "var(--lucid-elev-1)",
                          animationDelay: `${Math.min(cardIdx * 0.04, 0.35)}s`,
                        }}
                        onClick={() => setDrawerIndId(ind.id)}
                      >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <div className="lt-num text-xs" style={{ color: "var(--lucid-ink-3)" }}>Ind {ind.id}</div>
                            <div className="lt-serif text-sm font-semibold leading-tight" style={{ color: "var(--lucid-ink)" }}>{ind.name}</div>
                            <div
                              className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded mt-1"
                              style={{
                                background: `color-mix(in srgb, ${group.accent} 14%, transparent)`,
                                color: group.accent,
                                border: `1px solid color-mix(in srgb, ${group.accent} 28%, transparent)`,
                              }}
                            >
                              {ind.composite}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={scorePillClass(isInsufficient ? null : ind.score)} style={{ fontSize: 18, minWidth: 40, padding: "4px 10px", opacity: isCarried ? 0.6 : 1 }}>
                              {isInsufficient ? "—" : scoreDisplay(ind.score)}
                            </span>
                            {isCarried && (
                              <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                style={{ background: "color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", color: "var(--lucid-ink-2)", border: "1px solid color-mix(in srgb, var(--lucid-ctx) 24%, transparent)" }}>
                                ↩ Carried
                              </span>
                            )}
                            {isInsufficient && (
                              <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                style={{ background: "color-mix(in srgb, var(--lucid-warn) 15%, transparent)", color: "var(--lucid-warn)", border: "1px solid color-mix(in srgb, var(--lucid-warn) 30%, transparent)" }}>
                                No data
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Value */}
                        {isCarried ? (
                          <div className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>Using reading from {formatDate(ind.last_change_date)}</div>
                        ) : isInsufficient ? (
                          <div className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>{ind.reason ?? "Insufficient data for scoring"}</div>
                        ) : (
                          <>
                            <div className="lt-num text-lg font-semibold" style={{ color: "var(--lucid-ink)" }}>{ind.value || "—"}</div>
                            <div className="text-xs mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>{ind.magnitude}</div>
                          </>
                        )}

                        {/* Score basis — rolling avg / % change driving the score (Ind 6,7,10,11,12). */}
                        {ind.outcome === "scored" && ind.score_basis && (
                          <div
                            className="text-xs mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded"
                            style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}
                          >
                            <span style={{ color: "var(--lucid-ink-3)" }}>{ind.score_basis.label}:</span>
                            <span className="lt-num font-semibold" style={{ color: "var(--lucid-accent)" }}>{ind.score_basis.value}</span>
                          </div>
                        )}

                        {/* Trajectory — Ind 3 only */}
                        {ind.id === 3 && ind.trajectory_3m_avg && (
                          <div className="text-xs mt-1.5" style={{ color: "var(--lucid-ink-2)" }}>
                            Trajectory: {ind.trajectory_3m_avg}
                          </div>
                        )}

                        {/* Ind 9 special */}
                        {ind.id === 9 && (
                          <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--lucid-line)" }}>
                            <div className="text-xs lt-num" style={{ color: "var(--lucid-ink-3)" }}>
                              Raw composite: {sc.ind9_raw_composite !== null ? netDisplay(sc.ind9_raw_composite) : "—"} / −14 to +14
                            </div>
                            {sc.composition_flag && (
                              <div className="text-xs mt-0.5" style={{ color: "var(--lucid-warn)" }}>
                                [{sc.composition_flag.replace("_", " ")}] composition flag
                              </div>
                            )}
                          </div>
                        )}

                        {/* Ind 13 special */}
                        {ind.id === 13 && (
                          <div className="text-xs mt-1.5 italic" style={{ color: "var(--lucid-ink-3)" }}>
                            Live tracking — no historical backfill
                          </div>
                        )}

                        {/* Last changed */}
                        <div className="mt-2 pt-2 border-t text-xs flex items-center gap-1.5 flex-wrap" style={{ borderColor: "var(--lucid-line)", color: "var(--lucid-ink-3)" }}>
                          {isCarried ? "Last actual:" : "Last changed:"} {formatDate(ind.last_change_date)}
                          {!isCarried && !isInsufficient && ind.prev_score !== undefined && ind.prev_score !== ind.score && (
                            <span className="lt-num" style={{ color: safeScore > (ind.prev_score ?? 0) ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                              was {scoreDisplay(ind.prev_score ?? 0)} → {scoreDisplay(ind.score)}
                            </span>
                          )}
                        </div>

                        <div className="text-xs opacity-0 group-hover:opacity-100 transition-opacity mt-1" style={{ color: "var(--lucid-accent)" }}>
                          Click for details →
                        </div>
                      </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Composite Bar — centred ± bars from a zero baseline ──────── */}
      <div
        className="lt-card lt-edge lt-rise lt-stagger-5 p-4 sm:p-5"
        style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
      >
        <div className="lt-eyebrow mb-4">
          Indicator Composite
          <span className="lt-eyebrow-ln" />
          <span className="lt-num font-semibold" style={{ color: bandColor(sc.band) }}>{netDisplay(sc.net_score)}</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2.5">
          {sc.indicators.map((ind) => {
            const safeScore = ind.score ?? 0;
            const isCarried = ind.outcome === "carry_forward";
            const isInsufficient = ind.outcome === "insufficient_data";
            const magnitude = Math.min(Math.abs(safeScore) / 2, 1) * 50; // half-width % from centre
            const barColor = isCarried
              ? "var(--lucid-line-3)"
              : safeScore >= 1
              ? "var(--lucid-pos)"
              : safeScore <= -1
              ? "var(--lucid-neg)"
              : "var(--lucid-scale-2)";
            return (
            <button
              key={ind.id}
              className="flex items-center gap-3 group"
              onClick={() => setDrawerIndId(ind.id)}
            >
              <div className="lt-num text-xs w-12 shrink-0 text-right" style={{ color: "var(--lucid-ink-3)" }}>
                Ind {ind.id}
              </div>
              {/* Centre-anchored bar: fills left for negative, right for positive. */}
              <div className="relative flex-1 h-2 rounded-full" style={{ background: "var(--lucid-surface-3)" }}>
                <div className="absolute top-0 bottom-0 left-1/2 w-px" style={{ background: "var(--lucid-line-2)" }} />
                {!isInsufficient && safeScore !== 0 && (
                  <div
                    className="lt-bar absolute top-0 bottom-0 rounded-full transition-all"
                    style={{
                      background: barColor,
                      opacity: isCarried ? 0.5 : 1,
                      ...(safeScore > 0
                        ? { left: "50%", width: `${magnitude}%` }
                        : { right: "50%", width: `${magnitude}%` }),
                    }}
                  />
                )}
              </div>
              <span className={scorePillClass(isInsufficient ? null : ind.score)} style={{ fontSize: 11, opacity: isCarried ? 0.6 : 1 }}>
                {isInsufficient ? "—" : scoreDisplay(ind.score)}
              </span>
              <span className="text-xs truncate" style={{ color: "var(--lucid-ink-3)", width: 80 }}>{ind.short}</span>
              {isCarried && <span className="text-[9px]" style={{ color: "var(--lucid-ink-3)" }}>↩</span>}
              {isInsufficient && <span className="text-[9px]" style={{ color: "var(--lucid-warn)" }}>!</span>}
            </button>
            );
          })}
        </div>
      </div>

      {/* ── Indicator Detail Drawer ──────────────────────────────────── */}
      <DetailDrawer
        open={drawerInd !== null && drawerInd !== undefined}
        onClose={() => setDrawerIndId(null)}
        title={drawerInd ? `Ind ${drawerInd.id} · ${drawerInd.name}` : ""}
        expandHref={drawerInd?.id === 9 ? "/nifty/usd-lab" : undefined}
      >
        {drawerInd && (
          <div className="p-4 sm:p-6 space-y-6">
            {/* Carry-forward note */}
            {drawerInd.outcome === "carry_forward" && (
              <div
                className="rounded-lg p-3 text-xs"
                style={{
                  background: "color-mix(in srgb, var(--lucid-ctx) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)",
                  color: "var(--lucid-ink-2)",
                }}
              >
                <span className="font-semibold">↩ Carried forward</span> — no new reading on this scorecard date.
                Score and value are carried from the last actual reading ({formatDate(drawerInd.last_change_date)}).
              </div>
            )}

            {/* Insufficient data note */}
            {drawerInd.outcome === "insufficient_data" && (
              <div
                className="rounded-lg p-3 text-xs"
                style={{
                  background: "color-mix(in srgb, var(--lucid-warn) 15%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--lucid-warn) 15%, transparent)",
                  color: "var(--lucid-warn)",
                }}
              >
                <span className="font-semibold">Insufficient data</span> — this indicator scores zero and does not contribute to the composite.
                {drawerInd.reason && <span className="block mt-1" style={{ color: "var(--lucid-warn)" }}>Reason: {drawerInd.reason}</span>}
              </div>
            )}

            {/* A — Current Reading */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--lucid-ink-3)" }}>
                Current Reading
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>Score:</span>
                  <span
                    className={scorePillClass(drawerInd.outcome === "insufficient_data" ? null : drawerInd.score)}
                    style={{ fontSize: 14, opacity: drawerInd.outcome === "carry_forward" ? 0.6 : 1 }}
                  >
                    {drawerInd.outcome === "insufficient_data" ? "—" : scoreDisplay(drawerInd.score)}
                  </span>
                  <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>range −2 to +2</span>
                </div>
                {drawerInd.outcome === "scored" && (
                  <>
                    <div className="flex gap-2 text-sm">
                      <span style={{ color: "var(--lucid-ink-3)" }}>Value:</span>
                      <span className="font-mono font-semibold" style={{ color: "var(--lucid-ink)" }}>{drawerInd.value || "—"}</span>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <span style={{ color: "var(--lucid-ink-3)" }}>Context:</span>
                      <span style={{ color: "var(--lucid-ink-2)" }}>{drawerInd.magnitude}</span>
                    </div>
                    {drawerInd.score_basis && (
                      <div className="flex gap-2 text-sm">
                        <span style={{ color: "var(--lucid-ink-3)" }}>{drawerInd.score_basis.label} (scored):</span>
                        <span className="font-mono font-semibold" style={{ color: "var(--lucid-accent)" }}>{drawerInd.score_basis.value}</span>
                      </div>
                    )}
                    {drawerInd.trajectory_3m_avg && (
                      <div className="flex gap-2 text-sm">
                        <span style={{ color: "var(--lucid-ink-3)" }}>Trajectory:</span>
                        <span style={{ color: "var(--lucid-ink-2)" }}>{drawerInd.trajectory_3m_avg}</span>
                      </div>
                    )}
                  </>
                )}
                {drawerInd.outcome === "carry_forward" && (
                  <div className="flex gap-2 text-sm">
                    <span style={{ color: "var(--lucid-ink-3)" }}>Last actual:</span>
                    <span style={{ color: "var(--lucid-ink-2)" }}>{formatDate(drawerInd.last_change_date)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* B — Scoring Rule */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--lucid-ink-3)" }}>
                Scoring Rule
              </div>
              <div
                className="rounded-lg p-4 text-xs leading-relaxed whitespace-pre-wrap"
                style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-2)" }}
              >
                {SCORING_RULES[drawerInd.code] ?? "Scoring rule not documented for this indicator."}
              </div>
            </div>

            {/* D — Data History */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--lucid-ink-3)" }}>
                  Data History
                </div>
                <div className="flex gap-1">
                  {([30, 90, 365] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setDrawerLimit(n)}
                      className="text-[10px] px-2 py-0.5 rounded-md transition-colors"
                      style={{
                        background: drawerLimit === n ? "color-mix(in srgb, var(--lucid-accent) 14%, transparent)" : "rgba(255,255,255,0.04)",
                        color: drawerLimit === n ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                        border: `1px solid ${drawerLimit === n ? "color-mix(in srgb, var(--lucid-accent) 14%, transparent)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      {n}d
                    </button>
                  ))}
                </div>
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center gap-2 py-8" style={{ color: "var(--lucid-ink-3)" }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-xs">Loading data...</span>
                </div>
              ) : !indicatorDetail || indicatorDetail.entries.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: "var(--lucid-ink-3)" }}>No data points found</p>
              ) : (
                <div className="rounded-lg overflow-x-auto" style={{ border: "1px solid var(--lucid-line)" }}>
                  <table className="w-full text-xs" style={{ minWidth: 560 }}>
                    <thead>
                      <tr style={{ background: "var(--lucid-surface-3)", borderBottom: "1px solid var(--lucid-line-2)" }}>
                        {["Date", "Value", "Fcst", "Prev", "Score", "Outcome", "Flags", "Quality"].map((h) => (
                          <th key={h} className="lt-eyebrow text-left px-2 py-2.5" style={{ fontSize: 9.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {indicatorDetail.entries.map((entry, i) => {
                        const rowId = entry.dataPoint.id;
                        const isExpanded = expandedRows.has(rowId);
                        const outcome = entry.score?.outcome ?? null;
                        const scoreVal = entry.score?.value ?? null;
                        const hasDetail = !!(entry.score?.computationDetail && Object.keys(entry.score.computationDetail).length > 0);
                        const hasNote = !!(entry.dataPoint.notes || entry.dataPoint.enteredBy);
                        const isExpandable = hasDetail || hasNote;
                        const toggleRow = () => {
                          if (!isExpandable) return;
                          setExpandedRows((prev) => {
                            const next = new Set(prev);
                            if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
                            return next;
                          });
                        };
                        return (
                          <>
                            <tr
                              key={rowId}
                              className="border-t"
                              onClick={toggleRow}
                              style={{
                                borderColor: "var(--lucid-line)",
                                background: isExpanded ? "color-mix(in srgb, var(--lucid-accent) 14%, transparent)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                                cursor: isExpandable ? "pointer" : "default",
                              }}
                            >
                              <td className="px-2 py-2 whitespace-nowrap" style={{ color: "var(--lucid-ink-2)" }}>
                                <span className="flex items-center gap-1">
                                  {isExpandable && (
                                    <ChevronRight size={10} className={`shrink-0 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} style={{ color: "var(--lucid-ink-3)" }} />
                                  )}
                                  {entry.observationDate}
                                </span>
                              </td>
                              <td className="px-2 py-2 font-mono" style={{ color: "var(--lucid-ink)" }}>
                                {entry.dataPoint.value != null ? entry.dataPoint.value.toLocaleString() : "—"}
                                {entry.dataPoint.source === "manual" && (
                                  <span className="ml-1 text-[8px] px-1 rounded" style={{ background: "color-mix(in srgb, var(--lucid-accent) 14%, transparent)", color: "var(--lucid-accent)" }}>
                                    Manual
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-2 font-mono" style={{ color: "var(--lucid-ink-3)" }}>
                                {entry.dataPoint.forecastValue != null ? entry.dataPoint.forecastValue.toLocaleString() : "–"}
                              </td>
                              <td className="px-2 py-2 font-mono" style={{ color: "var(--lucid-ink-3)" }}>
                                {entry.dataPoint.previousValue != null ? entry.dataPoint.previousValue.toLocaleString() : "–"}
                              </td>
                              <td className="px-2 py-2">
                                <span className={scorePillClass(scoreVal)} style={{ fontSize: 10 }}>
                                  {scoreVal != null ? scoreDisplay(scoreVal) : "–"}
                                </span>
                              </td>
                              <td className="px-2 py-2">
                                {outcome === "carry_forward" && (
                                  <span className="text-[8px] font-semibold uppercase px-1 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", color: "var(--lucid-ink-2)" }}>↩ Carry</span>
                                )}
                                {outcome === "insufficient_data" && (
                                  <span className="text-[8px] font-semibold uppercase px-1 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--lucid-warn) 15%, transparent)", color: "var(--lucid-warn)" }}>No data</span>
                                )}
                                {outcome === "scored" && (
                                  <span className="text-[8px]" style={{ color: "var(--lucid-ink-3)" }}>Scored</span>
                                )}
                                {outcome === null && <span style={{ color: "var(--lucid-line-3)" }}>–</span>}
                              </td>
                              <td className="px-2 py-2" style={{ color: "var(--lucid-ink-3)", maxWidth: 100 }}>
                                {entry.score?.flags.length
                                  ? entry.score.flags.map((f) => (
                                      <span key={f} className="inline-block text-[8px] mr-0.5 px-1 rounded" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--lucid-ink-3)" }}>{f}</span>
                                    ))
                                  : "–"}
                              </td>
                              <td className="px-2 py-2" style={{ color: entry.dataPoint.dataQualityFlag ? "var(--lucid-warn)" : "var(--lucid-line-3)" }}>
                                {entry.dataPoint.dataQualityFlag ?? "–"}
                              </td>
                            </tr>
                            {isExpanded && isExpandable && (
                              <tr
                                key={`${rowId}-detail`}
                                className="border-t"
                                style={{ borderColor: "var(--lucid-line)", background: "var(--lucid-surface-2)" }}
                              >
                                <td colSpan={8} className="px-3 py-3 space-y-2">
                                  {hasDetail && (
                                    <div>
                                      <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--lucid-ink-3)" }}>Scoring detail</p>
                                      <pre className="text-[10px] font-mono whitespace-pre-wrap" style={{ color: "var(--lucid-ink-2)" }}>
                                        {JSON.stringify(entry.score!.computationDetail, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {entry.dataPoint.notes && (
                                    <p className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>
                                      <span style={{ color: "var(--lucid-ink-3)" }}>Note: </span>{entry.dataPoint.notes}
                                    </p>
                                  )}
                                  {entry.dataPoint.enteredBy && (
                                    <p className="text-[10px]" style={{ color: "var(--lucid-ink-3)" }}>
                                      Entered by: {entry.dataPoint.enteredBy}
                                    </p>
                                  )}
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* D — Related Patterns */}
            {getRelatedPatterns(drawerInd.id).length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--lucid-ink-3)" }}>
                  Related Patterns
                </div>
                <div className="space-y-2">
                  {getRelatedPatterns(drawerInd.id).map((p) => (
                    <button
                      key={p.id}
                      className="w-full flex items-center justify-between p-3 rounded-lg text-left hover:bg-white/5 transition-colors"
                      style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}
                      onClick={() => router.push(`/nifty/patterns`)}
                    >
                      <div>
                        <span className="text-xs font-mono font-semibold" style={{ color: "var(--lucid-accent)" }}>{p.id}</span>
                        <span className="text-xs ml-2" style={{ color: "var(--lucid-ink-2)" }}>{p.name}</span>
                      </div>
                      <ExternalLink size={12} style={{ color: "var(--lucid-ink-3)" }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ind 9 link to USD Lab */}
            {drawerInd.id === 9 && (
              <button
                className="w-full py-2 text-sm rounded-lg font-medium"
                style={{ background: "color-mix(in srgb, var(--lucid-accent) 14%, transparent)", color: "var(--lucid-accent)", border: "1px solid color-mix(in srgb, var(--lucid-accent) 14%, transparent)" }}
                onClick={() => { setDrawerIndId(null); router.push("/nifty/usd-lab"); }}
              >
                Open USD Lab →
              </button>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
