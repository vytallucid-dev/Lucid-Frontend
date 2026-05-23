"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Plus,
  DollarSign,
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
  trades as allTrades,
  plannedTrades as allPlanned,
  accounts as allAccounts,
  pairs,
  formatCurrency,
  getDistanceToEntry,
  type Trade,
  type PlannedTrade,
  type Account,
} from "@/lib/demo-data";
import { DetailDrawer } from "@/components/DetailDrawer";
import { TradeDrawerContent } from "@/app/trading/journal/TradeDrawerContent";
import {
  AccountDrawerContent,
  StagePill,
  StatusPill,
  calcDrawdown,
  calcGoalProgress,
} from "@/app/trading/accounts/AccountDrawerContent";
import { PlannedDrawerContent } from "@/app/trading/planned/PlannedDrawerContent";
import { AddTradeModal } from "@/app/trading/journal/AddTradeModal";

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
      <span className="pill" style={{ background: "rgba(59,130,246,0.15)", color: "#93C5FD", border: "1px solid rgba(59,130,246,0.25)" }}>
        High
      </span>
    );
  if (conviction === "Medium")
    return (
      <span className="pill" style={{ background: "rgba(148,163,184,0.1)", color: "#94A3B8", border: "1px solid rgba(148,163,184,0.2)" }}>
        Medium
      </span>
    );
  return (
    <span className="pill" style={{ background: "rgba(100,116,139,0.1)", color: "#64748B", border: "1px solid rgba(100,116,139,0.15)" }}>
      Low
    </span>
  );
}

function PlannedStatusPill({ status }: { status: string }) {
  if (status === "Ready")
    return (
      <span className="pill" style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}>
        Ready
      </span>
    );
  return (
    <span className="pill" style={{ background: "rgba(59,130,246,0.12)", color: "#93C5FD", border: "1px solid rgba(59,130,246,0.2)" }}>
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
        background: "rgba(10,14,20,0.95)",
        border: "1px solid rgba(148,163,184,0.2)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}
    >
      <p style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>{d.date}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: "#E2E8F0" }}>{formatCurrency(d.cumPnl)}</p>
      {d.pair && d.pnl !== 0 && (
        <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
          {d.pair} · {d.pnl >= 0 ? "+" : ""}{formatCurrency(d.pnl)}
        </p>
      )}
    </div>
  );
}

// ─── Log Payout Modal (lightweight) ───────────────────────────────────────────

function LogPayoutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  const fundedAccounts = allAccounts.filter((a) => a.stage === "Funded");
  const activeAccounts = allAccounts.filter((a) => a.status === "Active");
  const payoutTargets = fundedAccounts.length > 0 ? fundedAccounts : activeAccounts;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(20,28,40,0.8)",
    border: "1px solid rgba(148,163,184,0.12)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    color: "#E2E8F0",
    outline: "none",
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      >
        <div
          className="rounded-2xl pointer-events-auto w-full max-w-md mx-4"
          style={{
            background: "rgba(12,18,30,0.98)",
            border: "1px solid rgba(148,163,184,0.12)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#E2E8F0" }}>Log Payout</h2>
            <button onClick={onClose} style={{ color: "#64748B", fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
          <div className="px-6 py-5 flex flex-col gap-4">
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748B", display: "block", marginBottom: 6 }}>
                Account
              </label>
              <select style={inputStyle}>
                {payoutTargets.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748B", display: "block", marginBottom: 6 }}>
                Date
              </label>
              <input type="date" style={inputStyle} defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748B", display: "block", marginBottom: 6 }}>
                Amount ($)
              </label>
              <input type="number" placeholder="0.00" min="0" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#64748B", display: "block", marginBottom: 6 }}>
                Notes (optional)
              </label>
              <textarea rows={2} placeholder="Optional note..." style={{ ...inputStyle, resize: "none" }} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm" style={{ background: "rgba(148,163,184,0.08)", color: "#94A3B8", border: "1px solid rgba(148,163,184,0.1)" }}>
                Cancel
              </button>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ background: "#3B82F6", color: "#fff" }}>
                Log Payout
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Compact account row ──────────────────────────────────────────────────────

function AccountSnapshotRow({ account, onClick }: { account: Account; onClick: () => void }) {
  const pnl = account.current_balance - account.account_size;
  const pnlPct = (pnl / account.account_size) * 100;
  const pnlColor = pnl > 0 ? "#10B981" : pnl < 0 ? "#EF4444" : "#94A3B8";
  const { pct: goalPct } = calcGoalProgress(account);
  const { pctUsed: ddPct } = calcDrawdown(account);
  const ddColor = ddPct >= 80 ? "#EF4444" : ddPct >= 60 ? "#F59E0B" : "#10B981";
  const isPassed = account.status === "Passed";

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-4 transition-all duration-150"
      style={{
        background: "rgba(20,28,40,0.6)",
        border: "1px solid rgba(148,163,184,0.08)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(28,38,54,0.8)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(59,130,246,0.2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(20,28,40,0.6)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(148,163,184,0.08)";
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 12, color: "#64748B" }}>
          {account.prop_firm} · {account.account_name}
        </span>
        <StatusPill status={account.status} />
      </div>

      <div className="flex items-center gap-3 mb-3">
        <span style={{ fontSize: 18, fontWeight: 700, color: pnlColor, fontVariantNumeric: "tabular-nums" }}>
          {formatCurrency(account.current_balance)}
        </span>
        <span style={{ fontSize: 12, color: pnlColor }}>
          {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
        </span>
      </div>

      {/* Progress bars */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 10, color: "#475569", width: 32, flexShrink: 0 }}>Goal</span>
          <div style={{ flex: 1, height: 4, background: "rgba(148,163,184,0.12)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: isPassed ? "100%" : `${goalPct}%`, height: "100%", background: "#3B82F6", borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 10, color: "#64748B", width: 28, textAlign: "right", flexShrink: 0 }}>
            {isPassed ? "✓" : `${goalPct.toFixed(0)}%`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 10, color: "#475569", width: 32, flexShrink: 0 }}>DD</span>
          <div style={{ flex: 1, height: 4, background: "rgba(148,163,184,0.12)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${ddPct}%`, height: "100%", background: ddColor, borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 10, color: "#64748B", width: 28, textAlign: "right", flexShrink: 0 }}>
            {ddPct.toFixed(0)}%
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  // Drawer state
  const [tradeDrawer, setTradeDrawer] = useState<Trade | null>(null);
  const [plannedDrawer, setPlannedDrawer] = useState<PlannedTrade | null>(null);
  const [accountDrawer, setAccountDrawer] = useState<Account | null>(null);

  // Modal state
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [showLogPayout, setShowLogPayout] = useState(false);

  // Chat input
  const [chatValue, setChatValue] = useState("");
  const [showChatToast, setShowChatToast] = useState(false);

  // P&L curve date range
  const [dateRange, setDateRange] = useState<DateRangePreset>("All Time");
  const [rangeDropdown, setRangeDropdown] = useState(false);
  const rangeRef = useRef<HTMLDivElement>(null);

  // Greeting (computed on render from IST time)
  const greeting = getGreeting();

  // Live and planned counts
  const liveTrades = useMemo(() => allTrades.filter((t) => t.date_closed === ""), []);
  const activePlanned = useMemo(
    () => allPlanned.filter((p) => p.status === "Watching" || p.status === "Ready"),
    []
  );
  const readyCount = useMemo(() => allPlanned.filter((p) => p.status === "Ready").length, []);

  // Status line
  const statusLine = useMemo(() => {
    if (readyCount === 0 && liveTrades.length === 0)
      return "Markets are quiet. Time to plan or rest.";
    const parts: string[] = [];
    if (readyCount > 0)
      parts.push(`${readyCount} planned trade${readyCount !== 1 ? "s" : ""} ready`);
    if (liveTrades.length > 0)
      parts.push(`${liveTrades.length} live trade${liveTrades.length !== 1 ? "s" : ""} running`);
    return `You have ${parts.join(" and ")}.`;
  }, [readyCount, liveTrades.length]);

  // Metric cards
  const metrics = useMemo(() => {
    const activeAccounts = allAccounts.filter((a) => a.status === "Active");
    const totalCapital = activeAccounts.reduce((s, a) => s + a.account_size, 0);
    const overallPnl = allAccounts.reduce((s, a) => s + (a.current_balance - a.account_size), 0);
    const activeCount = activeAccounts.length;

    const closedSorted = [...allTrades.filter((t) => t.date_closed !== "")].sort(
      (a, b) => new Date(b.date_closed).getTime() - new Date(a.date_closed).getTime()
    );
    const last20 = closedSorted.slice(0, 20);
    const wins = last20.filter((t) => t.blended_rr > 0);
    const losses = last20.filter((t) => t.blended_rr < 0);
    const wr = wins.length + losses.length > 0 ? (wins.length / (wins.length + losses.length)) * 100 : 0;

    return { totalCapital, overallPnl, activeCount, wr, tradeCount: last20.length };
  }, []);

  // P&L Curve
  const curveData = useMemo(() => {
    const filtered = applyDateFilter(allTrades, dateRange);
    return buildPnlCurve(filtered);
  }, [dateRange]);

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
    setShowChatToast(true);
    setTimeout(() => setShowChatToast(false), 3000);
  }

  const pairsConfig = pairs;
  const activeAccounts = allAccounts.filter((a) => a.status === "Active");

  return (
    <div className="min-h-screen" style={{ color: "var(--text-primary)" }}>
      {/* Toast */}
      {showChatToast && (
        <div
          className="fixed top-5 right-5 z-[100] rounded-xl px-4 py-3 text-sm font-medium shadow-2xl"
          style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#93C5FD", backdropFilter: "blur(12px)" }}
        >
          ✨ Lucid AI activates in Phase 3.
        </div>
      )}

      <div className="flex flex-col gap-8 px-8 py-8 max-w-350 mx-auto">

        {/* ── Section 1: Hero ────────────────────────────────────────────────── */}
        <div
          className="glass-card p-8 -z-1"
          style={{ padding: 32 }}
        >
          {/* Greeting + status */}
          <div className="mb-6">
            <h1 style={{ fontSize: 28, fontWeight: 600, color: "#F1F5F9", lineHeight: 1.2, marginBottom: 8 }}>
              {greeting}, Aman.
            </h1>
            <p style={{ fontSize: 14, color: "#94A3B8" }}>{statusLine}</p>
          </div>

          {/* Lucid chat input bar */}
          <div
            className="rounded-xl flex items-center gap-3 px-4"
            style={{
              height: 56,
              background: "rgba(28,38,54,0.75)",
              border: "1px solid rgba(59,130,246,0.2)",
              boxShadow: "0 0 24px rgba(59,130,246,0.06)",
              backdropFilter: "blur(12px)",
            }}
          >
            <Sparkles size={18} style={{ color: "#3B82F6", flexShrink: 0 }} />
            <input
              value={chatValue}
              onChange={(e) => setChatValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleChatSubmit(); }}
              placeholder="Ask Lucid anything about your trading..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "#E2E8F0", caretColor: "#3B82F6" } as React.CSSProperties}
            />
            <button
              onClick={handleChatSubmit}
              className="flex items-center justify-center rounded-lg transition-all"
              style={{ width: 36, height: 36, background: "#3B82F6", flexShrink: 0 }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#2563EB")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#3B82F6")}
            >
              <ArrowRight size={16} style={{ color: "#fff" }} />
            </button>
          </div>
          <p style={{ fontSize: 11, color: "#475569", marginTop: 10 }}>
            <span className="pill" style={{ background: "rgba(168,85,247,0.12)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.2)", fontSize: 10, marginRight: 6 }}>
              Phase 3
            </span>
            Lucid AI activates with full context of your trading system.
          </p>
        </div>

        {/* ── Section 2: Quick Actions ───────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              icon: <Plus size={20} />,
              label: "Log Trade",
              desc: "Record a new position",
              action: () => setShowAddTrade(true),
            },
            {
              icon: <DollarSign size={20} />,
              label: "Log Payout",
              desc: "Record a prop firm payout",
              action: () => setShowLogPayout(true),
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
              className="text-left rounded-xl p-5 flex flex-col gap-3 transition-all duration-150"
              style={{
                height: 88,
                background: "rgba(20,28,40,0.6)",
                border: "1px solid rgba(148,163,184,0.1)",
                backdropFilter: "blur(12px)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.transform = "translateY(-2px)";
                el.style.border = "1px solid rgba(59,130,246,0.35)";
                el.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3), 0 0 20px rgba(59,130,246,0.08)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.transform = "translateY(0)";
                el.style.border = "1px solid rgba(148,163,184,0.1)";
                el.style.boxShadow = "none";
              }}
            >
              <div className="flex items-center gap-3">
                <span style={{ color: "#3B82F6" }}>{item.icon}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0", lineHeight: 1.2 }}>{item.label}</p>
                  <p style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{item.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* ── Section 3: Metric Cards ────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          {/* Total Capital Managed */}
          <div className="glass-card p-5 flex flex-col gap-1.5">
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748B" }}>
              Total Capital Managed
            </span>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#E2E8F0", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(metrics.totalCapital)}
            </span>
            <span style={{ fontSize: 11, color: "#475569" }}>Active accounts only</span>
          </div>

          {/* Overall P&L */}
          <div className="glass-card p-5 flex flex-col gap-1.5">
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748B" }}>
              Overall P&amp;L
            </span>
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: metrics.overallPnl > 0 ? "#10B981" : metrics.overallPnl < 0 ? "#EF4444" : "#94A3B8",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {metrics.overallPnl >= 0 ? "+" : ""}{formatCurrency(metrics.overallPnl)}
            </span>
            <span style={{ fontSize: 11, color: "#475569" }}>Across all accounts</span>
          </div>

          {/* Active Accounts */}
          <div className="glass-card p-5 flex flex-col gap-1.5">
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748B" }}>
              Active Accounts
            </span>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#E2E8F0", fontVariantNumeric: "tabular-nums" }}>
              {metrics.activeCount}
            </span>
            <span style={{ fontSize: 11, color: "#475569" }}>
              {allAccounts.length} total accounts
            </span>
          </div>

          {/* Rolling Win Rate */}
          <div className="glass-card p-5 flex flex-col gap-1.5">
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748B" }}>
              Rolling Win Rate
            </span>
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: metrics.wr > 40 ? "#10B981" : metrics.wr < 35 ? "#EF4444" : "#F59E0B",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {metrics.wr.toFixed(0)}%
            </span>
            <span style={{ fontSize: 11, color: "#475569" }}>Last {metrics.tradeCount} trades</span>
          </div>
        </div>

        {/* ── Section 4: P&L Curve ───────────────────────────────────────────── */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0" }}>Cumulative P&amp;L</h2>

            {/* Date range dropdown */}
            <div ref={rangeRef} className="relative">
              <button
                onClick={() => setRangeDropdown((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors"
                style={{
                  fontSize: 12,
                  color: "#94A3B8",
                  background: "rgba(148,163,184,0.06)",
                  border: "1px solid rgba(148,163,184,0.12)",
                }}
              >
                {dateRange}
                <ChevronDown size={12} />
              </button>
              {rangeDropdown && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-xl py-1 z-20"
                  style={{
                    background: "rgba(14,22,34,0.98)",
                    border: "1px solid rgba(148,163,184,0.15)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    minWidth: 120,
                  }}
                >
                  {(["Last 30d", "Last 90d", "All Time"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => { setDateRange(p); setRangeDropdown(false); }}
                      className="w-full text-left px-3 py-2 text-sm transition-colors"
                      style={{ color: dateRange === p ? "#E2E8F0" : "#94A3B8" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(59,130,246,0.08)")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
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
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748B" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
                width={52}
              />
              <Tooltip content={<PnlTooltip />} />
              <ReferenceLine y={0} stroke="rgba(148,163,184,0.2)" strokeDasharray="4 4" />
              {drawdownWindows.map((w, i) => (
                <ReferenceArea
                  key={i}
                  x1={w.x1}
                  x2={w.x2}
                  fill="rgba(239,68,68,0.08)"
                  fillOpacity={1}
                />
              ))}
              <Area
                type="monotone"
                dataKey="cumPnl"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="url(#pnlGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#3B82F6" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Section 5: Two-Column Strip ────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-6">

          {/* Left — Live + Planned Trades */}
          <div className="glass-card p-5 flex flex-col gap-6">

            {/* Sub-section A: Live Trades */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0" }}>Live Trades</h3>
                <span
                  className="pill"
                  style={{ background: "rgba(59,130,246,0.12)", color: "#93C5FD", border: "1px solid rgba(59,130,246,0.2)", fontSize: 10 }}
                >
                  {liveTrades.length}
                </span>
              </div>

              {liveTrades.length === 0 ? (
                <p style={{ fontSize: 13, color: "#475569" }}>No live trades running.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {liveTrades.map((t) => {
                    const pairConf = pairsConfig.find((p) => p.symbol === t.pair);
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTradeDrawer(t)}
                        className="w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 flex items-center gap-3"
                        style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(59,130,246,0.12)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(59,130,246,0.06)")}
                      >
                        <span style={{ fontSize: 15 }}>
                          {pairConf?.flag_a}{pairConf?.flag_b}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 13, fontWeight: 500, color: "#E2E8F0" }}>
                              {pairConf?.display_name ?? t.pair}
                            </span>
                            <span style={{ fontSize: 12, color: t.direction === "Buy" ? "#10B981" : "#EF4444" }}>
                              {t.direction === "Buy" ? "↑" : "↓"} {t.direction}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: "#64748B" }}>
                            Entry {t.entry_price}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="pill"
                            style={{
                              background: "rgba(59,130,246,0.12)",
                              color: "#60A5FA",
                              border: "1px solid rgba(59,130,246,0.2)",
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
                                background: "#3B82F6",
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
            <div style={{ height: 1, background: "rgba(148,163,184,0.06)" }} />

            {/* Sub-section B: Planned Trades */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0" }}>Planned Trades</h3>
                <span
                  className="pill"
                  style={{
                    background: readyCount > 0 ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.12)",
                    color: readyCount > 0 ? "#F59E0B" : "#93C5FD",
                    border: readyCount > 0 ? "1px solid rgba(245,158,11,0.25)" : "1px solid rgba(59,130,246,0.2)",
                    fontSize: 10,
                  }}
                >
                  {readyCount} ready
                </span>
              </div>

              {activePlanned.length === 0 ? (
                <p style={{ fontSize: 13, color: "#475569" }}>No setups planned.</p>
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
                        ? "#10B981"
                        : dist.pips <= 10
                        ? "#F59E0B"
                        : dist.pips <= 50
                        ? "#E2E8F0"
                        : "#64748B";
                    return (
                      <button
                        key={p.id}
                        onClick={() => setPlannedDrawer(p)}
                        className="w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 flex items-center gap-3"
                        style={{ background: "rgba(20,28,40,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = "rgba(28,38,54,0.8)";
                          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(148,163,184,0.14)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = "rgba(20,28,40,0.6)";
                          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(148,163,184,0.08)";
                        }}
                      >
                        <span style={{ fontSize: 15 }}>{pairConf?.flag_a}{pairConf?.flag_b}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 13, fontWeight: 500, color: "#E2E8F0" }}>
                              {pairConf?.display_name ?? p.pair}
                            </span>
                            <span style={{ fontSize: 12, color: p.direction === "Buy" ? "#10B981" : "#EF4444" }}>
                              {p.direction === "Buy" ? "↑" : "↓"}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: "#64748B" }}>
                            @ {p.planned_entry}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: 11, color: distColor, fontVariantNumeric: "tabular-nums" }}>
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
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0" }}>Account Snapshot</h3>
              <Link
                href="/trading/accounts"
                style={{ fontSize: 11, color: "#3B82F6", textDecoration: "none" }}
              >
                View all →
              </Link>
            </div>

            {activeAccounts.length === 0 ? (
              <p style={{ fontSize: 13, color: "#475569" }}>No active accounts.</p>
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

        {/* ── Section 6: Fundamental Bias Placeholder ────────────────────────── */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0" }}>Fundamental Bias</h2>
              <span className="pill" style={{ background: "rgba(168,85,247,0.15)", color: "#A855F7", border: "1px solid rgba(168,85,247,0.25)", fontSize: 10 }}>
                Phase 2
              </span>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-3 mb-4">
            {pairsConfig.map((pair) => (
              <div
                key={pair.symbol}
                className="rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-all duration-150 group"
                style={{
                  background: "rgba(20,28,40,0.6)",
                  border: "1px solid rgba(148,163,184,0.08)",
                }}
                title="Fundamental scores activate in Phase 2 when Scanner is live."
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(28,38,54,0.8)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(148,163,184,0.14)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(20,28,40,0.6)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(148,163,184,0.08)";
                }}
              >
                <span style={{ fontSize: 18 }}>{pair.flag_a}{pair.flag_b}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8" }}>{pair.display_name}</span>
                <div className="flex items-center gap-1" style={{ color: "#334155" }}>
                  <span>─</span><span>─</span><span>─</span>
                </div>
                <span style={{ fontSize: 10, color: "#334155" }}>Phase 2</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: "#334155" }}>
            Fundamental scores are coming in Phase 2.{" "}
            <Link href="/oracle" style={{ color: "#3B82F6", textDecoration: "none" }}>
              Open Scanner →
            </Link>
          </p>
        </div>

      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AddTradeModal open={showAddTrade} onClose={() => setShowAddTrade(false)} />
      <LogPayoutModal open={showLogPayout} onClose={() => setShowLogPayout(false)} />

      {/* ── DetailDrawers ────────────────────────────────────────────────────── */}

      {/* Trade Drawer */}
      <DetailDrawer
        open={tradeDrawer !== null}
        onClose={() => setTradeDrawer(null)}
        title={tradeDrawer ? `Trade #${tradeDrawer.id.replace("trd_", "")}` : ""}
        expandHref={tradeDrawer ? `/trading/journal/${tradeDrawer.id}` : undefined}
      >
        {tradeDrawer && <TradeDrawerContent trade={tradeDrawer} />}
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
