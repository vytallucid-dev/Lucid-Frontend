"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  type Account,
  type AccountStatus,
  type Trade,
  type Execution,
  type Payout,
  type AccountType,
  pairs,
  formatCurrency,
  formatDate,
  isPropAccount,
  accountSource,
  accountTypeLabel,
  accountTradingPnl,
  ACCOUNT_TYPE_COLORS,
} from "@/lib/demo-data";
import { accountStats as computeAccountStats } from "@/lib/stats";
import { useUpdateAccount } from "@/hooks/useTrading";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/toast";

// ── Shared helpers ────────────────────────────────────────────────────────────

// Drawdown tracks realized trading losses (not equity dips from withdrawals/
// payouts), so prop drawdown stays meaningful under the full-equity model.
export function calcDrawdown(account: Account) {
  const ddPct = account.max_drawdown_pct ?? 0;
  const drawdownUsed = Math.max(0, -accountTradingPnl(account));
  const drawdownLimit = (account.account_size * ddPct) / 100;
  const pctUsed = drawdownLimit > 0 ? Math.min(100, (drawdownUsed / drawdownLimit) * 100) : 0;
  return { drawdownUsed, drawdownLimit, pctUsed };
}

// Falls back across prop profit_target_pct → personal profit_goal_pct so the
// same bar renders a firm-set target or a user-set goal depending on type.
// Progress is measured against realized trading P&L, not equity (deposits don't
// count toward a profit target).
export function calcGoalProgress(account: Account, targetPct?: number) {
  const pctTarget = targetPct ?? account.profit_target_pct ?? account.profit_goal_pct ?? 0;
  const profitAchieved = Math.max(0, accountTradingPnl(account));
  const profitTarget = (account.account_size * pctTarget) / 100;
  const pct = profitTarget > 0 ? Math.min(100, (profitAchieved / profitTarget) * 100) : 0;
  return { profitAchieved, profitTarget, pct };
}

// An account's own performance: every EXECUTION it holds (not the ideas'
// primaries) — win rate over its own fills, $ averages. Account family:
// counts executions, sums dollars. See lib/stats.ts.
export function calcAccountStats(trades: Trade[], accountId: string) {
  const rows = trades.flatMap((t) => t.executions.filter((e) => e.account_id === accountId).map((e) => ({ e, trade: t })));
  const closed = rows.filter((r) => r.e.date_closed);
  const base = computeAccountStats(rows.map((r) => r.e));

  const pairPnl: Record<string, number> = {};
  closed.forEach(({ e, trade }) => {
    pairPnl[trade.pair] = (pairPnl[trade.pair] ?? 0) + e.blended_pnl;
  });
  const pairEntries = Object.entries(pairPnl);
  const bestPair = pairEntries.length > 0 ? pairEntries.reduce((a, b) => (a[1] > b[1] ? a : b))[0] : "—";
  const worstPair = pairEntries.length > 1 ? pairEntries.reduce((a, b) => (a[1] < b[1] ? a : b))[0] : "—";

  return { tradeCount: base.trade_count, winRate: base.win_rate, avgPnl: base.avg_pnl, bestPair, worstPair };
}

// ── Pill components ───────────────────────────────────────────────────────────

