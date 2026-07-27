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
  LifecycleStatusControl,
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
        background: "var(--lucid-surface-2)",
        border: "1px solid var(--lucid-line-2)",
      }}
    >
      <p style={{ fontSize: 11, color: "var(--lucid-ink-3)", marginBottom: 4 }}>{label}</p>
      <p className="lt-num" style={{ fontSize: 14, fontWeight: 700, color: "var(--lucid-ink)" }}>{formatCurrency(balance)}</p>
      {tradeLabel && tradeLabel !== "Start" && (
        <p style={{ fontSize: 11, color: "var(--lucid-ink-2)", marginTop: 2 }}>{tradeLabel}</p>
      )}
    </div>
  );
}

// ── Exit type pill ────────────────────────────────────────────────────────────

function ExitTypePill({ type }: { type: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    TP:           { bg: "var(--lucid-pos-bg)", color: "var(--lucid-pos)", border: "var(--lucid-pos-bd)" },
    "Partial+TP": { bg: "var(--lucid-pos-bg)", color: "var(--lucid-pos)", border: "var(--lucid-pos-bd)" },
    SL:           { bg: "var(--lucid-neg-bg)", color: "var(--lucid-neg)", border: "var(--lucid-neg-bd)" },
    "Partial+SL": { bg: "var(--lucid-neg-bg)", color: "var(--lucid-neg)", border: "var(--lucid-neg-bd)" },
    Manual:       { bg: "var(--lucid-warn-bg)", color: "var(--lucid-warn)", border: "var(--lucid-warn-bd)" },
    BE:           { bg: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "var(--lucid-line-2)" },
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
    <div className="lt-card p-4 flex flex-col gap-1">
      <span style={{ fontSize: 11, color: "var(--lucid-ink-3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span className="lt-num" style={{ fontSize: 22, fontWeight: 700, color: "var(--lucid-ink)" }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>{sub}</span>}
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
        <div className="py-16 text-center" style={{ color: "var(--lucid-ink-3)", fontSize: 14 }}>
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
  const pnlColor = pnl > 0 ? "var(--lucid-pos)" : pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
  const ddColor = pctUsed >= 80 ? "var(--lucid-neg)" : pctUsed >= 60 ? "var(--lucid-warn)" : "var(--lucid-pos)";
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
        style={{ color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line-2)" }}
      >
        <Pencil size={14} /> Edit
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        style={{ color: "var(--lucid-neg)", border: "1px solid var(--lucid-neg-bd)" }}
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
        className="lt-card p-4 sm:p-6 mb-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <AccountTypePill type={account.account_type} />
              {prop && account.stage && <StagePill stage={account.stage} />}
              <StatusPill status={account.status} />
              <LifecycleStatusControl account={account} />
            </div>
            <p style={{ fontSize: 13, color: "var(--lucid-ink-3)", marginBottom: 4 }}>{accountSource(account)}</p>
            <h2 className="lt-serif" style={{ fontSize: 22, fontWeight: 700, color: "var(--lucid-ink)", marginBottom: 8 }}>
              {account.account_name}
            </h2>
            <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>
              Started {formatDate(account.starting_date)} · {prop ? "Size" : "Starting balance"} {formatCurrency(account.account_size)}
            </p>
          </div>

          <div className="sm:text-right">
            <p className="lt-num" style={{ fontSize: 36, fontWeight: 700, color: pnlColor, lineHeight: 1 }}>
              {formatCurrency(account.current_balance)}
            </p>
            <p className="lt-num" style={{ fontSize: 14, color: pnlColor, marginTop: 6, opacity: 0.9 }}>
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
          value={<span style={{ color: winRate >= 40 ? "var(--lucid-pos)" : winRate >= 30 ? "var(--lucid-warn)" : "var(--lucid-neg)" }}>{tradeCount > 0 ? `${winRate.toFixed(0)}%` : "—"}</span>}
          sub="wins / (wins + losses)"
        />
        <StatCard
          label="Avg P&L / Trade"
          value={<span style={{ color: avgPnl > 0 ? "var(--lucid-pos)" : avgPnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)" }}>{tradeCount > 0 ? formatCurrency(avgPnl) : "—"}</span>}
        />
        <StatCard
          label="Net P&L"
          value={<span style={{ color: pnlColor }}>{formatCurrency(pnl)}</span>}
          sub={prop ? `vs ${formatCurrency(profitTarget)} target` : hasGoal ? `vs ${formatCurrency(profitTarget)} goal` : "since start"}
        />
      </div>

      {/* ── Goal (personal, optional) ────────────────────────────────── */}
      {!prop && hasGoal && (
        <div className="lt-card p-4 sm:p-6 mb-6">
          <h3 className="lt-serif" style={{ fontSize: 14, fontWeight: 600, color: "var(--lucid-ink-2)", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>Goal</h3>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 13, color: "var(--lucid-ink-2)" }}>Profit Goal</span>
              <span className="lt-num" style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>{goalPct >= 100 ? "Reached" : `${formatCurrency(remaining)} to go`}</span>
            </div>
            <div style={{ width: "100%", height: 10, background: "var(--lucid-surface-3)", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ width: `${goalPct}%`, height: "100%", background: "var(--lucid-accent)", borderRadius: 5 }} />
            </div>
            <p className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>{goalPct.toFixed(0)}% of {formatCurrency(profitTarget)} goal achieved</p>
          </div>
        </div>
      )}

      {/* ── Targets (prop only) ──────────────────────────────────────── */}
      {prop && (
      <div
        className="lt-card p-4 sm:p-6 mb-6"
      >
        <h3 className="lt-serif" style={{ fontSize: 14, fontWeight: 600, color: "var(--lucid-ink-2)", marginBottom: 20, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Targets
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
          {/* Profit Target */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 13, color: "var(--lucid-ink-2)" }}>Profit Target</span>
              {isPassed ? (
                <span style={{ fontSize: 13, color: "var(--lucid-pos)", fontWeight: 600 }}>✓ Passed</span>
              ) : (
                <span className="lt-num" style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>{formatCurrency(remaining)} to go</span>
              )}
            </div>
            <div style={{ width: "100%", height: 10, background: "var(--lucid-surface-3)", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ width: isPassed ? "100%" : `${goalPct}%`, height: "100%", background: "var(--lucid-accent)", borderRadius: 5 }} />
            </div>
            <p className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>
              {isPassed ? "100%" : `${goalPct.toFixed(0)}%`} of {formatCurrency(profitTarget)} target achieved
            </p>
          </div>

          {/* Max Drawdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 13, color: "var(--lucid-ink-2)" }}>Max Drawdown</span>
              <span className="lt-num" style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>{formatCurrency(drawdownUsed)} used / {formatCurrency(drawdownLimit)}</span>
            </div>
            <div style={{ width: "100%", height: 10, background: "var(--lucid-surface-3)", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ width: `${pctUsed}%`, height: "100%", background: ddColor, borderRadius: 5 }} />
            </div>
            <p className="lt-num" style={{ fontSize: 12, color: pctUsed >= 80 ? "var(--lucid-neg)" : pctUsed >= 60 ? "var(--lucid-warn)" : "var(--lucid-ink-3)" }}>
              {pctUsed.toFixed(0)}% of max drawdown used
            </p>

            {isActive && pctUsed > 80 && (
              <div
                className="mt-3 rounded-lg px-3 py-2.5 flex items-start gap-2"
                style={{ background: "var(--lucid-neg-bg)", border: "1px solid var(--lucid-neg-bd)" }}
              >
                <span style={{ fontSize: 14 }}>⚠</span>
                <p style={{ fontSize: 12, color: "var(--lucid-neg)", lineHeight: 1.5 }}>
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
        className="lt-card p-4 sm:p-6 mb-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h3 className="lt-serif" style={{ fontSize: 14, fontWeight: 600, color: "var(--lucid-ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Balance Over Time
          </h3>
          <div className="flex items-center gap-4" style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 24, height: 2, background: "var(--lucid-accent)", display: "inline-block", borderRadius: 1 }} />
              Balance
            </span>
            {prop && (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 24, height: 2, background: "var(--lucid-neg)", display: "inline-block", borderRadius: 1, borderTop: "1px dashed var(--lucid-neg)" }} />
                Max Drawdown Limit
              </span>
            )}
          </div>
        </div>

        {chartData.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>No trade data yet to chart balance progression.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--lucid-accent)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--lucid-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--lucid-line)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--lucid-ink-3)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--lucid-ink-3)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(1)}k`}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<DrawdownChartTooltip />} />
              <ReferenceLine
                y={account.account_size}
                stroke="var(--lucid-line-3)"
                strokeDasharray="4 4"
                label={{ value: "Start", fontSize: 10, fill: "var(--lucid-ink-3)", position: "right" }}
              />
              {prop && (
                <ReferenceLine
                  y={ddThreshold}
                  stroke="var(--lucid-neg)"
                  strokeDasharray="6 3"
                  strokeOpacity={0.6}
                  label={{ value: "Max DD", fontSize: 10, fill: "var(--lucid-neg)", position: "right" }}
                />
              )}
              <Area
                type="monotone"
                dataKey="balance"
                stroke="var(--lucid-accent)"
                strokeWidth={2}
                fill="url(#balanceGradient)"
                dot={{ r: 3, fill: "var(--lucid-accent)", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "var(--lucid-accent)", stroke: "var(--lucid-accent-bd)", strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Trade history ─────────────────────────────────────────────── */}
      <div
        className="lt-card mb-6 overflow-hidden"
      >

        <div
          className="px-6 py-4"
          style={{ borderBottom: "1px solid var(--lucid-line)", background: "var(--lucid-surface-2)" }}
        >
          <h3 className="lt-serif" style={{ fontSize: 14, fontWeight: 600, color: "var(--lucid-ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Trade History
          </h3>
        </div>

        {closedTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>No closed trades on this account yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Header */}
            <div
              className="grid px-6 py-2.5"
              style={{
                gridTemplateColumns: "80px 120px 100px 90px 80px 90px 110px",
                borderBottom: "1px solid var(--lucid-line)",
                background: "var(--lucid-surface-2)",
                minWidth: 680,
              }}
            >
              {["Date", "Pair", "Model", "Direction", "Pips", "P&L", "Exit"].map(col => (
                <span key={col} style={{ fontSize: 11, fontWeight: 600, color: "var(--lucid-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {col}
                </span>
              ))}
            </div>

            {closedTrades.map((trade, idx) => {
              const isLive = !trade.date_closed;
              const pnlCol = trade.blended_pnl > 0 ? "var(--lucid-pos)" : trade.blended_pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
              const pipsCol = trade.total_pips > 0 ? "var(--lucid-pos)" : trade.total_pips < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
              return (
                <div
                  key={trade.id}
                  className="grid px-6 items-center"
                  style={{
                    gridTemplateColumns: "80px 120px 100px 90px 80px 90px 110px",
                    background: idx % 2 === 0 ? "var(--lucid-surface)" : "var(--lucid-surface-2)",
                    borderBottom: idx < closedTrades.length - 1 ? "1px solid var(--lucid-line)" : "none",
                    minHeight: 44,
                    minWidth: 680,
                  }}
                >
                  <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>
                    {new Date(trade.date_closed).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--lucid-ink)" }}>{getPairDisplay(trade.pair)}</span>
                  <span style={{ fontSize: 12, color: "var(--lucid-ink-2)" }}>{trade.model}</span>
                  <span style={{ fontSize: 12, color: trade.direction === "Buy" ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
                    {trade.direction === "Buy" ? "↑" : "↓"} {trade.direction}
                  </span>
                  <span className="lt-num" style={{ fontSize: 12, color: pipsCol }}>
                    {trade.total_pips > 0 ? "+" : ""}{trade.total_pips}
                  </span>
                  <span className="lt-num" style={{ fontSize: 12, fontWeight: 700, color: pnlCol }}>
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
        className="lt-card mb-6 overflow-hidden"
      >
        <div
          className="px-6 py-4"
          style={{ borderBottom: "1px solid var(--lucid-line)", background: "var(--lucid-surface-2)" }}
        >
          <h3 className="lt-serif" style={{ fontSize: 14, fontWeight: 600, color: "var(--lucid-ink-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {prop ? "Payout History" : "Deposits & Withdrawals"}
          </h3>
        </div>

        {prop ? (
          account.payouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>No payouts logged yet.</p>
          </div>
        ) : (
          <div className="p-6">
            {/* Payout list */}
            <div
              className="rounded-xl overflow-hidden mb-6"
              style={{ border: "1px solid var(--lucid-line)" }}
            >
              {account.payouts.map((payout, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-4 py-3"
                  style={{
                    background: i % 2 === 0 ? "var(--lucid-surface)" : "var(--lucid-surface-2)",
                    borderBottom: i < account.payouts.length - 1 ? "1px solid var(--lucid-line)" : "none",
                  }}
                >
                  <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-3)", minWidth: 100 }}>
                    {new Date(payout.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className="lt-num" style={{ fontSize: 14, fontWeight: 700, color: "var(--lucid-pos)", flex: 1 }}>
                    +{formatCurrency(payout.amount)}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>
                    Running total: <strong className="lt-num" style={{ color: "var(--lucid-ink)" }}>{formatCurrency(payout.running_total)}</strong>
                  </span>
                </div>
              ))}
            </div>

            {/* Running total chart */}
            {payoutChartData.length >= 2 && (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={payoutChartData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--lucid-line)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--lucid-ink-3)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--lucid-ink-3)" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--lucid-surface-2)",
                      border: "1px solid var(--lucid-line-2)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--lucid-ink)",
                    }}
                    formatter={(v: unknown) => [formatCurrency(typeof v === "number" ? v : 0), "Running Total"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="var(--lucid-pos)"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "var(--lucid-pos)", strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "var(--lucid-pos)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          )
        ) : account.cash_flows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>No deposits or withdrawals logged yet.</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--lucid-line)" }}>
              {account.cash_flows.map((cf, i) => {
                const isOut = cf.type === "withdrawal";
                const color = isOut ? "var(--lucid-neg)" : "var(--lucid-pos)";
                const cfLabel = cf.type === "deposit" ? "Deposit" : cf.type === "withdrawal" ? "Withdrawal" : "Payout";
                return (
                  <div key={i} className="flex items-center gap-4 px-4 py-3" style={{ background: i % 2 === 0 ? "var(--lucid-surface)" : "var(--lucid-surface-2)", borderBottom: i < account.cash_flows.length - 1 ? "1px solid var(--lucid-line)" : "none" }}>
                    <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-3)", minWidth: 100 }}>
                      {new Date(cf.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--lucid-ink-2)", flex: 1 }}>
                      {cfLabel}
                      {cf.note ? <span style={{ color: "var(--lucid-ink-3)" }}> · {cf.note}</span> : null}
                    </span>
                    <span className="lt-num" style={{ fontSize: 14, fontWeight: 700, color }}>{isOut ? "−" : "+"}{formatCurrency(cf.amount)}</span>
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
