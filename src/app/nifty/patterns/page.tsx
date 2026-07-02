"use client";

import { useState, useMemo } from "react";
import { DetailDrawer } from "@/components/DetailDrawer";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import { useScorecardHistory } from "@/hooks/useScorecardHistory";
import { usePatterns } from "@/hooks/usePatterns";
import { computePatternRelevance, type PatternRelevance } from "@/lib/pattern-relevance";
import type { PublicPattern, PublicPatternTier, PublicScorecard } from "@/lib/api/nifty";
import { patternTierStyle, formatDate } from "../nifty-utils";

const TIERS: PublicPatternTier[] = ["CONFIRMED", "OBSERVED", "HYPOTHESIS"];
const SUBTOOL_OPTIONS = ["Velocity", "Peak Ceiling", "V-Bottom", "Composition", "Section 9F"];

function sortPatterns(list: PublicPattern[]): PublicPattern[] {
  const tierOrder: Record<PublicPatternTier, number> = { CONFIRMED: 0, OBSERVED: 1, HYPOTHESIS: 2 };
  return [...list].sort((a, b) => {
    const td = tierOrder[a.tier] - tierOrder[b.tier];
    if (td !== 0) return td;
    return b.instances - a.instances;
  });
}

function velocityBetween(s1: PublicScorecard, s2: PublicScorecard): number {
  const days = Math.abs(
    (new Date(s2.date).getTime() - new Date(s1.date).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return 0;
  return (s2.net_score - s1.net_score) / days;
}

export default function PatternsPage() {
  const scorecardsQuery = useScorecardHistory();
  const patternsQuery = usePatterns();

  const [filterTiers, setFilterTiers] = useState<PublicPatternTier[]>([]);
  const [filterSubTool, setFilterSubTool] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPattern, setSelectedPattern] = useState<PublicPattern | null>(null);
  const [selectedFromRelevant, setSelectedFromRelevant] = useState(false);
  const [showAllRelevant, setShowAllRelevant] = useState(false);

  // Combined gates
  if (scorecardsQuery.isLoading || patternsQuery.isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingState message="Loading patterns..." />
      </div>
    );
  }
  if (scorecardsQuery.error || patternsQuery.error) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState
          error={scorecardsQuery.error ?? patternsQuery.error}
          onRetry={() => {
            scorecardsQuery.refetch();
            patternsQuery.refetch();
          }}
        />
      </div>
    );
  }
  if (!scorecardsQuery.data || scorecardsQuery.data.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState title="No scorecards available — patterns cannot be ranked without context" />
      </div>
    );
  }
  if (!patternsQuery.data || patternsQuery.data.length === 0) {
    return (
      <div className="p-4 sm:p-6">
        <EmptyState title="No patterns available" />
      </div>
    );
  }

  const scorecards = scorecardsQuery.data;
  const patterns = patternsQuery.data;
  const currentSc = scorecards[0];
  const priorSc: PublicScorecard | undefined = scorecards[1];
  const vel = priorSc ? velocityBetween(priorSc, currentSc) : undefined;
  const missingCount = currentSc.missing_indicators.length;

  const tierCounts: Record<PublicPatternTier, number> = {
    CONFIRMED: patterns.filter((p) => p.tier === "CONFIRMED").length,
    OBSERVED: patterns.filter((p) => p.tier === "OBSERVED").length,
    HYPOTHESIS: patterns.filter((p) => p.tier === "HYPOTHESIS").length,
  };

  return (
    <PatternsPageInner
      scorecards={scorecards}
      patterns={patterns}
      currentSc={currentSc}
      vel={vel}
      missingCount={missingCount}
      tierCounts={tierCounts}
      filterTiers={filterTiers}
      setFilterTiers={setFilterTiers}
      filterSubTool={filterSubTool}
      setFilterSubTool={setFilterSubTool}
      filterCategory={filterCategory}
      setFilterCategory={setFilterCategory}
      search={search}
      setSearch={setSearch}
      selectedPattern={selectedPattern}
      setSelectedPattern={setSelectedPattern}
      selectedFromRelevant={selectedFromRelevant}
      setSelectedFromRelevant={setSelectedFromRelevant}
      showAllRelevant={showAllRelevant}
      setShowAllRelevant={setShowAllRelevant}
    />
  );
}

