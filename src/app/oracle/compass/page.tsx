"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import {
  getBias,
  getBiasPillClass,
  getScoreColor,
  type BiasType,
} from "@/data/assets";
import { useCompass } from "@/hooks/useCompass";
import type {
  CompassBand,
  CompassRegime,
  PublicCompassInput,
  PublicCompassScoreImpactRow,
  PublicCompassHistoryRow,
  PublicCompassSnapshot,
  PublicCompassSubCheck,
} from "@/lib/api/oracle";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { EmptyState } from "@/components/state/EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// Lucid Compass — wired to GET /api/oracle/compass (one batched, daily-cached
// snapshot). The live data drives every section: regime, the 6 input votes,
// classification math, score impact (real base vs compass-adjusted scores from
// the EdgeFinder scorecards), and the 30-day audit log. The only client-side
// state is the US Data Stack expand and the override what-if toggles, which
// recompute the score-impact column locally using the per-override deltas the
// backend returns. Static text below (input descriptions/thresholds, override
// copy, asset flags) is presentation metadata that has no home in the DB.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Static presentation metadata (keyed by backend codes) ──────────────────

const INPUT_META: Record<string, { name: string; description: string; threshold: string }> = {
  VIX_5D_AVG: {
    name: "VIX (5-Day Average)",
    description: "Market fear gauge — 5-day closing average",
    threshold: "< 18 = Green · 18–25 = Yellow · > 25 = Red",
  },
  HY_OAS: {
    name: "HY OAS (High Yield Credit Spreads)",
    description: "Corporate bond stress — level + 30-day trend",
    threshold: "< 450bp & tightening = Green · 450–700bp or widening = Yellow · > 700bp = Red",
  },
  YIELD_2S10S: {
    name: "2s10s Yield Curve",
    description: "Treasury yield curve slope — level + 30-day change",
    threshold: "Positive & steepening = Green · Inverted stable = Yellow · Re-steepening from inversion = Red",
  },
  DXY_TREND: {
    name: "DXY Trend",
    description: "Dollar index distance from 50-day moving average",
    threshold: "> 2% from 50d MA = Green · Range-bound = Yellow · Sharp break > 3% in 5 days = Red",
  },
  GOLD_DXY_CORR: {
    name: "Gold/DXY Correlation (60-Day Rolling)",
    description: "Gold–Dollar relationship — breaks signal stress",
    threshold: "< −0.5 normal inverse = Green · −0.5 to 0 = Yellow · > 0 broken = Red",
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
}

const OVERRIDES: OverrideDef[] = [
  {
    id: 1,
    code: "OVERRIDE_1_BAD_NEWS_GOOD_NEWS",
    name: "Bad News Good News (Stocks)",
    affected: ["SPY", "NAS100"],
    summary: "Weak US jobs data inverts for equity scoring — Fed pivot trade.",
    changes: [
      "NFP miss: −1 → +1",
      "Higher unemployment: −1 → +1",
      "ADP miss: −1 → +1",
      "JOLTS miss: −1 → +1",
      "Higher claims: −1 → +1",
    ],
    note: "CPI/PPI/PCE direction unchanged — inflation still hurts stocks via discount rate.",
  },
  {
    id: 2,
    code: "OVERRIDE_2_GOLD_INFLATION_HEDGE",
    name: "Gold Inflation Hedge",
    affected: ["XAUUSD"],
    summary: "Gold's inflation rules flip — real-yields channel breaks in stress.",
    changes: ["CPI beat: −1 → +1", "PPI beat: −1 → +1", "PCE beat: −1 → +1"],
    note: "Growth and jobs indicators unchanged.",
  },
  {
    id: 3,
    code: "OVERRIDE_3_JPY_SAFE_HAVEN",
    name: "JPY Safe-Haven Boost",
    affected: ["JPY", "USDJPY", "EURJPY", "GBPJPY"],
    summary: "+1 added to JPY standalone score — carry trades unwinding.",
    changes: ["Propagates to pairs: USDJPY −1, EURJPY −1, GBPJPY −1"],
  },
  {
    id: 4,
    code: "OVERRIDE_4_USD_WEAK_JOBS",
    name: "USD Weak-Jobs Neutralization",
    affected: ["USD"],
    summary: "USD jobs weakness softened — safe-haven flows competing with dovish expectations.",
    changes: [
      "NFP miss: −1 → 0",
      "Higher unemployment: −1 → 0",
      "Higher claims: −1 → 0",
      "ADP miss: −1 → 0",
      "JOLTS miss: −1 → 0",
    ],
  },
  {
    id: 5,
    code: "OVERRIDE_5_CARRY_UNWIND",
    name: "Carry Unwind",
    affected: ["EURJPY", "GBPJPY"],
    summary: "Automatic −1 adjustment on top of Override 3.",
    changes: ["Total Risk-Off effect on EURJPY/GBPJPY: −2 combined."],
  },
];

const OVERRIDE_CODE_TO_ID: Record<string, number> = Object.fromEntries(
  OVERRIDES.map((o) => [o.code, o.id]),
);

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

// ─── Visual tokens ───────────────────────────────────────────────────────────

const CLS: Record<CompassBand, { color: string; bg: string; border: string }> = {
  GREEN: { color: "#10B981", bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.3)" },
  YELLOW: { color: "#F59E0B", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)" },
  RED: { color: "#EF4444", bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.3)" },
};

const REGIME_META: Record<CompassRegime, { color: string; glow: string; bg: string; border: string; desc: string }> = {
  "Risk-On": {
    color: "#10B981",
    glow: "rgba(16, 185, 129, 0.2)",
    bg: "rgba(16, 185, 129, 0.15)",
    border: "rgba(16, 185, 129, 0.3)",
    desc: "All base scoring rules active. Trade with full conviction.",
  },
  Caution: {
    color: "#F59E0B",
    glow: "rgba(245, 158, 11, 0.2)",
    bg: "rgba(245, 158, 11, 0.15)",
    border: "rgba(245, 158, 11, 0.3)",
    desc: "Mixed signals. No overrides active. Reduce conviction sizing manually.",
  },
  "Risk-Off": {
    color: "#EF4444",
    glow: "rgba(239, 68, 68, 0.2)",
    bg: "rgba(239, 68, 68, 0.15)",
    border: "rgba(239, 68, 68, 0.3)",
    desc: "Stress regime active. Scoring overrides applied. See details below.",
  },
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

function fmt1(n: number): string {
  return n.toFixed(1);
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function formatAuditDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}`;
}

type Current = PublicCompassSnapshot["current"];

/** Re-derive a row's adjustment + contributing override ids from the toggle set. */
function rowAdjustment(
  row: PublicCompassScoreImpactRow,
  enabled: Record<number, boolean>,
): { adj: number; ids: number[] } {
  let adj = 0;
  const ids: number[] = [];
  for (const o of row.overrides) {
    const id = OVERRIDE_CODE_TO_ID[o.code];
    if (id === undefined || enabled[id]) {
      adj += o.adjustment;
      if (id !== undefined) ids.push(id);
    }
  }
  return { adj, ids };
}

// ─── Small presentational primitives ─────────────────────────────────────────

function StatusDot({ c }: { c: CompassBand }) {
  const m = CLS[c];
  return (
    <span
      className="inline-block rounded-full shrink-0"
      style={{ width: 16, height: 16, background: m.color, boxShadow: `0 0 10px ${m.color}66` }}
    />
  );
}

function ClassPill({ c, size = "md" }: { c: CompassBand; size?: "sm" | "md" }) {
  const m = CLS[c];
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      }`}
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
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}
    >
      {r}
    </span>
  );
}

