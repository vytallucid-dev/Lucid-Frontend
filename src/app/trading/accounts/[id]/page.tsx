"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  pairs,
  formatCurrency,
  formatDate,
  type Account,
  type Trade,
  isPropAccount,
  accountSource,
  accountTradingPnl,
} from "@/lib/demo-data";
import { useAccounts, useTrades, useUpdateAccount, useDeleteAccount } from "@/hooks/useTrading";
import type { CreateAccountPayload } from "@/lib/api/trading";
import { LoadingState } from "@/components/state/LoadingState";
import { DetailPageLayout } from "@/components/DetailPageLayout";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/toast";
import { AddAccountModal } from "../page";
import {
  StagePill,
  StatusPill,
  AccountTypePill,
  calcDrawdown,
  calcGoalProgress,
  calcAccountStats,
} from "../AccountDrawerContent";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPairDisplay(pair: string) {
  return pairs.find(p => p.symbol === pair)?.display_name ?? pair;
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Equity over time = starting size, then every closed trade's P&L and every
// cash movement (deposit +, withdrawal/payout −) applied in chronological order.
function buildChartData(account: Account, accountTrades: Trade[]) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

  type Event = { t: number; date: string; delta: number; label: string };
  const events: Event[] = [];

  for (const trade of accountTrades.filter(t => t.date_closed)) {
    events.push({
      t: new Date(trade.date_closed).getTime(),
      date: fmt(trade.date_closed),
      delta: trade.blended_pnl,
      label: `${getPairDisplay(trade.pair)} ${trade.blended_pnl >= 0 ? "+" : ""}${formatCurrency(trade.blended_pnl)}`,
    });
  }
  for (const cf of account.cash_flows) {
    const signed = cf.type === "deposit" ? cf.amount : -cf.amount;
    events.push({
      t: new Date(cf.date).getTime(),
      date: fmt(cf.date),
      delta: signed,
      label: `${cf.type === "deposit" ? "Deposit" : "Withdrawal"} ${signed >= 0 ? "+" : ""}${formatCurrency(signed)}`,
    });
  }
  for (const p of account.payouts) {
    events.push({
      t: new Date(p.date).getTime(),
      date: fmt(p.date),
      delta: -p.amount,
      label: `Payout −${formatCurrency(p.amount)}`,
    });
  }

  events.sort((a, b) => a.t - b.t);

  const data: { date: string; balance: number; label: string }[] = [
    { date: fmt(account.starting_date), balance: account.account_size, label: "Start" },
  ];

  let runningBalance = account.account_size;
  for (const e of events) {
    runningBalance = Math.round((runningBalance + e.delta) * 100) / 100;
    data.push({ date: e.date, balance: runningBalance, label: e.label });
  }

  return data;
}

// ── Chart component ───────────────────────────────────────────────────────────

function DrawdownChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { label: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const balance = payload[0].value;
  const tradeLabel = payload[0].payload?.label;
  return (
    <div
      className="rounded-xl px-3 py-2.5"
      style={{
        background: "rgba(10,14,20,0.95)",
        border: "1px solid rgba(148,163,184,0.2)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}
    >
      <p style={{ fontSize: 11, color: "#64748B", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0" }}>{formatCurrency(balance)}</p>
      {tradeLabel && tradeLabel !== "Start" && (
        <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{tradeLabel}</p>
      )}
    </div>
  );
}

// ── Exit type pill ────────────────────────────────────────────────────────────

function ExitTypePill({ type }: { type: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    TP:           { bg: "var(--positive-bg)", color: "var(--positive)", border: "rgba(16,185,129,0.25)" },
    "Partial+TP": { bg: "var(--positive-bg)", color: "var(--positive)", border: "rgba(16,185,129,0.25)" },
    SL:           { bg: "var(--negative-bg)", color: "var(--negative)", border: "rgba(239,68,68,0.25)" },
    "Partial+SL": { bg: "var(--negative-bg)", color: "var(--negative)", border: "rgba(239,68,68,0.25)" },
    Manual:       { bg: "var(--warning-bg)", color: "var(--warning)", border: "rgba(245,158,11,0.25)" },
    BE:           { bg: "rgba(148,163,184,0.1)", color: "#94A3B8", border: "rgba(148,163,184,0.2)" },
  };
  const s = map[type] ?? map["BE"];
  return (
    <span className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 10 }}>
      {type}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1"
      style={{ background: "rgba(20,28,40,0.7)", border: "1px solid rgba(148,163,184,0.08)" }}
    >
      <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: "#E2E8F0" }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: "#475569" }}>{sub}</span>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const accountsQuery = useAccounts();
  const tradesQuery = useTrades();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const account = (accountsQuery.data ?? []).find(a => a.id === id);

  const accountTrades = useMemo(
    () => (tradesQuery.data ?? []).filter(t => t.account_id === id),
    [tradesQuery.data, id]
  );

  const chartData = useMemo(
    () => (account ? buildChartData(account, accountTrades) : []),
    [account, accountTrades]
  );

  if (accountsQuery.isLoading) {
    return (
      <DetailPageLayout backHref="/trading/accounts" backLabel="Accounts" title="Account">
        <LoadingState message="Loading account…" />
      </DetailPageLayout>
    );
  }

  if (!account) {
    return (
      <DetailPageLayout backHref="/trading/accounts" backLabel="Accounts" title="Account not found">
        <div className="py-16 text-center" style={{ color: "#64748B", fontSize: 14 }}>
          This account could not be found. It may have been deleted.
        </div>
      </DetailPageLayout>
    );
  }

  const prop = isPropAccount(account);
  const hasGoal = account.profit_goal_pct != null && account.profit_goal_pct > 0;
  const { drawdownUsed, drawdownLimit, pctUsed } = calcDrawdown(account);
  const { profitAchieved, profitTarget, pct: goalPct } = calcGoalProgress(account);
  const { tradeCount, winRate, avgPnl } = calcAccountStats(accountTrades);

  const isPassed = account.status === "Passed";
  const isActive = account.status === "Active";
  const pnl = accountTradingPnl(account);
  const pnlPct = account.account_size > 0 ? (pnl / account.account_size) * 100 : 0;
  const pnlColor = pnl > 0 ? "var(--positive)" : pnl < 0 ? "var(--negative)" : "#94A3B8";
  const ddColor = pctUsed >= 80 ? "#EF4444" : pctUsed >= 60 ? "#F59E0B" : "#10B981";
  const remaining = profitTarget - profitAchieved;
  const fromBlown = drawdownLimit - drawdownUsed;

  // Max drawdown threshold line on chart
  const ddThreshold = account.account_size - drawdownLimit;

  // Closed + sorted trades for the mini table
  const closedTrades = [...accountTrades]
    .filter(t => t.date_closed)
    .sort((a, b) => new Date(b.date_closed).getTime() - new Date(a.date_closed).getTime());

  // Payout running total data for chart
  const payoutChartData = account.payouts.map((p, i) => ({
    date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }),
    total: p.running_total,
    amount: p.amount,
  }));

  const actions = (
    <>
      <button
        onClick={() => setEditOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
        style={{ color: "#94A3B8", border: "1px solid rgba(148,163,184,0.15)" }}
      >
        <Pencil size={14} /> Edit
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        style={{ color: "#F87171", border: "1px solid rgba(239,68,68,0.25)" }}
      >
        <Trash2 size={14} /> Delete
      </button>
    </>
  );

  return (
    <DetailPageLayout
      backHref="/trading/accounts"
      backLabel="Accounts"
      title={account.account_name}
      actions={actions}
    >
      {/* ── Account header ──────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4 sm:p-6 mb-6"
        style={{ background: "rgba(20,28,40,0.7)", border: "1px solid rgba(148,163,184,0.1)" }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <AccountTypePill type={account.account_type} />
              {prop && account.stage && <StagePill stage={account.stage} />}
              <StatusPill status={account.status} />
            </div>
            <p style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>{accountSource(account)}</p>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#E2E8F0", marginBottom: 8 }}>
              {account.account_name}
            </h2>
            <p style={{ fontSize: 13, color: "#64748B" }}>
              Started {formatDate(account.starting_date)} · {prop ? "Size" : "Starting balance"} {formatCurrency(account.account_size)}
            </p>
          </div>

          <div className="sm:text-right">
            <p style={{ fontSize: 36, fontWeight: 700, color: pnlColor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {formatCurrency(account.current_balance)}
            </p>
            <p style={{ fontSize: 14, color: pnlColor, marginTop: 6, opacity: 0.9 }}>
              {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Trade Count" value={tradeCount} sub="total trades" />
        <StatCard
          label="Win Rate"
          value={<span style={{ color: winRate >= 40 ? "var(--positive)" : winRate >= 30 ? "var(--warning)" : "var(--negative)" }}>{tradeCount > 0 ? `${winRate.toFixed(0)}%` : "—"}</span>}
          sub="wins / (wins + losses)"
        />
        <StatCard
          label="Avg P&L / Trade"
          value={<span style={{ color: avgPnl > 0 ? "var(--positive)" : avgPnl < 0 ? "var(--negative)" : "#94A3B8" }}>{tradeCount > 0 ? formatCurrency(avgPnl) : "—"}</span>}
        />
        <StatCard
          label="Net P&L"
          value={<span style={{ color: pnlColor }}>{formatCurrency(pnl)}</span>}
          sub={prop ? `vs ${formatCurrency(profitTarget)} target` : hasGoal ? `vs ${formatCurrency(profitTarget)} goal` : "since start"}
        />
      </div>

      {/* ── Goal (personal, optional) ────────────────────────────────── */}
      {!prop && hasGoal && (
        <div className="rounded-2xl p-4 sm:p-6 mb-6" style={{ background: "rgba(20,28,40,0.7)", border: "1px solid rgba(148,163,184,0.1)" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#94A3B8", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>Goal</h3>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 13, color: "#94A3B8" }}>Profit Goal</span>
              <span style={{ fontSize: 13, color: "#64748B" }}>{goalPct >= 100 ? "Reached" : `${formatCurrency(remaining)} to go`}</span>
            </div>
            <div style={{ width: "100%", height: 10, background: "rgba(148,163,184,0.12)", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ width: `${goalPct}%`, height: "100%", background: "#3B82F6", borderRadius: 5 }} />
            </div>
            <p style={{ fontSize: 12, color: "#475569" }}>{goalPct.toFixed(0)}% of {formatCurrency(profitTarget)} goal achieved</p>
          </div>
        </div>
      )}

      {/* ── Targets (prop only) ──────────────────────────────────────── */}
      {prop && (
      <div
        className="rounded-2xl p-4 sm:p-6 mb-6"
        style={{ background: "rgba(20,28,40,0.7)", border: "1px solid rgba(148,163,184,0.1)" }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#94A3B8", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Targets
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
          {/* Profit Target */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 13, color: "#94A3B8" }}>Profit Target</span>
              {isPassed ? (
                <span style={{ fontSize: 13, color: "#10B981", fontWeight: 600 }}>✓ Passed</span>
              ) : (
                <span style={{ fontSize: 13, color: "#64748B" }}>{formatCurrency(remaining)} to go</span>
              )}
            </div>
            <div style={{ width: "100%", height: 10, background: "rgba(148,163,184,0.12)", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ width: isPassed ? "100%" : `${goalPct}%`, height: "100%", background: "#3B82F6", borderRadius: 5 }} />
            </div>
            <p style={{ fontSize: 12, color: "#475569" }}>
              {isPassed ? "100%" : `${goalPct.toFixed(0)}%`} of {formatCurrency(profitTarget)} target achieved
            </p>
          </div>

          {/* Max Drawdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 13, color: "#94A3B8" }}>Max Drawdown</span>
              <span style={{ fontSize: 13, color: "#64748B" }}>{formatCurrency(drawdownUsed)} used / {formatCurrency(drawdownLimit)}</span>
            </div>
            <div style={{ width: "100%", height: 10, background: "rgba(148,163,184,0.12)", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ width: `${pctUsed}%`, height: "100%", background: ddColor, borderRadius: 5 }} />
            </div>
            <p style={{ fontSize: 12, color: pctUsed >= 80 ? "#EF4444" : pctUsed >= 60 ? "#F59E0B" : "#475569" }}>
              {pctUsed.toFixed(0)}% of max drawdown used
            </p>

            {isActive && pctUsed > 80 && (
              <div
                className="mt-3 rounded-lg px-3 py-2.5 flex items-start gap-2"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <span style={{ fontSize: 14 }}>⚠</span>
                <p style={{ fontSize: 12, color: "#FCA5A5", lineHeight: 1.5 }}>
                  Approaching max drawdown. <strong>{formatCurrency(fromBlown)}</strong> from blown account.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* ── Balance over time (Recharts) ─────────────────────────────── */}
      <div
        className="rounded-2xl p-4 sm:p-6 mb-6"
        style={{ background: "rgba(20,28,40,0.7)", border: "1px solid rgba(148,163,184,0.1)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Balance Over Time
          </h3>
          <div className="flex items-center gap-4" style={{ fontSize: 12, color: "#64748B" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 24, height: 2, background: "#3B82F6", display: "inline-block", borderRadius: 1 }} />
              Balance
            </span>
            {prop && (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 24, height: 2, background: "#EF4444", display: "inline-block", borderRadius: 1, borderTop: "1px dashed #EF4444" }} />
                Max Drawdown Limit
              </span>
            )}
          </div>
        </div>

        {chartData.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p style={{ fontSize: 13, color: "#64748B" }}>No trade data yet to chart balance progression.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(148,163,184,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#475569" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(1)}k`}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<DrawdownChartTooltip />} />
              <ReferenceLine
                y={account.account_size}
                stroke="rgba(148,163,184,0.3)"
                strokeDasharray="4 4"
                label={{ value: "Start", fontSize: 10, fill: "#475569", position: "right" }}
              />
              {prop && (
                <ReferenceLine
                  y={ddThreshold}
                  stroke="#EF4444"
                  strokeDasharray="6 3"
                  strokeOpacity={0.6}
                  label={{ value: "Max DD", fontSize: 10, fill: "#EF4444", position: "right" }}
                />
              )}
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#3B82F6"
                strokeWidth={2}
                fill="url(#balanceGradient)"
                dot={{ r: 3, fill: "#3B82F6", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#3B82F6", stroke: "rgba(59,130,246,0.4)", strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Trade history ─────────────────────────────────────────────── */}
      <div
        className="rounded-2xl mb-6 overflow-hidden"
        style={{ border: "1px solid rgba(148,163,184,0.1)", background: "rgba(20,28,40,0.5)" }}
      >

        <div
          className="px-6 py-4"
          style={{ borderBottom: "1px solid rgba(148,163,184,0.08)", background: "rgba(10,14,20,0.4)" }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Trade History
          </h3>
        </div>

        {closedTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p style={{ fontSize: 13, color: "#64748B" }}>No closed trades on this account yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Header */}
            <div
              className="grid px-6 py-2.5"
              style={{
                gridTemplateColumns: "80px 120px 100px 90px 80px 90px 110px",
                borderBottom: "1px solid rgba(148,163,184,0.06)",
                background: "rgba(10,14,20,0.3)",
                minWidth: 680,
              }}
            >
              {["Date", "Pair", "Model", "Direction", "Pips", "P&L", "Exit"].map(col => (
                <span key={col} style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {col}
                </span>
              ))}
            </div>

            {closedTrades.map((trade, idx) => {
              const isLive = !trade.date_closed;
              const pnlCol = trade.blended_pnl > 0 ? "var(--positive)" : trade.blended_pnl < 0 ? "var(--negative)" : "#94A3B8";
              const pipsCol = trade.total_pips > 0 ? "var(--positive)" : trade.total_pips < 0 ? "var(--negative)" : "#94A3B8";
              return (
                <div
                  key={trade.id}
                  className="grid px-6 items-center"
                  style={{
                    gridTemplateColumns: "80px 120px 100px 90px 80px 90px 110px",
                    background: idx % 2 === 0 ? "rgba(20,28,40,0.4)" : "rgba(15,23,35,0.2)",
                    borderBottom: idx < closedTrades.length - 1 ? "1px solid rgba(148,163,184,0.04)" : "none",
                    minHeight: 44,
                    minWidth: 680,
                  }}
                >
                  <span style={{ fontSize: 12, color: "#64748B" }}>
                    {new Date(trade.date_closed).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span style={{ fontSize: 12, color: "#E2E8F0" }}>{getPairDisplay(trade.pair)}</span>
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>{trade.model}</span>
                  <span style={{ fontSize: 12, color: trade.direction === "Buy" ? "var(--positive)" : "var(--negative)" }}>
                    {trade.direction === "Buy" ? "↑" : "↓"} {trade.direction}
                  </span>
                  <span style={{ fontSize: 12, color: pipsCol, fontVariantNumeric: "tabular-nums" }}>
                    {trade.total_pips > 0 ? "+" : ""}{trade.total_pips}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: pnlCol, fontVariantNumeric: "tabular-nums" }}>
                    {trade.blended_pnl > 0 ? "+" : ""}{formatCurrency(trade.blended_pnl)}
                  </span>
                  <ExitTypePill type={trade.exit_type} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Payout history ───────────────────────────────────────────── */}
      <div
        className="rounded-2xl mb-6 overflow-hidden"
        style={{ border: "1px solid rgba(148,163,184,0.1)", background: "rgba(20,28,40,0.5)" }}
      >
        <div
          className="px-6 py-4"
          style={{ borderBottom: "1px solid rgba(148,163,184,0.08)", background: "rgba(10,14,20,0.4)" }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {prop ? "Payout History" : "Deposits & Withdrawals"}
          </h3>
        </div>

        {prop ? (
          account.payouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <p style={{ fontSize: 13, color: "#64748B" }}>No payouts logged yet.</p>
          </div>
        ) : (
          <div className="p-6">
            {/* Payout list */}
            <div
              className="rounded-xl overflow-hidden mb-6"
              style={{ border: "1px solid rgba(148,163,184,0.08)" }}
            >
              {account.payouts.map((payout, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3"
                  style={{
                    background: i % 2 === 0 ? "rgba(20,28,40,0.6)" : "rgba(15,23,35,0.4)",
                    borderBottom: i < account.payouts.length - 1 ? "1px solid rgba(148,163,184,0.06)" : "none",
                  }}
                >
                  <span style={{ fontSize: 12, color: "#64748B", minWidth: 100 }}>
                    {new Date(payout.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--positive)", flex: 1 }}>
                    +{formatCurrency(payout.amount)}
                  </span>
                  <span style={{ fontSize: 12, color: "#64748B" }}>
                    Running total: <strong style={{ color: "#E2E8F0" }}>{formatCurrency(payout.running_total)}</strong>
                  </span>
                </div>
              ))}
            </div>

            {/* Running total chart */}
            {payoutChartData.length >= 2 && (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={payoutChartData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,14,20,0.95)",
                      border: "1px solid rgba(148,163,184,0.2)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "#E2E8F0",
                    }}
                    formatter={(v: unknown) => [formatCurrency(typeof v === "number" ? v : 0), "Running Total"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "#10B981", strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "#10B981" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          )
        ) : account.cash_flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <p style={{ fontSize: 13, color: "#64748B" }}>No deposits or withdrawals logged yet.</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(148,163,184,0.08)" }}>
              {account.cash_flows.map((cf, i) => {
                const isOut = cf.type === "withdrawal";
                const color = isOut ? "var(--negative)" : "var(--positive)";
                const cfLabel = cf.type === "deposit" ? "Deposit" : cf.type === "withdrawal" ? "Withdrawal" : "Payout";
                return (
                  <div key={i} className="flex items-center gap-4 px-4 py-3" style={{ background: i % 2 === 0 ? "rgba(20,28,40,0.6)" : "rgba(15,23,35,0.4)", borderBottom: i < account.cash_flows.length - 1 ? "1px solid rgba(148,163,184,0.06)" : "none" }}>
                    <span style={{ fontSize: 12, color: "#64748B", minWidth: 100 }}>
                      {new Date(cf.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span style={{ fontSize: 13, color: "#94A3B8", flex: 1 }}>
                      {cfLabel}
                      {cf.note ? <span style={{ color: "#475569" }}> · {cf.note}</span> : null}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color }}>{isOut ? "−" : "+"}{formatCurrency(cf.amount)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {editOpen && (
        <AddAccountModal
          initial={account}
          existingSources={[...new Set((accountsQuery.data ?? []).map(accountSource))].filter(s => s !== "—")}
          onSubmit={(payload: CreateAccountPayload) =>
            updateAccount.mutate({ id: account.id, body: payload }, {
              onSuccess: () => toast.success(`${payload.account_name} updated.`, { title: "Account saved" }),
            })
          }
          onClose={() => setEditOpen(false)}
          saving={updateAccount.isPending}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete account?"
        message={`"${account.account_name}" and all of its trades and cash flows will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete account"
        loading={deleteAccount.isPending}
        onConfirm={() =>
          deleteAccount.mutate(account.id, {
            onSuccess: () => { toast.success(`${account.account_name} deleted.`); router.push("/trading/accounts"); },
            onSettled: () => setConfirmDelete(false),
          })
        }
        onCancel={() => setConfirmDelete(false)}
      />
    </DetailPageLayout>
  );
}