type InnerProps = {
  scorecards: PublicScorecard[];
  patterns: PublicPattern[];
  currentSc: PublicScorecard;
  vel: number | undefined;
  missingCount: number;
  tierCounts: Record<PublicPatternTier, number>;
  filterTiers: PublicPatternTier[];
  setFilterTiers: React.Dispatch<React.SetStateAction<PublicPatternTier[]>>;
  filterSubTool: string[];
  setFilterSubTool: React.Dispatch<React.SetStateAction<string[]>>;
  filterCategory: string[];
  setFilterCategory: React.Dispatch<React.SetStateAction<string[]>>;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  selectedPattern: PublicPattern | null;
  setSelectedPattern: React.Dispatch<React.SetStateAction<PublicPattern | null>>;
  selectedFromRelevant: boolean;
  setSelectedFromRelevant: React.Dispatch<React.SetStateAction<boolean>>;
  showAllRelevant: boolean;
  setShowAllRelevant: React.Dispatch<React.SetStateAction<boolean>>;
};

function PatternsPageInner({
  scorecards,
  patterns,
  currentSc,
  vel,
  missingCount,
  tierCounts,
  filterTiers,
  setFilterTiers,
  filterSubTool,
  setFilterSubTool,
  filterCategory,
  setFilterCategory,
  search,
  setSearch,
  selectedPattern,
  setSelectedPattern,
  selectedFromRelevant,
  setSelectedFromRelevant,
  showAllRelevant,
  setShowAllRelevant,
}: InnerProps) {
  const relevanceList = useMemo(
    () => computePatternRelevance(patterns, currentSc, vel, scorecards),
    [patterns, currentSc, vel, scorecards],
  );

  const topRelevant = relevanceList.filter((r) => r.relevance_score >= 25);
  const shownRelevant = showAllRelevant ? topRelevant : topRelevant.slice(0, 3);

  const filtered = useMemo(() => {
    const list = patterns.filter((p) => {
      if (filterTiers.length && !filterTiers.includes(p.tier)) return false;
      if (filterSubTool.length) {
        if (!p.drives_subtool || !filterSubTool.includes(p.drives_subtool)) return false;
      }
      if (filterCategory.length && !filterCategory.includes(p.category)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.id.toLowerCase().includes(q) &&
          !p.name.toLowerCase().includes(q) &&
          !p.rule.toLowerCase().includes(q) &&
          !p.description.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
    return sortPatterns(list);
  }, [patterns, filterTiers, filterSubTool, filterCategory, search]);

  const hasFilters =
    filterTiers.length > 0 ||
    filterSubTool.length > 0 ||
    filterCategory.length > 0 ||
    search;

  function toggleTier(t: PublicPatternTier) {
    setFilterTiers((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function openPattern(p: PublicPattern, fromRelevant = false) {
    setSelectedPattern(p);
    setSelectedFromRelevant(fromRelevant);
  }

  const relevanceMap = useMemo(() => {
    const m = new Map<string, PatternRelevance>();
    for (const r of relevanceList) m.set(r.pattern.id, r);
    return m;
  }, [relevanceList]);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-350">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="lt-serif text-2xl font-bold" style={{ color: "var(--lucid-ink)" }}>Patterns</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>What we&apos;ve learned. What&apos;s relevant now.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
          <span style={{ color: "var(--lucid-pos)" }}>{tierCounts.CONFIRMED} CONFIRMED</span>
          <span style={{ color: "var(--lucid-ink-3)" }}>·</span>
          <span style={{ color: "var(--lucid-accent)" }}>{tierCounts.OBSERVED} OBSERVED</span>
          <span style={{ color: "var(--lucid-ink-3)" }}>·</span>
          <span style={{ color: "var(--lucid-accent)" }}>{tierCounts.HYPOTHESIS} HYPOTHESIS</span>
          {missingCount > 0 && (
            <>
              <span style={{ color: "var(--lucid-ink-3)" }}>·</span>
              <span style={{ color: "var(--lucid-warn)" }}>
                {missingCount} indicator{missingCount !== 1 ? "s" : ""} unavailable
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Section 1: Relevant Now ──────────────────────────────────── */}
      {topRelevant.length > 0 && (
        <div className="lt-card p-4 sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--lucid-ink-3)" }}>
            Relevant Now
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--lucid-ink-3)" }}>
            Patterns matched against current scorecard
            {currentSc.phase ? ` — ${currentSc.phase}, ${currentSc.band}.` : ` — ${currentSc.band}.`}
          </p>
          <div className="space-y-3">
            {shownRelevant.map(({ pattern, relevance_score, matched_triggers }) => {
              const ts = patternTierStyle(pattern.tier);
              return (
                <button
                  key={pattern.id}
                  className="w-full text-left p-4 rounded-xl hover:bg-white/5 transition-colors"
                  style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}
                  onClick={() => openPattern(pattern, true)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold" style={{ color: "var(--lucid-accent)" }}>{pattern.id}</span>
                      <span className="text-sm font-medium" style={{ color: "var(--lucid-ink)" }}>{pattern.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: ts.bg, color: ts.color }}>
                        {pattern.tier}
                      </span>
                      {pattern.drives_subtool && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--lucid-accent) 14%, transparent)", color: "var(--lucid-accent)" }}>
                          → {pattern.drives_subtool}
                        </span>
                      )}
                    </div>
                    <span className="text-xs ml-2 shrink-0" style={{ color: "var(--lucid-line-3)" }}>
                      Score: {relevance_score}
                    </span>
                  </div>
                  {matched_triggers.length > 0 && (
                    <div className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                      <span style={{ color: "var(--lucid-ink-3)" }}>Why now: </span>
                      {matched_triggers.join(" · ")}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {topRelevant.length > 3 && (
            <button
              className="mt-3 text-xs"
              style={{ color: "var(--lucid-accent)" }}
              onClick={() => setShowAllRelevant((v) => !v)}
            >
              {showAllRelevant ? `Show fewer` : `See all ${topRelevant.length} relevant patterns`}
            </button>
          )}
        </div>
      )}

      {/* ── Section 2: Full Library ──────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 flex-wrap mb-4">
          <div className="flex gap-1.5">
            {TIERS.map((t) => {
              const ts = patternTierStyle(t);
              const active = filterTiers.includes(t);
              return (
                <button
                  key={t}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: active ? ts.bg : "var(--lucid-surface-2)",
                    color: active ? ts.color : "var(--lucid-ink-3)",
                    border: `1px solid ${active ? ts.border : "color-mix(in srgb, var(--lucid-ctx) 12%, transparent)"}`,
                  }}
                  onClick={() => toggleTier(t)}
                >
                  [{tierCounts[t]} {t}]
                </button>
              );
            })}
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {SUBTOOL_OPTIONS.map((st) => {
              const active = filterSubTool.includes(st);
              return (
                <button
                  key={st}
                  className="px-2.5 py-1 rounded-full text-xs transition-all"
                  style={{
                    background: active ? "color-mix(in srgb, var(--lucid-accent) 14%, transparent)" : "var(--lucid-surface-2)",
                    color: active ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                    border: `1px solid ${active ? "color-mix(in srgb, var(--lucid-accent) 14%, transparent)" : "var(--lucid-line)"}`,
                  }}
                  onClick={() =>
                    setFilterSubTool((prev) => prev.includes(st) ? prev.filter((x) => x !== st) : [...prev, st])
                  }
                >
                  {st}
                </button>
              );
            })}
          </div>

          <input
            type="text"
            placeholder="Search patterns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:ml-auto px-3 py-1.5 rounded-lg text-xs w-full sm:w-48"
            style={{
              background: "var(--lucid-surface-2)",
              border: "1px solid color-mix(in srgb, var(--lucid-ctx) 12%, transparent)",
              color: "var(--lucid-ink)",
              outline: "none",
            }}
          />

          {hasFilters && (
            <button
              className="text-xs"
              style={{ color: "var(--lucid-ink-3)" }}
              onClick={() => { setFilterTiers([]); setFilterSubTool([]); setFilterCategory([]); setSearch(""); }}
            >
              Clear
            </button>
          )}
        </div>

        <p className="text-xs mb-3" style={{ color: "var(--lucid-ink-3)" }}>
          Showing {filtered.length} of {patterns.length} patterns
        </p>

        <div className="grid grid-cols-1 gap-3">
          {filtered.map((pattern) => {
            const ts = patternTierStyle(pattern.tier);
            const relevance = relevanceMap.get(pattern.id);
            return (
              <button
                key={pattern.id}
                className="text-left p-5 rounded-xl hover:bg-white/5 transition-colors"
                style={{
                  background: "var(--lucid-surface-2)",
                  border: "1px solid var(--lucid-line)",
                  borderLeft: `3px solid ${ts.color}30`,
                }}
                onClick={() => openPattern(pattern, false)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold" style={{ color: "var(--lucid-accent)" }}>{pattern.id}</span>
                    <span className="text-sm font-semibold" style={{ color: "var(--lucid-ink)" }}>{pattern.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>{pattern.instances} instances</span>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}>
                      {pattern.tier}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-3)", border: "1px solid var(--lucid-line)" }}>
                    {pattern.category}
                  </span>
                  {pattern.drives_subtool && (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--lucid-accent) 14%, transparent)", color: "var(--lucid-accent)" }}>
                      → {pattern.drives_subtool}
                    </span>
                  )}
                  {relevance && relevance.relevance_score >= 25 && (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--lucid-pos) 15%, transparent)", color: "var(--lucid-pos)" }}>
                      ★ Relevant now
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>{pattern.rule}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Detail Drawer ────────────────────────────────────────────── */}
      <DetailDrawer
        open={selectedPattern !== null}
        onClose={() => setSelectedPattern(null)}
        title={selectedPattern ? `${selectedPattern.id} — ${selectedPattern.name}` : ""}
      >
        {selectedPattern && (
          <PatternDrawerContent
            pattern={selectedPattern}
            scorecards={scorecards}
            fromRelevant={selectedFromRelevant}
            relevance={relevanceMap.get(selectedPattern.id) ?? null}
          />
        )}
      </DetailDrawer>
    </div>
  );
}

function PatternDrawerContent({
  pattern,
  scorecards,
  fromRelevant,
  relevance,
}: {
  pattern: PublicPattern;
  scorecards: PublicScorecard[];
  fromRelevant: boolean;
  relevance: PatternRelevance | null;
}) {
  const ts = patternTierStyle(pattern.tier);

  // Example dates whose scorecard exists in our fetched window
  const exampleRows = pattern.example_dates
    .map((d) => ({ date: d, sc: scorecards.find((s) => s.date === d) ?? null }));
  const inWindow = exampleRows.filter((r) => r.sc !== null);

  return (
    <div className="p-4 sm:p-6 space-y-6">

      {fromRelevant && relevance && relevance.matched_triggers.length > 0 && (
        <div
          className="p-4 rounded-xl"
          style={{ background: "color-mix(in srgb, var(--lucid-pos) 15%, transparent)", border: "1px solid color-mix(in srgb, var(--lucid-pos) 15%, transparent)" }}
        >
          <div className="text-xs font-semibold mb-2" style={{ color: "var(--lucid-pos)" }}>Relevant to current state because:</div>
          <ul className="space-y-1">
            {relevance.matched_triggers.map((t, i) => (
              <li key={i} className="flex gap-2 text-xs" style={{ color: "var(--lucid-pos)" }}>
                <span>•</span>{t}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--lucid-ink-3)" }}>Meta</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg" style={{ background: "var(--lucid-surface-2)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--lucid-ink-3)" }}>Tier</div>
            <span className="text-sm font-semibold px-2 py-0.5 rounded" style={{ background: ts.bg, color: ts.color }}>
              {pattern.tier}
            </span>
          </div>
          <div className="p-3 rounded-lg" style={{ background: "var(--lucid-surface-2)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--lucid-ink-3)" }}>Instances</div>
            <div className="text-sm font-semibold" style={{ color: "var(--lucid-ink)" }}>{pattern.instances}</div>
          </div>
          <div className="p-3 rounded-lg" style={{ background: "var(--lucid-surface-2)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--lucid-ink-3)" }}>Category</div>
            <div className="text-xs" style={{ color: "var(--lucid-ink-2)" }}>{pattern.category}</div>
          </div>
          <div className="p-3 rounded-lg" style={{ background: "var(--lucid-surface-2)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--lucid-ink-3)" }}>Drives Sub-tool</div>
            <div className="text-xs" style={{ color: pattern.drives_subtool ? "var(--lucid-accent)" : "var(--lucid-line-3)" }}>
              {pattern.drives_subtool ?? "—"}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--lucid-ink-3)" }}>Rule</div>
        <div
          className="p-4 rounded-xl text-xs leading-relaxed"
          style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line)" }}
        >
          {pattern.rule}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--lucid-ink-3)" }}>Description</div>
        <p className="text-xs leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>{pattern.description}</p>
      </div>

      {inWindow.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--lucid-ink-3)" }}>
            Instance Examples ({inWindow.length})
          </div>
          <div className="space-y-1.5">
            {inWindow.map(({ date, sc }, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: "var(--lucid-surface-2)" }}
              >
                <div>
                  <span className="text-xs" style={{ color: "var(--lucid-ink-2)" }}>{formatDate(date)}</span>
                  {sc && (
                    <span className="ml-2 text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                      {sc.phase ? `${sc.phase} · ` : ""}Net {sc.net_score >= 0 ? "+" : ""}{sc.net_score}
                    </span>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "color-mix(in srgb, var(--lucid-accent) 14%, transparent)", color: "var(--lucid-accent)" }}>
                  Open scorecard →
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--lucid-ink-3)" }}>Status</div>
        <p className="text-xs leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>{pattern.status}</p>
      </div>
    </div>
  );
}
