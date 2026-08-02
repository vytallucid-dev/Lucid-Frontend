"use client";

import { useMemo, Suspense } from "react";
import {
  getBiasPillClass,
  type BiasType,
} from "@/data/assets";
import { useAssetScorecard } from "@/hooks/useAssetScorecard";
import { useAssets } from "@/hooks/useAssets";
import { useScorecardSubjects } from "@/hooks/useScorecardSubjects";
import { useUrlSelectedKey } from "@/hooks/useUrlSelectedKey";
import { formatUpdated } from "@/lib/format-date";
import {
  type ScorecardAssetKey,
  type PublicScorecardSection,
  type PublicScorecardIndicator,
} from "@/lib/api/oracle";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";
import { ContentSwap } from "@/components/state/Skeleton";
import { type PickerOption } from "@/components/shared/ScorecardPicker";
import { ScorecardIdentityCard } from "@/components/shared/ScorecardIdentityCard";
import { ScoreHistoryTrigger } from "@/components/shared/ScoreHistoryTrigger";
import { ScorecardSkeleton } from "@/components/shared/ScorecardSkeleton";
import { useOracleTools } from "@/components/oracle-tools/OracleToolsProvider";

// Phase 7 derived the picker's membership from useAssets() (the screener
// projection), which regressed it to Gold + indices only — that endpoint has
// never contained standalone currencies. Fixed (Issue 1): membership and
// flags now come from useScorecardSubjects() (below, in ScorecardPageInner),
// the registry's actual scorecard-subject set — this file still doesn't need
// to know AUD or US30 exist for them to appear. The one thing kept local is
// *ordering* (Currency, then Commodity, then Index — a display preference,
// not membership); the "XAUUSD" → "Gold" key rename is used only to match a
// screener entry for score/bias enrichment, since scorecard-subjects already
// returns "Gold" directly.
const ASSET_TYPE_ORDER: Record<string, number> = { Currency: 0, Commodity: 1, Index: 2 };

function toScorecardKey(assetCode: string): string {
  return assetCode === "XAUUSD" ? "Gold" : assetCode;
}

function isScorecardAssetKey(value: string): value is ScorecardAssetKey {
  // Any non-empty string is accepted here; useUrlSelectedKey falls back to
  // the default ("USD") if the live picker options (derived below) don't
  // contain it, so an invalid/unknown ?asset= still degrades safely.
  return value.length > 0;
}

/** Score → theme token (positive green / negative red / neutral gold). */
function scoreToken(score: number): string {
  if (score > 0) return "var(--lucid-pos)";
  if (score < 0) return "var(--lucid-neg)";
  return "var(--lucid-accent)";
}

function ScorePill({ score }: { score: number }) {
  const color =
    score > 0
      ? "var(--lucid-pos)"
      : score < 0
        ? "var(--lucid-neg)"
        : "var(--lucid-ink-2)";
  const bg =
    score > 0
      ? "var(--lucid-pos-bg)"
      : score < 0
        ? "var(--lucid-neg-bg)"
        : "var(--lucid-surface-3)";
  const border =
    score > 0
      ? "var(--lucid-pos-bd)"
      : score < 0
        ? "var(--lucid-neg-bd)"
        : "var(--lucid-line)";
  return (
    <span
      className="lt-num inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: bg, color, border: `1px solid ${border}` }}
    >
      {score > 0 ? `+${score}` : score}
    </span>
  );
}

function SmallPill({
  label,
  variant,
}: {
  label: string;
  variant: "bullish" | "bearish" | "neutral";
}) {
  const styles = {
    bullish: {
      bg: "var(--lucid-pos-bg)",
      color: "var(--lucid-pos)",
      border: "var(--lucid-pos-bd)",
    },
    bearish: {
      bg: "var(--lucid-neg-bg)",
      color: "var(--lucid-neg)",
      border: "var(--lucid-neg-bd)",
    },
    neutral: {
      bg: "var(--lucid-surface-3)",
      color: "var(--lucid-ink-2)",
      border: "var(--lucid-line)",
    },
  }[variant];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{
        background: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
      }}
    >
      {label}
    </span>
  );
}