function WeightBadge({ w }: { w: number }) {
  return <span className="pill pill-blue whitespace-nowrap">Weight: {fmt1(w)}</span>;
}

function StabilityPill({ current }: { current: Current }) {
  const cfg = current.crisisOverrideFired
    ? { color: "#EF4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", text: "Crisis Override — Activated same-day", pulse: true }
    : current.persistenceDaysCount > 0
      ? {
          color: "#F59E0B",
          bg: "rgba(245,158,11,0.12)",
          border: "rgba(245,158,11,0.3)",
          text: `Pending — ${current.persistenceDaysCount} of 5 days confirmed`,
          pulse: false,
        }
      : {
          color: "#10B981",
          bg: "rgba(16,185,129,0.12)",
          border: "rgba(16,185,129,0.3)",
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

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="relative shrink-0 rounded-full transition-colors"
      style={{
        width: 38,
        height: 22,
        background: on ? "rgba(59,130,246,0.5)" : "rgba(100,116,139,0.25)",
        border: `1px solid ${on ? "rgba(59,130,246,0.6)" : "rgba(100,116,139,0.3)"}`,
      }}
    >
      <span
        className="absolute rounded-full bg-white transition-transform"
        style={{ top: 2, left: 2, width: 16, height: 16, transform: on ? "translateX(16px)" : "translateX(0)" }}
      />
    </button>
  );
}

