import type { Trade, Account } from "@/lib/demo-data";
import { accountTradingPnl, isPropAccount } from "@/lib/demo-data";
import { getPrimaryExecution } from "@/lib/trade-helpers";
import * as stats from "@/lib/stats";
import type { AssetBias } from "@/lib/api/oracle";

// ─── Greeting ────────────────────────────────────────────────────────────────

export function getGreeting(): string {
  // Convert to IST (UTC+5:30)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 3600000);
  const hour = ist.getHours();
  if (hour >= 4 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good late night";
}

// ─── P&L curve helpers ────────────────────────────────────────────────────────

export type DateRangePreset = "Last 30d" | "Last 90d" | "All Time";

// Filters ideas by their primary execution's close date (open ideas keep
// their idea date). This is a dashboard-range convenience filter, not a
// financial computation — the money curve built from the result still sums
// every execution of each surviving idea (see buildPnlCurve below), which is
// correct: P&L is execution-level and every account's fill counts.
export function applyDateFilter(tradeList: Trade[], preset: DateRangePreset): Trade[] {
  if (preset === "All Time") return tradeList;
  const now = new Date();
  const days = preset === "Last 30d" ? 30 : 90;
  const cutoff = new Date(now.getTime() - days * 86400000);
  return tradeList.filter((t) => {
    const primary = getPrimaryExecution(t);
    const d = primary && primary.date_closed ? new Date(primary.date_closed) : new Date(t.date_opened);
    return d >= cutoff;
  });
}

// Re-exported from lib/stats.ts (the one shared statistics module) with
// display-formatted dates, so PerformanceBand's chart keeps its existing
// category-label contract without duplicating the cumulative-sum math here.
export type CurvePoint = stats.CurvePoint;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function buildPnlCurve(filtered: Trade[]): CurvePoint[] {
  const points = stats.buildBalanceCurve(filtered);
  return points.map((p) => ({ ...p, date: p.isLive ? `${fmtDate(p.date)} ·Live` : fmtDate(p.date) }));
}

export function computeDrawdownWindows(pts: CurvePoint[]): { x1: string; x2: string }[] {
  return stats.computeDrawdownWindows(pts).map((w) => ({ x1: pts[w.startIndex].date, x2: pts[w.endIndex].date }));
}

// ─── Fundamental Bias helpers ─────────────────────────────────────────────────

/** Visual treatment for an Oracle asset/pair bias. Backgrounds are top-lit
 *  radial washes of the score color over the lit surface gradient.
 *
 *  Step 5 note: the original version of this function (pre-rebuild) built
 *  these washes from raw rgba(r,g,b,a) triples. Each triple was the exact
 *  channel value of an existing --lucid-scale-* token (e.g. 78,161,230 =
 *  --lucid-scale-4's #4ea1e6) restated as numbers instead of referencing the
 *  token. Per this step's "no raw colour values" rule, `wash()` now takes the
 *  token itself and blends it with color-mix() — same technique already used
 *  by lucid-theme.css's .score-pos-2 etc. — producing the identical rendered
 *  colour with zero raw values and zero change to which bias maps to which
 *  visual (that switch/case logic is untouched). */
export function biasVisual(bias: AssetBias | null): { color: string; bg: string; border: string; label: string } {
  const wash = (token: string, a: number) =>
    `radial-gradient(130% 100% at 50% 0%, color-mix(in srgb, ${token} ${Math.round(a * 100)}%, transparent), color-mix(in srgb, ${token} 3%, transparent) 78%), var(--lucid-grad-surface-2)`;
  const border = (token: string, a: number) => `color-mix(in srgb, ${token} ${Math.round(a * 100)}%, transparent)`;
  switch (bias) {
    case "Strong Bullish": return { color: "var(--lucid-scale-4)", bg: wash("var(--lucid-scale-4)", 0.22), border: border("var(--lucid-scale-4)", 0.3),  label: "Strong Bull" };
    case "Bullish":        return { color: "var(--lucid-scale-3)", bg: wash("var(--lucid-scale-3)", 0.18), border: border("var(--lucid-scale-3)", 0.25), label: "Bullish" };
    case "Neutral":        return { color: "var(--lucid-scale-2)", bg: wash("var(--lucid-scale-2)", 0.16), border: border("var(--lucid-scale-2)", 0.2),  label: "Neutral" };
    case "Bearish":        return { color: "var(--lucid-scale-1)", bg: wash("var(--lucid-scale-1)", 0.18), border: border("var(--lucid-scale-1)", 0.25), label: "Bearish" };
    case "Strong Bearish": return { color: "var(--lucid-scale-0)", bg: wash("var(--lucid-scale-0)", 0.22), border: border("var(--lucid-scale-0)", 0.3),  label: "Strong Bear" };
    default:               return { color: "var(--lucid-ink-3)",  bg: "var(--lucid-grad-surface-2)", border: "var(--lucid-line)",  label: "No data" };
  }
}

// ─── Status line (Dashboard's own duplicated stat logic — known duplicate of
// logic elsewhere, out of scope for this step; formula moved verbatim, only
// pulled out of its useMemo into a plain function so it can live outside
// page.tsx). Same body as the original inline computation, byte-for-byte
// except liveTrades.length → the liveCount parameter. ──────────────────────

export function buildStatusLine(allAccounts: Account[], readyCount: number, liveCount: number): string {
  const totalPnl = allAccounts.reduce((s, a) => s + accountTradingPnl(a), 0);
  const totalStart = allAccounts.reduce((s, a) => s + a.account_size, 0);
  const pct = totalStart > 0 ? (totalPnl / totalStart) * 100 : 0;
  const inChallenge = allAccounts.filter(
    (a) => isPropAccount(a) && a.status === "Active" && (a.stage === "Stage 1" || a.stage === "Stage 2"),
  ).length;

  let s =
    allAccounts.length > 0
      ? `Across all accounts, you're ${pct >= 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% overall.`
      : "Welcome — add an account to start tracking your trading.";
  if (inChallenge > 0) s += ` ${inChallenge} prop challenge${inChallenge !== 1 ? "s" : ""} active.`;

  if (readyCount > 0 || liveCount > 0) {
    const parts: string[] = [];
    if (readyCount > 0) parts.push(`${readyCount} planned trade${readyCount !== 1 ? "s" : ""} ready`);
    if (liveCount > 0) parts.push(`${liveCount} live trade${liveCount !== 1 ? "s" : ""} running`);
    s += ` You have ${parts.join(" and ")}.`;
  } else {
    s += " Markets are quiet — time to plan or rest.";
  }
  return s;
}
