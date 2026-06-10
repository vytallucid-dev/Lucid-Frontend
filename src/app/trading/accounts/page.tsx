"use client";

import { useState, useMemo } from "react";
import { Plus, LayoutList, LayoutGrid, ArrowLeftRight, Check } from "lucide-react";
import {
  accounts as initialAccounts,
  trades as allTrades,
  type Account,
  type AccountType,
  type CashFlowType,
  formatCurrency,
  type Trade,
  isPropAccount,
  accountSource,
  accountTypeLabel,
  ACCOUNT_TYPE_COLORS,
} from "@/lib/demo-data";
import { DetailDrawer } from "@/components/DetailDrawer";
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
  const color = pctUsed >= 80 ? "#EF4444" : pctUsed >= 60 ? "#F59E0B" : "#10B981";
  return (
    <div className="flex items-center gap-1.5">
      <div style={{ width: 60, height: 6, background: "rgba(148,163,184,0.15)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: `${pctUsed}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: "#64748B" }}>{pctUsed.toFixed(0)}%</span>
    </div>
  );
}

function MiniGoalBar({ pct, isPassed }: { pct: number; isPassed: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div style={{ width: 60, height: 6, background: "rgba(148,163,184,0.15)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: isPassed ? "100%" : `${pct}%`, height: "100%", background: "#3B82F6", borderRadius: 3 }} />
      </div>
      {isPassed ? <Check size={11} style={{ color: "#10B981" }} /> : <span style={{ fontSize: 11, color: "#64748B" }}>{pct.toFixed(0)}%</span>}
    </div>
  );
}

const MUTED = "#475569";

// ── Gallery card ─────────────────────────────────────────────────────────────

function AccountGalleryCard({
  account,
  accountTrades,
  onClick,
}: {
  account: Account;
  accountTrades: Trade[];
  onClick: () => void;
}) {
  const prop = isPropAccount(account);
  const hasGoal = account.profit_goal_pct != null && account.profit_goal_pct > 0;
  const { drawdownUsed, drawdownLimit, pctUsed } = calcDrawdown(account);
  const { profitAchieved, profitTarget, pct: goalPct } = calcGoalProgress(account);
  const { winRate, tradeCount } = calcAccountStats(accountTrades);
  const isPassed = account.status === "Passed";
  const pnl = account.current_balance - account.account_size;
  const pnlPct = account.account_size > 0 ? (pnl / account.account_size) * 100 : 0;
  const pnlColor = pnl > 0 ? "var(--positive)" : pnl < 0 ? "var(--negative)" : "#94A3B8";
  const ddColor = pctUsed >= 80 ? "#EF4444" : pctUsed >= 60 ? "#F59E0B" : "#10B981";
  const remaining = profitTarget - profitAchieved;

  const startDate = new Date(account.starting_date);
  const daysActive = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const startLabel = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <button
      className="text-left w-full rounded-xl p-5 flex flex-col transition-all duration-200"
      style={{ background: "rgba(20,28,40,0.7)", border: "1px solid rgba(148,163,184,0.1)", backdropFilter: "blur(12px)", minHeight: 340, cursor: "pointer" }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(59,130,246,0.3)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.4), 0 0 24px rgba(59,130,246,0.08)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(148,163,184,0.1)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
      }}
      onClick={onClick}
    >
      {/* Pill row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <AccountTypePill type={account.account_type} />
        {prop && account.stage && <StagePill stage={account.stage} />}
        <StatusPill status={account.status} />
      </div>

      {/* Source + name */}
      <p style={{ fontSize: 12, color: "#64748B", marginBottom: 2 }}>{accountSource(account)}</p>
      <p style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0", marginBottom: 12 }}>{account.account_name}</p>

      {/* Balance */}
      <p style={{ fontSize: 26, fontWeight: 700, color: pnlColor, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, marginBottom: 4 }}>
        {formatCurrency(account.current_balance)}
      </p>
      <p style={{ fontSize: 13, color: pnlColor, opacity: 0.85, marginBottom: 16 }}>
        {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
      </p>

      <div style={{ height: 1, background: "rgba(148,163,184,0.08)", marginBottom: 16 }} />

      {prop ? (
        <>
          {/* Profit Target bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 12, color: "#94A3B8" }}>Profit Target</span>
              {isPassed ? (
                <span style={{ fontSize: 12, color: "#10B981", fontWeight: 600 }}>✓ Passed</span>
              ) : (
                <span style={{ fontSize: 12, color: "#64748B" }}>{formatCurrency(remaining)} to go</span>
              )}
            </div>
            <div style={{ width: "100%", height: 8, background: "rgba(148,163,184,0.12)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: isPassed ? "100%" : `${goalPct}%`, height: "100%", background: "#3B82F6", borderRadius: 4 }} />
            </div>
            <p style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>
              {isPassed ? "100%" : `${goalPct.toFixed(0)}%`} of {formatCurrency(profitTarget)} target
            </p>
          </div>

          {/* Max Drawdown bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span style={{ fontSize: 12, color: "#94A3B8" }}>Max Drawdown</span>
              <span style={{ fontSize: 12, color: "#64748B" }}>{formatCurrency(drawdownUsed)} used / {formatCurrency(drawdownLimit)}</span>
            </div>
            <div style={{ width: "100%", height: 8, background: "rgba(148,163,184,0.12)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${pctUsed}%`, height: "100%", background: ddColor, borderRadius: 4 }} />
            </div>
            <p style={{ fontSize: 11, color: pctUsed >= 80 ? "#EF4444" : pctUsed >= 60 ? "#F59E0B" : MUTED, marginTop: 4 }}>{pctUsed.toFixed(0)}% used</p>
          </div>
        </>
      ) : (
        <>
          {/* Win rate (universal) */}
          <div className="mb-4 flex items-center justify-between">
            <span style={{ fontSize: 12, color: "#94A3B8" }}>Win Rate</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: winRate >= 40 ? "var(--positive)" : winRate >= 30 ? "var(--warning)" : tradeCount > 0 ? "var(--negative)" : "#64748B" }}>
              {tradeCount > 0 ? `${winRate.toFixed(0)}%` : "—"}
            </span>
          </div>

          {/* Optional personal goal — hidden if not set */}
          {hasGoal && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 12, color: "#94A3B8" }}>Goal</span>
                <span style={{ fontSize: 12, color: "#64748B" }}>{goalPct >= 100 ? "Reached" : `${formatCurrency(remaining)} to go`}</span>
              </div>
              <div style={{ width: "100%", height: 8, background: "rgba(148,163,184,0.12)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${goalPct}%`, height: "100%", background: "#3B82F6", borderRadius: 4 }} />
              </div>
              <p style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{goalPct.toFixed(0)}% of {formatCurrency(profitTarget)} goal</p>
            </div>
          )}
        </>
      )}

      <div style={{ height: 1, background: "rgba(148,163,184,0.08)", marginBottom: 12, marginTop: "auto" }} />

      {/* Bottom strip */}
      <div className="flex items-center gap-2" style={{ fontSize: 11, color: MUTED }}>
        <span>Started {startLabel}</span>
        <span style={{ color: "#334155" }}>·</span>
        <span>{daysActive} days</span>
        <span style={{ color: "#334155" }}>·</span>
        <span>{accountTrades.length} trades</span>
      </div>
    </button>
  );
}

