import type { Trade, Account } from "@/lib/demo-data";
import { accountTradingPnl, isPropAccount } from "@/lib/demo-data";
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

export function applyDateFilter(tradeList: Trade[], preset: DateRangePreset): Trade[] {
  if (preset === "All Time") return tradeList;
  const now = new Date();
  const days = preset === "Last 30d" ? 30 : 90;
  const cutoff = new Date(now.getTime() - days * 86400000);
  return tradeList.filter((t) => {
    const d = t.date_closed ? new Date(t.date_closed) : new Date(t.date_opened);
    return d >= cutoff;
  });
}

export interface CurvePoint {
  date: string;
  cumPnl: number;
  pair: string;
  pnl: number;
}

export function buildPnlCurve(filtered: Trade[]): CurvePoint[] {
  const closed = [...filtered.filter((t) => t.date_closed !== "")].sort(
    (a, b) => new Date(a.date_closed).getTime() - new Date(b.date_closed).getTime()
  );
  const running = filtered.find((t) => t.date_closed === "");

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const points: CurvePoint[] = [];
  let cum = 0;

  for (const t of closed) {
    cum += t.blended_pnl;
    points.push({ date: fmt(t.date_closed), cumPnl: Math.round(cum * 100) / 100, pair: t.pair, pnl: t.blended_pnl });
  }

  if (running) {
    points.push({
      date: fmt(running.date_opened) + " ·Live",
      cumPnl: Math.round(cum * 100) / 100,
      pair: running.pair,
      pnl: 0,
    });
  }

  return points;
}

export function computeDrawdownWindows(pts: CurvePoint[]): { x1: string; x2: string }[] {
  const windows: { x1: string; x2: string }[] = [];
  let peak = -Infinity;
  let inDD = false;
  let ddStartIdx = 0;

  for (let i = 0; i < pts.length; i++) {
    const v = pts[i].cumPnl;
    if (v > peak) {
      if (inDD) {
        windows.push({ x1: pts[ddStartIdx].date, x2: pts[i - 1].date });
        inDD = false;
      }
      peak = v;
    } else if (v < peak && !inDD) {
      inDD = true;
      ddStartIdx = i - 1 >= 0 ? i - 1 : 0;
    }
  }
  if (inDD && pts.length > 0) {
    windows.push({ x1: pts[ddStartIdx].date, x2: pts[pts.length - 1].date });
  }
  return windows;
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

export interface PairBias {
  bias: AssetBias | null;
  score: number | null;
  history: number[] | null;
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
