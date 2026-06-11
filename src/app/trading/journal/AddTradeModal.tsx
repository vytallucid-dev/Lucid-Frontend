"use client";

import { useEffect, useState } from "react";
import { X, Camera } from "lucide-react";
import { accountTypeLabel, type Direction, type Conviction, type ExitType } from "@/lib/demo-data";
import { useAccounts, useTradingModels, useTradingPairs, useCreateTrade } from "@/hooks/useTrading";
import type { CreateTradePayload } from "@/lib/api/trading";

/** Optional pre-fill, e.g. when converting a planned trade into a live one. */
export interface AddTradePrefill {
  pair?: string;
  model?: string;
  direction?: Direction;
  entry_price?: number;
  sl_price?: number;
  first_tp_price?: number | null;
  main_tp_price?: number;
  risk_pct?: number;
  conviction?: Conviction;
}

interface AddTradeModalProps {
  open: boolean;
  onClose: () => void;
  prefill?: AddTradePrefill;
  /** Called after a trade is successfully created (before onClose). */
  onSubmitted?: () => void;
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "rgba(20,28,40,0.8)",
  border: "1px solid rgba(148,163,184,0.12)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "#E2E8F0",
  outline: "none",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#64748B",
  marginBottom: 6,
  display: "block",
};

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      {children}
    </div>
  );
}

function GroupHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#64748B",
        paddingBottom: 8,
        borderBottom: "1px solid rgba(148,163,184,0.08)",
        marginBottom: 16,
      }}
    >
      {children}
    </h3>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  colorMap,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  colorMap?: Record<string, { active: string; bg: string }>;
}) {
  return (
    <div
      className="flex rounded-lg p-0.5"
      style={{ background: "rgba(20,28,40,0.8)", border: "1px solid rgba(148,163,184,0.12)" }}
    >
      {options.map(opt => {
        const active = value === opt;
        const colors = colorMap?.[opt];
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="flex-1 py-1.5 rounded-md text-xs font-semibold transition-all"
            style={{
              background: active ? (colors?.bg ?? "rgba(59,130,246,0.15)") : "transparent",
              color: active ? (colors?.active ?? "#93C5FD") : "#64748B",
              border: active ? `1px solid ${colors?.active ? colors.active + "40" : "rgba(59,130,246,0.25)"}` : "1px solid transparent",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function AddTradeModal({ open, onClose, prefill, onSubmitted }: AddTradeModalProps) {
  const accountsQuery = useAccounts();
  const modelsQuery = useTradingModels();
  const pairsQuery = useTradingPairs();
  const createTrade = useCreateTrade();

  const accountList = accountsQuery.data ?? [];
  const modelList = modelsQuery.data ?? [];
  const pairList = pairsQuery.data ?? [];

  const [pair, setPair] = useState("");
  const [model, setModel] = useState("");
  const [direction, setDirection] = useState<Direction>("Buy");
  const [account, setAccount] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [sl, setSl] = useState("");
  const [firstTp, setFirstTp] = useState("");
  const [mainTp, setMainTp] = useState("");
  const [lotSize, setLotSize] = useState("");
  const [riskPct, setRiskPct] = useState("");
  const [conviction, setConviction] = useState<Conviction>("Medium");
  const [fundScore, setFundScore] = useState("");
  const [psychology, setPsychology] = useState("");
  const [notes, setNotes] = useState("");
  const [isClosed, setIsClosed] = useState(false);
  const [partialExit, setPartialExit] = useState("");
  const [partialPct, setPartialPct] = useState("");
  const [mainExit, setMainExit] = useState("");
  const [dateClosed, setDateClosed] = useState("");
  const [exitType, setExitType] = useState<ExitType>("TP");
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time the modal opens, seeding from prefill where present.
  useEffect(() => {
    if (!open) return;
    setPair(prefill?.pair ?? "");
    setModel(prefill?.model ?? "");
    setAccount("");
    setDirection(prefill?.direction ?? "Buy");
    setEntryPrice(prefill?.entry_price != null ? String(prefill.entry_price) : "");
    setSl(prefill?.sl_price != null ? String(prefill.sl_price) : "");
    setFirstTp(prefill?.first_tp_price != null ? String(prefill.first_tp_price) : "");
    setMainTp(prefill?.main_tp_price != null ? String(prefill.main_tp_price) : "");
    setLotSize("");
    setRiskPct(prefill?.risk_pct != null ? String(prefill.risk_pct) : "");
    setConviction(prefill?.conviction ?? "Medium");
    setFundScore("");
    setPsychology("");
    setNotes("");
    setIsClosed(false);
    setPartialExit("");
    setPartialPct("");
    setMainExit("");
    setDateClosed("");
    setExitType("TP");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fill the dropdown defaults once the lists have loaded (covers the race where
  // the modal opens before queries resolve).
  useEffect(() => {
    if (!open) return;
    if (!pair && pairList.length) setPair(prefill?.pair ?? pairList[0].symbol);
    if (!model && modelList.length) setModel(prefill?.model ?? modelList[0].name);
    if (!account && accountList.length) setAccount(accountList[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pairList, modelList, accountList]);

  if (!open) return null;

  const noAccounts = !accountsQuery.isLoading && accountList.length === 0;

  async function handleSubmit() {
    setError(null);
    if (!account) {
      setError("Select an account first.");
      return;
    }
    const entryNum = parseFloat(entryPrice);
    const slNum = parseFloat(sl);
    const mainTpNum = parseFloat(mainTp);
    const lotNum = parseFloat(lotSize);
    if ([entryNum, slNum, mainTpNum, lotNum].some(Number.isNaN)) {
      setError("Entry, Stop Loss, Main TP and Lot Size are required numbers.");
      return;
    }
    const mainExitNum = mainExit ? parseFloat(mainExit) : NaN;
    if (isClosed && Number.isNaN(mainExitNum)) {
      setError("Main Exit Price is required to log a closed trade.");
      return;
    }

    const payload: CreateTradePayload = {
      account_id: account,
      model: model || (modelList[0]?.name ?? ""),
      pair: pair || (pairList[0]?.symbol ?? ""),
      direction,
      entry_price: entryNum,
      sl_price: slNum,
      first_tp_price: firstTp ? parseFloat(firstTp) : null,
      main_tp_price: mainTpNum,
      lot_size: lotNum,
      risk_pct: riskPct ? parseFloat(riskPct) : 0,
      conviction,
      fundamental_score: fundScore ? parseInt(fundScore, 10) : null,
      psychology: psychology.trim() || null,
      notes: notes.trim() || null,
      is_closed: isClosed,
      exit_type: exitType,
      ...(isClosed
        ? {
            partial_exit_price: partialExit ? parseFloat(partialExit) : null,
            partial_exit_lot_pct: partialPct ? parseFloat(partialPct) : null,
            main_exit_price: mainExitNum,
            date_closed: dateClosed ? new Date(dateClosed).toISOString() : null,
          }
        : {}),
    };

    try {
      await createTrade.mutateAsync(payload);
      onSubmitted?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save trade.");
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="relative flex flex-col rounded-2xl"
          style={{
            width: "100%",
            maxWidth: 720,
            maxHeight: "90vh",
            background: "rgba(10,18,30,0.98)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(148,163,184,0.12)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Modal header */}
          <div
            className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0"
            style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}
          >
            <h2 className="text-base font-semibold" style={{ color: "#E2E8F0" }}>Add Trade</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md transition-colors hover:bg-white/5"
              style={{ color: "#64748B" }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5">

            {/* Screenshot auto-fill zone */}
            <div
              className="flex flex-col items-center justify-center gap-2 mb-6 rounded-xl"
              style={{
                height: 112,
                border: "1.5px dashed rgba(148,163,184,0.2)",
                background: "rgba(148,163,184,0.02)",
              }}
            >
              <Camera size={22} style={{ color: "#334155" }} />
              <p className="text-sm" style={{ color: "#475569" }}>
                Paste an MT4/MT5 screenshot to auto-fill this form.
              </p>
              <span
                className="pill"
                style={{ background: "rgba(168,85,247,0.12)", color: "#C084FC", border: "1px solid rgba(168,85,247,0.2)", fontSize: 10 }}
              >
                Phase 3 — coming soon
              </span>
            </div>

            {noAccounts && (
              <div
                className="mb-6 rounded-lg px-4 py-3 text-sm"
                style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", color: "#F59E0B" }}
              >
                You need at least one account before logging a trade. Add one in the Accounts tab.
              </div>
            )}

            <div className="flex flex-col gap-6">

              {/* Group 1: Setup */}
              <div>
                <GroupHeader>Setup</GroupHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldGroup label="Pair">
                    <select
                      value={pair}
                      onChange={e => setPair(e.target.value)}
                      style={INPUT_STYLE}
                    >
                      {pairList.map(p => (
                        <option key={p.symbol} value={p.symbol}>{p.display_name}</option>
                      ))}
                    </select>
                  </FieldGroup>

                  <FieldGroup label="Model">
                    <select
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      style={INPUT_STYLE}
                    >
                      {modelList.map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </FieldGroup>

                  <FieldGroup label="Direction">
                    <SegmentedControl
                      options={["Buy", "Sell"] as const}
                      value={direction}
                      onChange={setDirection}
                      colorMap={{
                        Buy: { active: "#10B981", bg: "rgba(16,185,129,0.12)" },
                        Sell: { active: "#EF4444", bg: "rgba(239,68,68,0.1)" },
                      }}
                    />
                  </FieldGroup>

                  <FieldGroup label="Account">
                    <select
                      value={account}
                      onChange={e => setAccount(e.target.value)}
                      style={INPUT_STYLE}
                    >
                      {accountList.length === 0 && <option value="">No accounts</option>}
                      {accountList.map(a => (
                        <option key={a.id} value={a.id}>{a.account_name} ({accountTypeLabel(a.account_type)})</option>
                      ))}
                    </select>
                  </FieldGroup>
                </div>
              </div>

              {/* Group 2: Prices */}
              <div>
                <GroupHeader>Prices</GroupHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <FieldGroup label="Entry Price">
                    <input type="number" step="any" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} placeholder="1.0865" style={INPUT_STYLE} />
                  </FieldGroup>
                  <FieldGroup label="Stop Loss">
                    <input type="number" step="any" value={sl} onChange={e => setSl(e.target.value)} placeholder="1.0905" style={INPUT_STYLE} />
                  </FieldGroup>
                  <FieldGroup label="First TP (optional)">
                    <input type="number" step="any" value={firstTp} onChange={e => setFirstTp(e.target.value)} placeholder="1.0825" style={INPUT_STYLE} />
                  </FieldGroup>
                  <FieldGroup label="Main TP">
                    <input type="number" step="any" value={mainTp} onChange={e => setMainTp(e.target.value)} placeholder="1.0780" style={INPUT_STYLE} />
                  </FieldGroup>
                  <FieldGroup label="Lot Size">
                    <input type="number" step="any" value={lotSize} onChange={e => setLotSize(e.target.value)} placeholder="0.45" style={INPUT_STYLE} />
                  </FieldGroup>
                  <FieldGroup label="Risk %">
                    <input type="number" step="0.1" value={riskPct} onChange={e => setRiskPct(e.target.value)} placeholder="1.0" style={INPUT_STYLE} />
                  </FieldGroup>
                </div>
              </div>

              {/* Group 3: Conviction & Context */}
              <div>
                <GroupHeader>Conviction &amp; Context</GroupHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldGroup label="Conviction">
                    <SegmentedControl
                      options={["Low", "Medium", "High"] as const}
                      value={conviction}
                      onChange={setConviction}
                      colorMap={{
                        Low: { active: "#64748B", bg: "rgba(100,116,139,0.1)" },
                        Medium: { active: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
                        High: { active: "#93C5FD", bg: "rgba(59,130,246,0.15)" },
                      }}
                    />
                  </FieldGroup>

                  <FieldGroup label="Fundamental Score (1-10)">
                    <input type="number" min="1" max="10" value={fundScore} onChange={e => setFundScore(e.target.value)} placeholder="7" style={INPUT_STYLE} />
                  </FieldGroup>

                  <div className="col-span-2">
                    <FieldGroup label="Psychology">
                      <input type="text" value={psychology} onChange={e => setPsychology(e.target.value)} placeholder="One word: confident, patient, eager, frustrated..." style={INPUT_STYLE} />
                    </FieldGroup>
                  </div>
                </div>
              </div>

              {/* Group 4: Notes */}
              <div>
                <GroupHeader>Notes &amp; Screenshots</GroupHeader>
                <FieldGroup label="Notes">
                  <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Setup notes, observations, things you noticed..." style={{ ...INPUT_STYLE, resize: "vertical", lineHeight: 1.6 }} />
                </FieldGroup>
                <div className="mt-4">
                  <label style={LABEL_STYLE}>Screenshots</label>
                  <div
                    className="flex items-center justify-center rounded-lg"
                    style={{ height: 64, border: "1.5px dashed rgba(148,163,184,0.15)", background: "rgba(148,163,184,0.02)", cursor: "pointer", color: "#475569", fontSize: 13 }}
                  >
                    Click to upload (Phase 2)
                  </div>
                </div>
              </div>

              {/* Group 5: Outcome toggle */}
              <div>
                <GroupHeader>Outcome</GroupHeader>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setIsClosed(c => !c)}
                    className="relative flex-shrink-0 rounded-full transition-colors duration-200"
                    style={{
                      width: 40,
                      height: 24,
                      background: isClosed ? "#3B82F6" : "rgba(148,163,184,0.15)",
                      border: isClosed ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(148,163,184,0.2)",
                    }}
                  >
                    <span
                      className="absolute rounded-full transition-transform duration-200"
                      style={{
                        width: 16,
                        height: 16,
                        top: 3,
                        left: 3,
                        background: "#fff",
                        transform: isClosed ? "translateX(16px)" : "translateX(0)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      }}
                    />
                  </button>
                  <span style={{ fontSize: 13, color: "#94A3B8" }}>This trade is closed</span>
                </div>

                {isClosed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldGroup label="Partial Exit Price">
                      <input type="number" step="any" value={partialExit} onChange={e => setPartialExit(e.target.value)} placeholder="Optional" style={INPUT_STYLE} />
                    </FieldGroup>
                    <FieldGroup label="Partial Lot %">
                      <input type="number" value={partialPct} onChange={e => setPartialPct(e.target.value)} placeholder="25" style={INPUT_STYLE} />
                    </FieldGroup>
                    <FieldGroup label="Main Exit Price">
                      <input type="number" step="any" value={mainExit} onChange={e => setMainExit(e.target.value)} placeholder="1.0820" style={INPUT_STYLE} />
                    </FieldGroup>
                    <FieldGroup label="Date Closed">
                      <input type="datetime-local" value={dateClosed} onChange={e => setDateClosed(e.target.value)} style={INPUT_STYLE} />
                    </FieldGroup>
                    <div className="col-span-2">
                      <FieldGroup label="Exit Type">
                        <select value={exitType} onChange={e => setExitType(e.target.value as ExitType)} style={INPUT_STYLE}>
                          {(["TP", "SL", "Manual", "Partial+TP", "Partial+SL", "BE"] as ExitType[]).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </FieldGroup>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 shrink-0"
            style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}
          >
            {error && (
              <span className="mr-auto text-sm" style={{ color: "#FCA5A5" }}>{error}</span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm transition-colors"
              style={{ color: "#64748B" }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={createTrade.isPending || noAccounts}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: "#3B82F6", color: "#fff", opacity: createTrade.isPending || noAccounts ? 0.6 : 1 }}
              onClick={handleSubmit}
            >
              {createTrade.isPending ? "Saving…" : "Add Trade"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
