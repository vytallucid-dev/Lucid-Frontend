"use client";

import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Zap,
  ShieldAlert,
  Gauge,
  Landmark,
} from "lucide-react";
import { useCompass } from "@/hooks/useCompass";
import type {
  CompassBand,
  CompassRegime,
  PublicCompassInput,
  PublicCompassScoreImpactRow,
  PublicCompassHistoryRow,
  PublicCompassSnapshot,
  PublicCompassSubCheck,
  PublicCompassGateState,
  PublicCompassOverrideState,
} from "@/lib/api/oracle";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// Lucid Compass (v2) — wired to GET /api/oracle/compass (one batched, daily-
// cached snapshot). The live data drives every section: the FINAL regime (which
// differs from the standard machine's active regime under a Trigger A shock),
// the 6 v2 input votes with staleness flags, classification math, the two Phase
// 6 override gates (8A rate gate on JPY Overrides 3 & 5; 8B fed-constraint gate
// on gold Override 2), the post-gate override set, the base-vs-final score
// impact, and the 30-day history. Static copy below (input descriptions,
// override summaries, asset flags) is presentation metadata with no DB home.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Static presentation metadata (keyed by backend codes) ──────────────────

const INPUT_META: Record<string, { name: string; description: string; threshold: string }> = {
  VIX_5D_AVG: {
    name: "VIX (5-Day Average)",
    description: "Market fear gauge — 5-day closing average",
    threshold: "< 18 = Green · 18–25 = Yellow · > 25 = Red",
  },
  VIX_TERM_STRUCTURE: {
    name: "VIX Term Structure",
    description: "VIX ÷ VIX3M — backwardation signals acute stress",
    threshold: "< 0.90 contango = Green · 0.90–1.00 = Yellow · > 1.00 backwardation = Red",
  },
  HY_OAS: {
    name: "HY OAS (High Yield Credit Spreads)",
    description: "Corporate bond stress — level + 10-obs velocity",
    threshold: "< 450bp & calm = Green · 450–550bp or widening = Yellow · > 550bp or fast widening = Red",
  },
  YIELD_2S10S: {
    name: "2s10s Yield Curve",
    description: "Treasury curve slope — inversion-episode state machine",
    threshold: "Positive & steepening = Green · Inverted stable = Yellow · Inside post-inversion red window = Red",
  },
  DXY_TREND: {
    name: "DXY Trend",
    description: "Dollar index distance from 50-day MA + 5-obs move",
    threshold: "Calm & near MA = Green · Drifted from MA = Yellow · Sharp break > 3% in 5 obs = Red",
  },
  US_DATA_STACK: {
    name: "US Data Trend Stack",
    description: "Composite of CPI trajectory + GDP level + Sahm Rule jobs",
    threshold: "2 of 3 Green = Green · Mixed = Yellow · 2 of 3 Red = Red",
  },
};

interface OverrideDef {
  id: number;
  code: string;
  name: string;
  affected: string[];
  summary: string;
  changes: string[];
  note?: string;
  /** Which gate can suppress this override, for the display. */
  gate: "rate" | "fed" | null;
}

const OVERRIDES: OverrideDef[] = [
  {
    id: 1,
    code: "OVERRIDE_1_BAD_NEWS_GOOD_NEWS",
    name: "Bad News Good News (Stocks)",
    affected: ["SPY", "NAS100"],
    summary: "Weak US jobs data inverts for equity scoring — Fed pivot trade.",
    changes: ["NFP miss: −1 → +1", "Higher unemployment: −1 → +1", "ADP/JOLTS/claims miss: −1 → +1"],
    note: "Ungated. CPI/PPI/PCE direction unchanged — inflation still hurts stocks via discount rate.",
    gate: null,
  },
  {
    id: 2,
    code: "OVERRIDE_2_GOLD_INFLATION_HEDGE",
    name: "Gold Inflation Hedge",
    affected: ["XAUUSD"],
    summary: "Gold's inflation rules flip — real-yields channel breaks in stress.",
    changes: ["CPI beat: −1 → +1", "PPI beat: −1 → +1", "PCE beat: −1 → +1"],
    note: "Gated by Fed constraint (8B): applies only when the Fed is CONSTRAINED.",
    gate: "fed",
  },
  {
    id: 3,
    code: "OVERRIDE_3_JPY_SAFE_HAVEN",
    name: "JPY Safe-Haven Boost",
    affected: ["JPY", "USDJPY", "EURJPY", "GBPJPY"],
    summary: "+1 added to JPY standalone score — carry trades unwinding.",
    changes: ["Propagates to pairs: USDJPY −1, EURJPY −1, GBPJPY −1"],
    note: "Gated by the rate gate (8A): suppressed when US2Y is above its 21d SMA, unless a Carry Shock bypasses.",
    gate: "rate",
  },
  {
    id: 4,
    code: "OVERRIDE_4_USD_WEAK_JOBS",
    name: "USD Weak-Jobs Neutralization",
    affected: ["USD"],
    summary: "USD jobs weakness softened — safe-haven flows competing with dovish expectations.",
    changes: ["NFP/unemployment/claims/ADP/JOLTS miss: −1 → 0"],
    note: "Ungated.",
    gate: null,
  },
  {
    id: 5,
    code: "OVERRIDE_5_CARRY_UNWIND",
    name: "Carry Unwind",
    affected: ["EURJPY", "GBPJPY"],
    summary: "Automatic −1 adjustment on top of Override 3.",
    changes: ["Total Risk-Off effect on EURJPY/GBPJPY: −2 combined."],
    note: "Gated by the same rate gate (8A) as Override 3.",
    gate: "rate",
  },
];

