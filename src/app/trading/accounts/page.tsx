"use client";

import { useState, useMemo } from "react";
import { Plus, LayoutList, LayoutGrid, DollarSign, Check } from "lucide-react";
import {
  accounts as initialAccounts,
  trades as allTrades,
  type Account,
  formatCurrency,
  type Trade,
} from "@/lib/demo-data";
import { DetailDrawer } from "@/components/DetailDrawer";
import {
  AccountDrawerContent,
  StagePill,
  StatusPill,
  calcDrawdown,
  calcGoalProgress,
} from "./AccountDrawerContent";

// ── Mini progress bar (60px inline, for table) ────────────────────────────────

function MiniDrawdownBar({ pctUsed }: { pctUsed: number }) {
  const color = pctUsed >= 80 ? "#EF4444" : pctUsed >= 60 ? "#F59E0B" : "#10B981";
  return (
    <div className="flex items-center gap-1.5">
      <div
        style={{
          width: 60,
          height: 6,
          background: "rgba(148,163,184,0.15)",
          borderRadius: 3,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <div style={{ width: `${pctUsed}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: "#64748B" }}>{pctUsed.toFixed(0)}%</span>
    </div>
  );
}

function MiniGoalBar({ pct, isPassed }: { pct: number; isPassed: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        style={{
          width: 60,
          height: 6,
          background: "rgba(148,163,184,0.15)",
          borderRadius: 3,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: isPassed ? "100%" : `${pct}%`,
            height: "100%",
            background: "#3B82F6",
            borderRadius: 3,
          }}
        />
      </div>
      {isPassed ? (
        <Check size={11} style={{ color: "#10B981" }} />
      ) : (
        <span style={{ fontSize: 11, color: "#64748B" }}>{pct.toFixed(0)}%</span>
      )}
    </div>
  );
}

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
  const { drawdownUsed, drawdownLimit, pctUsed } = calcDrawdown(account);
  const { profitAchieved, profitTarget, pct: goalPct } = calcGoalProgress(account);
  const isPassed = account.status === "Passed";
  const pnl = account.current_balance - account.account_size;
  const pnlPct = (pnl / account.account_size) * 100;
  const pnlColor = pnl > 0 ? "var(--positive)" : pnl < 0 ? "var(--negative)" : "#94A3B8";
  const ddColor = pctUsed >= 80 ? "#EF4444" : pctUsed >= 60 ? "#F59E0B" : "#10B981";
  const remaining = profitTarget - profitAchieved;

  const startDate = new Date(account.starting_date);
  const daysActive = Math.floor((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const startLabel = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <button
      className="text-left w-full rounded-xl p-5 flex flex-col transition-all duration-200"
      style={{
        background: "rgba(20,28,40,0.7)",
        border: "1px solid rgba(148,163,184,0.1)",
        backdropFilter: "blur(12px)",
        minHeight: 340,
        cursor: "pointer",
      }}
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
      <div className="flex items-center gap-2 mb-4">
        <StagePill stage={account.stage} />
        <StatusPill status={account.status} />
      </div>

      {/* Firm + name */}
      <p style={{ fontSize: 12, color: "#64748B", marginBottom: 2 }}>{account.prop_firm}</p>
      <p style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0", marginBottom: 12 }}>
        {account.account_name}
      </p>

      {/* Balance */}
      <p style={{ fontSize: 26, fontWeight: 700, color: pnlColor, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, marginBottom: 4 }}>
        {formatCurrency(account.current_balance)}
      </p>
      <p style={{ fontSize: 13, color: pnlColor, opacity: 0.85, marginBottom: 16 }}>
        {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
      </p>

      <div style={{ height: 1, background: "rgba(148,163,184,0.08)", marginBottom: 16 }} />

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
        <p style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
          {isPassed ? "100%" : `${goalPct.toFixed(0)}%`} of {formatCurrency(profitTarget)} target
        </p>
      </div>

      {/* Max Drawdown bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: 12, color: "#94A3B8" }}>Max Drawdown</span>
          <span style={{ fontSize: 12, color: "#64748B" }}>
            {formatCurrency(drawdownUsed)} used / {formatCurrency(drawdownLimit)}
          </span>
        </div>
        <div style={{ width: "100%", height: 8, background: "rgba(148,163,184,0.12)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: `${pctUsed}%`, height: "100%", background: ddColor, borderRadius: 4 }} />
        </div>
        <p style={{ fontSize: 11, color: pctUsed >= 80 ? "#EF4444" : pctUsed >= 60 ? "#F59E0B" : "#475569", marginTop: 4 }}>
          {pctUsed.toFixed(0)}% used
        </p>
      </div>

      <div style={{ height: 1, background: "rgba(148,163,184,0.08)", marginBottom: 12 }} />

      {/* Bottom strip */}
      <div className="flex items-center gap-2 mt-auto" style={{ fontSize: 11, color: "#475569" }}>
        <span>Started {startLabel}</span>
        <span style={{ color: "#334155" }}>·</span>
        <span>{daysActive} days</span>
        <span style={{ color: "#334155" }}>·</span>
        <span>{accountTrades.length} trades</span>
      </div>
    </button>
  );
}

// ── Add Account Modal ─────────────────────────────────────────────────────────

interface AddAccountModalProps {
  existingFirms: string[];
  onAdd: (account: Account) => void;
  onClose: () => void;
}

function AddAccountModal({ existingFirms, onAdd, onClose }: AddAccountModalProps) {
  const [firm, setFirm] = useState("");
  const [name, setName] = useState("");
  const [size, setSize] = useState("");
  const [stage, setStage] = useState<"Stage 1" | "Stage 2" | "Funded">("Stage 1");
  const [profitTargetPct, setProfitTargetPct] = useState("");
  const [maxDrawdownPct, setMaxDrawdownPct] = useState("");
  const [startingDate, setStartingDate] = useState(new Date().toISOString().split("T")[0]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = existingFirms.filter(f =>
    firm.length > 0 && f.toLowerCase().includes(firm.toLowerCase()) && f !== firm
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sizeNum = parseFloat(size) || 0;
    const newAccount: Account = {
      id: `acc_${Date.now()}`,
      prop_firm: firm,
      account_name: name,
      account_size: sizeNum,
      current_balance: sizeNum,
      stage,
      status: "Active",
      max_drawdown_pct: parseFloat(maxDrawdownPct) || 5,
      profit_target_pct: parseFloat(profitTargetPct) || 10,
      starting_date: startingDate,
      payouts: [],
    };
    onAdd(newAccount);
    onClose();
  }

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-y-auto"
        style={{
          background: "rgba(10,14,20,0.98)",
          border: "1px solid rgba(148,163,184,0.15)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
          maxHeight: "90vh",
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0" }}>Add Account</h2>
          <button
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "#64748B" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {/* Prop Firm */}
          <div className="relative">
            <label style={labelStyle}>Prop Firm</label>
            <input
              style={inputStyle}
              placeholder="e.g. FundingPips"
              value={firm}
              onChange={e => { setFirm(e.target.value); setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              required
            />
            {showSuggestions && suggestions.length > 0 && (
              <div
                className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-10"
                style={{
                  background: "rgba(14,22,34,0.98)",
                  border: "1px solid rgba(148,163,184,0.15)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                }}
              >
                {suggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    className="w-full text-left px-3 py-2.5 text-sm"
                    style={{ color: "#E2E8F0" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.1)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    onClick={() => { setFirm(s); setShowSuggestions(false); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Account Name</label>
            <input style={inputStyle} placeholder="e.g. FP 10k Stage 2" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div>
            <label style={labelStyle}>Account Size ($)</label>
            <input style={inputStyle} type="number" placeholder="10000" value={size} onChange={e => setSize(e.target.value)} min="0" required />
          </div>

          <div>
            <label style={labelStyle}>Stage</label>
            <div className="flex gap-2">
              {(["Stage 1", "Stage 2", "Funded"] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: stage === s ? "rgba(59,130,246,0.2)" : "rgba(15,23,35,0.8)",
                    border: stage === s ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(148,163,184,0.12)",
                    color: stage === s ? "#93C5FD" : "#64748B",
                  }}
                  onClick={() => setStage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Profit Target %</label>
              <input style={inputStyle} type="number" placeholder="10" value={profitTargetPct} onChange={e => setProfitTargetPct(e.target.value)} min="0" max="100" step="0.5" required />
            </div>
            <div>
              <label style={labelStyle}>Max Drawdown %</label>
              <input style={inputStyle} type="number" placeholder="5" value={maxDrawdownPct} onChange={e => setMaxDrawdownPct(e.target.value)} min="0" max="100" step="0.5" required />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Starting Date</label>
            <input style={inputStyle} type="date" value={startingDate} onChange={e => setStartingDate(e.target.value)} required />
          </div>

          <div className="rounded-lg px-3 py-2" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.1)" }}>
            <p style={{ fontSize: 11, color: "#64748B" }}>Initial balance auto-fills to account size. Status defaults to Active.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{ color: "#64748B" }}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "#3B82F6", color: "#fff" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#2563EB")}
              onMouseLeave={e => (e.currentTarget.style.background = "#3B82F6")}
            >
              Add Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Log Payout Modal ──────────────────────────────────────────────────────────

interface LogPayoutModalProps {
  accounts: Account[];
  onLog: (accountId: string, payout: { date: string; amount: number; notes: string }) => void;
  onClose: () => void;
}

function LogPayoutModal({ accounts, onLog, onClose }: LogPayoutModalProps) {
  const fundedAccounts = accounts.filter(a => a.stage === "Funded");
  const [accountId, setAccountId] = useState(fundedAccounts[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onLog(accountId, { date, amount: parseFloat(amount) || 0, notes });
    onClose();
  }

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: "rgba(10,14,20,0.98)",
          border: "1px solid rgba(148,163,184,0.15)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#E2E8F0" }}>Log Payout</h2>
          <button className="p-1.5 rounded-lg" style={{ color: "#64748B" }} onClick={onClose}>✕</button>
        </div>

        {fundedAccounts.length === 0 ? (
          <div className="p-6">
            <p style={{ fontSize: 13, color: "#64748B", textAlign: "center" }}>
              No Funded accounts. Payouts can only be logged for Funded accounts.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <div>
              <label style={labelStyle}>Account</label>
              <select
                style={{ ...inputStyle, appearance: "none" as const }}
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                required
              >
                {fundedAccounts.map(a => (
                  <option key={a.id} value={a.id} style={{ background: "#0A0E14" }}>
                    {a.prop_firm} — {a.account_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Date</label>
              <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>

            <div>
              <label style={labelStyle}>Amount ($)</label>
              <input style={inputStyle} type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" required />
            </div>

            <div>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea
                style={{ ...inputStyle, resize: "vertical" as const, minHeight: 72 }}
                placeholder="Any notes about this payout..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ color: "#64748B" }} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "#3B82F6", color: "#fff" }}>
                Log Payout
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [view, setView] = useState<"table" | "gallery">("table");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  const totalCapital = useMemo(() => accounts.reduce((s, a) => s + a.account_size, 0), [accounts]);
  const netPnl = useMemo(() => accounts.reduce((s, a) => s + (a.current_balance - a.account_size), 0), [accounts]);

  function getAccountTrades(accountId: string): Trade[] {
    return allTrades.filter(t => t.account_id === accountId);
  }

  function handleAddAccount(account: Account) {
    setAccounts(prev => [account, ...prev]);
  }

  function handleLogPayout(accountId: string, payout: { date: string; amount: number; notes: string }) {
    setAccounts(prev =>
      prev.map(a => {
        if (a.id !== accountId) return a;
        const runningTotal = a.payouts.reduce((s, p) => s + p.amount, 0) + payout.amount;
        return {
          ...a,
          payouts: [...a.payouts, { date: payout.date, amount: payout.amount, running_total: runningTotal }],
        };
      })
    );
  }

  const pnlColor = netPnl >= 0 ? "var(--positive)" : "var(--negative)";

  return (
    <div className="flex flex-col min-h-full">
      {/* Page header */}
      <div className="flex items-start justify-between px-6 py-6">
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: "#E2E8F0" }}>Accounts</h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>Capital under management across prop firms.</p>
        </div>
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-2.5"
          style={{ background: "rgba(20,28,40,0.6)", border: "1px solid rgba(148,163,184,0.1)", fontSize: 13, color: "#94A3B8" }}
        >
          <span>Total Capital: <strong style={{ color: "#E2E8F0" }}>{formatCurrency(totalCapital)}</strong></span>
          <span style={{ color: "#334155", margin: "0 4px" }}>·</span>
          <span>Net P&amp;L: <strong style={{ color: pnlColor }}>{netPnl >= 0 ? "+" : ""}{formatCurrency(netPnl)}</strong></span>
        </div>
      </div>

      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-6 pb-4"
        style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}
      >
        <button
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{ background: "#3B82F6", color: "#fff" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#2563EB")}
          onMouseLeave={e => (e.currentTarget.style.background = "#3B82F6")}
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={14} />
          Add Account
        </button>

        <button
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: "rgba(20,28,40,0.7)",
            border: "1px solid rgba(148,163,184,0.12)",
            color: "#94A3B8",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "#E2E8F0";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(148,163,184,0.25)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "#94A3B8";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(148,163,184,0.12)";
          }}
          onClick={() => setShowPayoutModal(true)}
        >
          <DollarSign size={14} />
          Log Payout
        </button>

        <div className="flex-1" />

        {/* View toggle */}
        <div
          className="flex items-center rounded-lg overflow-hidden"
          style={{ border: "1px solid rgba(148,163,184,0.12)", background: "rgba(15,23,35,0.6)" }}
        >
          {(["table", "gallery"] as const).map(v => (
            <button
              key={v}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: view === v ? "rgba(59,130,246,0.15)" : "transparent",
                color: view === v ? "#93C5FD" : "#64748B",
                borderRight: v === "table" ? "1px solid rgba(148,163,184,0.1)" : "none",
              }}
              onClick={() => setView(v)}
            >
              {v === "table" ? <LayoutList size={13} /> : <LayoutGrid size={13} />}
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-5">

        {/* TABLE VIEW */}
        {view === "table" && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(148,163,184,0.08)", background: "rgba(15,23,35,0.4)" }}
          >
            {/* Table header */}
            <div
              className="grid px-4 py-3"
              style={{
                gridTemplateColumns: "1.6fr 1.6fr 100px 110px 90px 140px 100px 100px 130px",
                borderBottom: "1px solid rgba(148,163,184,0.08)",
                background: "rgba(10,14,20,0.5)",
              }}
            >
              {["Firm", "Name", "Size", "Balance", "Profit %", "Drawdown Used", "Stage", "Status", "Goal Progress"].map(col => (
                <span
                  key={col}
                  style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}
                >
                  {col}
                </span>
              ))}
            </div>

            {/* Rows */}
            {accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <span style={{ fontSize: 32 }}>🏦</span>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#94A3B8" }}>No accounts yet</p>
                <p style={{ fontSize: 13, color: "#475569" }}>Add your first prop firm account to start tracking.</p>
                <button
                  className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: "#3B82F6", color: "#fff" }}
                  onClick={() => setShowAddModal(true)}
                >
                  + Add Account
                </button>
              </div>
            ) : (
              accounts.map((account, idx) => {
                const { pctUsed: ddPct } = calcDrawdown(account);
                const { pct: goalPct } = calcGoalProgress(account);
                const isPassed = account.status === "Passed";
                const pnl = account.current_balance - account.account_size;
                const pnlPct = (pnl / account.account_size) * 100;
                const balColor = pnl > 0 ? "var(--positive)" : pnl < 0 ? "var(--negative)" : "#94A3B8";

                return (
                  <button
                    key={account.id}
                    className="w-full grid px-4 text-left transition-colors"
                    style={{
                      gridTemplateColumns: "1.6fr 1.6fr 100px 110px 90px 140px 100px 100px 130px",
                      background: idx % 2 === 0 ? "rgba(20,28,40,0.5)" : "rgba(15,23,35,0.3)",
                      borderBottom: idx < accounts.length - 1 ? "1px solid rgba(148,163,184,0.05)" : "none",
                      alignItems: "center",
                      minHeight: 48,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.05)")}
                    onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? "rgba(20,28,40,0.5)" : "rgba(15,23,35,0.3)")}
                    onClick={() => setSelectedAccount(account)}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>{account.prop_firm}</span>
                    <span style={{ fontSize: 13, color: "#94A3B8" }}>{account.account_name}</span>
                    <span style={{ fontSize: 13, color: "#94A3B8", fontVariantNumeric: "tabular-nums" }}>{formatCurrency(account.account_size)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: balColor, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(account.current_balance)}</span>
                    <span style={{ fontSize: 13, color: balColor, fontVariantNumeric: "tabular-nums" }}>{pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</span>
                    <MiniDrawdownBar pctUsed={ddPct} />
                    <span><StagePill stage={account.stage} /></span>
                    <span><StatusPill status={account.status} /></span>
                    <MiniGoalBar pct={goalPct} isPassed={isPassed} />
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* GALLERY VIEW */}
        {view === "gallery" && (
          accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <span style={{ fontSize: 40 }}>🏦</span>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#94A3B8" }}>No accounts yet</p>
              <button className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "#3B82F6", color: "#fff" }} onClick={() => setShowAddModal(true)}>
                + Add Account
              </button>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {accounts.map(account => (
                <AccountGalleryCard
                  key={account.id}
                  account={account}
                  accountTrades={getAccountTrades(account.id)}
                  onClick={() => setSelectedAccount(account)}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        open={!!selectedAccount}
        onClose={() => setSelectedAccount(null)}
        expandHref={selectedAccount ? `/trading/accounts/${selectedAccount.id}` : undefined}
        title={selectedAccount?.account_name ?? ""}
      >
        {selectedAccount && (
          <AccountDrawerContent
            account={selectedAccount}
            accountTrades={getAccountTrades(selectedAccount.id)}
          />
        )}
      </DetailDrawer>

      {/* Add Account Modal */}
      {showAddModal && (
        <AddAccountModal
          existingFirms={[...new Set(accounts.map(a => a.prop_firm))]}
          onAdd={handleAddAccount}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Log Payout Modal */}
      {showPayoutModal && (
        <LogPayoutModal
          accounts={accounts}
          onLog={handleLogPayout}
          onClose={() => setShowPayoutModal(false)}
        />
      )}
    </div>
  );
}
