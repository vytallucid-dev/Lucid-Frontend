"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { accountTypeLabel } from "@/lib/demo-data";
import { useAccounts, useAddCashFlow } from "@/hooks/useTrading";
import { toast } from "@/components/toast";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useScrollLock } from "@/hooks/useScrollLock";

// ─── Cash Flow Modal (deposit / withdrawal / payout — context aware) ──────────
//
// A second, independent implementation of this same form lives inline in
// src/app/trading/accounts/page.tsx (its own local `CashFlowModal` function).
// Both are reskinned here to look identical without merging — consolidating
// them is a separate job.

export function CashFlowModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const accountsQuery = useAccounts();
  const addCashFlow = useAddCashFlow();
  const accounts = accountsQuery.data ?? [];

  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState<"deposit" | "withdrawal" | "payout">("deposit");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);
  useScrollLock(panelRef, open);

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
      <div className="lx-overlay-scrim fixed inset-0 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div ref={panelRef} className="lx-modal-panel lx-modal-confirm relative" onClick={(e) => e.stopPropagation()}>
          <div className="lx-overlay-header">
            <h2 className="lx-overlay-title" style={{ fontSize: 18 }}>Cash Flow</h2>
            <button onClick={onClose} className="lx-overlay-close">
              <X size={15} />
            </button>
          </div>
          {accounts.length === 0 ? (
            <div className="lx-overlay-body">
              <p className="lx-body" style={{ textAlign: "center" }}>No accounts yet. Add an account first.</p>
            </div>
          ) : (
          <div className="lx-overlay-body flex flex-col gap-0">
            <div className="lx-field">
              <label className="lx-field-label">Account</label>
              <select className="lx-input lx-select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name} ({accountTypeLabel(a.account_type)})</option>
                ))}
              </select>
            </div>
            <div className="lx-field">
              <label className="lx-field-label">Type</label>
              <select className="lx-input lx-select" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
                <option value="payout">Payout (prop accounts)</option>
              </select>
            </div>
            <div className="lx-field">
              <label className="lx-field-label">Date</label>
              <input type="date" className="lx-input lx-input-num" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="lx-field">
              <label className="lx-field-label">Amount</label>
              <input type="number" placeholder="0.00" min="0" className="lx-input lx-input-num" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="lx-field">
              <label className="lx-field-label">Note (optional)</label>
              <textarea rows={2} placeholder="Optional note..." className="lx-input lx-textarea" style={{ resize: "none" }} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error && <p className="lx-field-error" style={{ marginTop: -8, marginBottom: 8 }}>{error}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="lx-btn lx-btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={handleLog} disabled={addCashFlow.isPending} className="lx-btn lx-btn-primary flex-1">
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
