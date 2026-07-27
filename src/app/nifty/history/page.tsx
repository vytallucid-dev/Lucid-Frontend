"use client";

import { useState, useMemo } from "react";
import { BookText, ChevronDown } from "lucide-react";
import { useScorecardHistory } from "@/hooks/useScorecardHistory";
import { usePatterns } from "@/hooks/usePatterns";
import type { PublicScorecard, PublicBand } from "@/lib/api/nifty";
import { DetailDrawer } from "@/components/DetailDrawer";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import { bandColor, bandBg, netDisplay, scorePillClass, scoreDisplay, flagPillStyle, formatDate, formatDateShort } from "../nifty-utils";
import { HistoryChart } from "./HistoryChart";
import { derivePatternMarkers, summarizeOverlays, PATTERN_OVERLAYS } from "./patternOverlays";

type ViewMode = "phase" | "date";

const NO_PHASE_KEY = "No phase";

// Group scorecards by phase. Scorecards with no phase get bucketed under NO_PHASE_KEY
// and that group is forced to the bottom.
function groupByPhase(list: PublicScorecard[]) {
  const map = new Map<string, PublicScorecard[]>();
  for (const sc of list) {
    const key = sc.phase ?? NO_PHASE_KEY;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(sc);
  }
  const phases = [...map.entries()].sort((a, b) => {
    if (a[0] === NO_PHASE_KEY) return 1;
    if (b[0] === NO_PHASE_KEY) return -1;
    const latestA = Math.max(...a[1].map((s) => new Date(s.date).getTime()));
    const latestB = Math.max(...b[1].map((s) => new Date(s.date).getTime()));
    return latestB - latestA;
  });
  return phases;
}

function phaseSubTools(phaseScs: PublicScorecard[]): string[] {
  const tools = new Set<string>();
  for (const sc of phaseScs) {
    if (sc.peak_score_active) tools.add("Peak Ceiling");
    if (sc.conflict_flag) tools.add("CONFLICT");
    if (sc.composition_flag) tools.add("Composition");
  }
  return [...tools];
}

const ALL_BANDS: PublicBand[] = ["Strong Bullish", "Bullish", "Neutral", "Caution", "Bearish", "Strong Bearish"];

export default function HistoryPage() {
  const { data: history, isLoading, error, refetch } = useScorecardHistory();

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingState stages={["Loading scorecards…", "Tracing phases…", "Drawing the timeline…"]} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }
  if (!history || history.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState title="No scorecards available" />
      </div>
    );
  }

  return <HistoryPageInner scorecards={history} />;
}