function MiniLabel({ children }: { children: ReactNode }) {
  return (
    <span className="label lg:hidden block mb-1" style={{ color: "#475569" }}>
      {children}
    </span>
  );
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
        <span className="tabular-nums font-semibold" style={{ color }}>
          {fmt1(value)}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function voteRuleText(current: Current): { regime: CompassRegime; rule: string } {
  const { green, red } = current.weights;
  if (current.crisisOverrideFired) return { regime: "Risk-Off", rule: "Crisis Override active" };
  if (red >= 4) return { regime: "Risk-Off", rule: `Red ${fmt1(red)} ≥ 4.0` };
  if (green >= 5 && red <= 1) return { regime: "Risk-On", rule: `Green ${fmt1(green)} ≥ 5.0 · Red ${fmt1(red)} ≤ 1.0` };
  return { regime: "Caution", rule: `Green ${fmt1(green)} < 5.0 · Red ${fmt1(red)} < 4.0` };
}

function VoteSummary({ current }: { current: Current }) {
  const w = current.weights;
  const { regime, rule } = voteRuleText(current);
  const meta = REGIME_META[regime];
  return (
    <div
      className="w-full lg:w-80 xl:w-96 shrink-0 rounded-xl p-4 sm:p-5"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="label" style={{ color: "#64748B" }}>
          Vote Breakdown
        </span>
        <span className="text-[11px] tabular-nums" style={{ color: "#475569" }}>
          Total {fmt1(w.total)}
        </span>
      </div>
      <VoteBar label="GREEN" value={w.green} max={w.total} color="#10B981" />
      <VoteBar label="YELLOW" value={w.yellow} max={w.total} color="#F59E0B" />
      <VoteBar label="RED" value={w.red} max={w.total} color="#EF4444" />
      <div className="mt-4 pt-3 flex items-start gap-1.5 text-xs" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ color: meta.color }}>✓</span>
        <span style={{ color: "#94A3B8" }}>
          Vote →{" "}
          <span className="font-bold" style={{ color: meta.color }}>
            {regime.toUpperCase()}
          </span>{" "}
          <span style={{ color: "#475569" }}>({rule})</span>
        </span>
      </div>
    </div>
  );
}