// ── Shared modal styles ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(15,23,35,0.8)",
  border: "1px solid rgba(148,163,184,0.15)",
  borderRadius: 8,
  padding: "8px 12px",
  color: "#E2E8F0",
  fontSize: 13,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#94A3B8",
  fontWeight: 500,
  marginBottom: 6,
  display: "block",
};

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "JPY"];

// ── Add Account Modal (type-aware) ────────────────────────────────────────────

interface AddAccountModalProps {
  existingSources: string[];
  onAdd: (account: Account) => void;
  onClose: () => void;
}

function AddAccountModal({ existingSources, onAdd, onClose }: AddAccountModalProps) {
  const [type, setType] = useState<AccountType>("personal");
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [size, setSize] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [goalPct, setGoalPct] = useState("");
  const [stage, setStage] = useState<"Stage 1" | "Stage 2" | "Funded">("Stage 1");
  const [profitTargetPct, setProfitTargetPct] = useState("");
  const [maxDrawdownPct, setMaxDrawdownPct] = useState("");
  const [startingDate, setStartingDate] = useState(new Date().toISOString().split("T")[0]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const prop = type === "prop_firm";
  const suggestions = existingSources.filter(f => source.length > 0 && f.toLowerCase().includes(source.toLowerCase()) && f !== source);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sizeNum = parseFloat(size) || 0;
    const base = {
      id: `acc_${Date.now()}`,
      account_name: name,
      account_size: sizeNum,
      current_balance: sizeNum,
      currency,
      status: "Active" as const,
      starting_date: startingDate,
      cash_flows: [],
      payouts: [],
    };
    const newAccount: Account = prop
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
          broker: source || undefined,
          profit_goal_pct: goalPct ? parseFloat(goalPct) : null,
        };
    onAdd(newAccount);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-y-auto"
        style={{ background: "rgba(10,14,20,0.98)", border: "1px solid rgba(148,163,184,0.15)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)", maxHeight: "90vh" }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0" }}>Add Account</h2>
          <button className="p-1.5 rounded-lg transition-colors" style={{ color: "#64748B" }} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {/* Account Type — drives the rest of the form */}
          <div>
            <label style={labelStyle}>Account Type</label>
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
                      background: active ? `${color}22` : "rgba(15,23,35,0.8)",
                      border: active ? `1px solid ${color}66` : "1px solid rgba(148,163,184,0.12)",
                      color: active ? color : "#64748B",
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
          <div>
            <label style={labelStyle}>Account Name</label>
            <input style={inputStyle} placeholder={prop ? "e.g. FP 10k Stage 2" : "e.g. My Live Account"} value={name} onChange={e => setName(e.target.value)} required />
          </div>

          {/* Source — Prop Firm (required) or Broker (optional) */}
          <div className="relative">
            <label style={labelStyle}>{prop ? "Prop Firm" : "Broker (optional)"}</label>
            <input
              style={inputStyle}
              placeholder={prop ? "e.g. FundingPips" : "e.g. IC Markets"}
              value={source}
              onChange={e => { setSource(e.target.value); setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              required={prop}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-10" style={{ background: "rgba(14,22,34,0.98)", border: "1px solid rgba(148,163,184,0.15)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                {suggestions.map(s => (
                  <button key={s} type="button" className="w-full text-left px-3 py-2.5 text-sm" style={{ color: "#E2E8F0" }} onClick={() => { setSource(s); setShowSuggestions(false); }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Balance + Currency (universal) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>{prop ? "Account Size ($)" : "Starting Balance"}</label>
              <input style={inputStyle} type="number" placeholder="10000" value={size} onChange={e => setSize(e.target.value)} min="0" required />
            </div>
            <div>
              <label style={labelStyle}>Currency</label>
              <select style={{ ...inputStyle, appearance: "none" as const }} value={currency} onChange={e => setCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c} style={{ background: "#0A0E14" }}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Prop-only fields */}
          {prop && (
            <>
              <div>
                <label style={labelStyle}>Stage</label>
                <div className="flex gap-2">
                  {(["Stage 1", "Stage 2", "Funded"] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: stage === s ? "rgba(129,140,248,0.2)" : "rgba(15,23,35,0.8)",
                        border: stage === s ? "1px solid rgba(129,140,248,0.4)" : "1px solid rgba(148,163,184,0.12)",
                        color: stage === s ? "#C7D2FE" : "#64748B",
                      }}
                      onClick={() => setStage(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Profit Target %</label>
                  <input style={inputStyle} type="number" placeholder="10" value={profitTargetPct} onChange={e => setProfitTargetPct(e.target.value)} min="0" max="100" step="0.5" required />
                </div>
                <div>
                  <label style={labelStyle}>Max Drawdown %</label>
                  <input style={inputStyle} type="number" placeholder="5" value={maxDrawdownPct} onChange={e => setMaxDrawdownPct(e.target.value)} min="0" max="100" step="0.5" required />
                </div>
              </div>
            </>
          )}

          {/* Personal/Demo optional goal */}
          {!prop && (
            <div>
              <label style={labelStyle}>Profit Goal % (optional)</label>
              <input style={inputStyle} type="number" placeholder="e.g. 20" value={goalPct} onChange={e => setGoalPct(e.target.value)} min="0" step="0.5" />
            </div>
          )}

          <div>
            <label style={labelStyle}>Starting Date</label>
            <input style={inputStyle} type="date" value={startingDate} onChange={e => setStartingDate(e.target.value)} required />
          </div>

          <div className="rounded-lg px-3 py-2" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.1)" }}>
            <p style={{ fontSize: 11, color: "#64748B" }}>
              {prop
                ? "Initial balance auto-fills to account size. Status defaults to Active."
                : "Initial balance auto-fills to your starting balance. Goals are optional and only for you."}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ color: "#64748B" }} onClick={onClose}>Cancel</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "#3B82F6", color: "#fff" }}>Add Account</button>
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
      <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl overflow-hidden" style={{ background: "rgba(10,14,20,0.98)", border: "1px solid rgba(148,163,184,0.15)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0" }}>Cash Flow</h2>
          <button className="p-1.5 rounded-lg" style={{ color: "#64748B" }} onClick={onClose}>✕</button>
        </div>

        {accounts.length === 0 ? (
          <div className="p-6">
            <p style={{ fontSize: 13, color: "#64748B", textAlign: "center" }}>No accounts yet. Add an account first.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <div>
              <label style={labelStyle}>Account</label>
              <select style={{ ...inputStyle, appearance: "none" as const }} value={accountId} onChange={e => setAccountId(e.target.value)} required>
                {accounts.map(a => (
                  <option key={a.id} value={a.id} style={{ background: "#0A0E14" }}>
                    {a.account_name} ({accountTypeLabel(a.account_type)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Type</label>
              <div className="flex gap-2">
                {flowOptions.map(f => {
                  const active = effectiveFlow === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: active ? "rgba(59,130,246,0.2)" : "rgba(15,23,35,0.8)",
                        border: active ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(148,163,184,0.12)",
                        color: active ? "#93C5FD" : "#64748B",
                      }}
                      onClick={() => setFlowType(f)}
                    >
                      {flowLabel[f]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Date</label>
              <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>

            <div>
              <label style={labelStyle}>Amount</label>
              <input style={inputStyle} type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" required />
            </div>

            <div>
              <label style={labelStyle}>Note (optional)</label>
              <textarea style={{ ...inputStyle, resize: "vertical" as const, minHeight: 72 }} placeholder="Any notes about this movement..." value={note} onChange={e => setNote(e.target.value)} />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ color: "#64748B" }} onClick={onClose}>Cancel</button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "#3B82F6", color: "#fff" }}>Log {flowLabel[effectiveFlow]}</button>
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
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [view, setView] = useState<"table" | "gallery">("table");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCashFlowModal, setShowCashFlowModal] = useState(false);

  const totalBalance = useMemo(() => accounts.reduce((s, a) => s + a.current_balance, 0), [accounts]);
  const netPnl = useMemo(() => accounts.reduce((s, a) => s + (a.current_balance - a.account_size), 0), [accounts]);

  function getAccountTrades(accountId: string): Trade[] {
    return allTrades.filter(t => t.account_id === accountId);
  }

  function handleAddAccount(account: Account) {
    setAccounts(prev => [account, ...prev]);
  }

  function handleCashFlow(accountId: string, flow: { type: CashFlowType; date: string; amount: number; note: string }) {
    setAccounts(prev =>
      prev.map(a => {
        if (a.id !== accountId) return a;
        if (flow.type === "payout") {
          const runningTotal = a.payouts.reduce((s, p) => s + p.amount, 0) + flow.amount;
          return { ...a, payouts: [...a.payouts, { date: flow.date, amount: flow.amount, running_total: runningTotal }] };
        }
        return { ...a, cash_flows: [...a.cash_flows, { date: flow.date, type: flow.type, amount: flow.amount, note: flow.note || undefined }] };
      })
    );
  }

  const pnlColor = netPnl >= 0 ? "var(--positive)" : "var(--negative)";

  return (
    <div className="flex flex-col min-h-full">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between px-4 sm:px-6 py-4 sm:py-6">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: "#E2E8F0" }}>Accounts</h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>Your trading accounts — personal, demo, and prop firm.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-2.5 self-start" style={{ background: "rgba(20,28,40,0.6)", border: "1px solid rgba(148,163,184,0.1)", fontSize: 13, color: "#94A3B8" }}>
          <span>Total Balance: <strong style={{ color: "#E2E8F0" }}>{formatCurrency(totalBalance)}</strong></span>
          <span style={{ color: "#334155" }}>·</span>
          <span>Net P&amp;L: <strong style={{ color: pnlColor }}>{netPnl >= 0 ? "+" : ""}{formatCurrency(netPnl)}</strong></span>
        </div>
      </div>

      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 pb-4" style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all" style={{ background: "#3B82F6", color: "#fff" }} onClick={() => setShowAddModal(true)}>
          <Plus size={14} />
          Add Account
        </button>

        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all" style={{ background: "rgba(20,28,40,0.7)", border: "1px solid rgba(148,163,184,0.12)", color: "#94A3B8" }} onClick={() => setShowCashFlowModal(true)}>
          <ArrowLeftRight size={14} />
          Cash Flow
        </button>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid rgba(148,163,184,0.12)", background: "rgba(15,23,35,0.6)" }}>
          {(["table", "gallery"] as const).map(v => (
            <button
              key={v}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors"
              style={{ background: view === v ? "rgba(59,130,246,0.15)" : "transparent", color: view === v ? "#93C5FD" : "#64748B", borderRight: v === "table" ? "1px solid rgba(148,163,184,0.1)" : "none" }}
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
        {/* TABLE VIEW */}
        {view === "table" && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(148,163,184,0.08)", background: "rgba(15,23,35,0.4)" }}>
            <div className="overflow-x-auto">
              {/* Table header */}
              <div className="grid px-4 py-3" style={{ gridTemplateColumns: TABLE_COLS, borderBottom: "1px solid rgba(148,163,184,0.08)", background: "rgba(10,14,20,0.5)", minWidth: TABLE_MIN_WIDTH }}>
                {TABLE_HEADERS.map(col => (
                  <span key={col} style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>{col}</span>
                ))}
              </div>

              {/* Rows */}
              {accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <span style={{ fontSize: 32 }}>📊</span>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "#94A3B8" }}>No accounts yet</p>
                  <p style={{ fontSize: 13, color: "#475569" }}>Add your first account to start tracking your trading.</p>
                  <button className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#3B82F6", color: "#fff" }} onClick={() => setShowAddModal(true)}>+ Add Account</button>
                </div>
              ) : (
                accounts.map((account, idx) => {
                  const prop = isPropAccount(account);
                  const { pctUsed: ddPct } = calcDrawdown(account);
                  const { pct: goalPct } = calcGoalProgress(account);
                  const { winRate, tradeCount } = calcAccountStats(getAccountTrades(account.id));
                  const isPassed = account.status === "Passed";
                  const pnl = account.current_balance - account.account_size;
                  const pnlPct = account.account_size > 0 ? (pnl / account.account_size) * 100 : 0;
                  const balColor = pnl > 0 ? "var(--positive)" : pnl < 0 ? "var(--negative)" : "#94A3B8";

                  return (
                    <button
                      key={account.id}
                      className="w-full grid px-4 text-left transition-colors"
                      style={{ gridTemplateColumns: TABLE_COLS, background: idx % 2 === 0 ? "rgba(20,28,40,0.5)" : "rgba(15,23,35,0.3)", borderBottom: idx < accounts.length - 1 ? "1px solid rgba(148,163,184,0.05)" : "none", alignItems: "center", minHeight: 48, minWidth: TABLE_MIN_WIDTH }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.05)")}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? "rgba(20,28,40,0.5)" : "rgba(15,23,35,0.3)")}
                      onClick={() => setSelectedAccount(account)}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>{account.account_name}</span>
                      <span><AccountTypePill type={account.account_type} /></span>
                      <span style={{ fontSize: 13, color: "#94A3B8" }}>{accountSource(account)}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: balColor, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(account.current_balance)}</span>
                      <span style={{ fontSize: 13, color: balColor, fontVariantNumeric: "tabular-nums" }}>{pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</span>
                      <span style={{ fontSize: 13, color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{tradeCount > 0 ? `${winRate.toFixed(0)}%` : "—"}</span>
                      <span>{prop && account.stage ? <StagePill stage={account.stage} /> : <span style={{ color: "#334155" }}>—</span>}</span>
                      <span>{prop ? <MiniGoalBar pct={goalPct} isPassed={isPassed} /> : <span style={{ color: "#334155" }}>—</span>}</span>
                      <span>{prop ? <MiniDrawdownBar pctUsed={ddPct} /> : <span style={{ color: "#334155" }}>—</span>}</span>
                      <span><StatusPill status={account.status} /></span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* GALLERY VIEW */}
        {view === "gallery" &&
          (accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <span style={{ fontSize: 40 }}>📊</span>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#94A3B8" }}>No accounts yet</p>
              <p style={{ fontSize: 13, color: "#475569" }}>Add your first account to start tracking your trading.</p>
              <button className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#3B82F6", color: "#fff" }} onClick={() => setShowAddModal(true)}>+ Add Account</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map(account => (
                <AccountGalleryCard key={account.id} account={account} accountTrades={getAccountTrades(account.id)} onClick={() => setSelectedAccount(account)} />
              ))}
            </div>
          ))}
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!selectedAccount}
        onClose={() => setSelectedAccount(null)}
        expandHref={selectedAccount ? `/trading/accounts/${selectedAccount.id}` : undefined}
        title={selectedAccount?.account_name ?? ""}
      >
        {selectedAccount && <AccountDrawerContent account={selectedAccount} accountTrades={getAccountTrades(selectedAccount.id)} />}
      </DetailDrawer>

      {/* Add Account Modal */}
      {showAddModal && (
        <AddAccountModal
          existingSources={[...new Set(accounts.map(accountSource))].filter(s => s !== "—")}
          onAdd={handleAddAccount}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Cash Flow Modal */}
      {showCashFlowModal && <CashFlowModal accounts={accounts} onLog={handleCashFlow} onClose={() => setShowCashFlowModal(false)} />}
    </div>
  );
}
