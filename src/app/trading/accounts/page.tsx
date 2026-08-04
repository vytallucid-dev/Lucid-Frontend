"use client";

import { useState, useMemo, useRef } from "react";
import { Plus, LayoutList, LayoutGrid, ArrowLeftRight, Check, X } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useScrollLock } from "@/hooks/useScrollLock";
import {
  type Account,
  type AccountType,
  type CashFlowType,
  formatCurrency,
  type Trade,
  isPropAccount,
  accountSource,
  accountTypeLabel,
  accountTradingPnl,
  ACCOUNT_TYPE_COLORS,
} from "@/lib/demo-data";
import { managedCapital, evaluationCapital, isLifecycleClosed } from "@/lib/account-capital";
import {
  useAccounts,
  useTrades,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useAddCashFlow,
} from "@/hooks/useTrading";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { CreateAccountPayload } from "@/lib/api/trading";
import { SkeletonGridRows, SkeletonCard } from "@/components/state/Skeleton";
import { ErrorState } from "@/components/state/ErrorState";
import { DetailDrawer } from "@/components/DetailDrawer";
import { toast } from "@/components/toast";
import {
  AccountDrawerContent,
  AccountTypePill,
  StagePill,
  StatusPill,
  calcDrawdown,
  calcGoalProgress,
  calcAccountStats,
} from "./AccountDrawerContent";

// ── Mini progress bars (60px inline, for table) ───────────────────────────────

