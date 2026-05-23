"use client";

import { useState, useEffect, Suspense } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { patterns } from "@/lib/nifty-demo-data";
import { useScorecardHistory } from "@/hooks/useScorecardHistory";
import type { PublicScorecard, PublicIndicator } from "@/lib/api/nifty";
import { DetailDrawer } from "@/components/DetailDrawer";
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

function getIndicatorHistory(scorecards: PublicScorecard[], indId: number) {
  return scorecards
    .slice(0, 8)
    .map((sc) => {
      const ind = sc.indicators.find((i) => i.id === indId);
      return ind ? { date: sc.date, score: ind.score, value: ind.value, magnitude: ind.magnitude } : null;
    })
    .filter((row): row is { date: string; score: PublicIndicator["score"]; value: string; magnitude: string } => row !== null);
}

export default function ScorecardPage() {
  // Suspense-wrap because the inner uses useSearchParams, which forces a
  // bailout from static prerendering unless boundaries are explicit.
  return (
    <Suspense fallback={<div className="p-6"><LoadingState message="Loading scorecards..." /></div>}>
      <ScorecardPageInner />
    </Suspense>
  );
}

function ScorecardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: history, isLoading, error, refetch } = useScorecardHistory();

  const [selectedScId, setSelectedScId] = useState<string | null>(null);
  const [drawerIndId, setDrawerIndId] = useState<number | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // Honor `?date=YYYY-MM-DD` on mount — preselect the matching scorecard if it
  // falls within the fetched history window. Out-of-window dates fall back to
  // the default (most-recent) and log so callers can see the miss.
  const dateParam = searchParams.get("date");
  useEffect(() => {
    if (!dateParam || !history || history.length === 0) return;
    const match = history.find((s) => s.date === dateParam);
    if (match) {
      setSelectedScId(match.id);
    } else {
      console.warn(
        `[scorecard] ?date=${dateParam} not found in fetched history; using latest`,
      );
    }
  }, [dateParam, history]);

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingState message="Loading scorecards..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="p-6">
        <EmptyState title="No scorecards available" />
      </div>
    );
  }

  const scorecards = history;

  const sc: PublicScorecard =
    scorecards.find((s) => s.id === selectedScId) ?? scorecards[0];
  const drawerInd = drawerIndId !== null ? sc.indicators.find((i) => i.id === drawerIndId) : null;
  const missingCount = sc.missing_indicators.length;

  return (
    <div className="p-6 space-y-5 max-w-[1400px]">

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#E2E8F0" }}>Scorecard</h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
            All 13 indicators, current readings, magnitudes.
          </p>
        </div>

        {/* Scorecard selector */}
        <div className="relative">
          <button
            className="flex items-center gap-2 glass-card px-4 py-2 text-sm"
            onClick={() => setSelectorOpen((o) => !o)}
          >
            <span style={{ color: "#E2E8F0" }}>{formatDate(sc.date)}</span>
            <ChevronDown size={14} style={{ color: "#64748B" }} />
          </button>
          {selectorOpen && (
            <div
              className="absolute right-0 top-11 z-50 rounded-xl overflow-hidden"
              style={{
                background: "rgba(10,18,30,0.98)",
                border: "1px solid rgba(148,163,184,0.12)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                width: 260,
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              {scorecards.map((s) => (
                <button
                  key={s.id}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-white/5 transition-colors"
                  style={{ color: s.id === sc.id ? "#3B82F6" : "#94A3B8" }}
                  onClick={() => { setSelectedScId(s.id); setSelectorOpen(false); }}
                >
                  <span>{formatDate(s.date)}</span>
                  <span className="text-xs" style={{ color: "#475569" }}>
                    {s.phase ? `${s.phase} · ` : ""}{netDisplay(s.net_score)}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="text-xs mt-1 text-right flex items-center justify-end gap-2" style={{ color: "#475569" }}>
            {sc.phase && <span>{sc.phase}</span>}
            {sc.phase && sc.bucket && <span>·</span>}
            {sc.bucket && <span>{sc.bucket}</span>}
            {(sc.phase || sc.bucket) && <span>·</span>}
            <span>{formatDate(sc.date)}</span>
          </div>
          {missingCount > 0 && (
            <div className="text-xs mt-1 text-right" style={{ color: "#F59E0B" }}>
              {missingCount} indicator{missingCount !== 1 ? "s" : ""} unavailable
            </div>
          )}
        </div>
      </div>

      {/* ── Summary Strip ───────────────────────────────────────────── */}
      <div
        className="glass-card px-6 py-4 flex items-center gap-8"
        style={{ background: bandBg(sc.band), borderColor: bandColor(sc.band) + "30" }}
      >
        {[
          { label: "DOMESTIC", value: sc.domestic_composite, desc: "Floor intact" },
          { label: "EXTERNAL", value: sc.external_composite, desc: "Cycle reading" },
          { label: "NET", value: sc.net_score, desc: sc.band, isNet: true },
        ].map(({ label, value, desc, isNet }) => (
          <div key={label} className="flex items-center gap-4">
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#64748B" }}>{label}</div>
              <div className="text-3xl font-bold tabular-nums" style={{ color: isNet ? bandColor(sc.band) : "#E2E8F0" }}>
                {netDisplay(value)}
              </div>
              <div className="text-xs" style={{ color: "#94A3B8" }}>{desc}</div>
            </div>
            {!isNet && <div className="w-px h-10 self-center" style={{ background: "rgba(255,255,255,0.06)" }} />}
          </div>
        ))}
      </div>

      {/* ── Indicator Grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {sc.indicators.map((ind) => {
          const safeScore = ind.score ?? 0;
          return (
          <button
            key={ind.id}
            className="glass-card p-4 text-left hover:bg-white/[0.04] transition-colors group"
            style={{
              borderLeft: `3px solid ${safeScore >= 1 ? "var(--positive)" : safeScore <= -1 ? "var(--negative)" : "rgba(148,163,184,0.2)"}`,
            }}
            onClick={() => setDrawerIndId(ind.id)}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <div className="text-xs" style={{ color: "#475569" }}>Ind {ind.id}</div>
                <div className="text-sm font-medium leading-tight" style={{ color: "#E2E8F0" }}>{ind.name}</div>
                <div
                  className="inline-block text-xs px-2 py-0.5 rounded mt-1"
                  style={{
                    background: ind.composite === "Domestic" ? "rgba(59,130,246,0.12)" : "rgba(168,85,247,0.12)",
                    color: ind.composite === "Domestic" ? "#60A5FA" : "#A855F7",
                    border: ind.composite === "Domestic" ? "1px solid rgba(59,130,246,0.2)" : "1px solid rgba(168,85,247,0.2)",
                  }}
                >
                  {ind.composite}
                </div>
              </div>
              <span className={scorePillClass(ind.score)} style={{ fontSize: 18, minWidth: 40, padding: "4px 10px" }}>
                {scoreDisplay(ind.score)}
              </span>
            </div>

            {/* Value */}
            <div className="font-mono text-lg font-semibold" style={{ color: "#E2E8F0" }}>{ind.value}</div>
            <div className="text-xs mt-0.5" style={{ color: "#64748B" }}>{ind.magnitude}</div>

            {/* Trajectory — Ind 3 only */}
            {ind.id === 3 && ind.trajectory_3m_avg && (
              <div className="text-xs mt-1.5" style={{ color: "#94A3B8" }}>
                Trajectory: {ind.trajectory_3m_avg}
              </div>
            )}

            {/* Ind 9 special */}
            {ind.id === 9 && (
              <div className="mt-2 pt-2 border-t" style={{ borderColor: "rgba(148,163,184,0.1)" }}>
                <div className="text-xs" style={{ color: "#64748B" }}>
                  Raw composite: {sc.ind9_raw_composite !== null ? netDisplay(sc.ind9_raw_composite) : "—"} / −14 to +14
                </div>
                {sc.composition_flag && (
                  <div className="text-xs mt-0.5" style={{ color: "#F59E0B" }}>
                    [{sc.composition_flag.replace("_", " ")}] composition flag
                  </div>
                )}
              </div>
            )}

            {/* Ind 13 special */}
            {ind.id === 13 && (
              <div className="text-xs mt-1.5 italic" style={{ color: "#475569" }}>
                Live tracking — no historical backfill
              </div>
            )}

            {/* Last changed */}
            <div className="mt-2 pt-2 border-t text-xs flex items-center gap-1.5" style={{ borderColor: "rgba(148,163,184,0.08)", color: "#475569" }}>
              Last changed: {formatDate(ind.last_change_date)}
              {ind.prev_score !== undefined && ind.prev_score !== ind.score && (
                <span style={{ color: safeScore > (ind.prev_score ?? 0) ? "var(--positive)" : "var(--negative)" }}>
                  was {scoreDisplay(ind.prev_score ?? 0)} → {scoreDisplay(ind.score)}
                </span>
              )}
            </div>

            <div className="text-xs opacity-0 group-hover:opacity-100 transition-opacity mt-1" style={{ color: "#3B82F6" }}>
              Click for details →
            </div>
          </button>
          );
        })}
      </div>

      {/* ── Composite Bar ───────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#64748B" }}>
          Indicator Composite — {netDisplay(sc.net_score)} of 17 max
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
          {sc.indicators.map((ind) => {
            const safeScore = ind.score ?? 0;
            return (
            <button
              key={ind.id}
              className="flex items-center gap-3 group"
              onClick={() => setDrawerIndId(ind.id)}
            >
              <div className="text-xs w-14 shrink-0 text-right" style={{ color: "#475569" }}>
                Ind {ind.id}
              </div>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(0, (safeScore / 2)) * 100}%`,
                    background: safeScore >= 1 ? "var(--positive)" : safeScore <= -1 ? "var(--negative)" : "rgba(148,163,184,0.3)",
                  }}
                />
              </div>
              <span className={scorePillClass(ind.score)} style={{ fontSize: 11 }}>
                {scoreDisplay(ind.score)}
              </span>
              <span className="text-xs truncate" style={{ color: "#475569", width: 80 }}>{ind.short}</span>
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
          <div className="p-6 space-y-6">
            {/* Insufficient data note */}
            {drawerInd.outcome === "insufficient_data" && (
              <div
                className="rounded-lg p-3 text-xs"
                style={{
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  color: "#F59E0B",
                }}
              >
                This indicator returned insufficient data
                {drawerInd.reason ? ` — reason: ${drawerInd.reason}` : "."}
              </div>
            )}

            {/* A — Current Reading */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#64748B" }}>
                Current Reading
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: "#475569" }}>Score:</span>
                  <span className={scorePillClass(drawerInd.score)} style={{ fontSize: 14 }}>{scoreDisplay(drawerInd.score)}</span>
                  <span className="text-xs" style={{ color: "#475569" }}>range −2 to +2</span>
                </div>
                <div className="flex gap-2 text-sm">
                  <span style={{ color: "#475569" }}>Value:</span>
                  <span className="font-mono font-semibold" style={{ color: "#E2E8F0" }}>{drawerInd.value}</span>
                </div>
                <div className="flex gap-2 text-sm">
                  <span style={{ color: "#475569" }}>Context:</span>
                  <span style={{ color: "#94A3B8" }}>{drawerInd.magnitude}</span>
                </div>
                {drawerInd.trajectory_3m_avg && (
                  <div className="flex gap-2 text-sm">
                    <span style={{ color: "#475569" }}>Trajectory:</span>
                    <span style={{ color: "#94A3B8" }}>{drawerInd.trajectory_3m_avg}</span>
                  </div>
                )}
              </div>
            </div>

            {/* B — Scoring Rule */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#64748B" }}>
                Scoring Rule
              </div>
              <div
                className="rounded-lg p-4 text-xs leading-relaxed whitespace-pre-wrap"
                style={{ background: "rgba(14,20,30,0.6)", color: "#94A3B8" }}
              >
                {SCORING_RULES[drawerInd.code] ?? "Scoring rule not documented for this indicator."}
              </div>
            </div>

            {/* C — Recent History */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#64748B" }}>
                Recent History
              </div>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(148,163,184,0.1)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "rgba(14,20,30,0.6)" }}>
                      {["Date", "Score", "Value", "Context"].map((h) => (
                        <th key={h} className="text-left px-3 py-2" style={{ color: "#475569" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {getIndicatorHistory(scorecards, drawerInd.id).map((row, i) => (
                      <tr
                        key={i}
                        className="border-t"
                        style={{ borderColor: "rgba(148,163,184,0.06)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}
                      >
                        <td className="px-3 py-2" style={{ color: "#94A3B8" }}>{formatDate(row.date)}</td>
                        <td className="px-3 py-2">
                          <span className={scorePillClass(row.score)}>{scoreDisplay(row.score)}</span>
                        </td>
                        <td className="px-3 py-2 font-mono" style={{ color: "#E2E8F0" }}>{row.value}</td>
                        <td className="px-3 py-2" style={{ color: "#64748B" }}>{row.magnitude.slice(0, 40)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* D — Related Patterns */}
            {getRelatedPatterns(drawerInd.id).length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#64748B" }}>
                  Related Patterns
                </div>
                <div className="space-y-2">
                  {getRelatedPatterns(drawerInd.id).map((p) => (
                    <button
                      key={p.id}
                      className="w-full flex items-center justify-between p-3 rounded-lg text-left hover:bg-white/5 transition-colors"
                      style={{ background: "rgba(14,20,30,0.4)", border: "1px solid rgba(148,163,184,0.08)" }}
                      onClick={() => router.push(`/nifty/patterns`)}
                    >
                      <div>
                        <span className="text-xs font-mono font-semibold" style={{ color: "#3B82F6" }}>{p.id}</span>
                        <span className="text-xs ml-2" style={{ color: "#94A3B8" }}>{p.name}</span>
                      </div>
                      <ExternalLink size={12} style={{ color: "#475569" }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ind 9 link to USD Lab */}
            {drawerInd.id === 9 && (
              <button
                className="w-full py-2 text-sm rounded-lg font-medium"
                style={{ background: "rgba(59,130,246,0.1)", color: "#3B82F6", border: "1px solid rgba(59,130,246,0.2)" }}
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