const ASSET_META: Record<string, { flag: string; order: number }> = {
  EURUSD: { flag: "🇪🇺", order: 1 },
  GBPUSD: { flag: "🇬🇧", order: 2 },
  USDJPY: { flag: "🇯🇵", order: 3 },
  EURJPY: { flag: "🇪🇺", order: 4 },
  GBPJPY: { flag: "🇬🇧", order: 5 },
  XAUUSD: { flag: "🥇", order: 6 },
  SPY: { flag: "🇺🇸", order: 7 },
  NAS100: { flag: "🇺🇸", order: 8 },
  USD: { flag: "🇺🇸", order: 9 },
  EUR: { flag: "🇪🇺", order: 10 },
  GBP: { flag: "🇬🇧", order: 11 },
  JPY: { flag: "🇯🇵", order: 12 },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── Visual tokens (warm "lucid" theme — see src/styles/lucid-theme.css) ─────

const CLS: Record<CompassBand, { color: string; bg: string; border: string }> = {
  GREEN: { color: "var(--lucid-pos)", bg: "var(--lucid-pos-bg)", border: "var(--lucid-pos-bd)" },
  YELLOW: { color: "var(--lucid-warn)", bg: "var(--lucid-warn-bg)", border: "var(--lucid-warn-bd)" },
  RED: { color: "var(--lucid-neg)", bg: "var(--lucid-neg-bg)", border: "var(--lucid-neg-bd)" },
};

const REGIME_META: Record<CompassRegime, { color: string; bg: string; border: string; desc: string }> = {
  "Risk-On": {
    color: "var(--lucid-pos)",
    bg: "var(--lucid-pos-bg)",
    border: "var(--lucid-pos-bd)",
    desc: "All base scoring rules active. Trade with full conviction.",
  },
  Caution: {
    color: "var(--lucid-warn)",
    bg: "var(--lucid-warn-bg)",
    border: "var(--lucid-warn-bd)",
    desc: "Mixed signals. No overrides active. Reduce conviction sizing manually.",
  },
  "Risk-Off": {
    color: "var(--lucid-neg)",
    bg: "var(--lucid-neg-bg)",
    border: "var(--lucid-neg-bd)",
    desc: "Stress regime active. Scoring overrides applied, subject to the rate & fed gates below.",
  },
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

function fmt1(n: number): string {
  return n.toFixed(1);
}
function fmt2(n: number): string {
  return n.toFixed(2);
}
function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
function formatAuditDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}`;
}

function scoreVisual(score: number): { color: string; bg: string; border: string; label: string } {
  if (score >= 5) return { color: "var(--lucid-scale-4)", bg: "rgba(78,161,230,0.14)", border: "rgba(78,161,230,0.3)", label: "Strong Bullish" };
  if (score >= 3) return { color: "var(--lucid-scale-3)", bg: "rgba(72,186,124,0.12)", border: "rgba(72,186,124,0.25)", label: "Bullish" };
  if (score >= -2) return { color: "var(--lucid-scale-2)", bg: "rgba(205,167,79,0.1)", border: "rgba(205,167,79,0.2)", label: "Neutral" };
  if (score >= -4) return { color: "var(--lucid-scale-1)", bg: "rgba(224,145,63,0.12)", border: "rgba(224,145,63,0.25)", label: "Bearish" };
  return { color: "var(--lucid-scale-0)", bg: "rgba(226,88,77,0.14)", border: "rgba(226,88,77,0.3)", label: "Strong Bearish" };
}

type Current = PublicCompassSnapshot["current"];

// ─── Small presentational primitives ─────────────────────────────────────────

function StatusDot({ c }: { c: CompassBand }) {
  return <span className="inline-block rounded-full shrink-0" style={{ width: 16, height: 16, background: CLS[c].color }} />;
}

function ClassPill({ c, size = "md" }: { c: CompassBand; size?: "sm" | "md" }) {
  const m = CLS[c];
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"}`}
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}
    >
      {c}
    </span>
  );
}

function RegimePill({ r, size = "md" }: { r: CompassRegime; size?: "sm" | "md" }) {
  const m = REGIME_META[r];
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"}`}
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}
    >
      {r}
    </span>
  );
}

function WeightBadge({ w }: { w: number }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "1px solid var(--lucid-accent-bd)" }}
    >
      Weight: <span className="lt-num ml-1">{fmt1(w)}</span>
    </span>
  );
}

/** Small stale / insufficient-history chip on an input row. */
function StaleChip({ stale, insufficient }: { stale: boolean; insufficient: boolean }) {
  if (!stale && !insufficient) return null;
  const text = insufficient ? "Insufficient history" : "Stale — forward-filled beyond limit";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap"
      style={{ background: "var(--lucid-warn-bg)", color: "var(--lucid-warn)", border: "1px solid var(--lucid-warn-bd)" }}
      title={text}
    >
      <AlertCircle size={11} />
      {insufficient ? "No history" : "Stale"}
    </span>
  );
}

function StabilityPill({ current }: { current: Current }) {
  const cfg =
    current.pendingLabel !== null && current.pendingCount > 0
      ? {
          color: "var(--lucid-warn)",
          bg: "var(--lucid-warn-bg)",
          border: "var(--lucid-warn-bd)",
          text: `Pending — ${current.pendingCount} of ${current.required} days toward ${current.pendingLabel}`,
          pulse: false,
        }
      : {
          color: "var(--lucid-pos)",
          bg: "var(--lucid-pos-bg)",
          border: "var(--lucid-pos-bd)",
          text: `Stable for ${current.daysStable} day${current.daysStable === 1 ? "" : "s"}`,
          pulse: false,
        };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      <span className={`inline-block rounded-full ${cfg.pulse ? "pulse-live" : ""}`} style={{ width: 7, height: 7, background: cfg.color }} />
      {cfg.text}
    </span>
  );
}