function RegimeHero({ current }: { current: Current }) {
  const regime = current.activeRegime;
  const meta = REGIME_META[regime];
  const isRiskOff = regime === "Risk-Off";
  return (
    <div className="glass-card p-6 sm:p-10">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <span className="label block mb-3" style={{ color: "#64748B" }}>
            Current Regime
          </span>
          <div
            className={`inline-block rounded-2xl ${isRiskOff ? "compass-pulse-glow" : ""}`}
            style={isRiskOff ? undefined : { boxShadow: `0 0 40px ${meta.glow}` }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold leading-none" style={{ color: meta.color, textShadow: `0 0 24px ${meta.glow}` }}>
              {regime}
            </h2>
          </div>
          <p className="mt-5 text-sm sm:text-base max-w-xl" style={{ color: "#94A3B8" }}>
            {meta.desc}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <StabilityPill current={current} />
            {current.candidateRegime !== regime && (
              <span className="text-[11px]" style={{ color: "#475569" }}>
                candidate trending to{" "}
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
      <span className="sm:w-44 shrink-0 font-medium" style={{ color: "#CBD5E1" }}>
        {sc.name}
      </span>
      <span className="sm:w-48 shrink-0 tabular-nums text-white">{sc.value}</span>
      <span className="sm:flex-1" style={{ color: "#64748B" }}>
        {sc.detail}
      </span>
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
    <div className="rounded-xl p-3 sm:p-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="pt-1">
          <StatusDot c={input.colorBand} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="lg:flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{meta.name}</span>
                {expandable && (
                  <button
                    type="button"
                    onClick={onToggle}
                    className="inline-flex items-center justify-center rounded-md transition-colors hover:bg-white/5"
                    style={{ width: 22, height: 22, color: "#64748B" }}
                    aria-label={expanded ? "Collapse sub-checks" : "Expand sub-checks"}
                  >
                    {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                )}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "#64748B" }}>
                {meta.description}
              </div>
            </div>

            <div className="lg:w-44 shrink-0">
              <MiniLabel>Current</MiniLabel>
              <div className="font-semibold tabular-nums text-white text-sm">{value}</div>
            </div>

            <div className="lg:w-80 shrink-0">
              <MiniLabel>Threshold</MiniLabel>
              <div className="text-[11px] leading-relaxed" style={{ color: "#64748B" }}>
                {meta.threshold}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 lg:w-44 lg:justify-end shrink-0">
              <ClassPill c={input.colorBand} />
              <WeightBadge w={input.weight} />
            </div>
          </div>

          {expandable && expanded && (
            <div className="mt-4 pt-4 space-y-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {subChecks.map((sc) => (
                <SubCheckRow key={sc.name} sc={sc} />
              ))}
              <div className="text-xs pt-2" style={{ color: "#94A3B8" }}>
                <span style={{ color: "#475569" }}>Aggregation: </span>
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
    <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: active ? color : "#334155" }}>
      {active ? fmt1(value) : "—"}
    </td>
  );
}

