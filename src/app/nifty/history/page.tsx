"use client";

import { useState, useMemo } from "react";
import { BookText, ChevronDown } from "lucide-react";
import { useScorecardHistory } from "@/hooks/useScorecardHistory";
import type { PublicScorecard, PublicBand } from "@/lib/api/nifty";
import { DetailDrawer } from "@/components/DetailDrawer";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import { bandColor, bandBg, netDisplay, scorePillClass, scoreDisplay, flagPillStyle, formatDate, formatDateShort } from "../nifty-utils";

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
        <LoadingState message="Loading scorecards..." />
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
  const [view, setView] = useState<ViewMode>("phase");
  const [drawerSc, setDrawerSc] = useState<PublicScorecard | null>(null);
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
    <div className="p-4 sm:p-6 space-y-5 max-w-350">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold" style={{ color: "#E2E8F0" }}>History</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>Every scorecard, every phase.</p>
        </div>
        <div className="text-sm text-right shrink-0" style={{ color: "#64748B" }}>
          <p>{scorecards.length} scorecards · {uniquePhases.length} phases</p>
          <p>{phaseRange}</p>
        </div>
      </div>

      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        {/* View toggle */}
        <div
          className="flex rounded-lg p-0.5 gap-0.5"
          style={{ background: "rgba(14,20,30,0.6)", border: "1px solid rgba(148,163,184,0.1)" }}
        >
          {(["phase", "date"] as ViewMode[]).map((v) => (
            <button
              key={v}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize"
              style={{
                background: view === v ? "rgba(59,130,246,0.15)" : "transparent",
                color: view === v ? "#3B82F6" : "#64748B",
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
            background: "rgba(14,20,30,0.6)",
            border: "1px solid rgba(148,163,184,0.1)",
            color: "#E2E8F0",
            outline: "none",
          }}
        />

        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Band filter */}
          <div className="relative group">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "rgba(14,20,30,0.6)", border: "1px solid rgba(148,163,184,0.1)", color: filterBands.length ? "#3B82F6" : "#64748B" }}
            >
              Band {filterBands.length ? `(${filterBands.length})` : ""} <ChevronDown size={12} />
            </button>
            <div
              className="absolute left-0 top-9 z-50 hidden group-focus-within:block rounded-xl p-2 space-y-1"
              style={{ background: "rgba(10,18,30,0.98)", border: "1px solid rgba(148,163,184,0.12)", width: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
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
              style={{ background: "rgba(14,20,30,0.6)", border: "1px solid rgba(148,163,184,0.1)", color: filterSubTools.length ? "#3B82F6" : "#64748B" }}
            >
              Sub-tools {filterSubTools.length ? `(${filterSubTools.length})` : ""} <ChevronDown size={12} />
            </button>
            <div
              className="absolute left-0 top-9 z-50 hidden group-focus-within:block rounded-xl p-2 space-y-1"
              style={{ background: "rgba(10,18,30,0.98)", border: "1px solid rgba(148,163,184,0.12)", width: 160, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
            >
              {["Peak Ceiling", "CONFLICT", "Composition"].map((t) => (
                <label key={t} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterSubTools.includes(t)}
                    onChange={(e) => setFilterSubTools((prev) => e.target.checked ? [...prev, t] : prev.filter((x) => x !== t))}
                    className="w-3 h-3"
                  />
                  <span className="text-xs" style={{ color: "#94A3B8" }}>{t}</span>
                </label>
              ))}
            </div>
          </div>

          {hasFilters && (
            <button className="text-xs" style={{ color: "#64748B" }} onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── View 1: By Phase ────────────────────────────────────────── */}
      {view === "phase" && (
        <div className="space-y-4">
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
                <div key={phase} className="glass-card p-5">
                  {/* Phase header */}
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-bold" style={{ color: "#E2E8F0" }}>{phase}</h3>
                        {latest.bucket && (
                          <span
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              background: "rgba(14,20,30,0.6)",
                              color: "#94A3B8",
                              border: "1px solid rgba(148,163,184,0.1)",
                            }}
                          >
                            {latest.bucket}
                          </span>
                        )}
                      </div>
                      <div className="text-xs" style={{ color: "#475569" }}>
                        {formatDateShort(earliest.date)} → {formatDateShort(latest.date)} · {phaseScs.length} scorecards
                      </div>
                    </div>
                    <div className="text-right text-xs" style={{ color: "#475569" }}>
                      <div>Peak: {netDisplay(peakSc.net_score)} on {formatDateShort(peakSc.date)}</div>
                      <div>Floor: {netDisplay(floorSc.net_score)} on {formatDateShort(floorSc.date)}</div>
                      {subTools.length > 0 && (
                        <div className="mt-1 flex gap-1 justify-end">
                          {subTools.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{
                                background: t === "Peak Ceiling" ? "rgba(245,158,11,0.12)" : t === "CONFLICT" ? "rgba(168,85,247,0.12)" : "rgba(59,130,246,0.12)",
                                color: t === "Peak Ceiling" ? "#F59E0B" : t === "CONFLICT" ? "#A855F7" : "#60A5FA",
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
                        style={{ background: "rgba(14,20,30,0.3)" }}
                        onClick={() => setDrawerSc(sc)}
                      >
                        <span className="text-xs w-24 shrink-0" style={{ color: "#64748B" }}>
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
                          <span className="text-xs" style={{ color: "#F59E0B" }}>⚠ Peak</span>
                        )}
                        {sc.conflict_flag && (
                          <span className="text-xs" style={{ color: "#A855F7" }}>⚡ CONFLICT</span>
                        )}
                        {sc.missing_indicators.length > 0 && (
                          <span className="text-xs" style={{ color: "#F59E0B" }}>
                            {sc.missing_indicators.length} unavailable
                          </span>
                        )}
                        {sc.catalysts[0] && (
                          <span className="text-xs truncate" style={{ color: "#475569" }}>
                            {sc.catalysts[0]}
                          </span>
                        )}
                        <span className="ml-auto text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#3B82F6" }}>→</span>
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
        <div>
          {sorted.length === 0 ? (
            <FilterEmpty onClear={clearFilters} />
          ) : (
            <div className="glass-card overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: 760 }}>
                <thead>
                  <tr style={{ background: "rgba(14,20,30,0.6)", borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
                    <th className="text-left px-3 py-3"><SortHeader col="date" label="Date" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort} /></th>
                    <th className="text-left px-3 py-3" style={{ color: "#475569" }}>Phase</th>
                    <th className="text-left px-3 py-3" style={{ color: "#475569" }}>Bucket</th>
                    <th className="text-left px-3 py-3"><SortHeader col="domestic" label="Domestic" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort} /></th>
                    <th className="text-left px-3 py-3"><SortHeader col="external" label="External" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort} /></th>
                    <th className="text-left px-3 py-3"><SortHeader col="net" label="Net" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort} /></th>
                    <th className="text-left px-3 py-3" style={{ color: "#475569" }}>Band</th>
                    <th className="text-left px-3 py-3"><SortHeader col="ind9" label="Ind 9 Raw" sortCol={sortCol} sortDir={sortDir} onToggle={toggleSort} /></th>
                    <th className="text-left px-3 py-3" style={{ color: "#475569" }}>Flag</th>
                    <th className="text-left px-3 py-3" style={{ color: "#475569" }}>Sub-tools</th>
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
                        style={{ borderColor: "rgba(148,163,184,0.05)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.005)" }}
                        onClick={() => setDrawerSc(sc)}
                      >
                        <td className="px-3 py-2" style={{ color: "#94A3B8" }}>{formatDate(sc.date)}</td>
                        <td className="px-3 py-2" style={{ color: "#64748B" }}>{sc.phase ?? <span style={{ color: "#334155" }}>—</span>}</td>
                        <td className="px-3 py-2">
                          {sc.bucket ? (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(14,20,30,0.6)", color: "#64748B" }}>
                              {sc.bucket}
                            </span>
                          ) : (
                            <span style={{ color: "#334155" }}>—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: "#94A3B8" }}>{netDisplay(sc.domestic_composite)}</td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: sc.external_composite < 0 ? "var(--negative)" : "#94A3B8" }}>
                          {netDisplay(sc.external_composite)}
                        </td>
                        <td className="px-3 py-2 font-bold tabular-nums" style={{ color: bandColor(sc.band) }}>
                          {netDisplay(sc.net_score)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-xs" style={{ color: bandColor(sc.band) }}>{sc.band}</span>
                        </td>
                        <td className="px-3 py-2 tabular-nums font-mono" style={{ color: ind9 === null ? "#334155" : ind9 < 0 ? "var(--positive)" : ind9 > 0 ? "var(--negative)" : "#64748B" }}>
                          {ind9 === null ? "—" : `${ind9 >= 0 ? "+" : ""}${ind9}`}
                        </td>
                        <td className="px-3 py-2">
                          {sc.composition_flag ? (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: fs.bg, color: fs.color }}>
                              {sc.composition_flag.replace("_", " ")}
                            </span>
                          ) : (
                            <span style={{ color: "#334155" }}>—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            {sc.peak_score_active && (
                              <span className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>Peak</span>
                            )}
                            {sc.conflict_flag && (
                              <span className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(168,85,247,0.12)", color: "#A855F7" }}>Conflict</span>
                            )}
                            {sc.composition_flag && (
                              <span className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.1)", color: "#60A5FA" }}>Comp</span>
                            )}
                            {sc.missing_indicators.length > 0 && (
                              <span className="text-xs px-1 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B" }} title={`${sc.missing_indicators.length} indicators unavailable`}>
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
              style={{ background: bandBg(drawerSc.band), border: `1px solid ${bandColor(drawerSc.band)}30` }}
            >
              <div className="text-3xl font-bold" style={{ color: bandColor(drawerSc.band) }}>
                {netDisplay(drawerSc.net_score)}
              </div>
              <div className="text-lg font-semibold mt-1" style={{ color: bandColor(drawerSc.band) }}>
                {drawerSc.band}
              </div>
              <div className="text-xs mt-2" style={{ color: "#64748B" }}>
                Dom {netDisplay(drawerSc.domestic_composite)} · Ext {netDisplay(drawerSc.external_composite)} · Ind 9 raw {drawerSc.ind9_raw_composite === null ? "—" : `${drawerSc.ind9_raw_composite >= 0 ? "+" : ""}${drawerSc.ind9_raw_composite}`}
              </div>
              {drawerSc.missing_indicators.length > 0 && (
                <div className="text-xs mt-2" style={{ color: "#F59E0B" }}>
                  {drawerSc.missing_indicators.length} indicator{drawerSc.missing_indicators.length !== 1 ? "s" : ""} unavailable
                </div>
              )}
            </div>

            {/* Indicators */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#64748B" }}>Indicators</div>
              <div className="space-y-1.5">
                {drawerSc.indicators.map((ind) => (
                  <div key={ind.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(14,20,30,0.4)" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs w-10" style={{ color: "#475569" }}>Ind {ind.id}</span>
                      <span className="text-xs" style={{ color: "#94A3B8" }}>{ind.short}</span>
                      {ind.outcome === "insufficient_data" && (
                        <span className="text-xs" style={{ color: "#F59E0B" }} title={ind.reason ?? "insufficient data"}>
                          ⚠
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs" style={{ color: "#64748B" }}>{ind.value}</span>
                      <span className={scorePillClass(ind.score)}>{scoreDisplay(ind.score)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Catalysts */}
            {drawerSc.catalysts.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#64748B" }}>Catalysts</div>
                <ul className="space-y-1.5">
                  {drawerSc.catalysts.map((c, i) => (
                    <li key={i} className="flex gap-2 text-xs" style={{ color: "#64748B" }}>
                      <span style={{ color: "#475569" }}>•</span>{c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notes */}
            {drawerSc.notes && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#64748B" }}>Notes</div>
                <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>{drawerSc.notes}</p>
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
      style={{ color: sortCol === col ? "#94A3B8" : "#475569" }}
    >
      {label}
      {sortCol === col && <span>{sortDir === "desc" ? " ↓" : " ↑"}</span>}
    </button>
  );
}

function FilterEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="glass-card p-16 text-center">
      <BookText size={40} className="mx-auto mb-4" style={{ color: "#334155" }} />
      <p className="text-sm font-medium mb-1" style={{ color: "#64748B" }}>No scorecards match these filters.</p>
      <p className="text-xs mb-4" style={{ color: "#475569" }}>Try removing a filter or adjusting the date range.</p>
      <button
        className="text-sm px-4 py-2 rounded-lg"
        style={{ background: "rgba(59,130,246,0.1)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.2)" }}
        onClick={onClear}
      >
        Clear Filters
      </button>
    </div>
  );
}