/** Shock banner — Trigger A (Vol Shock → Risk-Off) or Trigger B (Carry Shock). */
function ShockBanner({ gate }: { gate: PublicCompassGateState }) {
  if (!gate.shockAActive && !gate.shockBActive) return null;
  const items: { icon: ReactNode; label: string; detail: string; color: string; bg: string; bd: string }[] = [];
  if (gate.shockAActive) {
    items.push({
      icon: <ShieldAlert size={16} />,
      label: "VOL SHOCK — Risk-Off forced",
      detail: gate.shockAExpiry ? `Trigger A active through ${gate.shockAExpiry}` : "Trigger A active",
      color: "var(--lucid-neg)",
      bg: "var(--lucid-neg-bg)",
      bd: "var(--lucid-neg-bd)",
    });
  }
  if (gate.shockBActive) {
    items.push({
      icon: <Zap size={16} />,
      label: "CARRY SHOCK",
      detail: gate.shockBExpiry
        ? `Trigger B active through ${gate.shockBExpiry} — JPY overrides bypass the rate gate`
        : "Trigger B active — JPY overrides bypass the rate gate",
      color: "var(--lucid-accent)",
      bg: "var(--lucid-accent-bg)",
      bd: "var(--lucid-accent-bd)",
    });
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 flex-1 min-w-0"
          style={{ background: it.bg, border: `1px solid ${it.bd}` }}
        >
          <span className="pulse-live shrink-0" style={{ color: it.color }}>
            {it.icon}
          </span>
          <div className="min-w-0">
            <div className="text-xs font-bold" style={{ color: it.color }}>
              {it.label}
            </div>
            <div className="text-[11px]" style={{ color: "var(--lucid-ink-2)" }}>
              {it.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniLabel({ children }: { children: ReactNode }) {
  return <span className="lt-eyebrow lg:hidden block mb-1">{children}</span>;
}

// ─── Section 1 — Hero ────────────────────────────────────────────────────────

function VoteBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="font-medium" style={{ color }}>
          {label}
        </span>
        <span className="lt-num font-semibold" style={{ color }}>
          {fmt1(value)}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--lucid-surface-3)" }}>
        <div className="lt-bar h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** The standard vote rule (no shock/gate) — describes how the votes classify. */
function voteRuleText(current: Current): { regime: CompassRegime; rule: string } {
  const { green, red } = current.weights;
  const t = current.thresholds;
  if (red >= t.redRiskOffAt) return { regime: "Risk-Off", rule: `Red ${fmt1(red)} ≥ ${fmt1(t.redRiskOffAt)}` };
  if (green >= t.greenRiskOnAt && red <= t.redRiskOnCeiling)
    return { regime: "Risk-On", rule: `Green ${fmt1(green)} ≥ ${fmt1(t.greenRiskOnAt)} · Red ${fmt1(red)} ≤ ${fmt1(t.redRiskOnCeiling)}` };
  return { regime: "Caution", rule: `Green ${fmt1(green)} < ${fmt1(t.greenRiskOnAt)} · Red ${fmt1(red)} < ${fmt1(t.redRiskOffAt)}` };
}

function VoteSummary({ current }: { current: Current }) {
  const w = current.weights;
  const { regime, rule } = voteRuleText(current);
  const meta = REGIME_META[regime];
  return (
    <div className="w-full lg:w-80 xl:w-96 shrink-0 rounded-xl p-4 sm:p-5" style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}>
      <div className="flex items-center justify-between mb-4">
        <span className="lt-eyebrow">Vote Breakdown</span>
        <span className="text-[11px] lt-num" style={{ color: "var(--lucid-ink-3)" }}>
          Total {fmt1(w.total)}
        </span>
      </div>
      <VoteBar label="GREEN" value={w.green} max={w.total} color="var(--lucid-pos)" />
      <VoteBar label="YELLOW" value={w.yellow} max={w.total} color="var(--lucid-warn)" />
      <VoteBar label="RED" value={w.red} max={w.total} color="var(--lucid-neg)" />
      <div className="mt-4 pt-3 flex items-start gap-1.5 text-xs" style={{ borderTop: "1px solid var(--lucid-line)" }}>
        <span style={{ color: meta.color }}>✓</span>
        <span style={{ color: "var(--lucid-ink-2)" }}>
          Vote →{" "}
          <span className="font-bold" style={{ color: meta.color }}>
            {regime.toUpperCase()}
          </span>{" "}
          <span style={{ color: "var(--lucid-ink-3)" }}>({rule})</span>
        </span>
      </div>
    </div>
  );
}

function RegimeHero({ current, gate }: { current: Current; gate: PublicCompassGateState }) {
  // The hero shows the FINAL regime — Risk-Off under a Trigger A shock.
  const regime = current.finalRegime;
  const meta = REGIME_META[regime];
  const shockLabel = gate.shockAActive ? "Risk-Off (SHOCK)" : regime;
  const standardDiffers = current.activeRegime !== regime;
  return (
    <div
      className={`lt-card lt-edge lt-rise lt-stagger-2 p-6 sm:p-10${regime === "Risk-Off" ? " compass-pulse-glow" : ""}`}
      style={{ background: `radial-gradient(120% 140% at 0% 0%, ${meta.bg}, transparent 55%), var(--lucid-grad-surface)`, boxShadow: "var(--lucid-elev-1)" }}
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <span className="lt-eyebrow block mb-3">Current Regime</span>
          <h2 className="lt-serif text-4xl sm:text-5xl font-bold leading-none" style={{ color: meta.color }}>
            {shockLabel}
          </h2>
          <p className="mt-5 text-sm sm:text-base max-w-xl" style={{ color: "var(--lucid-ink-2)" }}>
            {meta.desc}
          </p>
          {standardDiffers && (
            <p className="mt-3 text-xs" style={{ color: "var(--lucid-ink-3)" }}>
              Standard machine regime is{" "}
              <span style={{ color: REGIME_META[current.activeRegime].color }}>{current.activeRegime}</span> — the shock forces the final regime to Risk-Off.
            </p>
          )}
          <p className="mt-3 text-xs" style={{ color: "var(--lucid-ink-3)" }}>
            Stable <span className="lt-num" style={{ color: "var(--lucid-ink-2)" }}>{current.daysStable}</span> day{current.daysStable === 1 ? "" : "s"}
            {current.pendingLabel !== null && current.pendingCount > 0 && (
              <>
                {" · "}
                <span className="lt-num" style={{ color: "var(--lucid-ink-2)" }}>{current.pendingCount}</span>/{current.required} days toward{" "}
                <span style={{ color: REGIME_META[current.pendingLabel].color }}>{current.pendingLabel}</span>
              </>
            )}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <StabilityPill current={current} />
            {current.candidateRegime !== current.activeRegime && (
              <span className="text-[11px]" style={{ color: "var(--lucid-ink-3)" }}>
                today&apos;s vote →{" "}
                <span style={{ color: REGIME_META[current.candidateRegime].color }}>{current.candidateRegime}</span>
              </span>
            )}
          </div>
        </div>
        <VoteSummary current={current} />
      </div>
    </div>
  );
}

// ─── Section 2 — Input vote rows ─────────────────────────────────────────────

function SubCheckRow({ sc }: { sc: PublicCompassSubCheck }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3 text-xs">
      <span className="sm:w-44 shrink-0 font-medium" style={{ color: "var(--lucid-ink-3)" }}>{sc.name}</span>
      <span className="sm:w-48 shrink-0 lt-num" style={{ color: "var(--lucid-ink)" }}>{sc.value}</span>
      <span className="sm:flex-1" style={{ color: "var(--lucid-ink-3)" }}>{sc.detail}</span>
      <ClassPill c={sc.colorBand} size="sm" />
    </div>
  );
}