export function StagePill({ stage }: { stage: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    "Stage 1": { bg: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "var(--lucid-accent-bd)" },
    "Stage 2": { bg: "var(--lucid-ctx-bg)", color: "var(--lucid-ctx)", border: "var(--lucid-ctx-bd)" },
    "Funded":  { bg: "var(--lucid-pos-bg)", color: "var(--lucid-pos)", border: "var(--lucid-pos-bd)" },
    "Blown":   { bg: "var(--lucid-neg-bg)",   color: "var(--lucid-neg)", border: "var(--lucid-neg-bd)" },
  };
  const s = map[stage] ?? map["Stage 1"];
  return (
    <span className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {stage}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    "Active": { bg: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "var(--lucid-accent-bd)" },
    "Passed": { bg: "var(--lucid-pos-bg)", color: "var(--lucid-pos)", border: "var(--lucid-pos-bd)" },
    "Blown":  { bg: "var(--lucid-neg-bg)",   color: "var(--lucid-neg)", border: "var(--lucid-neg-bd)" },
    "Closed": { bg: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "var(--lucid-line-2)" },
  };
  const s = map[status] ?? map["Active"];
  return (
    <span className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

// ── Lifecycle status control ──────────────────────────────────────────────
// The only place an account's status can be changed. Shared by the drawer
// and the detail page so the behaviour (confirmation copy, mutation, toasts)
// exists in exactly one place.

const STATUS_OPTS: AccountStatus[] = ["Active", "Passed", "Blown", "Closed"];

export function LifecycleStatusControl({ account }: { account: Account }) {
  const updateAccount = useUpdateAccount();
  const [pendingStatus, setPendingStatus] = useState<AccountStatus | null>(null);

  function commit(status: AccountStatus) {
    updateAccount.mutate(
      { id: account.id, body: { status } },
      {
        onSuccess: () => toast.success(`${account.account_name} marked ${status}.`, { title: "Status updated" }),
        onError: () => toast.error(`Couldn't update ${account.account_name}'s status.`, { title: "Update failed" }),
      },
    );
  }

  function handleChange(next: AccountStatus) {
    if (next === account.status) return;
    if (next === "Active") {
      commit(next);
    } else {
      setPendingStatus(next);
    }
  }

  return (
    <>
      <div style={{ minWidth: 140 }}>
        <label className="lx-field-label" htmlFor={`status-${account.id}`}>Status</label>
        <select
          id={`status-${account.id}`}
          className="lx-input lx-select"
          style={{ height: 32, fontSize: 12.5 }}
          value={account.status}
          disabled={updateAccount.isPending}
          onChange={(e) => handleChange(e.target.value as AccountStatus)}
        >
          {STATUS_OPTS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <ConfirmDialog
        open={pendingStatus !== null}
        title={`Mark ${account.account_name} as ${pendingStatus}?`}
        message={`This account's balance will no longer count toward capital totals, but all of its trades will continue to count toward performance statistics.`}
        confirmLabel={`Mark ${pendingStatus}`}
        danger={false}
        loading={updateAccount.isPending}
        onConfirm={() => {
          if (!pendingStatus) return;
          commit(pendingStatus);
          setPendingStatus(null);
        }}
        onCancel={() => setPendingStatus(null)}
      />
    </>
  );
}

/** Account-type pill: Personal (blue), Demo (gray), Prop Firm (indigo/purple). */
export function AccountTypePill({ type }: { type: AccountType }) {
  const color = ACCOUNT_TYPE_COLORS[type];
  return (
    <span className="pill" style={{ background: `${color}22`, color, border: `1px solid ${color}40` }}>
      {accountTypeLabel(type)}
    </span>
  );
}

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

// ── Progress bar components ───────────────────────────────────────────────────

function DrawdownBar({ pctUsed }: { pctUsed: number }) {
  const color = pctUsed >= 80 ? "var(--lucid-neg)" : pctUsed >= 60 ? "var(--lucid-warn)" : "var(--lucid-pos)";
  return (
    <div className="lx-progress-track">
      <div className="lx-progress-fill" style={{ width: `${pctUsed}%`, background: color }} />
    </div>
  );
}

function GoalBar({ pct }: { pct: number }) {
  return (
    <div className="lx-progress-track">
      <div className="lx-progress-fill" style={{ width: `${pct}%`, background: "var(--lucid-accent)" }} />
    </div>
  );
}

// ── Section components ────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="lx-eyebrow" style={{ marginBottom: 12 }}>{children}</p>;
}

function Section({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div className="lx-content-section" style={first ? { borderTop: "none", paddingTop: 0 } : undefined}>
      {children}
    </div>
  );
}

function StatMiniCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="lx-card lx-card-compact flex flex-col gap-0.5">
      <span className="lx-eyebrow">{label}</span>
      <span className="lx-metric-sm" style={{ fontSize: 16, color: "var(--lucid-ink)" }}>{value}</span>
      {sub && <span className="lx-micro">{sub}</span>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AccountDrawerContentProps {
  account: Account;
  /** Every idea (not just this account's) — this account's own executions
   * are derived from it, joined back to their parent idea for pair/click-through. */
  trades: Trade[];
  onTradeClick?: (tradeId: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function AccountDrawerContent({ account, trades, onTradeClick, onEdit, onDelete }: AccountDrawerContentProps) {
  const prop = isPropAccount(account);
  const hasGoal = account.profit_goal_pct != null && account.profit_goal_pct > 0;
  const { drawdownUsed, drawdownLimit, pctUsed } = calcDrawdown(account);
  const { profitAchieved, profitTarget, pct: goalPct } = calcGoalProgress(account);
  const { tradeCount, winRate, avgPnl, bestPair, worstPair } = calcAccountStats(trades, account.id);

  const isPassed = account.status === "Passed";
  const isActive = account.status === "Active";
  const pnl = accountTradingPnl(account);
  const pnlPct = account.account_size > 0 ? (pnl / account.account_size) * 100 : 0;
  const pnlColor = pnl > 0 ? "var(--lucid-pos)" : pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";

  const remaining = profitTarget - profitAchieved;
  const fromBlown = drawdownLimit - drawdownUsed;

  // This account's own executions, each joined back to its parent idea (for
  // pair + click-through). Sorted most recent first by close date.
  const accountRows = trades.flatMap((t) =>
    t.executions.filter((e) => e.account_id === account.id).map((e) => ({ execution: e, trade: t })),
  );
  const recentTrades = accountRows
    .filter((r) => r.execution.date_closed)
    .sort((a, b) => new Date(b.execution.date_closed).getTime() - new Date(a.execution.date_closed).getTime())
    .slice(0, 5);

  function getPairDisplay(pair: string) {
    return pairs.find(p => p.symbol === pair)?.display_name ?? pair;
  }

  return (
    <div className="flex flex-col pb-6">

      {/* Edit / Delete actions */}
      {(onEdit || onDelete) && (
        <div className="flex items-center justify-end gap-2" style={{ marginBottom: 16 }}>
          {onEdit && (
            <button onClick={onEdit} className="lx-btn lx-btn-secondary" style={{ height: 32, paddingInline: 12, fontSize: 12.5 }}>
              <Pencil size={13} /> Edit
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="lx-btn lx-btn-danger" style={{ height: 32, paddingInline: 12, fontSize: 12.5 }}>
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      )}

      {/* ── Section 1: Header ──────────────────────────────────── */}
      <Section first>
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <AccountTypePill type={account.account_type} />
            {prop && account.stage && <StagePill stage={account.stage} />}
            <StatusPill status={account.status} />
          </div>
          <LifecycleStatusControl account={account} />
        </div>
        <p className="lx-micro" style={{ marginBottom: 4 }}>{accountSource(account)}</p>
        <p className="lx-heading" style={{ fontSize: 18, marginBottom: 10 }}>
          {account.account_name}
        </p>
        <p className="lx-metric" style={{ color: pnlColor }}>
          {formatCurrency(account.current_balance)}
        </p>
        <p className="lx-value" style={{ color: pnlColor, marginTop: 6 }}>
          {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
        </p>
      </Section>

      {/* ── Section 2: Targets (prop) / Goal (personal) ──────────────── */}
      {!prop && hasGoal && (
        <Section>
          <SectionTitle>Goal</SectionTitle>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="lx-body" style={{ fontSize: 12 }}>Profit Goal</span>
              <span className="lx-micro">
                {goalPct >= 100 ? "Reached" : `${formatCurrency(remaining)} to go`}
              </span>
            </div>
            <GoalBar pct={goalPct} />
            <div className="flex items-center justify-between mt-2">
              <span className="lx-micro">
                {goalPct.toFixed(0)}% of {formatCurrency(profitTarget)} goal
              </span>
            </div>
          </div>
        </Section>
      )}

      {prop && (
      <Section>
        <SectionTitle>Targets</SectionTitle>

        {/* Profit Target */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="lx-body" style={{ fontSize: 12 }}>Profit Target</span>
            {isPassed ? (
              <span style={{ fontSize: 12, color: "var(--lucid-pos)", fontWeight: 600 }}>✓ Passed</span>
            ) : (
              <span className="lx-micro">
                {formatCurrency(remaining)} to go
              </span>
            )}
          </div>
          <GoalBar pct={goalPct} />
          <div className="flex items-center justify-between mt-2">
            <span className="lx-micro">{goalPct.toFixed(0)}% of {formatCurrency(profitTarget)} target</span>
          </div>
        </div>

        {/* Max Drawdown */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="lx-body" style={{ fontSize: 12 }}>Max Drawdown</span>
            <span className="lx-micro">
              {formatCurrency(drawdownUsed)} used / {formatCurrency(drawdownLimit)}
            </span>
          </div>
          <DrawdownBar pctUsed={pctUsed} />
          <div className="flex items-center justify-between mt-2">
            <span className="lx-micro" style={{ color: pctUsed >= 80 ? "var(--lucid-neg)" : pctUsed >= 60 ? "var(--lucid-warn)" : "var(--lucid-ink-3)" }}>
              {pctUsed.toFixed(0)}% used
            </span>
          </div>

          {/* Danger zone warning */}
          {isActive && pctUsed > 80 && (
            <div
              className="mt-3 rounded-lg px-3 py-2.5 flex items-start gap-2"
              style={{ background: "var(--lucid-neg-bg)", border: "1px solid var(--lucid-neg-bd)" }}
            >
              <span style={{ fontSize: 14 }}>⚠</span>
              <p style={{ fontSize: 12, color: "var(--lucid-neg)", lineHeight: 1.5 }}>
                Approaching max drawdown.{" "}
                <strong>{formatCurrency(fromBlown)}</strong> from blown account.
              </p>
            </div>
          )}
        </div>
      </Section>
      )}

      {/* ── Section 3: Quick Stats ────────────────────────────────── */}
      <Section>
        <SectionTitle>Quick Stats</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <StatMiniCard
            label="Trade Count"
            value={tradeCount}
            sub="total trades"
          />
          <StatMiniCard
            label="Win Rate"
            value={
              <span style={{ color: winRate >= 40 ? "var(--lucid-pos)" : winRate >= 30 ? "var(--lucid-warn)" : "var(--lucid-neg)" }}>
                {tradeCount > 0 ? `${winRate.toFixed(0)}%` : "—"}
              </span>
            }
            sub="wins / (wins + losses)"
          />
          <StatMiniCard
            label="Avg P&L / Trade"
            value={
              <span style={{ color: avgPnl > 0 ? "var(--lucid-pos)" : avgPnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)" }}>
                {tradeCount > 0 ? formatCurrency(avgPnl) : "—"}
              </span>
            }
          />
          <StatMiniCard
            label="Best / Worst Pair"
            value={
              <span style={{ fontSize: 13 }}>
                <span style={{ color: "var(--lucid-pos)" }}>{bestPair}</span>
                {worstPair !== "—" && (
                  <>
                    <span style={{ color: "var(--lucid-ink-3)" }}> / </span>
                    <span style={{ color: "var(--lucid-neg)" }}>{worstPair}</span>
                  </>
                )}
              </span>
            }
          />
        </div>
      </Section>

      {/* ── Section 4: Recent Trades ──────────────────────────────── */}
      <Section>
        <SectionTitle>Recent Trades</SectionTitle>
        {recentTrades.length === 0 ? (
          <p className="lx-body">No closed trades on this account.</p>
        ) : (
          <div className="lx-card lx-card-compact" style={{ padding: 0 }}>
            <div className="lx-rows">
              {recentTrades.map(({ execution, trade }) => {
                const pnlCol = execution.blended_pnl > 0 ? "var(--lucid-pos)" : execution.blended_pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
                return (
                  <button
                    key={execution.id}
                    className="lx-row"
                    style={{ paddingInline: 12 }}
                    onClick={() => onTradeClick?.(trade.id)}
                  >
                    <span className="lx-micro" style={{ minWidth: 52 }}>
                      {new Date(execution.date_closed).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--lucid-ink)", flex: 1 }}>
                      {getPairDisplay(trade.pair)}
                    </span>
                    <span className="lx-value" style={{ fontWeight: 700, color: pnlCol, minWidth: 64, textAlign: "right" }}>
                      {execution.blended_pnl > 0 ? "+" : ""}{formatCurrency(execution.blended_pnl)}
                    </span>
                    <ExitTypePill type={execution.exit_type} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      {/* ── Section 5: Payouts (prop) / Deposits & Withdrawals (personal) ── */}
      {prop ? (
        <Section>
          <SectionTitle>Payouts</SectionTitle>
          {account.payouts.length === 0 ? (
            <p className="lx-body">No payouts logged yet.</p>
          ) : (
            <div className="lx-card lx-card-compact" style={{ padding: 0 }}>
              <div className="lx-rows">
                {account.payouts.map((payout: Payout, i: number) => (
                  <div key={i} className="lx-row" style={{ paddingInline: 12 }}>
                    <span className="lx-micro" style={{ minWidth: 80 }}>
                      {new Date(payout.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="lx-value" style={{ fontWeight: 700, color: "var(--lucid-pos)", flex: 1 }}>
                      +{formatCurrency(payout.amount)}
                    </span>
                    <span className="lx-micro">
                      Running: {formatCurrency(payout.running_total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      ) : (
        <Section>
          <SectionTitle>Deposits &amp; Withdrawals</SectionTitle>
          {account.cash_flows.length === 0 ? (
            <p className="lx-body">No deposits or withdrawals logged yet.</p>
          ) : (
            <div className="lx-card lx-card-compact" style={{ padding: 0 }}>
              <div className="lx-rows">
                {account.cash_flows.map((cf, i) => {
                  const isOut = cf.type === "withdrawal";
                  const color = isOut ? "var(--lucid-neg)" : "var(--lucid-pos)";
                  const cfLabel = cf.type === "deposit" ? "Deposit" : cf.type === "withdrawal" ? "Withdrawal" : "Payout";
                  return (
                    <div key={i} className="lx-row" style={{ paddingInline: 12 }}>
                      <span className="lx-micro" style={{ minWidth: 80 }}>
                        {new Date(cf.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--lucid-ink-2)", flex: 1 }}>
                        {cfLabel}
                        {cf.note ? <span style={{ color: "var(--lucid-ink-3)" }}> · {cf.note}</span> : null}
                      </span>
                      <span className="lx-value" style={{ fontWeight: 700, color }}>
                        {isOut ? "−" : "+"}
                        {formatCurrency(cf.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Section>
      )}

    </div>
  );
}
