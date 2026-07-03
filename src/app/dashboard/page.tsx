"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Plus,
  ArrowLeftRight,
  ClipboardList,
  Radar,
  ChevronDown,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import {
  formatCurrency,
  getDistanceToEntry,
  isPropAccount,
  accountTypeLabel,
  accountTradingPnl,
  type Trade,
  type PlannedTrade,
  type Account,
} from "@/lib/demo-data";
import {
  useTrades,
  usePlanned,
  useAccounts,
  useTradingPairs,
  useAddCashFlow,
  useDeleteTrade,
} from "@/hooks/useTrading";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { useAuth } from "@/lib/auth/auth-context";
import { DetailDrawer } from "@/components/DetailDrawer";
import { TradeDrawerContent } from "@/app/trading/journal/TradeDrawerContent";
import {
  AccountDrawerContent,
  AccountTypePill,
  StatusPill,
  calcDrawdown,
  calcGoalProgress,
} from "@/app/trading/accounts/AccountDrawerContent";
import { PlannedDrawerContent } from "@/app/trading/planned/PlannedDrawerContent";
import { AddTradeModal } from "@/app/trading/journal/AddTradeModal";
import { toast } from "@/components/toast";
import { useQuery } from "@tanstack/react-query";
import { Sparkline } from "@/components/Sparkline";
import { bandColor, bandBg, netDisplay } from "@/app/nifty/nifty-utils";
import { getAllFxPairs, getScorecardAsset, type AssetBias } from "@/lib/api/oracle";
import { getLatestScorecard, getScorecardHistory, type PublicScorecard } from "@/lib/api/nifty";

// ─── Greeting ────────────────────────────────────────────────────────────────

function getGreeting(): string {
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

type DateRangePreset = "Last 30d" | "Last 90d" | "All Time";

function applyDateFilter(tradeList: Trade[], preset: DateRangePreset): Trade[] {
  if (preset === "All Time") return tradeList;
  const now = new Date();
  const days = preset === "Last 30d" ? 30 : 90;
  const cutoff = new Date(now.getTime() - days * 86400000);
  return tradeList.filter((t) => {
    const d = t.date_closed ? new Date(t.date_closed) : new Date(t.date_opened);
    return d >= cutoff;
  });
}

interface CurvePoint {
  date: string;
  cumPnl: number;
  pair: string;
  pnl: number;
}

function buildPnlCurve(filtered: Trade[]): CurvePoint[] {
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

function computeDrawdownWindows(pts: CurvePoint[]): { x1: string; x2: string }[] {
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

// ─── Pill helpers ─────────────────────────────────────────────────────────────

function ConvictionPill({ conviction }: { conviction: string }) {
  if (conviction === "High")
    return (
      <span className="pill" style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "1px solid var(--lucid-accent-bd)" }}>
        High
      </span>
    );
  if (conviction === "Medium")
    return (
      <span className="pill" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line)" }}>
        Medium
      </span>
    );
  return (
    <span className="pill" style={{ background: "var(--lucid-surface-2)", color: "var(--lucid-ink-3)", border: "1px solid var(--lucid-line)" }}>
      Low
    </span>
  );
}

function PlannedStatusPill({ status }: { status: string }) {
  if (status === "Ready")
    return (
      <span className="pill" style={{ background: "var(--lucid-warn-bg)", color: "var(--lucid-warn)", border: "1px solid var(--lucid-warn-bd)" }}>
        Ready
      </span>
    );
  return (
    <span className="pill" style={{ background: "var(--lucid-ctx-bg)", color: "var(--lucid-ctx)", border: "1px solid var(--lucid-ctx-bd)" }}>
      Watching
    </span>
  );
}

// ─── PnL Tooltip ──────────────────────────────────────────────────────────────

function PnlTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CurvePoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: "var(--lucid-surface-2)",
        border: "1px solid var(--lucid-line)",
      }}
    >
      <p className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginBottom: 4 }}>{d.date}</p>
      <p className="lt-num" style={{ fontSize: 15, fontWeight: 700, color: "var(--lucid-ink)" }}>{formatCurrency(d.cumPnl)}</p>
      {d.pair && d.pnl !== 0 && (
        <p className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-2)", marginTop: 2 }}>
          {d.pair} · {d.pnl >= 0 ? "+" : ""}{formatCurrency(d.pnl)}
        </p>
      )}
    </div>
  );
}

// ─── Cash Flow Modal (deposit / withdrawal / payout — context aware) ──────────

function CashFlowModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const accountsQuery = useAccounts();
  const addCashFlow = useAddCashFlow();
  const accounts = accountsQuery.data ?? [];

  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState<"deposit" | "withdrawal" | "payout">("deposit");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAccountId(accounts[0]?.id ?? "");
      setType("deposit");
      setDate(new Date().toISOString().slice(0, 10));
      setAmount("");
      setNote("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && !accountId && accounts.length) setAccountId(accounts[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accounts]);

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--lucid-surface-2)",
    border: "1px solid var(--lucid-line)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    color: "var(--lucid-ink)",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--lucid-ink-3)", display: "block", marginBottom: 6 };

  async function handleLog() {
    setError(null);
    const amt = parseFloat(amount);
    if (!accountId) { setError("Select an account."); return; }
    if (Number.isNaN(amt) || amt <= 0) { setError("Enter a valid amount."); return; }
    try {
      await addCashFlow.mutateAsync({ id: accountId, body: { type, amount: amt, date, note: note.trim() || null } });
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} of $${amt.toFixed(2)} logged.`, { title: "Cash flow logged" });
      onClose();
    } catch {
      // The global mutation handler surfaces the error toast.
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="rounded-2xl pointer-events-auto w-full max-w-md mx-4" style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--lucid-line)" }}>
            <h2 className="lt-serif" style={{ fontSize: 15, fontWeight: 600, color: "var(--lucid-ink)" }}>Cash Flow</h2>
            <button onClick={onClose} style={{ color: "var(--lucid-ink-3)", fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
          {accounts.length === 0 ? (
            <div className="px-6 py-8">
              <p style={{ fontSize: 13, color: "var(--lucid-ink-3)", textAlign: "center" }}>No accounts yet. Add an account first.</p>
            </div>
          ) : (
          <div className="px-6 py-5 flex flex-col gap-4">
            <div>
              <label style={labelStyle}>Account</label>
              <select style={inputStyle} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name} ({accountTypeLabel(a.account_type)})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="payout">Payout (prop accounts)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Amount</label>
              <input type="number" placeholder="0.00" min="0" style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Note (optional)</label>
              <textarea rows={2} placeholder="Optional note..." style={{ ...inputStyle, resize: "none" }} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error && <p style={{ fontSize: 12, color: "var(--lucid-neg)" }}>{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm" style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line)" }}>
                Cancel
              </button>
              <button onClick={handleLog} disabled={addCashFlow.isPending} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "var(--lucid-accent)", color: "var(--lucid-bg)", opacity: addCashFlow.isPending ? 0.6 : 1 }}>
                {addCashFlow.isPending ? "Logging…" : "Log"}
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Compact account row ──────────────────────────────────────────────────────

function AccountSnapshotRow({ account, onClick }: { account: Account; onClick: () => void }) {
  const prop = isPropAccount(account);
  const hasGoal = account.profit_goal_pct != null && account.profit_goal_pct > 0;
  const pnl = accountTradingPnl(account);
  const pnlPct = account.account_size > 0 ? (pnl / account.account_size) * 100 : 0;
  const pnlColor = pnl > 0 ? "var(--lucid-pos)" : pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
  const { pct: goalPct } = calcGoalProgress(account);
  const { pctUsed: ddPct } = calcDrawdown(account);
  const ddColor = ddPct >= 80 ? "var(--lucid-neg)" : ddPct >= 60 ? "var(--lucid-warn)" : "var(--lucid-pos)";
  const isPassed = account.status === "Passed";

  return (
    <button
      onClick={onClick}
      className="lt-lift w-full text-left rounded-xl p-4 transition-all duration-150"
      style={{
        background: "var(--lucid-surface-2)",
        border: "1px solid var(--lucid-line)",
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <AccountTypePill type={account.account_type} />
          <span className="truncate" style={{ fontSize: 12, color: "var(--lucid-ink-2)" }}>{account.account_name}</span>
        </div>
        <StatusPill status={account.status} />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <span className="lt-num" style={{ fontSize: 18, fontWeight: 700, color: pnlColor }}>
          {formatCurrency(account.current_balance)}
        </span>
        <span className="lt-num" style={{ fontSize: 12, color: pnlColor }}>
          {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
        </span>
      </div>

      {/* Progress bars — prop shows target + drawdown; personal shows goal if set */}
      {prop ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 10, color: "var(--lucid-ink-3)", width: 36, flexShrink: 0 }}>Target</span>
            <div style={{ flex: 1, height: 4, background: "var(--lucid-surface-3)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: isPassed ? "100%" : `${goalPct}%`, height: "100%", background: "var(--lucid-ink-2)", borderRadius: 2 }} />
            </div>
            <span className="lt-num" style={{ fontSize: 10, color: "var(--lucid-ink-3)", width: 28, textAlign: "right", flexShrink: 0 }}>{isPassed ? "✓" : `${goalPct.toFixed(0)}%`}</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 10, color: "var(--lucid-ink-3)", width: 36, flexShrink: 0 }}>DD</span>
            <div style={{ flex: 1, height: 4, background: "var(--lucid-surface-3)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${ddPct}%`, height: "100%", background: ddColor, borderRadius: 2 }} />
            </div>
            <span className="lt-num" style={{ fontSize: 10, color: "var(--lucid-ink-3)", width: 28, textAlign: "right", flexShrink: 0 }}>{ddPct.toFixed(0)}%</span>
          </div>
        </div>
      ) : hasGoal ? (
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 10, color: "var(--lucid-ink-3)", width: 36, flexShrink: 0 }}>Goal</span>
          <div style={{ flex: 1, height: 4, background: "var(--lucid-surface-3)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${goalPct}%`, height: "100%", background: "var(--lucid-ink-2)", borderRadius: 2 }} />
          </div>
          <span className="lt-num" style={{ fontSize: 10, color: "var(--lucid-ink-3)", width: 28, textAlign: "right", flexShrink: 0 }}>{goalPct.toFixed(0)}%</span>
        </div>
      ) : null}
    </button>
  );
}

// ─── Fundamental Bias + NIFTY helpers ─────────────────────────────────────────