function stackAggLine(subChecks: PublicCompassSubCheck[], overall: CompassBand): string {
  const g = subChecks.filter((s) => s.colorBand === "GREEN").length;
  const y = subChecks.filter((s) => s.colorBand === "YELLOW").length;
  const r = subChecks.filter((s) => s.colorBand === "RED").length;
  const parts: string[] = [];
  if (g) parts.push(`${g} Green`);
  if (y) parts.push(`${y} Yellow`);
  if (r) parts.push(`${r} Red`);
  return `${parts.join(" + ")} → US Data Stack = ${overall}`;
}

function InputRow({ input, expanded, onToggle }: { input: PublicCompassInput; expanded: boolean; onToggle: () => void }) {
  const meta = INPUT_META[input.code] ?? { name: input.code, description: "", threshold: "" };
  const subChecks = input.subChecks;
  const expandable = !!subChecks && subChecks.length > 0;
  const value = input.displayValue + (input.displayDetail ? ` · ${input.displayDetail}` : "");

  return (
    <div className="rounded-xl p-3 sm:p-4" style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="pt-1">
          <StatusDot c={input.colorBand} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="lg:flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold" style={{ color: "var(--lucid-ink)" }}>{meta.name}</span>
                <StaleChip stale={input.stale} insufficient={input.insufficientHistory} />
                {expandable && (
                  <button
                    type="button"
                    onClick={onToggle}
                    className="inline-flex items-center justify-center rounded-md transition-colors hover:bg-(--lucid-line)"
                    style={{ width: 22, height: 22, color: "var(--lucid-ink-3)" }}
                    aria-label={expanded ? "Collapse sub-checks" : "Expand sub-checks"}
                  >
                    {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                )}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>{meta.description}</div>
            </div>
            <div className="lg:w-44 shrink-0">
              <MiniLabel>Current</MiniLabel>
              <div className="font-semibold lt-num text-sm" style={{ color: "var(--lucid-ink)" }}>{value}</div>
            </div>
            <div className="lg:w-80 shrink-0">
              <MiniLabel>Threshold</MiniLabel>
              <div className="text-[11px] leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>{meta.threshold}</div>
            </div>
            <div className="flex items-center justify-between gap-3 lg:w-44 lg:justify-end shrink-0">
              <ClassPill c={input.colorBand} />
              <WeightBadge w={input.weight} />
            </div>
          </div>
          {expandable && expanded && (
            <div className="mt-4 pt-4 space-y-2.5" style={{ borderTop: "1px solid var(--lucid-line)" }}>
              {subChecks.map((sc) => (
                <SubCheckRow key={sc.name} sc={sc} />
              ))}
              <div className="text-xs pt-2" style={{ color: "var(--lucid-ink-2)" }}>
                <span style={{ color: "var(--lucid-ink-3)" }}>Aggregation: </span>
                {stackAggLine(subChecks, input.colorBand)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section 3 — Classification logic table ──────────────────────────────────

function LogicCell({ active, value, color }: { active: boolean; value: number; color: string }) {
  return (
    <td className="px-3 py-2.5 text-right lt-num" style={{ color: active ? color : "var(--lucid-ink-3)" }}>
      {active ? fmt1(value) : "—"}
    </td>
  );
}

function ClassificationLogic({ current, inputs }: { current: Current; inputs: PublicCompassInput[] }) {
  const w = current.weights;
  const t = current.thresholds;
  const { regime } = voteRuleText(current);
  const meta = REGIME_META[regime];

  const result =
    w.red >= t.redRiskOffAt
      ? `✓ RED ${fmt1(w.red)} ≥ ${fmt1(t.redRiskOffAt)} → RISK-OFF`
      : w.green >= t.greenRiskOnAt && w.red <= t.redRiskOnCeiling
        ? `✓ GREEN ${fmt1(w.green)} ≥ ${fmt1(t.greenRiskOnAt)} AND RED ${fmt1(w.red)} ≤ ${fmt1(t.redRiskOnCeiling)} → RISK-ON`
        : `Neither threshold met — GREEN ${fmt1(w.green)} < ${fmt1(t.greenRiskOnAt)} and RED ${fmt1(w.red)} < ${fmt1(t.redRiskOffAt)} → CAUTION`;

  return (
    <div className="lt-card lt-edge lt-rise lt-stagger-4 p-4 sm:p-5" style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}>
      <h2 className="lt-eyebrow mb-4">Classification Result</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 560 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--lucid-line-2)" }}>
              <th className="px-3 py-2.5 text-left lt-eyebrow">Input</th>
              <th className="px-3 py-2.5 text-left lt-eyebrow">Classification</th>
              <th className="px-3 py-2.5 text-right lt-eyebrow">Weight</th>
              <th className="px-3 py-2.5 text-right lt-eyebrow" style={{ color: "var(--lucid-pos)" }}>Green</th>
              <th className="px-3 py-2.5 text-right lt-eyebrow" style={{ color: "var(--lucid-warn)" }}>Yellow</th>
              <th className="px-3 py-2.5 text-right lt-eyebrow" style={{ color: "var(--lucid-neg)" }}>Red</th>
            </tr>
          </thead>
          <tbody>
            {inputs.map((i) => {
              const name = (INPUT_META[i.code]?.name ?? i.code).replace(/ \(.*\)$/, "");
              return (
                <tr key={i.code} style={{ borderBottom: "1px solid var(--lucid-line)" }}>
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap" style={{ color: "var(--lucid-ink)" }}>{name}</td>
                  <td className="px-3 py-2.5">
                    <ClassPill c={i.colorBand} size="sm" />
                  </td>
                  <td className="px-3 py-2.5 text-right lt-num" style={{ color: "var(--lucid-ink-2)" }}>{fmt1(i.weight)}</td>
                  <LogicCell active={i.colorBand === "GREEN"} value={i.weight} color="var(--lucid-pos)" />
                  <LogicCell active={i.colorBand === "YELLOW"} value={i.weight} color="var(--lucid-warn)" />
                  <LogicCell active={i.colorBand === "RED"} value={i.weight} color="var(--lucid-neg)" />
                </tr>
              );
            })}
            <tr style={{ borderTop: "1px solid var(--lucid-line-3)" }}>
              <td className="px-3 py-2.5 lt-eyebrow" style={{ color: "var(--lucid-ink-2)" }}>Totals</td>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-right lt-num font-semibold" style={{ color: "var(--lucid-ink)" }}>{fmt1(w.total)}</td>
              <td className="px-3 py-2.5 text-right lt-num font-semibold" style={{ color: "var(--lucid-pos)" }}>{fmt1(w.green)}</td>
              <td className="px-3 py-2.5 text-right lt-num font-semibold" style={{ color: "var(--lucid-warn)" }}>{fmt1(w.yellow)}</td>
              <td className="px-3 py-2.5 text-right lt-num font-semibold" style={{ color: "var(--lucid-neg)" }}>{fmt1(w.red)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-1.5 text-xs" style={{ color: "var(--lucid-ink-3)" }}>
        <p>
          <span style={{ color: "var(--lucid-pos)" }}>RISK-ON</span> requires: Green ≥ {fmt1(t.greenRiskOnAt)} AND Red ≤ {fmt1(t.redRiskOnCeiling)}
        </p>
        <p>
          <span style={{ color: "var(--lucid-neg)" }}>RISK-OFF</span> requires: Red ≥ {fmt1(t.redRiskOffAt)} OR a Vol Shock (Trigger A)
        </p>
        <p>
          <span style={{ color: "var(--lucid-warn)" }}>CAUTION</span> otherwise. Regime changes need a {t.daysToHigherSeverity}-day streak toward higher severity ({t.daysToLowerSeverity} toward lower) before they take effect.
        </p>
      </div>

      <div className="mt-3 rounded-lg px-3 py-2.5 text-xs font-semibold" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
        RESULT: {result}
        {current.candidateRegime !== current.activeRegime && (
          <span style={{ color: "var(--lucid-ink-2)", fontWeight: 400 }}>
            {" "}· active regime still {current.activeRegime} ({current.pendingCount}/{current.required} days toward change)
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Section 4 — Override gates (Addenda 8A / 8B) ─────────────────────────────

function GateCard({
  icon,
  title,
  status,
  statusColor,
  statusBg,
  statusBd,
  children,
}: {
  icon: ReactNode;
  title: string;
  status: string;
  statusColor: string;
  statusBg: string;
  statusBd: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl p-4 flex-1 min-w-0" style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color: "var(--lucid-accent)" }}>{icon}</span>
          <span className="font-semibold text-sm" style={{ color: "var(--lucid-ink)" }}>{title}</span>
        </div>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap"
          style={{ background: statusBg, color: statusColor, border: `1px solid ${statusBd}` }}
        >
          {status}
        </span>
      </div>
      <div className="text-xs space-y-1" style={{ color: "var(--lucid-ink-2)" }}>{children}</div>
    </div>
  );
}

function OverrideGates({ gate }: { gate: PublicCompassGateState }) {
  // 8A rate gate status
  const rateHawkish = gate.rateGateHawkish;
  const rateBypassed = gate.shockBActive; // Carry Shock bypasses a hawkish gate
  const rateStatus = rateHawkish
    ? rateBypassed
      ? "HAWKISH (bypassed)"
      : "HAWKISH"
    : "NOT HAWKISH";
  const rateColor = rateHawkish && !rateBypassed ? "var(--lucid-neg)" : "var(--lucid-pos)";
  const rateBg = rateHawkish && !rateBypassed ? "var(--lucid-neg-bg)" : "var(--lucid-pos-bg)";
  const rateBd = rateHawkish && !rateBypassed ? "var(--lucid-neg-bd)" : "var(--lucid-pos-bd)";

  // 8B fed constraint status
  const constrained = gate.fedConstraint === "CONSTRAINED";
  const fedColor = constrained ? "var(--lucid-neg)" : "var(--lucid-pos)";
  const fedBg = constrained ? "var(--lucid-neg-bg)" : "var(--lucid-pos-bg)";
  const fedBd = constrained ? "var(--lucid-neg-bd)" : "var(--lucid-pos-bd)";

  return (
    <div className="lt-card lt-edge lt-rise lt-stagger-4 p-4 sm:p-6" style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}>
      <h2 className="lt-eyebrow mb-4">Override Gates</h2>
      <div className="flex flex-col gap-3 lg:flex-row">
        <GateCard icon={<Gauge size={16} />} title="Rate Gate (8A) — JPY Overrides 3 & 5" status={rateStatus} statusColor={rateColor} statusBg={rateBg} statusBd={rateBd}>
          <div className="flex items-center gap-2 lt-num">
            <span style={{ color: "var(--lucid-ink-3)" }}>US2Y close</span>
            <span style={{ color: "var(--lucid-ink)" }}>{gate.us02yClose !== null ? fmt2(gate.us02yClose) : "n/a"}</span>
            <span style={{ color: "var(--lucid-ink-3)" }}>vs 21d SMA</span>
            <span style={{ color: "var(--lucid-ink)" }}>{gate.us02ySma21 !== null ? fmt2(gate.us02ySma21) : "n/a"}</span>
          </div>
          <p style={{ color: "var(--lucid-ink-3)" }}>
            {rateHawkish
              ? rateBypassed
                ? "US2Y above its 21d SMA — but a Carry Shock (price-confirmed unwind) bypasses the gate, so JPY safe-haven overrides still apply."
                : "US2Y above its 21d SMA — rate differential widening. JPY safe-haven Overrides 3 & 5 suppressed."
              : "US2Y at or below its 21d SMA — JPY safe-haven Overrides 3 & 5 apply as written under Risk-Off."}
          </p>
          {gate.us02yClose === null && (
            <p style={{ color: "var(--lucid-warn)" }}>US2Y unavailable — gate fails OPEN (overrides apply).</p>
          )}
        </GateCard>

        <GateCard
          icon={<Landmark size={16} />}
          title="Fed Constraint (8B) — Gold Override 2"
          status={gate.fedConstraint}
          statusColor={fedColor}
          statusBg={fedBg}
          statusBd={fedBd}
        >
          <p style={{ color: "var(--lucid-ink-3)" }}>
            Effective from{" "}
            <span className="lt-num" style={{ color: "var(--lucid-ink-2)" }}>{gate.fedConstraintEffectiveFrom ?? "default"}</span>
          </p>
          <p style={{ color: "var(--lucid-ink-3)" }}>
            {constrained
              ? "Fed CONSTRAINED — cannot hike into hot inflation. Inflation is a gold tailwind; Override 2 applies under Risk-Off."
              : "Fed FREE — can hike into inflation. Classical inflation rules apply; gold Override 2 suppressed. (No shock bypass exists for Override 2.)"}
          </p>
        </GateCard>
      </div>
    </div>
  );
}

// ─── Section 5 — Active overrides (real state from backend) ───────────────────

function OverrideCard({ o, state }: { o: OverrideDef; state: PublicCompassOverrideState | undefined }) {
  const active = state?.active ?? false;
  const suppressed = state?.suppressed ?? false;
  const reason = state?.reason ?? null;
  const badge = active ? "ACTIVE" : suppressed ? "SUPPRESSED" : "INACTIVE";
  const badgeStyle = active
    ? { background: "var(--lucid-neg-bg)", color: "var(--lucid-neg)", border: "1px solid var(--lucid-neg-bd)" }
    : suppressed
      ? { background: "var(--lucid-warn-bg)", color: "var(--lucid-warn)", border: "1px solid var(--lucid-warn-bd)" }
      : { background: "var(--lucid-surface-3)", color: "var(--lucid-ink-3)", border: "1px solid var(--lucid-line)" };

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: active ? "var(--lucid-surface-2)" : "var(--lucid-surface)",
        border: `1px solid ${active ? "var(--lucid-neg-bd)" : suppressed ? "var(--lucid-warn-bd)" : "var(--lucid-line)"}`,
        opacity: active ? 1 : 0.75,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 mt-0.5" style={badgeStyle}>
            {badge}
          </span>
          <div className="min-w-0">
            <div className="font-semibold" style={active ? { color: "var(--lucid-ink)" } : { color: "var(--lucid-ink-2)" }}>
              Override {o.id}: {o.name}
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--lucid-ink-2)" }}>{o.summary}</p>
          </div>
        </div>
        {o.gate && (
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium shrink-0"
            style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "1px solid var(--lucid-accent-bd)" }}
          >
            {o.gate === "rate" ? <Gauge size={11} /> : <Landmark size={11} />}
            {o.gate === "rate" ? "8A" : "8B"}
          </span>
        )}
      </div>

      {suppressed && reason && (
        <div className="mt-3 rounded-lg px-3 py-2 text-[11px]" style={{ background: "var(--lucid-warn-bg)", color: "var(--lucid-warn)", border: "1px solid var(--lucid-warn-bd)" }}>
          Adjustment 0 — suppressed: {reason}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <span className="lt-eyebrow mr-1">Affected</span>
        {o.affected.map((a) => (
          <span
            key={a}
            className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
            style={
              active
                ? { background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "1px solid var(--lucid-accent-bd)" }
                : { background: "var(--lucid-surface-3)", color: "var(--lucid-ink-3)", border: "1px solid var(--lucid-line)" }
            }
          >
            {a}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {o.changes.map((c) => (
          <span
            key={c}
            className="inline-flex items-center rounded-md px-2 py-1 text-[11px] lt-num"
            style={{ background: "var(--lucid-surface-3)", color: active ? "var(--lucid-ink-2)" : "var(--lucid-ink-3)", border: "1px solid var(--lucid-line)" }}
          >
            {c}
          </span>
        ))}
      </div>

      {o.note && <p className="text-[11px] mt-3" style={{ color: "var(--lucid-ink-3)" }}>Note: {o.note}</p>}
    </div>
  );
}

function OverridesSection({ regime, gate }: { regime: CompassRegime; gate: PublicCompassGateState }) {
  const byCode = new Map(gate.overrides.map((o) => [o.code, o]));
  const anyActive = gate.overridesActive.length > 0;

  return (
    <div className="lt-card lt-edge lt-rise lt-stagger-5 p-4 sm:p-6" style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="lt-eyebrow">Scoring Overrides</h2>
        <RegimePill r={regime} />
      </div>

      {!anyActive && regime === "Risk-On" && (
        <div className="flex flex-col items-center text-center gap-3 py-8">
          <CheckCircle2 size={32} style={{ color: "var(--lucid-pos)" }} />
          <p className="text-sm max-w-md" style={{ color: "var(--lucid-ink-2)" }}>
            No overrides active. All base scoring rules apply. Lucid scores reflect pure fundamental analysis.
          </p>
        </div>
      )}

      {!anyActive && regime === "Caution" && (
        <div className="flex flex-col items-center text-center gap-3 py-8">
          <AlertCircle size={32} style={{ color: "var(--lucid-warn)" }} />
          <p className="text-sm max-w-md" style={{ color: "var(--lucid-ink-2)" }}>
            No overrides active. Fundamental signals have reduced reliability in mixed regimes — consider reducing conviction sizing.
          </p>
        </div>
      )}

      {(anyActive || regime === "Risk-Off") && (
        <div className="space-y-3">
          <p className="text-xs mb-1" style={{ color: "var(--lucid-ink-3)" }}>
            Overrides fire only under a Risk-Off activation path, and each is subject to its gate (8A rate gate on 3 & 5, 8B fed constraint on 2). State below is the live post-gate result.
          </p>
          {OVERRIDES.map((o) => (
            <OverrideCard key={o.id} o={o} state={byCode.get(o.code)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section 6 — Score impact table (layered base → adjustment → final) ───────

function ScorePill({ score }: { score: number }) {
  const v = scoreVisual(score);
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="lt-num font-bold text-sm" style={{ color: v.color }}>{signed(score)}</span>
      <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold" style={{ background: v.bg, color: v.color, border: `1px solid ${v.border}` }}>
        {v.label}
      </span>
    </div>
  );
}

function ScoreImpactTable({ regime, rows }: { regime: CompassRegime; rows: PublicCompassScoreImpactRow[] }) {
  const ordered = [...rows].sort((a, b) => (ASSET_META[a.asset]?.order ?? 99) - (ASSET_META[b.asset]?.order ?? 99));

  return (
    <div className="lt-card lt-edge lt-rise lt-stagger-6 p-4 sm:p-6" style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}>
      <h2 className="lt-eyebrow mb-4">Score Impact — Base → Adjustment → Final</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--lucid-line-2)" }}>
              <th className="px-3 py-2.5 text-left lt-eyebrow">Asset</th>
              <th className="px-3 py-2.5 text-left lt-eyebrow">Base Score</th>
              <th className="px-3 py-2.5 text-left lt-eyebrow">Compass Adjustment</th>
              <th className="px-3 py-2.5 text-left lt-eyebrow">Final Score</th>
              <th className="px-3 py-2.5 text-center lt-eyebrow">Change</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => {
              const flag = ASSET_META[row.asset]?.flag ?? "🌐";
              // Use the backend-computed, post-gate adjustment/final directly.
              const adj = row.adjustment;
              const changed = adj !== 0;
              const codes = row.overrides.map((o) => o.code.replace(/^OVERRIDE_(\d)_.*/, "$1"));
              const adjLabel =
                row.overrides.length === 0
                  ? "0 (no override)"
                  : adj === 0
                    ? "0 (suppressed by gate)"
                    : `${signed(adj)} · Ov ${codes.join("+")}`;
              const arrow = adj > 0 ? "↑" : adj < 0 ? "↓" : "—";
              const arrowColor = adj > 0 ? "var(--lucid-pos)" : adj < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)";
              return (
                <tr key={row.asset} style={{ borderBottom: "1px solid var(--lucid-line)", background: changed ? "var(--lucid-surface-2)" : undefined }}>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="mr-2">{flag}</span>
                    <span className="font-semibold" style={{ color: "var(--lucid-ink)" }}>{row.asset}</span>
                  </td>
                  <td className="px-3 py-3">
                    <ScorePill score={row.baseScore} />
                  </td>
                  <td className="px-3 py-3 lt-num font-medium whitespace-nowrap" style={{ color: changed ? (adj > 0 ? "var(--lucid-pos)" : "var(--lucid-neg)") : "var(--lucid-ink-3)" }}>
                    {adjLabel}
                  </td>
                  <td className="px-3 py-3">
                    <ScorePill score={row.finalScore} />
                  </td>
                  <td className="px-3 py-3 text-center font-bold lt-num" style={{ color: arrowColor }}>{arrow}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] mt-4" style={{ color: "var(--lucid-ink-3)" }}>
        {regime === "Risk-Off"
          ? "Final = base + the post-gate override adjustment the backend actually applied. Overrides suppressed by the rate/fed gates contribute 0."
          : "In Risk-On and Caution regimes, all base scores equal final scores. Compass overrides only activate under a Risk-Off path."}
      </p>
    </div>
  );
}

// ─── Section 7 — Audit log ───────────────────────────────────────────────────

function AuditLetterCell({ band }: { band: CompassBand | undefined }) {
  if (!band) {
    return <td className="px-2 py-2 text-center" style={{ color: "var(--lucid-ink-3)" }}>—</td>;
  }
  return (
    <td className="px-2 py-2 text-center font-bold lt-num" style={{ color: CLS[band].color }}>{band[0]}</td>
  );
}

const AUDIT_INPUT_ORDER = ["VIX_5D_AVG", "VIX_TERM_STRUCTURE", "HY_OAS", "YIELD_2S10S", "DXY_TREND", "US_DATA_STACK"];
const AUDIT_INPUT_HEADERS = ["VIX", "VIX-TS", "HY OAS", "2s10s", "DXY", "Data Stack"];

function AuditLog({ history }: { history: PublicCompassHistoryRow[] }) {
  return (
    <div className="lt-card lt-edge lt-rise lt-stagger-7 p-4 sm:p-6" style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}>
      <h2 className="lt-eyebrow mb-4">Classification History — Last {history.length} Days</h2>
      <div className="overflow-x-auto">
        <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
          <table className="w-full text-xs" style={{ minWidth: 760 }}>
            <thead className="sticky top-0 z-10" style={{ background: "var(--lucid-surface)" }}>
              <tr style={{ borderBottom: "1px solid var(--lucid-line-2)" }}>
                {["Date", "Regime", ...AUDIT_INPUT_HEADERS, "Green Wt", "Red Wt"].map((h, idx) => (
                  <th key={h} className={`px-2 py-2.5 lt-eyebrow whitespace-nowrap ${idx <= 1 ? "text-left" : idx >= 8 ? "text-right" : "text-center"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.date} className="transition-colors hover:bg-(--lucid-line)" style={{ borderBottom: "1px solid var(--lucid-line)" }}>
                  <td className="px-2 py-2 whitespace-nowrap font-medium" style={{ color: "var(--lucid-ink-2)" }}>{formatAuditDate(row.date)}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <RegimePill r={row.finalRegime} size="sm" />
                      {row.shockAActive && <ShieldAlert size={12} style={{ color: "var(--lucid-neg)" }} aria-label="Vol shock" />}
                      {row.shockBActive && <Zap size={12} style={{ color: "var(--lucid-accent)" }} aria-label="Carry shock" />}
                    </div>
                  </td>
                  {AUDIT_INPUT_ORDER.map((code) => (
                    <AuditLetterCell key={code} band={row.bands[code]} />
                  ))}
                  <td className="px-2 py-2 text-right lt-num font-medium" style={{ color: "var(--lucid-pos)" }}>{fmt1(row.greenWeight)}</td>
                  <td className="px-2 py-2 text-right lt-num font-medium" style={{ color: row.redWeight > 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)" }}>{fmt1(row.redWeight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] mt-4" style={{ color: "var(--lucid-ink-3)" }}>
        Regime shown is the FINAL regime (shock icons flag Vol / Carry shocks). Audit log used for validation and backtesting. Inputs snapshot daily at market close.
      </p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CompassPage() {
  const { data, isLoading, error, refetch } = useCompass();
  const [expandedStack, setExpandedStack] = useState(false);

  if (isLoading) return <LoadingState stages={["Loading Compass…", "Weighing regime votes…", "Classifying the market…"]} />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data)
    return (
      <EmptyState
        title="Compass not yet computed"
        description="The regime classifier has not produced a reading yet. Check back after the next daily run."
      />
    );

  const { current, gate, inputs, scoreImpact, history } = data;
  const regime = current.finalRegime;

  return (
    <div className="space-y-5 sm:space-y-6 p-4 sm:p-6" style={{ color: "var(--lucid-ink)" }}>
      {/* Page header */}
      <div className="lt-rise lt-stagger-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="lt-serif text-xl font-semibold" style={{ color: "var(--lucid-ink)" }}>Compass</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>
            Regime classification — is the fundamental scoring reliable right now?
          </p>
        </div>
        <p className="text-xs shrink-0 sm:text-right" style={{ color: "var(--lucid-ink-3)" }}>
          As of <span className="lt-num" style={{ color: "var(--lucid-ink-2)" }}>{current.classificationDate}</span>
        </p>
      </div>

      {/* Shock banner (only when a shock is active) */}
      <ShockBanner gate={gate} />

      {/* Section 1 — Regime verdict hero (shows FINAL regime) */}
      <RegimeHero current={current} gate={gate} />

      {/* Section 2 — 6 input votes */}
      <div className="lt-card lt-edge lt-rise lt-stagger-3 p-4 sm:p-6" style={{ background: "var(--lucid-grad-surface)", boxShadow: "var(--lucid-elev-1)" }}>
        <div className="mb-4">
          <h2 className="lt-serif text-base font-semibold" style={{ color: "var(--lucid-ink)" }}>Compass Inputs — Vote Breakdown</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>
            Each input classified independently, then weighted to determine overall regime.
          </p>
        </div>
        <div className="space-y-3">
          {inputs.map((input) => (
            <InputRow
              key={input.code}
              input={input}
              expanded={input.code === "US_DATA_STACK" && expandedStack}
              onToggle={() => setExpandedStack((v) => !v)}
            />
          ))}
        </div>
      </div>

      {/* Section 3 — Classification logic */}
      <ClassificationLogic current={current} inputs={inputs} />

      {/* Section 4 — Override gates (8A / 8B) */}
      <OverrideGates gate={gate} />

      {/* Section 5 — Active overrides (live post-gate state) */}
      <OverridesSection regime={regime} gate={gate} />

      {/* Section 6 — Score impact */}
      <ScoreImpactTable regime={regime} rows={scoreImpact} />

      {/* Section 7 — Audit log */}
      {history.length > 0 && <AuditLog history={history} />}
    </div>
  );
}