function IndicatorRow({ ind }: { ind: PublicScorecardIndicator }) {
  const isInsufficient = ind.outcome === "insufficient_data";

  const scoreColor =
    ind.score !== null
      ? ind.score > 0
        ? "var(--lucid-pos)"
        : ind.score < 0
          ? "var(--lucid-neg)"
          : "var(--lucid-ink-2)"
      : "var(--lucid-ink-3)";
  const scoreBg =
    ind.score !== null
      ? ind.score > 0
        ? "var(--lucid-pos-bg)"
        : ind.score < 0
          ? "var(--lucid-neg-bg)"
          : "transparent"
      : "transparent";

  let surpriseColor = "var(--lucid-ink-3)";
  let surpriseBg = "transparent";
  if (
    ind.surprise !== null &&
    ind.surprise !== "0.0%" &&
    ind.surprise !== "0.0"
  ) {
    const isPos =
      ind.surprise.startsWith("+") && ind.surprise !== "+0.0%";
    const isNeg = ind.surprise.startsWith("-");
    if (isPos) {
      surpriseColor = "var(--lucid-pos)";
      surpriseBg = "var(--lucid-pos-bg)";
    } else if (isNeg) {
      surpriseColor = "var(--lucid-neg)";
      surpriseBg = "var(--lucid-neg-bg)";
    }
  }

  let actualColor = "var(--lucid-ink)";
  if (
    ind.surprise !== null &&
    ind.surprise !== "0.0%" &&
    ind.surprise !== "0.0"
  ) {
    if (ind.surprise.startsWith("+") && ind.surprise !== "+0.0%")
      actualColor = "var(--lucid-pos)";
    else if (ind.surprise.startsWith("-")) actualColor = "var(--lucid-neg)";
  }

  return (
    <tr
      className="transition-colors"
      style={{ borderBottom: "1px solid var(--lucid-line)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--lucid-surface-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <td
        className="py-2.5 px-3 text-[13px] font-medium"
        style={{ color: "var(--lucid-ink)" }}
      >
        <div className="flex items-center gap-2">
          {ind.name}
          {ind.staleDate && (
            <span
              className="text-[9px] font-medium px-1.5 py-0.5 rounded"
              style={{
                background: "var(--lucid-warn-bg)",
                color: "var(--lucid-warn)",
                border: "1px solid var(--lucid-warn-bd)",
              }}
            >
              {ind.staleDate}
            </span>
          )}
        </div>
      </td>
      <td
        className="lt-num py-2.5 px-3 text-[13px] font-semibold text-right"
        style={{ color: actualColor }}
      >
        {ind.actual ?? "—"}
      </td>
      <td
        className="lt-num py-2.5 px-3 text-[13px] text-right"
        style={{ color: "var(--lucid-ink-3)" }}
      >
        {ind.forecast ?? "—"}
      </td>
      <td
        className="lt-num py-2.5 px-3 text-[13px] text-right"
        style={{ color: "var(--lucid-ink-3)" }}
      >
        {ind.previous ?? "—"}
      </td>
      <td
        className="lt-num py-2.5 px-3 text-[13px] font-semibold text-right"
        style={{ color: surpriseColor, background: surpriseBg }}
      >
        {ind.surprise ?? "—"}
      </td>
      <td className="py-2.5 px-3 text-center">
        {isInsufficient ? (
          <span
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{
              background: "var(--lucid-warn-bg)",
              color: "var(--lucid-warn)",
              border: "1px solid var(--lucid-warn-bd)",
            }}
          >
            No data
          </span>
        ) : (
          <span
            className="lt-num inline-flex items-center justify-center w-8 py-0.5 rounded text-[11px] font-semibold"
            style={{ background: scoreBg, color: scoreColor }}
          >
            {ind.score === null
              ? "—"
              : ind.score > 0
                ? "+1"
                : ind.score < 0
                  ? "-1"
                  : "0"}
          </span>
        )}
      </td>
    </tr>
  );
}

function SectionCard({ section, delay = 0 }: { section: PublicScorecardSection; delay?: number }) {
  return (
    <div
      className="lt-card lt-edge lt-rise overflow-hidden"
      style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)", animationDelay: `${delay}s` }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--lucid-line)" }}
      >
        <span className="lt-eyebrow lt-serif" style={{ color: "var(--lucid-ink-2)" }}>
          {section.label}
        </span>
        <div className="flex items-center gap-2">
          <ScorePill score={section.subtotal} />
        </div>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
            <th className="lt-eyebrow text-left px-3 py-2">INDICATOR</th>
            <th className="lt-eyebrow text-right px-3 py-2">
              <span className="ml-auto">ACTUAL</span>
            </th>
            <th className="lt-eyebrow text-right px-3 py-2">
              <span className="ml-auto">FORECAST</span>
            </th>
            <th className="lt-eyebrow text-right px-3 py-2">
              <span className="ml-auto">PREVIOUS</span>
            </th>
            <th className="lt-eyebrow text-right px-3 py-2">
              <span className="ml-auto">SURPRISE</span>
            </th>
            <th className="lt-eyebrow px-3 py-2">
              <span className="mx-auto">SCORE</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {section.indicators.map((ind) => (
            <IndicatorRow key={ind.name} ind={ind} />
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default function ScorecardPage() {
  // Suspense-wrap because the inner uses useSearchParams (to preselect from
  // ?asset=), which forces a bailout from static prerendering unless
  // boundaries are explicit — same pattern the NIFTY scorecard page uses.
  return (
    <Suspense fallback={<ScorecardSkeleton />}>
      <ScorecardPageInner />
    </Suspense>
  );
}

function ScorecardPageInner() {
  // Missing ?asset= → today's default (USD), unchanged. Present but invalid
  // for this page → same default, silently — no error, no empty page.
  const [selectedKey, setSelectedKey] = useUrlSelectedKey<ScorecardAssetKey>(
    "asset",
    isScorecardAssetKey,
    "USD",
  );

  // Issue 1 fix: /api/oracle/assets is the screener projection — it has NEVER
  // contained standalone currencies (see instrument-registry.ts: "Currencies
  // are not screener rows — they are scorecard subjects"). Filtering it to
  // non-Forex only ever leaves Gold and the indices, which is exactly the
  // regression Phase 7 introduced by deriving membership from it. The
  // scorecard endpoint's actual valid-subject set is a different registry
  // projection (scorecardByKey), now exposed via /api/oracle/scorecard-subjects
  // — that is this picker's real membership source.
  const { data: subjects } = useScorecardSubjects();
  // Still read for live score/bias enrichment where it exists — Gold/SPY/
  // NAS100/US30 appear in the screener and get a real value; standalone
  // currencies never have and never will (they're not screener rows), so
  // their picker tabs correctly show no score, same as before Phase 7.
  const { data: allAssets } = useAssets();
  const scorecardQuery = useAssetScorecard(selectedKey);
  const { openScoreTrend } = useOracleTools();

  const asset = scorecardQuery.data;

  // Picker options: membership + flag from scorecard-subjects (the true
  // source), score/bias/deferred-note layered in from the screener list
  // where a match exists. Ordering (Currency, then Commodity, then Index) is
  // the one locally-kept display concern — membership is fully API-derived,
  // so a newly registered scorecard subject appears with zero edit here.
  const pickerOptions = useMemo<PickerOption[]>(
    () =>
      (subjects ?? [])
        .slice()
        .sort((a, b) => (ASSET_TYPE_ORDER[a.type] ?? 99) - (ASSET_TYPE_ORDER[b.type] ?? 99))
        .map((subj) => {
          const live = (allAssets ?? []).find((a) => toScorecardKey(a.asset) === subj.key);
          return {
            key: subj.key,
            label: subj.key,
            glyph: subj.flag,
            score: live?.score ?? null,
            bias: live?.bias ?? null,
            note: live?.outcome === "deferred" ? "Deferred" : null,
          };
        }),
    [subjects, allAssets],
  );

  // The error branch has no `asset` (the fetch that would have supplied
  // flag/name failed) but still needs an identity to show next to the
  // picker. selectedKey is one of the live picker options' keys once
  // useAssets resolves, so this reliably finds a match — the same fallback
  // ScorecardIdentityCard itself uses while a switch is pending.
  const selectedOption = pickerOptions.find((o) => o.key === selectedKey);

  return (
    <div className="p-4 sm:p-6" style={{ color: "var(--lucid-ink)" }}>
      {/* No standalone selector row — the score card's identity IS the picker. */}

      {/* Content area */}
      {scorecardQuery.error && !scorecardQuery.isLoading ? (
        /* ── Error state ─────────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          {/* The picker lives in EVERY outcome, not just the scored one. A
              failed fetch with no selector anywhere on the page is a dead
              end — you could select SPY, get a 400, and have no way back. */}
          <div className="w-full max-w-lg">
            <ScorecardIdentityCard
              score={null}
              bias={null}
              biasClass=""
              identity={<>{selectedOption?.glyph} {selectedOption?.label ?? selectedKey}</>}
              identityName={selectedOption?.label ?? selectedKey}
              pickerLabel="Asset"
              options={pickerOptions}
              value={selectedKey}
              onChange={(k) => setSelectedKey(k as ScorecardAssetKey)}
              recentStorageKey="lucid.recent.asset-scorecard"
            />
          </div>
          <ErrorState
            error={scorecardQuery.error}
            onRetry={() => scorecardQuery.refetch()}
          />
        </div>
      ) : (
      <ContentSwap
        data={asset}
        busy={scorecardQuery.isLoading}
        skeleton={<ScorecardSkeleton />}
        empty={<EmptyState title="No scorecard available" />}
      >
      {(asset, pending) => (
        asset.outcome === "deferred" ? (
        /* ── Deferred state ─────────────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          {/* The picker lives in EVERY outcome, not just the scored one. A
              deferred asset with no selector anywhere on the page is a dead
              end — you could select SPY and have no way back. */}
          <div className="w-full max-w-lg">
            <ScorecardIdentityCard
              score={null}
              bias={null}
              biasClass=""
              identity={<>{asset.flag} {asset.name}</>}
              identityName={asset.name}
              pending={pending}
              pickerLabel="Asset"
              options={pickerOptions}
              value={selectedKey}
              onChange={(k) => setSelectedKey(k as ScorecardAssetKey)}
              recentStorageKey="lucid.recent.asset-scorecard"
            />
          </div>
          <div
            className="lt-card p-10 max-w-lg w-full text-center flex flex-col items-center gap-4"
            style={{ borderColor: "var(--lucid-line-2)" }}
          >
            <span className="text-4xl">{asset.flag}</span>
            <div>
              <p
                className="lt-serif text-base font-semibold mb-1"
                style={{ color: "var(--lucid-ink-2)" }}
              >
                {asset.name}
              </p>
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: "var(--lucid-surface-3)",
                  color: "var(--lucid-ink-3)",
                  border: "1px solid var(--lucid-line-2)",
                }}
              >
                Scoring deferred
              </span>
            </div>
            {asset.reason && (
              <p
                className="text-sm leading-relaxed max-w-sm"
                style={{ color: "var(--lucid-ink-3)" }}
              >
                {asset.reason}
              </p>
            )}
          </div>
        </div>
      ) : asset.outcome === "insufficient_data" ? (
        /* ── Insufficient data state ─────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          {/* The picker lives in EVERY outcome, not just the scored one. A
              deferred asset with no selector anywhere on the page is a dead
              end — you could select SPY and have no way back. */}
          <div className="w-full max-w-lg">
            <ScorecardIdentityCard
              score={null}
              bias={null}
              biasClass=""
              identity={<>{asset.flag} {asset.name}</>}
              identityName={asset.name}
              pending={pending}
              pickerLabel="Asset"
              options={pickerOptions}
              value={selectedKey}
              onChange={(k) => setSelectedKey(k as ScorecardAssetKey)}
              recentStorageKey="lucid.recent.asset-scorecard"
            />
          </div>
          <div
            className="lt-card p-10 max-w-lg w-full text-center flex flex-col items-center gap-4"
            style={{
              borderColor: "var(--lucid-warn-bd)",
              background: "var(--lucid-warn-bg)",
            }}
          >
            <span className="text-4xl">{asset.flag}</span>
            <div>
              <p
                className="lt-serif text-base font-semibold mb-1"
                style={{ color: "var(--lucid-ink-2)" }}
              >
                {asset.name}
              </p>
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: "var(--lucid-warn-bg)",
                  color: "var(--lucid-warn)",
                  border: "1px solid var(--lucid-warn-bd)",
                }}
              >
                Data unavailable
              </span>
            </div>
            {asset.reason && (
              <p
                className="text-sm leading-relaxed max-w-sm"
                style={{ color: "var(--lucid-ink-3)" }}
              >
                {asset.reason}
              </p>
            )}
          </div>
        </div>
      ) : (
        /* ── Scored — full layout ────────────────────────────────────── */
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* LEFT PANEL */}
          <div className="lt-rise lt-stagger-2 w-full lg:w-70 lg:shrink-0 flex flex-col gap-4">
            {/* Score & Bias — and the asset picker. Same gauge, same bias pill,
                same flag and name; the identity block is now the trigger. */}
            <ScorecardIdentityCard
              score={asset.totalScore}
              bias={asset.bias}
              biasClass={asset.bias ? getBiasPillClass(asset.bias as BiasType) : ""}
              identity={<>{asset.flag} {asset.name}</>}
              identityName={asset.name}
              pending={pending}
              pickerLabel="Asset"
              options={pickerOptions}
              value={selectedKey}
              onChange={(k) => setSelectedKey(k as ScorecardAssetKey)}
              recentStorageKey="lucid.recent.asset-scorecard"
            />

            {/* Everything below the identity is a value being replaced during a
                switch, so it ghosts as one block. */}
            <div className={`lx-swap flex flex-col gap-4 ${pending ? "lx-swap-busy" : ""}`}>
            {/* Score History Chart — opens the trajectory view */}
            {asset.scoreHistory && asset.scoreHistory.length > 0 && (
              <ScoreHistoryTrigger
                data={asset.scoreHistory}
                onOpen={() => openScoreTrend(asset.key)}
                subjectName={asset.name}
              />
            )}

            {/* Score breakdown */}
            <div className="lt-card p-4">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                  COT Score
                </span>
                {asset.cotScore !== null ? (
                  <span
                    className="lt-num inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{
                      background: "var(--lucid-accent-bg)",
                      color: "var(--lucid-accent)",
                      border: "1px solid var(--lucid-accent-bd)",
                    }}
                  >
                    {asset.cotScore > 0
                      ? `+${asset.cotScore}`
                      : asset.cotScore}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                    —
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                  Fundamentals
                </span>
                {asset.fundamentals !== null ? (
                  <ScorePill score={asset.fundamentals} />
                ) : (
                  <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                    —
                  </span>
                )}
              </div>
              <div
                className="my-2"
                style={{ borderTop: "1px solid var(--lucid-line)" }}
              />
              <div className="flex items-center justify-between py-1">
                <span
                  className="text-xs font-semibold"
                  style={{ color: "var(--lucid-ink-2)" }}
                >
                  Total Score
                </span>
                {asset.totalScore !== null ? (
                  <span
                    className="lt-num text-lg font-bold"
                    style={{ color: scoreToken(asset.totalScore) }}
                  >
                    {asset.totalScore > 0
                      ? `+${asset.totalScore}`
                      : asset.totalScore}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                    —
                  </span>
                )}
              </div>
            </div>

            {/* COT detail */}
            {asset.cot && (
              <div className="lt-card p-4">
                <p className="lt-eyebrow mb-3">INSTITUTIONAL ACTIVITY</p>
                <div className="flex flex-col gap-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                      Net Positioning
                    </span>
                    <SmallPill
                      label={asset.cot.netPositioning}
                      variant={
                        asset.cot.netPositioning === "Bullish"
                          ? "bullish"
                          : asset.cot.netPositioning === "Bearish"
                            ? "bearish"
                            : "neutral"
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                      Weekly Change
                    </span>
                    <SmallPill
                      label={asset.cot.weeklyChange}
                      variant={
                        asset.cot.weeklyChange === "Bullish"
                          ? "bullish"
                          : asset.cot.weeklyChange === "Bearish"
                            ? "bearish"
                            : "neutral"
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                      COT Score
                    </span>
                    <span
                      className="lt-num text-xs font-semibold"
                      style={{
                        color:
                          asset.cot.cotScore > 0
                            ? "var(--lucid-pos)"
                            : asset.cot.cotScore < 0
                              ? "var(--lucid-neg)"
                              : "var(--lucid-ink-2)",
                      }}
                    >
                      {asset.cot.cotScore > 0
                        ? `+${asset.cot.cotScore}`
                        : asset.cot.cotScore}
                    </span>
                  </div>
                </div>
                <div
                  className="my-2"
                  style={{
                    borderTop: "1px solid var(--lucid-line)",
                  }}
                />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="text-center">
                    <p
                      className="text-[10px] mb-0.5"
                      style={{ color: "var(--lucid-ink-3)" }}
                    >
                      Long %
                    </p>
                    <p
                      className="lt-num text-xs font-semibold"
                      style={{ color: "var(--lucid-pos)" }}
                    >
                      {asset.cot.longPct}
                    </p>
                  </div>
                  <div className="text-center">
                    <p
                      className="text-[10px] mb-0.5"
                      style={{ color: "var(--lucid-ink-3)" }}
                    >
                      Short %
                    </p>
                    <p
                      className="lt-num text-xs font-semibold"
                      style={{ color: "var(--lucid-neg)" }}
                    >
                      {asset.cot.shortPct}
                    </p>
                  </div>
                  <div className="text-center">
                    <p
                      className="text-[10px] mb-0.5"
                      style={{ color: "var(--lucid-ink-3)" }}
                    >
                      Δ Weekly
                    </p>
                    <p
                      className="lt-num text-xs font-semibold"
                      style={{
                        color: asset.cot.deltaWeekly.startsWith("+")
                          ? "var(--lucid-pos)"
                          : asset.cot.deltaWeekly.startsWith("-")
                            ? "var(--lucid-neg)"
                            : "var(--lucid-ink-2)",
                      }}
                    >
                      {asset.cot.deltaWeekly}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Last updated */}
            <p
              className="text-[10px] text-center"
              style={{ color: "var(--lucid-ink-3)" }}
            >
              Last updated: {formatUpdated(asset.lastUpdated)}
            </p>
            </div>
          </div>

          {/* RIGHT PANEL — indicator tables ghost during a switch too. */}
          <div
            className={`lt-rise lt-stagger-3 lx-swap flex-1 flex flex-col gap-4 min-w-0 ${pending ? "lx-swap-busy" : ""}`}
          >
            {asset.sections.map((section, idx) => (
              <SectionCard key={section.label} section={section} delay={Math.min(idx * 0.08, 0.4)} />
            ))}

            {/* Per-indicator drilldown flag */}
            <p className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
              Per-indicator history drilldown pending a backend indicator-code field.
            </p>

            {/* Lucid Outlook placeholder */}
            <div
              className="lt-card p-4 sm:p-6"
              style={{
                background: "var(--lucid-accent-bg)",
                borderColor: "var(--lucid-accent-bd)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🤖</span>
                <span className="lt-eyebrow lt-serif" style={{ color: "var(--lucid-accent)" }}>
                  LUCID OUTLOOK
                </span>
              </div>
              <p
                className="text-sm leading-relaxed mb-4"
                style={{ color: "var(--lucid-ink-3)" }}
              >
                AI-powered qualitative macro analysis for this asset — Fed
                commentary, geopolitical developments, rate trajectory signals,
                and global risk factors interpreted through your trading lens.
              </p>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: "var(--lucid-accent-bg)",
                  color: "var(--lucid-accent)",
                  border: "1px solid var(--lucid-accent-bd)",
                }}
              >
                ⚡ Coming in Phase 4
              </span>
            </div>
          </div>
        </div>
      )
      )}
      </ContentSwap>
      )}
    </div>
  );
}