function ClassificationLogic({ current, inputs }: { current: Current; inputs: PublicCompassInput[] }) {
  const w = current.weights;
  const { regime } = voteRuleText(current);
  const meta = REGIME_META[regime];

  const result = current.crisisOverrideFired
    ? "✓ Crisis Override active (VIX > 30 AND HY OAS > 700bp) → RISK-OFF"
    : w.red >= 4
      ? `✓ RED ${fmt1(w.red)} ≥ 4.0 → RISK-OFF`
      : w.green >= 5 && w.red <= 1
        ? `✓ GREEN ${fmt1(w.green)} ≥ 5.0 AND RED ${fmt1(w.red)} ≤ 1.0 → RISK-ON`
        : `Neither threshold met — GREEN ${fmt1(w.green)} < 5.0 and RED ${fmt1(w.red)} < 4.0 → CAUTION`;

  return (
    <div className="glass-card p-4 sm:p-5">
      <h2 className="label mb-4" style={{ color: "#64748B" }}>
        Classification Result
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 560 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <th className="px-3 py-2.5 text-left label" style={{ color: "#64748B" }}>Input</th>
              <th className="px-3 py-2.5 text-left label" style={{ color: "#64748B" }}>Classification</th>
              <th className="px-3 py-2.5 text-right label" style={{ color: "#64748B" }}>Weight</th>
              <th className="px-3 py-2.5 text-right label" style={{ color: "#10B981" }}>Green</th>
              <th className="px-3 py-2.5 text-right label" style={{ color: "#F59E0B" }}>Yellow</th>
              <th className="px-3 py-2.5 text-right label" style={{ color: "#EF4444" }}>Red</th>
            </tr>
          </thead>
          <tbody>
            {inputs.map((i) => {
              const name = (INPUT_META[i.code]?.name ?? i.code).replace(/ \(.*\)$/, "");
              return (
                <tr key={i.code} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-3 py-2.5 font-medium text-white whitespace-nowrap">{name}</td>
                  <td className="px-3 py-2.5">
                    <ClassPill c={i.colorBand} size="sm" />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "#94A3B8" }}>
                    {fmt1(i.weight)}
                  </td>
                  <LogicCell active={i.colorBand === "GREEN"} value={i.weight} color="#10B981" />
                  <LogicCell active={i.colorBand === "YELLOW"} value={i.weight} color="#F59E0B" />
                  <LogicCell active={i.colorBand === "RED"} value={i.weight} color="#EF4444" />
                </tr>
              );
            })}
            <tr style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
              <td className="px-3 py-2.5 label" style={{ color: "#94A3B8" }}>Totals</td>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-white">{fmt1(w.total)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: "#10B981" }}>{fmt1(w.green)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: "#F59E0B" }}>{fmt1(w.yellow)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: "#EF4444" }}>{fmt1(w.red)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-1.5 text-xs" style={{ color: "#64748B" }}>
        <p>
          <span style={{ color: "#10B981" }}>RISK-ON</span> requires: Green ≥ 5.0 AND Red ≤ 1.0
        </p>
        <p>
          <span style={{ color: "#EF4444" }}>RISK-OFF</span> requires: Red ≥ 4.0 OR Crisis Override (VIX &gt; 30 AND HY OAS &gt; 700bp)
        </p>
        <p>
          <span style={{ color: "#F59E0B" }}>CAUTION</span> otherwise. Regime changes need a 5-day persistence streak before they take effect.
        </p>
      </div>

      <div className="mt-3 rounded-lg px-3 py-2.5 text-xs font-semibold" style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
        RESULT: {result}
        {current.candidateRegime !== current.activeRegime && (
          <span style={{ color: "#94A3B8", fontWeight: 400 }}>
            {" "}
            · active regime still {current.activeRegime} ({current.persistenceDaysCount}/5 days toward change)
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Section 4 — Active overrides ────────────────────────────────────────────

function OverrideCard({ o, on, onToggle }: { o: OverrideDef; on: boolean; onToggle: () => void }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: on ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
        border: `1px solid ${on ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.05)"}`,
        opacity: on ? 1 : 0.6,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 mt-0.5"
            style={
              on
                ? { background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }
                : { background: "rgba(100,116,139,0.15)", color: "#64748B", border: "1px solid rgba(100,116,139,0.3)" }
            }
          >
            {on ? "ACTIVE" : "DISABLED"}
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-white" style={on ? undefined : { textDecoration: "line-through", color: "#64748B" }}>
              Override {o.id}: {o.name}
            </div>
            <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>
              {o.summary}
            </p>
          </div>
        </div>
        <Toggle on={on} onClick={onToggle} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <span className="label mr-1" style={{ color: "#475569" }}>
          Affected
        </span>
        {o.affected.map((a) => (
          <span
            key={a}
            className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
            style={
              on
                ? { background: "rgba(59,130,246,0.12)", color: "#60A5FA", border: "1px solid rgba(59,130,246,0.25)" }
                : { background: "rgba(100,116,139,0.1)", color: "#475569", border: "1px solid rgba(100,116,139,0.2)" }
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
            className="inline-flex items-center rounded-md px-2 py-1 text-[11px] tabular-nums"
            style={{ background: "rgba(255,255,255,0.03)", color: on ? "#CBD5E1" : "#475569", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {c}
          </span>
        ))}
      </div>

      {o.note && (
        <p className="text-[11px] mt-3" style={{ color: "#475569" }}>
          Note: {o.note}
        </p>
      )}
    </div>
  );
}

function OverridesSection({
  regime,
  enabled,
  onToggle,
}: {
  regime: CompassRegime;
  enabled: Record<number, boolean>;
  onToggle: (id: number) => void;
}) {
  return (
    <div className="glass-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="label" style={{ color: "#64748B" }}>
          Scoring Overrides
        </h2>
        <RegimePill r={regime} />
      </div>

      {regime === "Risk-On" && (
        <div className="flex flex-col items-center text-center gap-3 py-8">
          <CheckCircle2 size={32} style={{ color: "#10B981" }} />
          <p className="text-sm max-w-md" style={{ color: "#94A3B8" }}>
            No overrides active. All base scoring rules apply. Lucid scores reflect pure fundamental analysis.
          </p>
        </div>
      )}

      {regime === "Caution" && (
        <div className="flex flex-col items-center text-center gap-3 py-8">
          <AlertCircle size={32} style={{ color: "#F59E0B" }} />
          <p className="text-sm max-w-md" style={{ color: "#94A3B8" }}>
            No overrides active. Warning: fundamental signals have reduced reliability in mixed regimes. Consider reducing
            position conviction sizing.
          </p>
        </div>
      )}

      {regime === "Risk-Off" && (
        <div className="space-y-3">
          <p className="text-xs mb-1" style={{ color: "#64748B" }}>
            Toggle any override off to preview its effect on the score impact table below. Toggle state is session-only.
          </p>
          {OVERRIDES.map((o) => (
            <OverrideCard key={o.id} o={o} on={enabled[o.id]} onToggle={() => onToggle(o.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section 5 — Score impact table ──────────────────────────────────────────

function ScorePill({ score }: { score: number }) {
  const bias: BiasType = getBias(score);
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="tabular-nums font-bold text-sm" style={{ color: getScoreColor(score) }}>
        {signed(score)}
      </span>
      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold ${getBiasPillClass(bias)}`}>
        {bias}
      </span>
    </div>
  );
}

function ScoreImpactTable({
  regime,
  rows,
  enabled,
}: {
  regime: CompassRegime;
  rows: PublicCompassScoreImpactRow[];
  enabled: Record<number, boolean>;
}) {
  const ordered = [...rows].sort(
    (a, b) => (ASSET_META[a.asset]?.order ?? 99) - (ASSET_META[b.asset]?.order ?? 99),
  );

  return (
    <div className="glass-card p-4 sm:p-6">
      <h2 className="label mb-4" style={{ color: "#64748B" }}>
        Score Impact — Base vs Compass-Adjusted
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <th className="px-3 py-2.5 text-left label" style={{ color: "#64748B" }}>Asset</th>
              <th className="px-3 py-2.5 text-left label" style={{ color: "#64748B" }}>Base Score</th>
              <th className="px-3 py-2.5 text-left label" style={{ color: "#64748B" }}>Compass Adj</th>
              <th className="px-3 py-2.5 text-left label" style={{ color: "#64748B" }}>Final Score</th>
              <th className="px-3 py-2.5 text-center label" style={{ color: "#64748B" }}>Change</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => {
              const flag = ASSET_META[row.asset]?.flag ?? "🌐";
              const { adj, ids } = rowAdjustment(row, enabled);
              const final = row.baseScore + adj;
              const changed = adj !== 0;
              const adjLabel =
                row.overrides.length === 0
                  ? "0 (no change)"
                  : ids.length === 0
                    ? "0 (overrides off)"
                    : `${signed(adj)} · Ov ${ids.join("+")}`;
              const arrow = adj > 0 ? "↑" : adj < 0 ? "↓" : "—";
              const arrowColor = adj > 0 ? "#10B981" : adj < 0 ? "#EF4444" : "#475569";
              return (
                <tr
                  key={row.asset}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: changed ? "rgba(59,130,246,0.05)" : undefined }}
                >
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="mr-2">{flag}</span>
                    <span className="font-semibold text-white">{row.asset}</span>
                  </td>
                  <td className="px-3 py-3">
                    <ScorePill score={row.baseScore} />
                  </td>
                  <td
                    className="px-3 py-3 tabular-nums font-medium whitespace-nowrap"
                    style={{ color: changed ? (adj > 0 ? "#10B981" : "#EF4444") : "#475569" }}
                  >
                    {adjLabel}
                  </td>
                  <td className="px-3 py-3">
                    <ScorePill score={final} />
                  </td>
                  <td className="px-3 py-3 text-center font-bold tabular-nums" style={{ color: arrowColor }}>
                    {arrow}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] mt-4" style={{ color: "#334155" }}>
        {regime === "Risk-Off"
          ? "Compass overrides are active. Final = base + the currently-enabled override deltas — toggle overrides above to see the impact reactively."
          : "In Risk-On and Caution regimes, all base scores equal final scores. Compass overrides only activate in Risk-Off."}
      </p>
    </div>
  );
}

// ─── Section 6 — Audit log ───────────────────────────────────────────────────

function AuditLetterCell({ band }: { band: CompassBand | undefined }) {
  if (!band) {
    return (
      <td className="px-2 py-2 text-center" style={{ color: "#334155" }}>
        —
      </td>
    );
  }
  return (
    <td className="px-2 py-2 text-center font-bold tabular-nums" style={{ color: CLS[band].color }}>
      {band[0]}
    </td>
  );
}

const AUDIT_INPUT_ORDER = ["VIX_5D_AVG", "HY_OAS", "YIELD_2S10S", "DXY_TREND", "GOLD_DXY_CORR", "US_DATA_STACK"];

function AuditLog({ history }: { history: PublicCompassHistoryRow[] }) {
  return (
    <div className="glass-card p-4 sm:p-6">
      <h2 className="label mb-4" style={{ color: "#64748B" }}>
        Classification History — Last {history.length} Days
      </h2>
      <div className="overflow-x-auto">
        <div className="overflow-y-auto" style={{ maxHeight: 420 }}>
          <table className="w-full text-xs" style={{ minWidth: 720 }}>
            <thead className="sticky top-0 z-10" style={{ background: "#0A1424" }}>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                {["Date", "Regime", "VIX", "HY OAS", "2s10s", "DXY", "Gold/DXY", "Data Stack", "Green Wt", "Red Wt"].map((h, idx) => (
                  <th
                    key={h}
                    className={`px-2 py-2.5 label whitespace-nowrap ${idx <= 1 ? "text-left" : idx >= 8 ? "text-right" : "text-center"}`}
                    style={{ color: "#64748B" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.date} className="transition-colors hover:bg-white/3" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-2 py-2 whitespace-nowrap font-medium" style={{ color: "#CBD5E1" }}>
                    {formatAuditDate(row.date)}
                  </td>
                  <td className="px-2 py-2">
                    <RegimePill r={row.activeRegime} size="sm" />
                  </td>
                  {AUDIT_INPUT_ORDER.map((code) => (
                    <AuditLetterCell key={code} band={row.bands[code]} />
                  ))}
                  <td className="px-2 py-2 text-right tabular-nums font-medium" style={{ color: "#10B981" }}>
                    {fmt1(row.greenWeight)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium" style={{ color: row.redWeight > 0 ? "#EF4444" : "#475569" }}>
                    {fmt1(row.redWeight)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] mt-4" style={{ color: "#334155" }}>
        Audit log used for regime validation and backtesting. Inputs snapshot daily at market close.
      </p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CompassPage() {
  const { data, isLoading, error, refetch } = useCompass();
  const [expandedStack, setExpandedStack] = useState(false);
  const [enabledOverrides, setEnabledOverrides] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
  });

  function toggleOverride(id: number) {
    setEnabledOverrides((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (isLoading) return <LoadingState message="Loading Compass..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data)
    return (
      <EmptyState
        title="Compass not yet computed"
        description="The regime classifier has not produced a reading yet. Check back after the next daily run."
      />
    );

  const { current, inputs, scoreImpact, history } = data;
  const regime = current.activeRegime;

  return (
    <div className="space-y-5 sm:space-y-6 p-4 sm:p-6">
      {/* Page header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold" style={{ color: "#F1F5F9" }}>
            Compass
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748B" }}>
            Regime classification — is the fundamental scoring reliable right now?
          </p>
        </div>
        <p className="text-xs shrink-0 sm:text-right" style={{ color: "#475569" }}>
          As of <span style={{ color: "#94A3B8" }}>{current.classificationDate}</span>
        </p>
      </div>

      {/* Section 1 — Regime verdict hero */}
      <RegimeHero current={current} />

      {/* Section 2 — 6 input votes */}
      <div className="glass-card p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold" style={{ color: "#F1F5F9" }}>
            Compass Inputs — Vote Breakdown
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>
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

      {/* Section 4 — Active overrides */}
      <OverridesSection regime={regime} enabled={enabledOverrides} onToggle={toggleOverride} />

      {/* Section 5 — Score impact */}
      <ScoreImpactTable regime={regime} rows={scoreImpact} enabled={enabledOverrides} />

      {/* Section 6 — Audit log */}
      {history.length > 0 && <AuditLog history={history} />}
    </div>
  );
}