function MiniDrawdownBar({ pctUsed }: { pctUsed: number }) {
  const color = pctUsed >= 80 ? "var(--lucid-neg)" : pctUsed >= 60 ? "var(--lucid-warn)" : "var(--lucid-pos)";
  return (
    <div className="flex items-center gap-1.5">
      <div style={{ width: 60, height: 6, background: "var(--lucid-surface-3)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: `${pctUsed}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>{pctUsed.toFixed(0)}%</span>
    </div>
  );
}

function MiniGoalBar({ pct, isPassed }: { pct: number; isPassed: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div style={{ width: 60, height: 6, background: "var(--lucid-surface-3)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: isPassed ? "100%" : `${pct}%`, height: "100%", background: "var(--lucid-accent)", borderRadius: 3 }} />
      </div>
      {isPassed ? <Check size={11} style={{ color: "var(--lucid-pos)" }} /> : <span className="lt-num" style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>{pct.toFixed(0)}%</span>}
    </div>
  );
}

const MUTED = "var(--lucid-ink-3)";

// ── Gallery card ─────────────────────────────────────────────────────────────

function AccountGalleryCard({
  account,
  accountTrades,
  onClick,
  recessed,
}: {
  account: Account;
  accountTrades: Trade[];
  onClick: () => void;
  recessed?: boolean;
}) {
  const prop = isPropAccount(account);
  const hasGoal = account.profit_goal_pct != null && account.profit_goal_pct > 0;
  const { drawdownUsed, drawdownLimit, pctUsed } = calcDrawdown(account);
  const { profitAchieved, profitTarget, pct: goalPct } = calcGoalProgress(account);
  const { winRate, tradeCount } = calcAccountStats(accountTrades, account.id);
  const isPassed = account.status === "Passed";
  const pnl = accountTradingPnl(account);
  const pnlPct = account.account_size > 0 ? (pnl / account.account_size) * 100 : 0;
  const pnlColor = pnl > 0 ? "var(--lucid-pos)" : pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
  const ddColor = pctUsed >= 80 ? "var(--lucid-neg)" : pctUsed >= 60 ? "var(--lucid-warn)" : "var(--lucid-pos)";
  const remaining = profitTarget - profitAchieved;

  const startDate = new Date(account.starting_date);
  const daysActive = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const startLabel = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <button
      className="lt-card text-left w-full p-5 flex flex-col transition-all duration-200"
      style={{ minHeight: 340, cursor: "pointer" }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--lucid-accent-bd)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--lucid-line)";
      }}
      onClick={onClick}
    >
      {/* Pill row — status pill stays at full strength even when the card is recessed */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <AccountTypePill type={account.account_type} />
        {prop && account.stage && <StagePill stage={account.stage} />}
        <span style={recessed ? { opacity: 1 / 0.55 } : undefined}>
          <StatusPill status={account.status} />
        </span>
      </div>

      {/* Source + name */}
      <p style={{ fontSize: 12, color: "var(--lucid-ink-3)", marginBottom: 2 }}>{accountSource(account)}</p>
      <p className="lt-serif" style={{ fontSize: 16, fontWeight: 700, color: "var(--lucid-ink)", marginBottom: 12 }}>{account.account_name}</p>

      {/* Balance */}
      <p className="lt-num" style={{ fontSize: 26, fontWeight: 700, color: pnlColor, lineHeight: 1.1, marginBottom: 4 }}>
        {formatCurrency(account.current_balance)}
      </p>
      <p className="lt-num" style={{ fontSize: 13, color: pnlColor, opacity: 0.85, marginBottom: 16 }}>
        {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
      </p>

      <div style={{ height: 1, background: "var(--lucid-line)", marginBottom: 16 }} />

      {prop ? (
        <>
          {/* Profit Target bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 12, color: "var(--lucid-ink-2)" }}>Profit Target</span>
              {isPassed ? (
                <span style={{ fontSize: 12, color: "var(--lucid-pos)", fontWeight: 600 }}>✓ Passed</span>
              ) : (
                <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>{formatCurrency(remaining)} to go</span>
              )}
            </div>
            <div style={{ width: "100%", height: 8, background: "var(--lucid-surface-3)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: isPassed ? "100%" : `${goalPct}%`, height: "100%", background: "var(--lucid-accent)", borderRadius: 4 }} />
            </div>
            <p className="lt-num" style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
              {isPassed ? "100%" : `${goalPct.toFixed(0)}%`} of {formatCurrency(profitTarget)} target
            </p>
          </div>

          {/* Max Drawdown bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 12, color: "var(--lucid-ink-2)" }}>Max Drawdown</span>
              <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>{formatCurrency(drawdownUsed)} used / {formatCurrency(drawdownLimit)}</span>
            </div>
            <div style={{ width: "100%", height: 8, background: "var(--lucid-surface-3)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${pctUsed}%`, height: "100%", background: ddColor, borderRadius: 4 }} />
            </div>
            <p className="lt-num" style={{ fontSize: 11, color: pctUsed >= 80 ? "var(--lucid-neg)" : pctUsed >= 60 ? "var(--lucid-warn)" : MUTED, marginTop: 4 }}>{pctUsed.toFixed(0)}% used</p>
          </div>
        </>
      ) : (
        <>
          {/* Win rate (universal) */}
          <div className="mb-4 flex items-center justify-between">
            <span style={{ fontSize: 12, color: "var(--lucid-ink-2)" }}>Win Rate</span>
            <span className="lt-num" style={{ fontSize: 13, fontWeight: 600, color: winRate >= 40 ? "var(--lucid-pos)" : winRate >= 30 ? "var(--lucid-warn)" : tradeCount > 0 ? "var(--lucid-neg)" : "var(--lucid-ink-3)" }}>
              {tradeCount > 0 ? `${winRate.toFixed(0)}%` : "—"}
            </span>
          </div>

          {/* Optional personal goal — hidden if not set */}
          {hasGoal && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 12, color: "var(--lucid-ink-2)" }}>Goal</span>
                <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>{goalPct >= 100 ? "Reached" : `${formatCurrency(remaining)} to go`}</span>
              </div>
              <div style={{ width: "100%", height: 8, background: "var(--lucid-surface-3)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${goalPct}%`, height: "100%", background: "var(--lucid-accent)", borderRadius: 4 }} />
              </div>
              <p className="lt-num" style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{goalPct.toFixed(0)}% of {formatCurrency(profitTarget)} goal</p>
            </div>
          )}
        </>
      )}

      <div style={{ height: 1, background: "var(--lucid-line)", marginBottom: 12, marginTop: "auto" }} />

      {/* Bottom strip */}
      <div className="flex items-center gap-2" style={{ fontSize: 11, color: MUTED }}>
        <span>Started {startLabel}</span>
        <span style={{ color: "var(--lucid-ink-3)" }}>·</span>
        <span>{daysActive} days</span>
        <span style={{ color: "var(--lucid-ink-3)" }}>·</span>
        <span>{tradeCount} trades</span>
      </div>
    </button>
  );
}

// ── Add Account Modal (type-aware) ────────────────────────────────────────────

interface AddAccountModalProps {
  initial?: Account;
  existingSources: string[];
  onSubmit: (account: CreateAccountPayload) => void;
  onClose: () => void;
  saving?: boolean;
}

const STAGE_OPTS = ["Stage 1", "Stage 2", "Funded"] as const;
type StageOpt = (typeof STAGE_OPTS)[number];
const STATUS_OPTS = ["Active", "Passed", "Blown", "Closed"] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "JPY"];