function HistoryPageInner({ scorecards }: { scorecards: PublicScorecard[] }) {
  const { data: patterns } = usePatterns();
  const [view, setView] = useState<ViewMode>("phase");
  const [drawerSc, setDrawerSc] = useState<PublicScorecard | null>(null);

  // Chart wants ascending (oldest → newest); the API returns newest-first.
  const ascending = useMemo(
    () => [...scorecards].sort((a, b) => a.date.localeCompare(b.date)),
    [scorecards],
  );
  const markers = useMemo(
    () => derivePatternMarkers(ascending, patterns),
    [ascending, patterns],
  );
  const overlaySummary = useMemo(() => summarizeOverlays(markers), [markers]);

  const openDrawerForDate = (date: string) => {
    const sc = scorecards.find((s) => s.date === date) ?? null;
    setDrawerSc(sc);
  };
  const [filterBands, setFilterBands] = useState<PublicBand[]>([]);
  const [filterPhases, setFilterPhases] = useState<string[]>([]);
  const [filterSubTools, setFilterSubTools] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<"date" | "net" | "domestic" | "external" | "ind9">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    return scorecards.filter((sc) => {
      if (filterBands.length && !filterBands.includes(sc.band)) return false;
      // Phase filter: undefined phase cannot match any selected phase
      if (filterPhases.length && (!sc.phase || !filterPhases.includes(sc.phase))) return false;
      if (filterSubTools.length) {
        const scTools: string[] = [];
        if (sc.peak_score_active) scTools.push("Peak Ceiling");
        if (sc.conflict_flag) scTools.push("CONFLICT");
        if (sc.composition_flag) scTools.push("Composition");
        if (!filterSubTools.every((t) => scTools.includes(t))) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !sc.phase?.toLowerCase().includes(q) &&
          !sc.notes?.toLowerCase().includes(q) &&
          !sc.catalysts.some((c) => c.toLowerCase().includes(q)) &&
          !sc.band.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [scorecards, filterBands, filterPhases, filterSubTools, search]);

  const sorted = useMemo(() => {
    // Null-safe getters: nulls sort to the end regardless of direction.
    const getVal = (sc: PublicScorecard): number | null => {
      if (sortCol === "date") return new Date(sc.date).getTime();
      if (sortCol === "net") return sc.net_score;
      if (sortCol === "domestic") return sc.domestic_composite;
      if (sortCol === "external") return sc.external_composite;
      if (sortCol === "ind9") return sc.ind9_raw_composite;
      return 0;
    };
    return [...filtered].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [filtered, sortCol, sortDir]);

  const phases = useMemo(() => groupByPhase(filtered), [filtered]);

  const clearFilters = () => {
    setFilterBands([]);
    setFilterPhases([]);
    setFilterSubTools([]);
    setSearch("");
  };

  const hasFilters = filterBands.length > 0 || filterPhases.length > 0 || filterSubTools.length > 0 || search;

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  // Unique phase strings, dropping undefined so we don't get a chip labeled "undefined".
  const allPhases = [...new Set(scorecards.map((s) => s.phase).filter((p): p is string => !!p))];
  const uniquePhases = allPhases.slice(0, 12);
  const phaseRange = scorecards.length > 0
    ? `${formatDateShort([...scorecards].sort((a, b) => a.date.localeCompare(b.date))[0].date)} → ${formatDateShort(scorecards[0].date)}`
    : "";

  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="lt-rise lt-stagger-1 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="lt-serif text-2xl font-bold" style={{ color: "var(--lucid-ink)" }}>History</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>Every scorecard, every phase.</p>
        </div>
        <div className="text-sm text-right shrink-0" style={{ color: "var(--lucid-ink-3)" }}>
          <p>{scorecards.length} scorecards · {uniquePhases.length} phases</p>
          <p>{phaseRange}</p>
        </div>
      </div>

      {/* ── Net-score timeline (centerpiece) ────────────────────────── */}
      <div
        className="lt-card lt-edge lt-rise lt-stagger-2 p-4 sm:p-5"
        style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="lt-eyebrow">
            Net score over time
            <span className="lt-eyebrow-ln" />
          </div>
          {/* Pattern overlay legend */}
          <div className="flex items-center gap-3 flex-wrap">
            {PATTERN_OVERLAYS.map((def) => {
              const active =
                overlaySummary.derived.includes(def.id) ||
                overlaySummary.instanceOnly.includes(def.id);
              return (
                <span
                  key={def.id}
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: active ? "var(--lucid-ink-2)" : "var(--lucid-ink-3)", opacity: active ? 1 : 0.5 }}
                  title={def.note}
                >
                  <span
                    className="w-2.5 h-2.5"
                    style={{
                      background: def.color,
                      borderRadius: def.mode === "example_dates" ? 0 : "9999px",
                    }}
                  />
                  {def.short}
                  <span style={{ color: "var(--lucid-ink-3)" }}>
                    {def.mode === "derived" ? "· derived" : "· instances"}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
        {ascending.length < 2 ? (
          <div className="py-10">
            <EmptyState title="Timeline accumulating" description="Need at least two scorecards to draw the net-score history." />
          </div>
        ) : (
          <div style={{ height: 320 }}>
            <HistoryChart scorecards={ascending} markers={markers} onSelectDate={openDrawerForDate} />
          </div>
        )}
        <p className="text-xs mt-3" style={{ color: "var(--lucid-ink-3)" }}>
          Pattern overlays are derived client-side from stored per-date fields.{" "}
          {overlaySummary.derived.length > 0 && (
            <>Derived: {overlaySummary.derived.join(", ")}. </>
          )}
          {overlaySummary.instanceOnly.length > 0 && (
            <>Marked by known instance dates only: {overlaySummary.instanceOnly.join(", ")}. </>
          )}
          V-bottoms are trough events and aren&apos;t derivable from a single row, so only their confirmed instances are marked.
        </p>
      </div>

      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="lt-rise lt-stagger-3 flex items-center gap-3 sm:gap-4 flex-wrap">
        {/* View toggle */}
        <div
          className="flex rounded-lg p-0.5 gap-0.5"
          style={{ background: "var(--lucid-surface-2)", border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)" }}
        >
          {(["phase", "date"] as ViewMode[]).map((v) => (
            <button
              key={v}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize"
              style={{
                background: view === v ? "color-mix(in srgb, var(--lucid-accent) 14%, transparent)" : "transparent",
                color: view === v ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
              }}
              onClick={() => setView(v)}
            >
              By {v === "phase" ? "Phase" : "Date"}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search phases, notes, catalysts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm w-full sm:w-60"
          style={{
            background: "var(--lucid-surface-2)",
            border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)",
            color: "var(--lucid-ink)",
            outline: "none",
          }}
        />

        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Band filter */}
          <div className="relative group">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "var(--lucid-surface-2)", border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", color: filterBands.length ? "var(--lucid-accent)" : "var(--lucid-ink-3)" }}
            >
              Band {filterBands.length ? `(${filterBands.length})` : ""} <ChevronDown size={12} />
            </button>
            <div
              className="absolute left-0 top-9 z-50 hidden group-focus-within:block rounded-xl p-2 space-y-1"
              style={{ background: "var(--lucid-surface-2)", border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", width: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
            >
              {ALL_BANDS.map((b) => (
                <label key={b} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterBands.includes(b)}
                    onChange={(e) => setFilterBands((prev) => e.target.checked ? [...prev, b] : prev.filter((x) => x !== b))}
                    className="w-3 h-3"
                  />
                  <span className="text-xs" style={{ color: bandColor(b) }}>{b}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sub-tools filter */}
          <div className="relative group">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "var(--lucid-surface-2)", border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", color: filterSubTools.length ? "var(--lucid-accent)" : "var(--lucid-ink-3)" }}
            >
              Sub-tools {filterSubTools.length ? `(${filterSubTools.length})` : ""} <ChevronDown size={12} />
            </button>
            <div
              className="absolute left-0 top-9 z-50 hidden group-focus-within:block rounded-xl p-2 space-y-1"
              style={{ background: "var(--lucid-surface-2)", border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)", width: 160, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
            >
              {["Peak Ceiling", "CONFLICT", "Composition"].map((t) => (
                <label key={t} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterSubTools.includes(t)}
                    onChange={(e) => setFilterSubTools((prev) => e.target.checked ? [...prev, t] : prev.filter((x) => x !== t))}
                    className="w-3 h-3"
                  />
                  <span className="text-xs" style={{ color: "var(--lucid-ink-2)" }}>{t}</span>
                </label>
              ))}
            </div>
          </div>

          {hasFilters && (
            <button className="text-xs" style={{ color: "var(--lucid-ink-3)" }} onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── View 1: By Phase ────────────────────────────────────────── */}
      {view === "phase" && (
        <div className="lt-rise lt-stagger-4 space-y-4">
          {phases.length === 0 ? (
            <FilterEmpty onClear={clearFilters} />
          ) : (
            // TODO: virtualize when history > 200 rows
            phases.map(([phase, phaseScs]) => {
              const sorted2 = [...phaseScs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              const earliest = sorted2[sorted2.length - 1];
              const latest = sorted2[0];
              const peakSc = phaseScs.reduce((best, s) => s.net_score > best.net_score ? s : best);
              const floorSc = phaseScs.reduce((best, s) => s.net_score < best.net_score ? s : best);
              const subTools = phaseSubTools(phaseScs);

              return (
                <div
                  key={phase}
                  className="lt-card lt-edge p-5"
                  style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
                >
                  {/* Phase header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-bold" style={{ color: "var(--lucid-ink)" }}>{phase}</h3>
                        {latest.bucket && (
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              background: "var(--lucid-surface-2)",
                              color: "var(--lucid-ink-2)",
                              border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)",
                            }}
                          >
                            {latest.bucket}
                          </span>
                        )}
                      </div>
                      <div className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                        {formatDateShort(earliest.date)} → {formatDateShort(latest.date)} · {phaseScs.length} scorecards
                      </div>
                    </div>
                    <div className="text-right text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                      <div>Peak: {netDisplay(peakSc.net_score)} on {formatDateShort(peakSc.date)}</div>
                      <div>Floor: {netDisplay(floorSc.net_score)} on {formatDateShort(floorSc.date)}</div>
                      {subTools.length > 0 && (
                        <div className="mt-1 flex gap-1 justify-end">
                          {subTools.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{
                                background: t === "Peak Ceiling" ? "color-mix(in srgb, var(--lucid-warn) 15%, transparent)" : t === "CONFLICT" ? "color-mix(in srgb, var(--lucid-accent) 14%, transparent)" : "color-mix(in srgb, var(--lucid-accent) 14%, transparent)",
                                color: t === "Peak Ceiling" ? "var(--lucid-warn)" : t === "CONFLICT" ? "var(--lucid-accent)" : "var(--lucid-accent)",
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Scorecard rows */}
                  <div className="space-y-1.5">
                    {sorted2.map((sc) => (
                      <button
                        key={sc.id}
                        className="w-full text-left px-3 py-2 rounded-lg flex flex-wrap items-center gap-2 sm:gap-4 hover:bg-white/5 transition-colors group"
                        style={{ background: "var(--lucid-surface-2)" }}
                        onClick={() => setDrawerSc(sc)}
                      >
                        <span className="text-xs w-24 shrink-0" style={{ color: "var(--lucid-ink-3)" }}>
                          {formatDate(sc.date)}
                        </span>
                        <span className="font-mono font-bold tabular-nums text-sm" style={{ color: bandColor(sc.band) }}>
                          {netDisplay(sc.net_score)}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: bandBg(sc.band), color: bandColor(sc.band) }}
                        >
                          {sc.band}
                        </span>
                        {sc.peak_score_active && (
                          <span className="text-xs" style={{ color: "var(--lucid-warn)" }}>⚠ Peak</span>
                        )}
                        {sc.conflict_flag && (
                          <span className="text-xs" style={{ color: "var(--lucid-accent)" }}>⚡ CONFLICT</span>
                        )}
                        {sc.missing_indicators.length > 0 && (
                          <span className="text-xs" style={{ color: "var(--lucid-warn)" }}>
                            {sc.missing_indicators.length} unavailable
                          </span>
                        )}
                        {sc.catalysts[0] && (
                          <span className="text-xs truncate" style={{ color: "var(--lucid-ink-3)" }}>
                            {sc.catalysts[0]}
                          </span>
                        )}
                        <span className="ml-auto text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--lucid-accent)" }}>→</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── View 2: By Date (chronological table) ───────────────────── */}
      {view === "date" && (
        <div className="lt-rise lt-stagger-4">
          {sorted.length === 0 ? (
            <FilterEmpty onClear={clearFilters} />
          ) : (
            <div
              className="lt-card lt-edge overflow-x-auto"
              style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}
            >
              <table className="w-full text-xs" style={{ minWidth: 760 }}>
                <thead>
                  <tr style={{ background: "var(--lucid-surface-3)", borderBottom: "1px solid var(--lucid-line-2)" }}>
                    <th className="lt-eyebrow text-left px-3 py-3"><SortHeader col="date" label="Date" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort} /></th>
                    <th className="lt-eyebrow text-left px-3 py-3">Phase</th>
                    <th className="lt-eyebrow text-left px-3 py-3">Bucket</th>
                    <th className="lt-eyebrow text-left px-3 py-3"><SortHeader col="domestic" label="Domestic" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort} /></th>
                    <th className="lt-eyebrow text-left px-3 py-3"><SortHeader col="external" label="External" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort} /></th>
                    <th className="lt-eyebrow text-left px-3 py-3"><SortHeader col="net" label="Net" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort} /></th>
                    <th className="lt-eyebrow text-left px-3 py-3">Band</th>
                    <th className="lt-eyebrow text-left px-3 py-3"><SortHeader col="ind9" label="Ind 9 Raw" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort} /></th>
                    <th className="lt-eyebrow text-left px-3 py-3">Flag</th>
                    <th className="lt-eyebrow text-left px-3 py-3">Sub-tools</th>
                  </tr>
                </thead>
                {/* TODO: virtualize when history > 200 rows */}
                <tbody>
                  {sorted.map((sc, i) => {
                    const fs = flagPillStyle(sc.composition_flag);
                    const ind9 = sc.ind9_raw_composite;
                    return (
                      <tr
                        key={sc.id}
                        className="border-t hover:bg-white/2 cursor-pointer transition-colors"
                        style={{ borderColor: "var(--lucid-line)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.005)" }}
                        onClick={() => setDrawerSc(sc)}
                      >
                        <td className="px-3 py-2" style={{ color: "var(--lucid-ink-2)" }}>{formatDate(sc.date)}</td>
                        <td className="px-3 py-2" style={{ color: "var(--lucid-ink-3)" }}>{sc.phase ?? <span style={{ color: "var(--lucid-line-3)" }}>—</span>}</td>
                        <td className="px-3 py-2">
                          {sc.bucket ? (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-3)" }}>
                              {sc.bucket}
                            </span>
                          ) : (
                            <span style={{ color: "var(--lucid-line-3)" }}>—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: "var(--lucid-ink-2)" }}>{netDisplay(sc.domestic_composite)}</td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: sc.external_composite < 0 ? "var(--negative)" : "var(--lucid-ink-2)" }}>
                          {netDisplay(sc.external_composite)}
                        </td>
                        <td className="px-3 py-2 font-bold tabular-nums" style={{ color: bandColor(sc.band) }}>
                          {netDisplay(sc.net_score)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs" style={{ color: bandColor(sc.band) }}>{sc.band}</span>
                        </td>
                        <td className="px-3 py-2 tabular-nums font-mono" style={{ color: ind9 === null ? "var(--lucid-line-3)" : ind9 < 0 ? "var(--positive)" : ind9 > 0 ? "var(--negative)" : "var(--lucid-ink-3)" }}>
                          {ind9 === null ? "—" : `${ind9 >= 0 ? "+" : ""}${ind9}`}
                        </td>
                        <td className="px-3 py-2">
                          {sc.composition_flag ? (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: fs.bg, color: fs.color }}>
                              {sc.composition_flag.replace("_", " ")}
                            </span>
                          ) : (
                            <span style={{ color: "var(--lucid-line-3)" }}>—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            {sc.peak_score_active && (
                              <span className="text-xs px-1 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--lucid-warn) 15%, transparent)", color: "var(--lucid-warn)" }}>Peak</span>
                            )}
                            {sc.conflict_flag && (
                              <span className="text-xs px-1 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--lucid-accent) 14%, transparent)", color: "var(--lucid-accent)" }}>Conflict</span>
                            )}
                            {sc.composition_flag && (
                              <span className="text-xs px-1 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--lucid-accent) 14%, transparent)", color: "var(--lucid-accent)" }}>Comp</span>
                            )}
                            {sc.missing_indicators.length > 0 && (
                              <span className="text-xs px-1 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--lucid-warn) 15%, transparent)", color: "var(--lucid-warn)" }} title={`${sc.missing_indicators.length} indicators unavailable`}>
                                ⚠ {sc.missing_indicators.length}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Scorecard Detail Drawer ──────────────────────────────────── */}
      <DetailDrawer
        open={drawerSc !== null}
        onClose={() => setDrawerSc(null)}
        title={drawerSc ? `${drawerSc.phase ? `${drawerSc.phase} — ` : ""}${formatDate(drawerSc.date)}` : ""}
      >
        {drawerSc && (
          <div className="p-4 sm:p-6 space-y-5">
            {/* Band summary */}
            <div
              className="p-4 rounded-xl"
              style={{ background: bandBg(drawerSc.band), border: `1px solid color-mix(in srgb, ${bandColor(drawerSc.band)} 30%, transparent)` }}
            >
              <div className="text-3xl font-bold" style={{ color: bandColor(drawerSc.band) }}>
                {netDisplay(drawerSc.net_score)}
              </div>
              <div className="text-lg font-semibold mt-1" style={{ color: bandColor(drawerSc.band) }}>
                {drawerSc.band}
              </div>
              <div className="text-xs mt-2" style={{ color: "var(--lucid-ink-3)" }}>
                Dom {netDisplay(drawerSc.domestic_composite)} · Ext {netDisplay(drawerSc.external_composite)} · Ind 9 raw {drawerSc.ind9_raw_composite === null ? "—" : `${drawerSc.ind9_raw_composite >= 0 ? "+" : ""}${drawerSc.ind9_raw_composite}`}
              </div>
              {drawerSc.missing_indicators.length > 0 && (
                <div className="text-xs mt-2" style={{ color: "var(--lucid-warn)" }}>
                  {drawerSc.missing_indicators.length} indicator{drawerSc.missing_indicators.length !== 1 ? "s" : ""} unavailable
                </div>
              )}
            </div>

            {/* Indicators */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--lucid-ink-3)" }}>Indicators</div>
              <div className="space-y-1.5">
                {drawerSc.indicators.map((ind) => (
                  <div key={ind.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--lucid-surface-2)" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-10" style={{ color: "var(--lucid-ink-3)" }}>Ind {ind.id}</span>
                      <span className="text-xs" style={{ color: "var(--lucid-ink-2)" }}>{ind.short}</span>
                      {ind.outcome === "insufficient_data" && (
                        <span className="text-xs" style={{ color: "var(--lucid-warn)" }} title={ind.reason ?? "insufficient data"}>
                          ⚠
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs" style={{ color: "var(--lucid-ink-3)" }}>{ind.value}</span>
                      <span className={scorePillClass(ind.score)}>{scoreDisplay(ind.score)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Catalysts */}
            {drawerSc.catalysts.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--lucid-ink-3)" }}>Catalysts</div>
                <ul className="space-y-1.5">
                  {drawerSc.catalysts.map((c, i) => (
                    <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                      <span style={{ color: "var(--lucid-ink-3)" }}>•</span>{c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notes */}
            {drawerSc.notes && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--lucid-ink-3)" }}>Notes</div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>{drawerSc.notes}</p>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

function SortHeader({
  col,
  label,
  sortCol,
  sortDir,
  onToggle,
}: {
  col: "date" | "net" | "domestic" | "external" | "ind9";
  label: string;
  sortCol: string;
  sortDir: "asc" | "desc";
  onToggle: (col: "date" | "net" | "domestic" | "external" | "ind9") => void;
}) {
  return (
    <button
      className="flex items-center gap-1 text-left"
      onClick={() => onToggle(col)}
      style={{ color: sortCol === col ? "var(--lucid-ink-2)" : "var(--lucid-ink-3)" }}
    >
      {label}
      {sortCol === col && <span>{sortDir === "desc" ? " ↓" : " ↑"}</span>}
    </button>
  );
}

function FilterEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="lt-card p-16 text-center">
      <BookText size={40} className="mx-auto mb-4" style={{ color: "var(--lucid-line-3)" }} />
      <p className="text-sm font-medium mb-1" style={{ color: "var(--lucid-ink-3)" }}>No scorecards match these filters.</p>
      <p className="text-xs mb-4" style={{ color: "var(--lucid-ink-3)" }}>Try removing a filter or adjusting the date range.</p>
      <button
        className="text-sm px-4 py-2 rounded-lg"
        style={{ background: "color-mix(in srgb, var(--lucid-accent) 14%, transparent)", color: "var(--lucid-accent)", border: "1px solid color-mix(in srgb, var(--lucid-accent) 14%, transparent)" }}
        onClick={onClear}
      >
        Clear Filters
      </button>
    </div>
  );
}