/** Visual treatment for an Oracle asset/pair bias. */
function biasVisual(bias: AssetBias | null): { color: string; bg: string; border: string; label: string } {
  switch (bias) {
    case "Strong Bullish": return { color: "var(--lucid-scale-4)", bg: "rgba(78,161,230,0.14)",  border: "rgba(78,161,230,0.3)",  label: "Strong Bull" };
    case "Bullish":        return { color: "var(--lucid-scale-3)", bg: "rgba(72,186,124,0.12)",  border: "rgba(72,186,124,0.25)", label: "Bullish" };
    case "Neutral":        return { color: "var(--lucid-scale-2)", bg: "rgba(205,167,79,0.1)",   border: "rgba(205,167,79,0.2)",  label: "Neutral" };
    case "Bearish":        return { color: "var(--lucid-scale-1)", bg: "rgba(224,145,63,0.12)",  border: "rgba(224,145,63,0.25)", label: "Bearish" };
    case "Strong Bearish": return { color: "var(--lucid-scale-0)", bg: "rgba(226,88,77,0.14)",   border: "rgba(226,88,77,0.3)",   label: "Strong Bear" };
    default:               return { color: "var(--lucid-ink-3)",  bg: "var(--lucid-surface-2)", border: "var(--lucid-line)",     label: "No data" };
  }
}

interface PairBias {
  bias: AssetBias | null;
  score: number | null;
  history: number[] | null;
}

function FundamentalBiasTile({
  flagA, flagB, name, data, onClick,
}: {
  flagA: string; flagB: string; name: string; data: PairBias | undefined; onClick: () => void;
}) {
  const has = !!data && data.bias != null;
  const v = biasVisual(data?.bias ?? null);
  return (
    <button
      onClick={onClick}
      className="lt-lift rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all duration-150"
      style={{ background: v.bg, border: `1px solid ${v.border}` }}
    >
      <span style={{ fontSize: 18 }}>{flagA}{flagB}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--lucid-ink-2)" }}>{name}</span>
      {has ? (
        <span className="lt-num" style={{ fontSize: 20, fontWeight: 700, color: v.color, lineHeight: 1 }}>
          {data!.score != null ? `${data!.score > 0 ? "+" : ""}${data!.score}` : "—"}
        </span>
      ) : (
        <span style={{ fontSize: 18, color: "var(--lucid-ink-3)", lineHeight: 1 }}>—</span>
      )}
      <span style={{ fontSize: 9.5, fontWeight: 600, color: has ? v.color : "var(--lucid-ink-3)", letterSpacing: "0.02em" }}>
        {v.label}
      </span>
    </button>
  );
}

function NiftyMetric({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div className="flex flex-col">
      <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--lucid-ink-3)" }}>{label}</span>
      <span className="lt-num" style={{ fontSize: big ? 24 : 16, fontWeight: 700, color: color ?? "var(--lucid-ink)", lineHeight: 1.1 }}>
        {value}
      </span>
    </div>
  );
}

