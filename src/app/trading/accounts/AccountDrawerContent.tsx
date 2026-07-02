"use client";

import { Pencil, Trash2 } from "lucide-react";
import {
  type Account,
  type Trade,
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

export function calcAccountStats(accountTrades: Trade[]) {
  const closedTrades = accountTrades.filter(t => t.date_closed);
  // Outcome decided by manual net P&L (blended_pnl), matching the journal.
  const wins = closedTrades.filter(t => t.blended_pnl > 0);
  const losses = closedTrades.filter(t => t.blended_pnl < 0);
  const denominator = wins.length + losses.length;
  const winRate = denominator > 0 ? (wins.length / denominator) * 100 : 0;
  const netPnl = closedTrades.reduce((sum, t) => sum + t.blended_pnl, 0);
  const avgPnl = closedTrades.length > 0 ? netPnl / closedTrades.length : 0;

  const pairPnl: Record<string, number> = {};
  closedTrades.forEach(t => {
    pairPnl[t.pair] = (pairPnl[t.pair] ?? 0) + t.blended_pnl;
  });
  const pairEntries = Object.entries(pairPnl);
  const bestPair = pairEntries.length > 0
    ? pairEntries.reduce((a, b) => a[1] > b[1] ? a : b)[0]
    : "—";
  const worstPair = pairEntries.length > 1
    ? pairEntries.reduce((a, b) => a[1] < b[1] ? a : b)[0]
    : "—";

  return { tradeCount: accountTrades.length, winRate, avgPnl, bestPair, worstPair };
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
    <div
      style={{
        width: "100%",
        height: 8,
        background: "var(--lucid-surface-3)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pctUsed}%`,
          height: "100%",
          background: color,
          borderRadius: 4,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

function GoalBar({ pct }: { pct: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: 8,
        background: "var(--lucid-surface-3)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: "var(--lucid-accent)",
          borderRadius: 4,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

// ── Section components ────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="lt-serif text-xs font-semibold uppercase tracking-widest mb-3"
      style={{ color: "var(--lucid-ink-3)", letterSpacing: "0.08em" }}
    >
      {children}
    </p>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`lt-card p-4 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

function StatMiniCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div
      className="lt-card-2 rounded-xl p-3 flex flex-col gap-0.5"
    >
      <span style={{ fontSize: 11, color: "var(--lucid-ink-3)", fontWeight: 500 }}>{label}</span>
      <span className="lt-num" style={{ fontSize: 16, fontWeight: 700, color: "var(--lucid-ink)" }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>{sub}</span>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AccountDrawerContentProps {
  account: Account;
  accountTrades: Trade[];
  onTradeClick?: (tradeId: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function AccountDrawerContent({ account, accountTrades, onTradeClick, onEdit, onDelete }: AccountDrawerContentProps) {
  const prop = isPropAccount(account);
  const hasGoal = account.profit_goal_pct != null && account.profit_goal_pct > 0;
  const { drawdownUsed, drawdownLimit, pctUsed } = calcDrawdown(account);
  const { profitAchieved, profitTarget, pct: goalPct } = calcGoalProgress(account);
  const { tradeCount, winRate, avgPnl, bestPair, worstPair } = calcAccountStats(accountTrades);

  const isPassed = account.status === "Passed";
  const isActive = account.status === "Active";
  const pnl = accountTradingPnl(account);
  const pnlPct = account.account_size > 0 ? (pnl / account.account_size) * 100 : 0;
  const pnlColor = pnl > 0 ? "var(--lucid-pos)" : pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";

  const remaining = profitTarget - profitAchieved;
  const fromBlown = drawdownLimit - drawdownUsed;

  // Sort trades: most recent first (by date_closed for closed, date_opened for running)
  const sortedTrades = [...accountTrades]
    .filter(t => t.date_closed)
    .sort((a, b) => new Date(b.date_closed).getTime() - new Date(a.date_closed).getTime());
  const recentTrades = sortedTrades.slice(0, 5);

  function getPairDisplay(pair: string) {
    return pairs.find(p => p.symbol === pair)?.display_name ?? pair;
  }

  return (
    <div className="flex flex-col gap-4 pb-6">

      {/* Edit / Delete actions */}
      {(onEdit || onDelete) && (
        <div className="flex items-center justify-end gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: "var(--lucid-ink-2)", border: "1px solid var(--lucid-line-2)" }}
            >
              <Pencil size={14} /> Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{ color: "var(--lucid-neg)", border: "1px solid var(--lucid-neg-bd)" }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      )}

      {/* ── Section 1: Header ──────────────────────────────────── */}
      <Card>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <AccountTypePill type={account.account_type} />
          {prop && account.stage && <StagePill stage={account.stage} />}
          <StatusPill status={account.status} />
        </div>
        <p style={{ fontSize: 12, color: "var(--lucid-ink-3)", marginBottom: 2 }}>{accountSource(account)}</p>
        <p className="lt-serif" style={{ fontSize: 16, fontWeight: 700, color: "var(--lucid-ink)", marginBottom: 8 }}>
          {account.account_name}
        </p>
        <p className="lt-num" style={{ fontSize: 28, fontWeight: 700, color: pnlColor, lineHeight: 1 }}>
          {formatCurrency(account.current_balance)}
        </p>
        <p className="lt-num" style={{ fontSize: 13, color: pnlColor, marginTop: 4 }}>
          {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
        </p>
      </Card>

      {/* ── Section 2: Targets (prop) / Goal (personal) ──────────────── */}
      {!prop && hasGoal && (
        <Card>
          <SectionTitle>Goal</SectionTitle>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span style={{ fontSize: 12, color: "var(--lucid-ink-2)" }}>Profit Goal</span>
              <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>
                {goalPct >= 100 ? "Reached" : `${formatCurrency(remaining)} to go`}
              </span>
            </div>
            <GoalBar pct={goalPct} />
            <div className="flex items-center justify-between mt-1">
              <span className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>
                {goalPct.toFixed(0)}% of {formatCurrency(profitTarget)} goal
              </span>
            </div>
          </div>
        </Card>
      )}

      {prop && (
      <Card>
        <SectionTitle>Targets</SectionTitle>

        {/* Profit Target */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize: 12, color: "var(--lucid-ink-2)" }}>Profit Target</span>
            {isPassed ? (
              <span style={{ fontSize: 12, color: "var(--lucid-pos)", fontWeight: 600 }}>✓ Passed</span>
            ) : (
              <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>
                {formatCurrency(remaining)} to go
              </span>
            )}
          </div>
          <GoalBar pct={goalPct} />
          <div className="flex items-center justify-between mt-1">
            <span className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>{goalPct.toFixed(0)}% of {formatCurrency(profitTarget)} target</span>
          </div>
        </div>

        {/* Max Drawdown */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize: 12, color: "var(--lucid-ink-2)" }}>Max Drawdown</span>
            <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>
              {formatCurrency(drawdownUsed)} used / {formatCurrency(drawdownLimit)}
            </span>
          </div>
          <DrawdownBar pctUsed={pctUsed} />
          <div className="flex items-center justify-between mt-1">
            <span className="lt-num" style={{ fontSize: 11, color: pctUsed >= 80 ? "var(--lucid-neg)" : pctUsed >= 60 ? "var(--lucid-warn)" : "var(--lucid-ink-3)" }}>
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
      </Card>
      )}

      {/* ── Section 3: Quick Stats ────────────────────────────────── */}
      <div>
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
      </div>

      {/* ── Section 4: Recent Trades ──────────────────────────────── */}
      <div>
        <SectionTitle>Recent Trades</SectionTitle>
        {recentTrades.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>No closed trades on this account.</p>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--lucid-line)" }}
          >
            {recentTrades.map((trade, i) => {
              const pnlCol = trade.blended_pnl > 0 ? "var(--lucid-pos)" : trade.blended_pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
              return (
                <button
                  key={trade.id}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors"
                  style={{
                    background: i % 2 === 0 ? "var(--lucid-surface-2)" : "var(--lucid-surface)",
                    borderBottom: i < recentTrades.length - 1 ? "1px solid var(--lucid-line)" : "none",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--lucid-surface-3)")}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "var(--lucid-surface-2)" : "var(--lucid-surface)")}
                  onClick={() => onTradeClick?.(trade.id)}
                >
                  <span className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-3)", minWidth: 52 }}>
                    {new Date(trade.date_closed).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--lucid-ink)", flex: 1 }}>
                    {getPairDisplay(trade.pair)}
                  </span>
                  <span className="lt-num" style={{ fontSize: 12, fontWeight: 700, color: pnlCol, minWidth: 64, textAlign: "right" }}>
                    {trade.blended_pnl > 0 ? "+" : ""}{formatCurrency(trade.blended_pnl)}
                  </span>
                  <ExitTypePill type={trade.exit_type} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 5: Payouts (prop) / Deposits & Withdrawals (personal) ── */}
      {prop ? (
        <div>
          <SectionTitle>Payouts</SectionTitle>
          {account.payouts.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>No payouts logged yet.</p>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--lucid-line)" }}
            >
              {account.payouts.map((payout: Payout, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2.5"
                  style={{
                    background: i % 2 === 0 ? "var(--lucid-surface-2)" : "var(--lucid-surface)",
                    borderBottom: i < account.payouts.length - 1 ? "1px solid var(--lucid-line)" : "none",
                  }}
                >
                  <span className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-3)", minWidth: 80 }}>
                    {new Date(payout.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className="lt-num" style={{ fontSize: 13, fontWeight: 700, color: "var(--lucid-pos)", flex: 1 }}>
                    +{formatCurrency(payout.amount)}
                  </span>
                  <span className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>
                    Running: {formatCurrency(payout.running_total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <SectionTitle>Deposits &amp; Withdrawals</SectionTitle>
          {account.cash_flows.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>No deposits or withdrawals logged yet.</p>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--lucid-line)" }}
            >
              {account.cash_flows.map((cf, i) => {
                const isOut = cf.type === "withdrawal";
                const color = isOut ? "var(--lucid-neg)" : "var(--lucid-pos)";
                const cfLabel = cf.type === "deposit" ? "Deposit" : cf.type === "withdrawal" ? "Withdrawal" : "Payout";
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5"
                    style={{
                      background: i % 2 === 0 ? "var(--lucid-surface-2)" : "var(--lucid-surface)",
                      borderBottom: i < account.cash_flows.length - 1 ? "1px solid var(--lucid-line)" : "none",
                    }}
                  >
                    <span className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-3)", minWidth: 80 }}>
                      {new Date(cf.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--lucid-ink-2)", flex: 1 }}>
                      {cfLabel}
                      {cf.note ? <span style={{ color: "var(--lucid-ink-3)" }}> · {cf.note}</span> : null}
                    </span>
                    <span className="lt-num" style={{ fontSize: 13, fontWeight: 700, color }}>
                      {isOut ? "−" : "+"}
                      {formatCurrency(cf.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