export function AddAccountModal({ initial, existingSources, onSubmit, onClose, saving }: AddAccountModalProps) {
  const isEdit = !!initial;
  const initialSource = initial
    ? (initial.account_type === "prop_firm" ? initial.prop_firm : initial.broker) ?? ""
    : "";

  const [type, setType] = useState<AccountType>(initial?.account_type ?? "personal");
  const [name, setName] = useState(initial?.account_name ?? "");
  const [source, setSource] = useState(initialSource);
  const [size, setSize] = useState(initial ? String(initial.account_size) : "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [status, setStatus] = useState<Account["status"]>(initial?.status ?? "Active");
  const [goalPct, setGoalPct] = useState(initial?.profit_goal_pct != null ? String(initial.profit_goal_pct) : "");
  const [stage, setStage] = useState<StageOpt>(
    initial?.stage && (STAGE_OPTS as readonly string[]).includes(initial.stage) ? (initial.stage as StageOpt) : "Stage 1",
  );
  const [profitTargetPct, setProfitTargetPct] = useState(initial?.profit_target_pct != null ? String(initial.profit_target_pct) : "");
  const [maxDrawdownPct, setMaxDrawdownPct] = useState(initial?.max_drawdown_pct != null ? String(initial.max_drawdown_pct) : "");
  const [startingDate, setStartingDate] = useState(initial?.starting_date ?? new Date().toISOString().split("T")[0]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  useScrollLock(panelRef, true);

  const prop = type === "prop_firm";
  const suggestions = existingSources.filter(f => source.length > 0 && f.toLowerCase().includes(source.toLowerCase()) && f !== source);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sizeNum = parseFloat(size) || 0;
    const base: CreateAccountPayload = {
      account_type: type,
      account_name: name,
      account_size: sizeNum,
      currency,
      status: isEdit ? status : "Active",
      starting_date: startingDate,
    };
    const payload: CreateAccountPayload = prop
      ? {
          ...base,
          account_type: "prop_firm",
          prop_firm: source,
          stage,
          max_drawdown_pct: parseFloat(maxDrawdownPct) || 5,
          profit_target_pct: parseFloat(profitTargetPct) || 10,
        }
      : {
          ...base,
          account_type: type,
          broker: source || null,
          profit_goal_pct: goalPct ? parseFloat(goalPct) : null,
        };
    onSubmit(payload);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="lx-overlay-scrim" onClick={onClose} />
      <div ref={panelRef} className="lx-modal-panel lx-modal-form relative">
        <div className="lx-overlay-header">
          <h2 className="lx-overlay-title" style={{ fontSize: 18 }}>{isEdit ? "Edit Account" : "Add Account"}</h2>
          <button className="lx-overlay-close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="lx-overlay-body flex flex-col gap-0">
          {/* Account Type — drives the rest of the form */}
          <div className="lx-field">
            <label className="lx-field-label">Account Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(["personal", "demo", "prop_firm"] as AccountType[]).map(t => {
                const active = type === t;
                const color = ACCOUNT_TYPE_COLORS[t];
                return (
                  <button
                    key={t}
                    type="button"
                    className="py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: active ? `${color}22` : "var(--lucid-surface-3)",
                      border: active ? `1px solid ${color}66` : "1px solid var(--lucid-line-2)",
                      color: active ? color : "var(--lucid-ink-3)",
                    }}
                    onClick={() => setType(t)}
                  >
                    {accountTypeLabel(t)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Name (universal) */}
          <div className="lx-field">
            <label className="lx-field-label">Account Name</label>
            <input className="lx-input" placeholder={prop ? "e.g. FP 10k Stage 2" : "e.g. My Live Account"} value={name} onChange={e => setName(e.target.value)} required />
          </div>

          {/* Source — Prop Firm (required) or Broker (optional) */}
          <div className="lx-field relative">
            <label className="lx-field-label">{prop ? "Prop Firm" : "Broker (optional)"}</label>
            <input
              className="lx-input"
              placeholder={prop ? "e.g. FundingPips" : "e.g. IC Markets"}
              value={source}
              onChange={e => { setSource(e.target.value); setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              required={prop}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-10" style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line-2)" }}>
                {suggestions.map(s => (
                  <button key={s} type="button" className="w-full text-left px-3 py-2.5 text-sm" style={{ color: "var(--lucid-ink)" }} onClick={() => { setSource(s); setShowSuggestions(false); }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Balance + Currency (universal) */}
          <div className="lx-field grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="lx-field-label">{prop ? "Account Size ($)" : "Starting Balance"}</label>
              <input className="lx-input lx-input-num" type="number" placeholder="10000" value={size} onChange={e => setSize(e.target.value)} min="0" required />
            </div>
            <div>
              <label className="lx-field-label">Currency</label>
              <select className="lx-input lx-select" value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Status — edit only; creation always defaults to Active */}
          {isEdit && (
            <div className="lx-field">
              <label className="lx-field-label">Status</label>
              <select className="lx-input lx-select" value={status} onChange={e => setStatus(e.target.value as Account["status"])}>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Prop-only fields */}
          {prop && (
            <>
              <div className="lx-field">
                <label className="lx-field-label">Stage</label>
                <div className="flex gap-2">
                  {(["Stage 1", "Stage 2", "Funded"] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: stage === s ? "var(--lucid-ctx-bg)" : "var(--lucid-surface-3)",
                        border: stage === s ? "1px solid var(--lucid-ctx-bd)" : "1px solid var(--lucid-line-2)",
                        color: stage === s ? "var(--lucid-ctx)" : "var(--lucid-ink-3)",
                      }}
                      onClick={() => setStage(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lx-field grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="lx-field-label">Profit Target %</label>
                  <input className="lx-input lx-input-num" type="number" placeholder="10" value={profitTargetPct} onChange={e => setProfitTargetPct(e.target.value)} min="0" max="100" step="0.5" required />
                </div>
                <div>
                  <label className="lx-field-label">Max Drawdown %</label>
                  <input className="lx-input lx-input-num" type="number" placeholder="5" value={maxDrawdownPct} onChange={e => setMaxDrawdownPct(e.target.value)} min="0" max="100" step="0.5" required />
                </div>
              </div>
            </>
          )}

          {/* Personal/Demo optional goal */}
          {!prop && (
            <div className="lx-field">
              <label className="lx-field-label">Profit Goal % (optional)</label>
              <input className="lx-input lx-input-num" type="number" placeholder="e.g. 20" value={goalPct} onChange={e => setGoalPct(e.target.value)} min="0" step="0.5" />
            </div>
          )}

          <div className="lx-field">
            <label className="lx-field-label">Starting Date</label>
            <input className="lx-input lx-input-num" type="date" value={startingDate} onChange={e => setStartingDate(e.target.value)} required />
          </div>

          <div className="rounded-lg px-3 py-2" style={{ background: "var(--lucid-accent-bg)", border: "1px solid var(--lucid-accent-bd)" }}>
            <p style={{ fontSize: 11, color: "var(--lucid-ink-3)" }}>
              {isEdit
                ? "Changing status affects capital totals — trades on this account still count toward performance statistics."
                : prop
                ? "Initial balance auto-fills to account size. Status defaults to Active."
                : "Initial balance auto-fills to your starting balance. Goals are optional and only for you."}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="lx-btn lx-btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={saving} className="lx-btn lx-btn-primary flex-1">{saving ? "Saving…" : isEdit ? "Save Changes" : "Add Account"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Cash Flow Modal (deposit / withdrawal / payout — context aware) ───────────

interface CashFlowModalProps {
  accounts: Account[];
  onLog: (accountId: string, flow: { type: CashFlowType; date: string; amount: number; note: string }) => void;
  onClose: () => void;
}

function CashFlowModal({ accounts, onLog, onClose }: CashFlowModalProps) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [flowType, setFlowType] = useState<CashFlowType>("deposit");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true);
  useScrollLock(panelRef, true);

  const selected = accounts.find(a => a.id === accountId);
  const selectedIsProp = selected ? isPropAccount(selected) : false;
  // Payout only makes sense for prop accounts.
  const flowOptions: CashFlowType[] = selectedIsProp ? ["payout", "deposit", "withdrawal"] : ["deposit", "withdrawal"];
  const effectiveFlow: CashFlowType = flowOptions.includes(flowType) ? flowType : flowOptions[0];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onLog(accountId, { type: effectiveFlow, date, amount: parseFloat(amount) || 0, note });
    onClose();
  }

  const flowLabel: Record<CashFlowType, string> = { deposit: "Deposit", withdrawal: "Withdrawal", payout: "Payout" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="lx-overlay-scrim" onClick={onClose} />
      <div ref={panelRef} className="lx-modal-panel lx-modal-confirm relative">
        <div className="lx-overlay-header">
          <h2 className="lx-overlay-title" style={{ fontSize: 18 }}>Cash Flow</h2>
          <button className="lx-overlay-close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {accounts.length === 0 ? (
          <div className="lx-overlay-body">
            <p className="lx-body" style={{ textAlign: "center" }}>No accounts yet. Add an account first.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="lx-overlay-body flex flex-col gap-0">
            <div className="lx-field">
              <label className="lx-field-label">Account</label>
              <select className="lx-input lx-select" value={accountId} onChange={e => setAccountId(e.target.value)} required>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.account_name} ({accountTypeLabel(a.account_type)})
                  </option>
                ))}
              </select>
            </div>

            <div className="lx-field">
              <label className="lx-field-label">Type</label>
              <div className="flex gap-2">
                {flowOptions.map(f => {
                  const active = effectiveFlow === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: active ? "var(--lucid-accent-bg)" : "var(--lucid-surface-3)",
                        border: active ? "1px solid var(--lucid-accent-bd)" : "1px solid var(--lucid-line-2)",
                        color: active ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                      }}
                      onClick={() => setFlowType(f)}
                    >
                      {flowLabel[f]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lx-field">
              <label className="lx-field-label">Date</label>
              <input className="lx-input lx-input-num" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>

            <div className="lx-field">
              <label className="lx-field-label">Amount</label>
              <input className="lx-input lx-input-num" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" required />
            </div>

            <div className="lx-field">
              <label className="lx-field-label">Note (optional)</label>
              <textarea className="lx-input lx-textarea" placeholder="Any notes about this movement..." value={note} onChange={e => setNote(e.target.value)} />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" className="lx-btn lx-btn-secondary flex-1" onClick={onClose}>Cancel</button>
              <button type="submit" className="lx-btn lx-btn-primary flex-1">Log {flowLabel[effectiveFlow]}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

const TABLE_COLS = "1.6fr 90px 1.4fr 110px 90px 80px 100px 120px 130px 90px";
const TABLE_MIN_WIDTH = 1080;
const TABLE_HEADERS = ["Name", "Type", "Broker / Firm", "Balance", "Net P&L", "Win Rate", "Stage", "Target", "Drawdown", "Status"];

export default function AccountsPage() {
  const accountsQuery = useAccounts();
  const tradesQuery = useTrades();
  const createAccountM = useCreateAccount();
  const updateAccountM = useUpdateAccount();
  const deleteAccountM = useDeleteAccount();
  const addCashFlowM = useAddCashFlow();

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const allTrades = useMemo(() => tradesQuery.data ?? [], [tradesQuery.data]);

  const [view, setView] = useState<"table" | "gallery">("table");
  const [lifecycleFilter, setLifecycleFilter] = useState<"active" | "all" | "closed">("active");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCashFlowModal, setShowCashFlowModal] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [pendingDeleteAccount, setPendingDeleteAccount] = useState<Account | null>(null);
  // In-session only — this codebase has no localStorage/UI-preference persistence
  // mechanism today, so the hint returns on next page load by design of that gap,
  // not this dismiss action; it will not reappear within the same session.
  const [showMigrationHint, setShowMigrationHint] = useState(true);

  const visibleAccounts = useMemo(() => {
    if (lifecycleFilter === "all") return accounts;
    if (lifecycleFilter === "closed") return accounts.filter(isLifecycleClosed);
    return accounts.filter(a => !isLifecycleClosed(a));
  }, [accounts, lifecycleFilter]);
  const hiddenCount = accounts.length - visibleAccounts.length;

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) ?? null;

  const managed = useMemo(() => managedCapital(accounts), [accounts]);
  const evaluation = useMemo(() => evaluationCapital(accounts), [accounts]);
  const netPnl = useMemo(() => accounts.reduce((s, a) => s + accountTradingPnl(a), 0), [accounts]);

  // Ideas with an execution in this account, narrowed to that account's
  // fill(s) — same shape the API's account filter returns.
  function getAccountTrades(accountId: string): Trade[] {
    return allTrades
      .filter(t => t.executions.some(e => e.account_id === accountId))
      .map(t => ({ ...t, executions: t.executions.filter(e => e.account_id === accountId) }));
  }

  function handleAddAccount(payload: CreateAccountPayload) {
    createAccountM.mutate(payload, {
      onSuccess: () => toast.success(`${payload.account_name} added to your accounts.`, { title: "Account added" }),
    });
  }

  function handleUpdateAccount(payload: CreateAccountPayload) {
    if (!editAccount) return;
    updateAccountM.mutate({ id: editAccount.id, body: payload }, {
      onSuccess: () => toast.success(`${payload.account_name} updated.`, { title: "Account saved" }),
    });
  }

  function confirmDeleteAccount() {
    const a = pendingDeleteAccount;
    if (!a) return;
    deleteAccountM.mutate(a.id, {
      onSuccess: () => { toast.success(`${a.account_name} deleted.`, { title: "Account deleted" }); setSelectedAccountId(null); },
      onSettled: () => setPendingDeleteAccount(null),
    });
  }

  function handleCashFlow(accountId: string, flow: { type: CashFlowType; date: string; amount: number; note: string }) {
    addCashFlowM.mutate(
      {
        id: accountId,
        body: { type: flow.type, amount: flow.amount, date: flow.date, note: flow.note || null },
      },
      {
        onSuccess: () =>
          toast.success(`${flow.type.charAt(0).toUpperCase() + flow.type.slice(1)} of $${flow.amount.toFixed(2)} logged.`, {
            title: "Cash flow logged",
          }),
      },
    );
  }

  const pnlColor = netPnl >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)";

  return (
    <div className="flex flex-col min-h-full">
      {showMigrationHint && (
        <div
          className="flex items-start justify-between gap-3 px-4 sm:px-6 py-3"
          style={{ background: "var(--lucid-accent-bg)", borderBottom: "1px solid var(--lucid-accent-bd)" }}
        >
          <p style={{ fontSize: 12.5, color: "var(--lucid-ink-2)", lineHeight: 1.5 }}>
            You can now set an account's status. Mark old, finished challenges <strong>Passed</strong> or <strong>Closed</strong> so
            Managed Capital and In Evaluation totals read correctly — every account defaults to Active until you update it.
          </p>
          <button
            className="lx-overlay-close shrink-0"
            style={{ color: "var(--lucid-ink-3)" }}
            onClick={() => setShowMigrationHint(false)}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between px-4 sm:px-6 py-4 sm:py-6">
        <div>
          <h1 className="lt-serif" style={{ fontSize: 24, fontWeight: 600, color: "var(--lucid-ink)" }}>Accounts</h1>
          <p style={{ fontSize: 13, color: "var(--lucid-ink-3)", marginTop: 4 }}>Your trading accounts — personal, demo, and prop firm.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 self-start" style={{ background: "var(--lucid-surface)", border: "1px solid var(--lucid-line)", fontSize: 13, color: "var(--lucid-ink-2)" }}>
          <span>Managed: <strong className="lt-num" style={{ color: "var(--lucid-ink)" }}>{formatCurrency(managed)}</strong></span>
          {evaluation > 0 && (
            <>
              <span style={{ color: "var(--lucid-ink-3)" }}>·</span>
              <span>In Evaluation: <strong className="lt-num" style={{ color: "var(--lucid-ink-3)" }}>{formatCurrency(evaluation)}</strong></span>
            </>
          )}
          <span style={{ color: "var(--lucid-ink-3)" }}>·</span>
          <span>Net P&amp;L: <strong className="lt-num" style={{ color: pnlColor }}>{netPnl >= 0 ? "+" : ""}{formatCurrency(netPnl)}</strong></span>
        </div>
      </div>

      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 pb-4" style={{ borderBottom: "1px solid var(--lucid-line)" }}>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all" style={{ background: "var(--lucid-accent)", color: "var(--lucid-page-bg)" }} onClick={() => setShowAddModal(true)}>
          <Plus size={14} />
          Add Account
        </button>

        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all" style={{ background: "var(--lucid-surface)", border: "1px solid var(--lucid-line-2)", color: "var(--lucid-ink-2)" }} onClick={() => setShowCashFlowModal(true)}>
          <ArrowLeftRight size={14} />
          Cash Flow
        </button>

        {/* Lifecycle filter */}
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--lucid-line-2)", background: "var(--lucid-surface)" }}>
          {([
            { key: "active", label: "Active" },
            { key: "all", label: "All" },
            { key: "closed", label: "Closed" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              className="px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: lifecycleFilter === key ? "var(--lucid-accent-bg)" : "transparent",
                color: lifecycleFilter === key ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                borderRight: key !== "closed" ? "1px solid var(--lucid-line)" : "none",
              }}
              onClick={() => setLifecycleFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {hiddenCount > 0 && (
          <span className="lx-micro">{hiddenCount} account{hiddenCount !== 1 ? "s" : ""} hidden</span>
        )}

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--lucid-line-2)", background: "var(--lucid-surface)" }}>
          {(["table", "gallery"] as const).map(v => (
            <button
              key={v}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors"
              style={{ background: view === v ? "var(--lucid-accent-bg)" : "transparent", color: view === v ? "var(--lucid-accent)" : "var(--lucid-ink-3)", borderRight: v === "table" ? "1px solid var(--lucid-line)" : "none" }}
              onClick={() => setView(v)}
            >
              {v === "table" ? <LayoutList size={13} /> : <LayoutGrid size={13} />}
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 py-5">
        {/* Same grid template and min-width as the real table (or the same card
            grid in gallery view), so rows arrive without moving anything. */}
        {accountsQuery.isLoading &&
          (view === "table" ? (
            <SkeletonGridRows
              columns={TABLE_COLS}
              columnCount={TABLE_HEADERS.length}
              minWidth={TABLE_MIN_WIDTH}
              rows={7}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} height={232} />
              ))}
            </div>
          ))}
        {accountsQuery.isError && (
          <ErrorState error={accountsQuery.error} onRetry={() => accountsQuery.refetch()} title="Couldn't load accounts" />
        )}
        {/* TABLE VIEW */}
        {!accountsQuery.isLoading && !accountsQuery.isError && view === "table" && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--lucid-line)", background: "var(--lucid-surface)" }}>
            <div className="overflow-x-auto">
              {/* Table header */}
              <div className="grid px-4 py-3" style={{ gridTemplateColumns: TABLE_COLS, borderBottom: "1px solid var(--lucid-line)", background: "var(--lucid-surface-2)", minWidth: TABLE_MIN_WIDTH }}>
                {TABLE_HEADERS.map(col => (
                  <span key={col} style={{ fontSize: 11, fontWeight: 600, color: "var(--lucid-ink-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{col}</span>
                ))}
              </div>

              {/* Rows */}
              {visibleAccounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <span style={{ fontSize: 32 }}>📊</span>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "var(--lucid-ink-2)" }}>No accounts yet</p>
                  <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>Add your first account to start tracking your trading.</p>
                  <button className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--lucid-accent)", color: "var(--lucid-page-bg)" }} onClick={() => setShowAddModal(true)}>+ Add Account</button>
                </div>
              ) : (
                visibleAccounts.map((account, idx) => {
                  const prop = isPropAccount(account);
                  const { pctUsed: ddPct } = calcDrawdown(account);
                  const { pct: goalPct } = calcGoalProgress(account);
                  const { winRate, tradeCount } = calcAccountStats(getAccountTrades(account.id), account.id);
                  const isPassed = account.status === "Passed";
                  const pnl = accountTradingPnl(account);
                  const pnlPct = account.account_size > 0 ? (pnl / account.account_size) * 100 : 0;
                  const balColor = pnl > 0 ? "var(--lucid-pos)" : pnl < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
                  const recessed = isLifecycleClosed(account);
                  const rowBg = idx % 2 === 0 ? "var(--lucid-surface)" : "var(--lucid-surface-2)";

                  return (
                    <button
                      key={account.id}
                      className="w-full grid px-4 text-left transition-colors"
                      style={{ gridTemplateColumns: TABLE_COLS, background: rowBg, borderBottom: idx < visibleAccounts.length - 1 ? "1px solid var(--lucid-line)" : "none", alignItems: "center", minHeight: 48, minWidth: TABLE_MIN_WIDTH, opacity: recessed ? 0.55 : 1 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--lucid-surface-3)")}
                      onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                      onClick={() => setSelectedAccountId(account.id)}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--lucid-ink)" }}>{account.account_name}</span>
                      <span><AccountTypePill type={account.account_type} /></span>
                      <span style={{ fontSize: 13, color: "var(--lucid-ink-2)" }}>{accountSource(account)}</span>
                      <span className="lt-num" style={{ fontSize: 13, fontWeight: 600, color: balColor }}>{formatCurrency(account.current_balance)}</span>
                      <span className="lt-num" style={{ fontSize: 13, color: balColor }}>{pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</span>
                      <span className="lt-num" style={{ fontSize: 13, color: "var(--lucid-ink-2)" }}>{tradeCount > 0 ? `${winRate.toFixed(0)}%` : "—"}</span>
                      <span>{prop && account.stage ? <StagePill stage={account.stage} /> : <span style={{ color: "var(--lucid-ink-3)" }}>—</span>}</span>
                      <span>{prop ? <MiniGoalBar pct={goalPct} isPassed={isPassed} /> : <span style={{ color: "var(--lucid-ink-3)" }}>—</span>}</span>
                      <span>{prop ? <MiniDrawdownBar pctUsed={ddPct} /> : <span style={{ color: "var(--lucid-ink-3)" }}>—</span>}</span>
                      <span style={{ opacity: recessed ? 1 / 0.55 : 1 }}><StatusPill status={account.status} /></span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* GALLERY VIEW */}
        {!accountsQuery.isLoading && !accountsQuery.isError && view === "gallery" &&
          (visibleAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <span style={{ fontSize: 40 }}>📊</span>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--lucid-ink-2)" }}>No accounts yet</p>
              <p style={{ fontSize: 13, color: "var(--lucid-ink-3)" }}>Add your first account to start tracking your trading.</p>
              <button className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "var(--lucid-accent)", color: "var(--lucid-page-bg)" }} onClick={() => setShowAddModal(true)}>+ Add Account</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleAccounts.map(account => (
                <div key={account.id} style={{ opacity: isLifecycleClosed(account) ? 0.55 : 1 }}>
                  <AccountGalleryCard account={account} accountTrades={getAccountTrades(account.id)} onClick={() => setSelectedAccountId(account.id)} recessed={isLifecycleClosed(account)} />
                </div>
              ))}
            </div>
          ))}
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!selectedAccount}
        onClose={() => setSelectedAccountId(null)}
        expandHref={selectedAccount ? `/trading/accounts/${selectedAccount.id}` : undefined}
        title={selectedAccount?.account_name ?? ""}
      >
        {selectedAccount && (
          <AccountDrawerContent
            account={selectedAccount}
            trades={allTrades}
            onEdit={() => { setEditAccount(selectedAccount); setSelectedAccountId(null); }}
            onDelete={() => setPendingDeleteAccount(selectedAccount)}
          />
        )}
      </DetailDrawer>

      {/* Add Account Modal */}
      {showAddModal && (
        <AddAccountModal
          existingSources={[...new Set(accounts.map(accountSource))].filter(s => s !== "—")}
          onSubmit={handleAddAccount}
          onClose={() => setShowAddModal(false)}
          saving={createAccountM.isPending}
        />
      )}

      {/* Edit Account Modal */}
      {editAccount && (
        <AddAccountModal
          initial={editAccount}
          existingSources={[...new Set(accounts.map(accountSource))].filter(s => s !== "—")}
          onSubmit={handleUpdateAccount}
          onClose={() => setEditAccount(null)}
          saving={updateAccountM.isPending}
        />
      )}

      {/* Cash Flow Modal */}
      {showCashFlowModal && <CashFlowModal accounts={accounts} onLog={handleCashFlow} onClose={() => setShowCashFlowModal(false)} />}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!pendingDeleteAccount}
        title="Delete account?"
        message={pendingDeleteAccount ? `"${pendingDeleteAccount.account_name}" and all of its trades and cash flows will be permanently deleted. This cannot be undone.` : undefined}
        confirmLabel="Delete account"
        loading={deleteAccountM.isPending}
        onConfirm={confirmDeleteAccount}
        onCancel={() => setPendingDeleteAccount(null)}
      />
    </div>
  );
}