function NiftyPulseCard({ latest, history }: { latest: PublicScorecard; history: number[] }) {
  const color = bandColor(latest.band);
  return (
    <Link
      href="/nifty/scorecard"
      className="block rounded-xl p-4 mb-5 transition-all duration-150"
      style={{ background: bandBg(latest.band), border: `1px solid ${color}33`, textDecoration: "none" }}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Identity */}
        <div className="flex items-center gap-2.5">
          <span style={{ fontSize: 22 }}>🇮🇳</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--lucid-ink)" }}>NIFTY 50 Macro</p>
            <p style={{ fontSize: 12, fontWeight: 600, color }}>{latest.band}</p>
          </div>
        </div>

        {/* Composite metrics */}
        <div className="flex items-center gap-5">
          <NiftyMetric label="Net" value={netDisplay(latest.net_score)} color={color} big />
          <NiftyMetric label="Domestic" value={netDisplay(latest.domestic_composite)} />
          <NiftyMetric label="External" value={netDisplay(latest.external_composite)} />
        </div>

        {/* Trend + CTA */}
        <div className="flex items-center gap-3 ml-auto">
          {history.length >= 2 && <Sparkline data={history} width={100} height={32} />}
          <span style={{ fontSize: 11, color: "var(--lucid-ink-2)", whiteSpace: "nowrap" }}>View scorecard →</span>
        </div>
      </div>
    </Link>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { dbUser } = useAuth();
  // First name for the greeting; falls back gracefully when the name isn't set.
  const firstName = dbUser?.name?.trim().split(/\s+/)[0] ?? "";

  // Drawer state
  const [tradeDrawer, setTradeDrawer] = useState<Trade | null>(null);
  const [plannedDrawer, setPlannedDrawer] = useState<PlannedTrade | null>(null);
  const [accountDrawer, setAccountDrawer] = useState<Account | null>(null);

  // Modal state
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [showCashFlow, setShowCashFlow] = useState(false);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [pendingDeleteTrade, setPendingDeleteTrade] = useState<Trade | null>(null);
  const deleteTrade = useDeleteTrade();

  // Chat input
  const [chatValue, setChatValue] = useState("");

  // P&L curve date range
  const [dateRange, setDateRange] = useState<DateRangePreset>("All Time");
  const [rangeDropdown, setRangeDropdown] = useState(false);
  const rangeRef = useRef<HTMLDivElement>(null);

  // Live data
  const tradesQuery = useTrades();
  const plannedQuery = usePlanned();
  const accountsQuery = useAccounts();
  const pairsQuery = useTradingPairs();

  // Fundamental bias (Oracle) + NIFTY macro pulse — independent of trading data.
  const fxPairsQuery = useQuery({ queryKey: ["oracle", "fx-scorecard", "__all__"], queryFn: getAllFxPairs });
  // Gold is an asset (not an FX pair). The /scorecard endpoint is single-asset
  // (asset= is required), so fetch Gold directly rather than as an "all" call.
  const goldQuery = useQuery({ queryKey: ["oracle", "scorecard", "Gold"], queryFn: () => getScorecardAsset("Gold") });
  const niftyLatestQuery = useQuery({ queryKey: ["nifty", "scorecard", "latest"], queryFn: getLatestScorecard });
  const niftyHistoryQuery = useQuery({
    queryKey: ["nifty", "scorecard", "history-lite", 30],
    queryFn: () => getScorecardHistory({ includeBreakdown: false, limit: 30 }),
  });

  const allTrades = useMemo(() => tradesQuery.data ?? [], [tradesQuery.data]);
  const allPlanned = useMemo(() => plannedQuery.data ?? [], [plannedQuery.data]);
  const allAccounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const pairs = useMemo(() => pairsQuery.data ?? [], [pairsQuery.data]);

  // Map each tracked pair's symbol → its fundamental bias. FX majors come from
  // the FX scorecard; XAUUSD maps to the Gold asset scorecard.
  const biasByPair = useMemo(() => {
    const map = new Map<string, PairBias>();
    for (const fx of fxPairsQuery.data ?? []) {
      map.set(fx.key, { bias: fx.bias, score: fx.totalScore, history: fx.scoreHistory });
    }
    const gold = goldQuery.data;
    if (gold) map.set("XAUUSD", { bias: gold.bias, score: gold.totalScore, history: gold.scoreHistory });
    return map;
  }, [fxPairsQuery.data, goldQuery.data]);

  // NIFTY net-score trend (oldest → newest) for the pulse sparkline.
  const niftyHistory = useMemo(
    () => [...(niftyHistoryQuery.data ?? [])].map((s) => s.net_score).reverse(),
    [niftyHistoryQuery.data],
  );
  const biasLoading = fxPairsQuery.isLoading || goldQuery.isLoading;

  const isLoading = tradesQuery.isLoading || accountsQuery.isLoading || plannedQuery.isLoading;
  const loadError = tradesQuery.error || accountsQuery.error || plannedQuery.error;

  // Greeting (computed on render from IST time)
  const greeting = getGreeting();

  // Live and planned counts
  const liveTrades = useMemo(() => allTrades.filter((t) => t.date_closed === ""), [allTrades]);
  const activePlanned = useMemo(
    () => allPlanned.filter((p) => p.status === "Watching" || p.status === "Ready"),
    [allPlanned]
  );
  const readyCount = useMemo(() => allPlanned.filter((p) => p.status === "Ready").length, [allPlanned]);

  // Status line — type-agnostic, framed off whatever accounts exist
  const statusLine = useMemo(() => {
    const totalPnl = allAccounts.reduce((s, a) => s + accountTradingPnl(a), 0);
    const totalStart = allAccounts.reduce((s, a) => s + a.account_size, 0);
    const pct = totalStart > 0 ? (totalPnl / totalStart) * 100 : 0;
    const inChallenge = allAccounts.filter(
      (a) => isPropAccount(a) && a.status === "Active" && (a.stage === "Stage 1" || a.stage === "Stage 2"),
    ).length;

    let s =
      allAccounts.length > 0
        ? `Your accounts are ${pct >= 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% overall.`
        : "Welcome — add an account to start tracking your trading.";
    if (inChallenge > 0) s += ` ${inChallenge} prop challenge${inChallenge !== 1 ? "s" : ""} active.`;

    if (readyCount > 0 || liveTrades.length > 0) {
      const parts: string[] = [];
      if (readyCount > 0) parts.push(`${readyCount} planned trade${readyCount !== 1 ? "s" : ""} ready`);
      if (liveTrades.length > 0) parts.push(`${liveTrades.length} live trade${liveTrades.length !== 1 ? "s" : ""} running`);
      s += ` You have ${parts.join(" and ")}.`;
    } else {
      s += " Markets are quiet — time to plan or rest.";
    }
    return s;
  }, [allAccounts, readyCount, liveTrades.length]);

  // Metric cards
  const metrics = useMemo(() => {
    const activeAccounts = allAccounts.filter((a) => a.status === "Active");
    const totalBalance = allAccounts.reduce((s, a) => s + a.current_balance, 0);
    const overallPnl = allAccounts.reduce((s, a) => s + accountTradingPnl(a), 0);
    const activeCount = activeAccounts.length;

    const closedSorted = [...allTrades.filter((t) => t.date_closed !== "")].sort(
      (a, b) => new Date(b.date_closed).getTime() - new Date(a.date_closed).getTime()
    );
    const last20 = closedSorted.slice(0, 20);
    // Outcome decided by manual net P&L (blended_pnl), matching the journal.
    const wins = last20.filter((t) => t.blended_pnl > 0);
    const losses = last20.filter((t) => t.blended_pnl < 0);
    const wr = wins.length + losses.length > 0 ? (wins.length / (wins.length + losses.length)) * 100 : 0;

    // Adaptive 4th metric: challenges if any prop accounts exist, else best performer.
    const propAccounts = allAccounts.filter(isPropAccount);
    const challengesActive = propAccounts.filter(
      (a) => a.status === "Active" && (a.stage === "Stage 1" || a.stage === "Stage 2"),
    ).length;
    const pnlPct = (a: Account) => (a.account_size > 0 ? accountTradingPnl(a) / a.account_size : 0);
    const best = [...allAccounts].sort((a, b) => pnlPct(b) - pnlPct(a))[0] ?? null;

    return {
      totalBalance,
      overallPnl,
      activeCount,
      wr,
      tradeCount: last20.length,
      hasProp: propAccounts.length > 0,
      challengesActive,
      bestName: best?.account_name ?? "—",
      bestPct: best ? pnlPct(best) * 100 : 0,
    };
  }, [allAccounts, allTrades]);

  // P&L Curve
  const curveData = useMemo(() => {
    const filtered = applyDateFilter(allTrades, dateRange);
    return buildPnlCurve(filtered);
  }, [allTrades, dateRange]);

  const drawdownWindows = useMemo(() => computeDrawdownWindows(curveData), [curveData]);

  // Close range dropdown on outside click
  useEffect(() => {
    if (!rangeDropdown) return;
    function handle(e: MouseEvent) {
      if (rangeRef.current && !rangeRef.current.contains(e.target as Node)) setRangeDropdown(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [rangeDropdown]);

  function handleChatSubmit() {
    toast.info("Lucid AI activates with full context of your trading system in Phase 3.", {
      title: "✨ Coming in Phase 3",
    });
  }

  const pairsConfig = pairs;

  return (
    <div className="min-h-screen" style={{ color: "var(--lucid-ink)" }}>
      <div className="flex flex-col gap-6 sm:gap-8 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-350 mx-auto">

        {/* ── Section 1: Hero ────────────────────────────────────────────────── */}
        <div className="lt-edge lt-hero-wash -z-1 p-5 sm:p-8" style={{ border: "1px solid var(--lucid-line)", borderRadius: "var(--lucid-r-lg)" }}>
          {/* Greeting + status */}
          <div className="mb-6">
            <h1 className="lt-serif" style={{ fontSize: 34, fontWeight: 700, color: "var(--lucid-ink)", lineHeight: 1.15, marginBottom: 8, letterSpacing: "-0.01em" }}>
              {greeting}{firstName ? `, ${firstName}` : ""}.
            </h1>
            <p style={{ fontSize: 14, color: "var(--lucid-ink-2)" }}>{statusLine}</p>
          </div>

          {/* Lucid chat input bar */}
          <div
            className="rounded-xl flex items-center gap-3 px-4"
            style={{
              height: 56,
              background: "var(--lucid-surface-2)",
              border: "1px solid var(--lucid-line)",
            }}
          >
            <Sparkles size={18} style={{ color: "var(--lucid-accent)", flexShrink: 0 }} />
            <input
              value={chatValue}
              onChange={(e) => setChatValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleChatSubmit(); }}
              placeholder="Ask Lucid anything about your trading..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "var(--lucid-ink)", caretColor: "var(--lucid-accent)" } as React.CSSProperties}
            />
            <button
              onClick={handleChatSubmit}
              className="lt-hover flex items-center justify-center rounded-lg transition-all"
              style={{ width: 36, height: 36, background: "var(--lucid-accent)", flexShrink: 0 }}
            >
              <ArrowRight size={16} style={{ color: "var(--lucid-bg)" }} />
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginTop: 10 }}>
            <span className="pill" style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line-2)", fontSize: 10, marginRight: 6 }}>
              Phase 3
            </span>
            Lucid AI activates with full context of your trading system.
          </p>
        </div>

        {/* ── Section 2: Quick Actions ───────────────────────────────────────── */}
        <div>
          <div className="lt-eyebrow mb-3">
            Quick Actions
            <span className="lt-eyebrow-ln" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              icon: <Plus size={20} />,
              label: "Log Trade",
              desc: "Record a new position",
              action: () => setShowAddTrade(true),
            },
            {
              icon: <ArrowLeftRight size={20} />,
              label: "Cash Flow",
              desc: "Deposit, withdrawal or payout",
              action: () => setShowCashFlow(true),
            },
            {
              icon: <ClipboardList size={20} />,
              label: "View Planned",
              desc: "Review your setup watchlist",
              action: () => router.push("/trading/planned"),
            },
            {
              icon: <Radar size={20} />,
              label: "Open Scanner",
              desc: "Top setups and scores",
              action: () => router.push("/oracle"),
            },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="lt-card-2 lt-lift text-left rounded-xl p-5 flex flex-col gap-3 transition-all duration-150"
              style={{ height: 88, cursor: "pointer" }}
            >
              <div className="flex items-center gap-3">
                <span style={{ color: "var(--lucid-ink-2)" }}>{item.icon}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--lucid-ink)", lineHeight: 1.2 }}>{item.label}</p>
                  <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginTop: 2 }}>{item.desc}</p>
                </div>
              </div>
            </button>
          ))}
          </div>
        </div>

        {isLoading ? (
          <LoadingState message="Loading your dashboard…" />
        ) : loadError ? (
          <ErrorState
            error={loadError}
            onRetry={() => { tradesQuery.refetch(); accountsQuery.refetch(); plannedQuery.refetch(); }}
            title="Couldn't load your dashboard"
          />
        ) : (
        <>
        {/* ── Section 3: Metric Cards ────────────────────────────────────────── */}
        <div>
          <div className="lt-eyebrow mb-3">
            Overview
            <span className="lt-eyebrow-ln" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Total Balance */}
          <div className="lt-card lt-edge p-5 flex flex-col gap-2">
            <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--lucid-ink-3)" }}>
              Total Balance
            </span>
            <span className="lt-num" style={{ fontSize: 30, fontWeight: 700, color: "var(--lucid-ink)" }}>
              {formatCurrency(metrics.totalBalance)}
            </span>
            <span style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>Across all accounts</span>
          </div>

          {/* Overall P&L */}
          <div className="lt-card lt-edge p-5 flex flex-col gap-2">
            <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--lucid-ink-3)" }}>
              Overall P&amp;L
            </span>
            <span
              className="lt-num"
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: metrics.overallPnl > 0 ? "var(--lucid-pos)" : metrics.overallPnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)",
              }}
            >
              {metrics.overallPnl >= 0 ? "+" : ""}{formatCurrency(metrics.overallPnl)}
            </span>
            <span style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>Across all accounts</span>
          </div>

          {/* Active Accounts */}
          <div className="lt-card lt-edge p-5 flex flex-col gap-2">
            <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--lucid-ink-3)" }}>
              Active Accounts
            </span>
            <span className="lt-num" style={{ fontSize: 30, fontWeight: 700, color: "var(--lucid-ink)" }}>
              {metrics.activeCount}
            </span>
            <span style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>
              {allAccounts.length} total accounts
            </span>
          </div>

          {/* Rolling Win Rate — a neutral stat, not a loss signal, so it stays ink-toned regardless of value */}
          <div className="lt-card lt-edge p-5 flex flex-col gap-2">
            <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--lucid-ink-3)" }}>
              Rolling Win Rate
            </span>
            <span
              className="lt-num"
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: "var(--lucid-ink)",
              }}
            >
              {metrics.wr.toFixed(0)}%
            </span>
            <span style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>Last {metrics.tradeCount} trades</span>
          </div>

          {/* Adaptive: Challenges Active (if prop accounts) else Best Performer */}
          <div className="lt-card lt-edge p-5 flex flex-col gap-2">
            {metrics.hasProp ? (
              <>
                <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--lucid-ink-3)" }}>
                  Challenges Active
                </span>
                <span className="lt-num" style={{ fontSize: 30, fontWeight: 700, color: "var(--lucid-ctx)" }}>
                  {metrics.challengesActive}
                </span>
                <span style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>In challenge phase</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--lucid-ink-3)" }}>
                  Best Performing Account
                </span>
                <span className="truncate" style={{ fontSize: 18, fontWeight: 700, color: "var(--lucid-ink)" }}>
                  {metrics.bestName}
                </span>
                <span className="lt-num" style={{ fontSize: 11, color: metrics.bestPct >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                  {metrics.bestPct >= 0 ? "+" : ""}{metrics.bestPct.toFixed(2)}%
                </span>
              </>
            )}
          </div>
          </div>
        </div>

        {/* ── Section 4: P&L Curve ───────────────────────────────────────────── */}
        <div className="lt-card lt-edge p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="lt-eyebrow" style={{ flex: 1, marginRight: 16 }}>
              Performance
              <span className="lt-eyebrow-ln" />
            </div>

            {/* Date range dropdown */}
            <div ref={rangeRef} className="relative">
              <button
                onClick={() => setRangeDropdown((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
                style={{
                  fontSize: 12,
                  color: "var(--lucid-ink-2)",
                  background: "var(--lucid-surface-2)",
                  border: "1px solid var(--lucid-line)",
                }}
              >
                {dateRange}
                <ChevronDown size={12} />
              </button>
              {rangeDropdown && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-xl py-1 z-20"
                  style={{
                    background: "var(--lucid-surface-2)",
                    border: "1px solid var(--lucid-line-2)",
                    minWidth: 120,
                  }}
                >
                  {(["Last 30d", "Last 90d", "All Time"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => { setDateRange(p); setRangeDropdown(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-(--lucid-line) transition-colors"
                      style={{ color: dateRange === p ? "var(--lucid-ink)" : "var(--lucid-ink-2)" }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={curveData} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--lucid-accent)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--lucid-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--lucid-line)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--lucid-ink-3)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--lucid-ink-3)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
                width={52}
              />
              <Tooltip content={<PnlTooltip />} />
              <ReferenceLine y={0} stroke="var(--lucid-line-2)" strokeDasharray="4 4" />
              {drawdownWindows.map((w, i) => (
                <ReferenceArea
                  key={i}
                  x1={w.x1}
                  x2={w.x2}
                  fill="var(--lucid-neg)"
                  fillOpacity={0.08}
                />
              ))}
              <Area
                type="monotone"
                dataKey="cumPnl"
                stroke="var(--lucid-accent)"
                strokeWidth={2}
                fill="url(#pnlGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "var(--lucid-accent)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Section 5: Two-Column Strip ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

          {/* Left — Live + Planned Trades */}
          <div className="lt-card lt-edge p-5 flex flex-col gap-6">

            {/* Sub-section A: Live Trades */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="lt-serif" style={{ fontSize: 13, fontWeight: 600, color: "var(--lucid-ink)" }}>Live Trades</h3>
                <span
                  className="pill lt-num"
                  style={{ background: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line-2)", fontSize: 10 }}
                >
                  {liveTrades.length}
                </span>
              </div>

              {liveTrades.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>No live trades running.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {liveTrades.map((t) => {
                    const pairConf = pairsConfig.find((p) => p.symbol === t.pair);
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTradeDrawer(t)}
                        className="lt-lift lt-card-2 w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 flex items-center gap-3"
                      >
                        <span style={{ fontSize: 15 }}>
                          {pairConf?.flag_a}{pairConf?.flag_b}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--lucid-ink)" }}>
                              {pairConf?.display_name ?? t.pair}
                            </span>
                            <span style={{ fontSize: 12, color: t.direction === "Buy" ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                              {t.direction === "Buy" ? "↑" : "↓"} {t.direction}
                            </span>
                          </div>
                          <span className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>
                            Entry {t.entry_price}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="pill"
                            style={{
                              background: "var(--lucid-pos-bg)",
                              color: "var(--lucid-pos)",
                              border: "1px solid var(--lucid-pos-bd)",
                              fontSize: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                background: "var(--lucid-pos)",
                                animation: "pulse 2s infinite",
                              }}
                            />
                            Live
                          </span>
                          <ConvictionPill conviction={t.conviction} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "var(--lucid-line)" }} />

            {/* Sub-section B: Planned Trades */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="lt-serif" style={{ fontSize: 13, fontWeight: 600, color: "var(--lucid-ink)" }}>Planned Trades</h3>
                <span
                  className="pill lt-num"
                  style={{
                    background: readyCount > 0 ? "var(--lucid-warn-bg)" : "var(--lucid-ctx-bg)",
                    color: readyCount > 0 ? "var(--lucid-warn)" : "var(--lucid-ctx)",
                    border: readyCount > 0 ? "1px solid var(--lucid-warn-bd)" : "1px solid var(--lucid-ctx-bd)",
                    fontSize: 10,
                  }}
                >
                  {readyCount} ready
                </span>
              </div>

              {activePlanned.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>No setups planned.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {activePlanned.map((p) => {
                    const pairConf = pairsConfig.find((pc) => pc.symbol === p.pair);
                    const dist = getDistanceToEntry(p);
                    const distLabel =
                      dist.direction === "at"
                        ? "at entry"
                        : `${dist.pips}p ${dist.direction}`;
                    const distColor =
                      dist.direction === "at"
                        ? "var(--lucid-pos)"
                        : dist.pips <= 10
                        ? "var(--lucid-warn)"
                        : dist.pips <= 50
                        ? "var(--lucid-ink)"
                        : "var(--lucid-ink-3)";
                    return (
                      <button
                        key={p.id}
                        onClick={() => setPlannedDrawer(p)}
                        className="lt-lift w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 flex items-center gap-3"
                        style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}
                      >
                        <span style={{ fontSize: 15 }}>{pairConf?.flag_a}{pairConf?.flag_b}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--lucid-ink)" }}>
                              {pairConf?.display_name ?? p.pair}
                            </span>
                            <span style={{ fontSize: 12, color: p.direction === "Buy" ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                              {p.direction === "Buy" ? "↑" : "↓"}
                            </span>
                          </div>
                          <span className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>
                            @ {p.planned_entry}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="lt-num" style={{ fontSize: 11, color: distColor }}>
                            {distLabel}
                          </span>
                          <PlannedStatusPill status={p.status} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right — Account Snapshot */}
          <div className="lt-card lt-edge p-5">
            <div className="flex items-center justify-between mb-4 gap-4">
              <div className="lt-eyebrow" style={{ flex: 1 }}>
                Accounts
                <span className="lt-eyebrow-ln" />
              </div>
              <Link
                href="/trading/accounts"
                style={{ fontSize: 11, color: "var(--lucid-ink-2)", textDecoration: "none", flexShrink: 0 }}
              >
                View all →
              </Link>
            </div>

            {allAccounts.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>No accounts yet. Add one to get started.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {allAccounts.map((account) => (
                  <AccountSnapshotRow
                    key={account.id}
                    account={account}
                    onClick={() => setAccountDrawer(account)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Section 6: Fundamental Bias (FX + Gold) + NIFTY Macro ──────────── */}
        <div className="lt-card lt-edge p-5">
          <div className="flex items-center justify-between mb-5 gap-4">
            <div className="flex items-center gap-3" style={{ flex: 1 }}>
              <div className="lt-eyebrow" style={{ flex: 1 }}>
                Fundamental Bias
                <span className="lt-eyebrow-ln" />
              </div>
              <span
                className="pill"
                style={{ background: "var(--lucid-pos-bg)", color: "var(--lucid-pos)", border: "1px solid var(--lucid-pos-bd)", fontSize: 10, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--lucid-pos)", animation: "pulse 2s infinite" }} />
                Live
              </span>
            </div>
            <Link href="/oracle" style={{ fontSize: 11, color: "var(--lucid-ink-2)", textDecoration: "none", flexShrink: 0 }}>
              Open Scanner →
            </Link>
          </div>

          {/* NIFTY macro pulse */}
          {niftyLatestQuery.isLoading ? (
            <div className="rounded-xl p-4 mb-5" style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}>
              <p style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>Loading NIFTY macro…</p>
            </div>
          ) : niftyLatestQuery.data ? (
            <NiftyPulseCard latest={niftyLatestQuery.data} history={niftyHistory} />
          ) : (
            <Link
              href="/nifty/scorecard"
              className="block rounded-xl p-4 mb-5"
              style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)", textDecoration: "none" }}
            >
              <p style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>
                🇮🇳 NIFTY macro scorecard not available yet — <span style={{ color: "var(--lucid-ink-2)" }}>open the scorecard →</span>
              </p>
            </Link>
          )}

          {/* FX + Gold bias for the user's tracked pairs */}
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--lucid-ink-3)", marginBottom: 10 }}>
            Your pairs · fundamental bias
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
            {pairsConfig.map((pair) => {
              const data = biasByPair.get(pair.symbol);
              const target =
                pair.symbol === "XAUUSD"
                  ? "/oracle/scorecard"
                  : biasByPair.has(pair.symbol)
                  ? "/oracle/fx-scorecard"
                  : "/oracle";
              return (
                <FundamentalBiasTile
                  key={pair.symbol}
                  flagA={pair.flag_a}
                  flagB={pair.flag_b}
                  name={pair.display_name}
                  data={data}
                  onClick={() => router.push(target)}
                />
              );
            })}
          </div>

          <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginTop: 14 }}>
            {biasLoading
              ? "Loading fundamental bias…"
              : "Bias blends fundamental scores and COT positioning from the Scanner."}
          </p>
        </div>
        </>
        )}

      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AddTradeModal open={showAddTrade} onClose={() => setShowAddTrade(false)} />
      <AddTradeModal open={!!editTrade} editTrade={editTrade ?? undefined} onClose={() => setEditTrade(null)} />
      <CashFlowModal open={showCashFlow} onClose={() => setShowCashFlow(false)} />

      <ConfirmDialog
        open={!!pendingDeleteTrade}
        title="Delete trade?"
        message={pendingDeleteTrade ? `This ${pendingDeleteTrade.pair} ${pendingDeleteTrade.direction} trade will be permanently deleted.` : undefined}
        confirmLabel="Delete"
        loading={deleteTrade.isPending}
        onConfirm={() => {
          const t = pendingDeleteTrade;
          if (!t) return;
          deleteTrade.mutate(t.id, {
            onSuccess: () => { toast.success("Trade deleted."); setTradeDrawer(null); },
            onSettled: () => setPendingDeleteTrade(null),
          });
        }}
        onCancel={() => setPendingDeleteTrade(null)}
      />

      {/* ── DetailDrawers ────────────────────────────────────────────────────── */}

      {/* Trade Drawer */}
      <DetailDrawer
        open={tradeDrawer !== null}
        onClose={() => setTradeDrawer(null)}
        title={tradeDrawer ? `Trade #${tradeDrawer.id.slice(0, 8)}` : ""}
        expandHref={tradeDrawer ? `/trading/journal/${tradeDrawer.id}` : undefined}
      >
        {tradeDrawer && (
          <TradeDrawerContent
            trade={tradeDrawer}
            onEdit={() => { setEditTrade(tradeDrawer); setTradeDrawer(null); }}
            onDelete={() => setPendingDeleteTrade(tradeDrawer)}
          />
        )}
      </DetailDrawer>

      {/* Planned Trade Drawer */}
      <DetailDrawer
        open={plannedDrawer !== null}
        onClose={() => setPlannedDrawer(null)}
        title={plannedDrawer ? `${plannedDrawer.pair} ${plannedDrawer.direction}` : ""}
        expandHref={plannedDrawer ? `/trading/planned/${plannedDrawer.id}` : undefined}
      >
        {plannedDrawer && (
          <PlannedDrawerContent
            trade={plannedDrawer}
            onConvert={() => {
              setPlannedDrawer(null);
              setShowAddTrade(true);
            }}
            onMarkInvalidated={() => setPlannedDrawer(null)}
          />
        )}
      </DetailDrawer>

      {/* Account Drawer */}
      <DetailDrawer
        open={accountDrawer !== null}
        onClose={() => setAccountDrawer(null)}
        title={accountDrawer?.account_name ?? ""}
        expandHref={accountDrawer ? `/trading/accounts/${accountDrawer.id}` : undefined}
      >
        {accountDrawer && (
          <AccountDrawerContent
            account={accountDrawer}
            accountTrades={allTrades.filter((t) => t.account_id === accountDrawer.id)}
            onTradeClick={(tradeId) => {
              const t = allTrades.find((tr) => tr.id === tradeId);
              if (!t) return;
              setAccountDrawer(null);
              setTimeout(() => setTradeDrawer(t), 150);
            }}
          />
        )}
      </DetailDrawer>
    </div>
  );
}
