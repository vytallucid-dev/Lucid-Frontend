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
      <div className="p-6">
        <LoadingState message="Loading patterns..." />
      </div>
    );
  }
  if (scorecardsQuery.error || patternsQuery.error) {
    return (
      <div className="p-6">
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
      <div className="p-6">
        <EmptyState title="No scorecards available — patterns cannot be ranked without context" />
      </div>
    );
  }
  if (!patternsQuery.data || patternsQuery.data.length === 0) {
    return (
      <div className="p-6">
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
    <div className="p-6 space-y-5 max-w-350">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#E2E8F0" }}>Patterns</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>What we&apos;ve learned. What&apos;s relevant now.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span style={{ color: "#10B981" }}>{tierCounts.CONFIRMED} CONFIRMED</span>
          <span style={{ color: "#64748B" }}>·</span>
          <span style={{ color: "#60A5FA" }}>{tierCounts.OBSERVED} OBSERVED</span>
          <span style={{ color: "#64748B" }}>·</span>
          <span style={{ color: "#A855F7" }}>{tierCounts.HYPOTHESIS} HYPOTHESIS</span>
          {missingCount > 0 && (
            <>
              <span style={{ color: "#64748B" }}>·</span>
              <span style={{ color: "#F59E0B" }}>
                {missingCount} indicator{missingCount !== 1 ? "s" : ""} unavailable
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Section 1: Relevant Now ──────────────────────────────────── */}
      {topRelevant.length > 0 && (
        <div className="glass-card p-5">
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#64748B" }}>
            Relevant Now
          </div>
          <p className="text-xs mb-4" style={{ color: "#475569" }}>
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
                  style={{ background: "rgba(14,20,30,0.5)", border: "1px solid rgba(148,163,184,0.08)" }}
                  onClick={() => openPattern(pattern, true)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold" style={{ color: "#3B82F6" }}>{pattern.id}</span>
                      <span className="text-sm font-medium" style={{ color: "#E2E8F0" }}>{pattern.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded" style={{ background: ts.bg, color: ts.color }}>
                        {pattern.tier}
                      </span>
                      {pattern.drives_subtool && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.1)", color: "#60A5FA" }}>
                          → {pattern.drives_subtool}
                        </span>
                      )}
                    </div>
                    <span className="text-xs ml-2 shrink-0" style={{ color: "#334155" }}>
                      Score: {relevance_score}
                    </span>
                  </div>
                  {matched_triggers.length > 0 && (
                    <div className="text-xs" style={{ color: "#64748B" }}>
                      <span style={{ color: "#475569" }}>Why now: </span>
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
              style={{ color: "#3B82F6" }}
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
                    background: active ? ts.bg : "rgba(14,20,30,0.6)",
                    color: active ? ts.color : "#475569",
                    border: `1px solid ${active ? ts.border : "rgba(148,163,184,0.1)"}`,
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
                    background: active ? "rgba(59,130,246,0.15)" : "rgba(14,20,30,0.5)",
                    color: active ? "#3B82F6" : "#475569",
                    border: `1px solid ${active ? "rgba(59,130,246,0.3)" : "rgba(148,163,184,0.08)"}`,
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
            className="ml-auto px-3 py-1.5 rounded-lg text-xs"
            style={{
              background: "rgba(14,20,30,0.6)",
              border: "1px solid rgba(148,163,184,0.1)",
              color: "#E2E8F0",
              outline: "none",
              width: 200,
            }}
          />

          {hasFilters && (
            <button
              className="text-xs"
              style={{ color: "#64748B" }}
              onClick={() => { setFilterTiers([]); setFilterSubTool([]); setFilterCategory([]); setSearch(""); }}
            >
              Clear
            </button>
          )}
        </div>

        <p className="text-xs mb-3" style={{ color: "#475569" }}>
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
                  background: "rgba(14,20,30,0.45)",
                  border: "1px solid rgba(148,163,184,0.08)",
                  borderLeft: `3px solid ${ts.color}30`,
                }}
                onClick={() => openPattern(pattern, false)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold" style={{ color: "#3B82F6" }}>{pattern.id}</span>
                    <span className="text-sm font-semibold" style={{ color: "#E2E8F0" }}>{pattern.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs" style={{ color: "#475569" }}>{pattern.instances} instances</span>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}>
                      {pattern.tier}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(14,20,30,0.6)", color: "#64748B", border: "1px solid rgba(148,163,184,0.08)" }}>
                    {pattern.category}
                  </span>
                  {pattern.drives_subtool && (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.08)", color: "#60A5FA" }}>
                      → {pattern.drives_subtool}
                    </span>
                  )}
                  {relevance && relevance.relevance_score >= 25 && (
                    <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(16,185,129,0.08)", color: "#10B981" }}>
                      ★ Relevant now
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>{pattern.rule}</p>
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
    <div className="p-6 space-y-6">

      {fromRelevant && relevance && relevance.matched_triggers.length > 0 && (
        <div
          className="p-4 rounded-xl"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}
        >
          <div className="text-xs font-semibold mb-2" style={{ color: "#10B981" }}>Relevant to current state because:</div>
          <ul className="space-y-1">
            {relevance.matched_triggers.map((t, i) => (
              <li key={i} className="flex gap-2 text-xs" style={{ color: "#6EE7B7" }}>
                <span>•</span>{t}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#64748B" }}>Meta</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg" style={{ background: "rgba(14,20,30,0.5)" }}>
            <div className="text-xs mb-1" style={{ color: "#475569" }}>Tier</div>
            <span className="text-sm font-semibold px-2 py-0.5 rounded" style={{ background: ts.bg, color: ts.color }}>
              {pattern.tier}
            </span>
          </div>
          <div className="p-3 rounded-lg" style={{ background: "rgba(14,20,30,0.5)" }}>
            <div className="text-xs mb-1" style={{ color: "#475569" }}>Instances</div>
            <div className="text-sm font-semibold" style={{ color: "#E2E8F0" }}>{pattern.instances}</div>
          </div>
          <div className="p-3 rounded-lg" style={{ background: "rgba(14,20,30,0.5)" }}>
            <div className="text-xs mb-1" style={{ color: "#475569" }}>Category</div>
            <div className="text-xs" style={{ color: "#94A3B8" }}>{pattern.category}</div>
          </div>
          <div className="p-3 rounded-lg" style={{ background: "rgba(14,20,30,0.5)" }}>
            <div className="text-xs mb-1" style={{ color: "#475569" }}>Drives Sub-tool</div>
            <div className="text-xs" style={{ color: pattern.drives_subtool ? "#60A5FA" : "#334155" }}>
              {pattern.drives_subtool ?? "—"}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#64748B" }}>Rule</div>
        <div
          className="p-4 rounded-xl text-xs leading-relaxed"
          style={{ background: "rgba(14,20,30,0.6)", color: "#94A3B8", border: "1px solid rgba(148,163,184,0.06)" }}
        >
          {pattern.rule}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#64748B" }}>Description</div>
        <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>{pattern.description}</p>
      </div>

      {inWindow.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#64748B" }}>
            Instance Examples ({inWindow.length})
          </div>
          <div className="space-y-1.5">
            {inWindow.map(({ date, sc }, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: "rgba(14,20,30,0.4)" }}
              >
                <div>
                  <span className="text-xs" style={{ color: "#94A3B8" }}>{formatDate(date)}</span>
                  {sc && (
                    <span className="ml-2 text-xs" style={{ color: "#475569" }}>
                      {sc.phase ? `${sc.phase} · ` : ""}Net {sc.net_score >= 0 ? "+" : ""}{sc.net_score}
                    </span>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.08)", color: "#60A5FA" }}>
                  Open scorecard →
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#64748B" }}>Status</div>
        <p className="text-xs leading-relaxed" style={{ color: "#64748B" }}>{pattern.status}</p>
      </div>
    </div>
  );
}
