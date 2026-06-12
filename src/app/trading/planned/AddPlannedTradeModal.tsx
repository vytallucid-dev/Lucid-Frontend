"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { PlannedTrade, Direction, Conviction } from "@/lib/demo-data";
import { useTradingModels, useTradingPairs, useCreatePlanned, useUpdatePlanned } from "@/hooks/useTrading";
import type { CreatePlannedPayload } from "@/lib/api/trading";
import { toast } from "@/components/toast";

interface AddPlannedTradeModalProps {
  open: boolean;
  onClose: () => void;
  /** When set, the modal updates this planned trade instead of creating one. */
  editId?: string;
  prefill?: Partial<PlannedTrade>;
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

// Explicit dark background so the native dropdown list stays readable on mobile.
const OPTION_STYLE: React.CSSProperties = { background: "#0A0E14", color: "#E2E8F0" };

/** Local `YYYY-MM-DD` string for a `date` input, defaulting to today. */
function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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
              border: active
                ? `1px solid ${colors?.active ? colors.active + "40" : "rgba(59,130,246,0.25)"}`
                : "1px solid transparent",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function AddPlannedTradeModal({ open, onClose, editId, prefill }: AddPlannedTradeModalProps) {
  const pairsQuery = useTradingPairs();
  const modelsQuery = useTradingModels();
  const createPlanned = useCreatePlanned();
  const updatePlanned = useUpdatePlanned();

  const pairList = pairsQuery.data ?? [];
  const modelList = modelsQuery.data ?? [];

  const [pair, setPair] = useState("");
  const [model, setModel] = useState("");
  const [direction, setDirection] = useState<Direction>("Buy");
  const [plannedEntry, setPlannedEntry] = useState("");
  const [plannedSl, setPlannedSl] = useState("");
  const [plannedFirstTp, setPlannedFirstTp] = useState("");
  const [plannedMainTp, setPlannedMainTp] = useState("");
  const [currentMarketPrice, setCurrentMarketPrice] = useState("");
  const [riskPct, setRiskPct] = useState("");
  const [conviction, setConviction] = useState<Conviction>("Medium");
  const [datePlanned, setDatePlanned] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPair(prefill?.pair ?? "");
    setModel(prefill?.model ?? "");
    setDirection(prefill?.direction ?? "Buy");
    setPlannedEntry(prefill?.planned_entry != null ? String(prefill.planned_entry) : "");
    setPlannedSl(prefill?.planned_sl != null ? String(prefill.planned_sl) : "");
    setPlannedFirstTp(prefill?.planned_first_tp != null ? String(prefill.planned_first_tp) : "");
    setPlannedMainTp(prefill?.planned_main_tp != null ? String(prefill.planned_main_tp) : "");
    setCurrentMarketPrice(prefill?.current_market_price != null ? String(prefill.current_market_price) : "");
    setRiskPct(prefill?.planned_risk_pct != null ? String(prefill.planned_risk_pct) : "");
    setConviction(prefill?.conviction ?? "Medium");
    setDatePlanned(prefill?.date_added ? toDateInput(new Date(prefill.date_added)) : toDateInput(new Date()));
    setNotes(prefill?.notes ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editId]);

  useEffect(() => {
    if (!open) return;
    if (!pair && pairList.length) setPair(prefill?.pair ?? pairList[0].symbol);
    if (!model && modelList.length) setModel(prefill?.model ?? modelList[0].name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pairList, modelList]);

  if (!open) return null;

  const saving = createPlanned.isPending || updatePlanned.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const entryNum = parseFloat(plannedEntry);
    const slNum = parseFloat(plannedSl);
    const mainTpNum = parseFloat(plannedMainTp);
    if ([entryNum, slNum, mainTpNum].some(Number.isNaN)) {
      setError("Entry, Stop Loss and Main TP are required numbers.");
      return;
    }
    const body: CreatePlannedPayload = {
      pair: pair || (pairList[0]?.symbol ?? ""),
      model: model || (modelList[0]?.name ?? ""),
      direction,
      planned_entry: entryNum,
      planned_sl: slNum,
      planned_first_tp: plannedFirstTp ? parseFloat(plannedFirstTp) : null,
      planned_main_tp: mainTpNum,
      planned_risk_pct: riskPct ? parseFloat(riskPct) : 1.0,
      conviction,
      notes: notes.trim() || null,
      ...(datePlanned ? { date_added: datePlanned } : {}),
      ...(currentMarketPrice ? { current_market_price: parseFloat(currentMarketPrice) } : {}),
    };
    try {
      if (editId) {
        await updatePlanned.mutateAsync({ id: editId, body });
        toast.success(`${body.pair} ${direction} setup updated.`, { title: "Planned trade updated" });
      } else {
        await createPlanned.mutateAsync(body);
        toast.success(`${body.pair} ${direction} added to your watchlist.`, { title: "Setup planned" });
      }
      onClose();
    } catch {
      // The global mutation handler surfaces the error toast.
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <form
          className="relative flex flex-col rounded-2xl"
          style={{
            width: "100%",
            maxWidth: 640,
            maxHeight: "88vh",
            background: "rgba(10,18,30,0.98)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(148,163,184,0.12)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          }}
          onClick={e => e.stopPropagation()}
          onSubmit={handleSubmit}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0"
            style={{ borderBottom: "1px solid rgba(148,163,184,0.08)" }}
          >
            <h2 className="text-base font-semibold" style={{ color: "#E2E8F0" }}>
              {editId ? "Edit Planned Trade" : "Add Planned Trade"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md transition-colors hover:bg-white/5"
              style={{ color: "#64748B" }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5">
            <div className="flex flex-col gap-6">
              {/* Setup */}
              <div>
                <GroupHeader>Setup</GroupHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldGroup label="Pair">
                    <select value={pair} onChange={e => setPair(e.target.value)} style={INPUT_STYLE}>
                      {pairList.map(p => (
                        <option key={p.symbol} value={p.symbol} style={OPTION_STYLE}>{p.display_name}</option>
                      ))}
                    </select>
                  </FieldGroup>

                  <FieldGroup label="Model">
                    <select value={model} onChange={e => setModel(e.target.value)} style={INPUT_STYLE}>
                      {modelList.map(m => (
                        <option key={m.id} value={m.name} style={OPTION_STYLE}>{m.name}</option>
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

                  <FieldGroup label="Date Planned">
                    <input
                      type="date"
                      value={datePlanned}
                      onChange={e => setDatePlanned(e.target.value)}
                      style={INPUT_STYLE}
                    />
                  </FieldGroup>
                </div>
              </div>

              {/* Levels */}
              <div>
                <GroupHeader>Price Levels</GroupHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldGroup label="Planned Entry">
                    <input type="number" step="any" value={plannedEntry} onChange={e => setPlannedEntry(e.target.value)} placeholder="1.2580" style={INPUT_STYLE} required />
                  </FieldGroup>
                  <FieldGroup label="Stop Loss">
                    <input type="number" step="any" value={plannedSl} onChange={e => setPlannedSl(e.target.value)} placeholder="1.2540" style={INPUT_STYLE} required />
                  </FieldGroup>
                  <FieldGroup label="First TP (optional)">
                    <input type="number" step="any" value={plannedFirstTp} onChange={e => setPlannedFirstTp(e.target.value)} placeholder="1.2620" style={INPUT_STYLE} />
                  </FieldGroup>
                  <FieldGroup label="Main TP">
                    <input type="number" step="any" value={plannedMainTp} onChange={e => setPlannedMainTp(e.target.value)} placeholder="1.2680" style={INPUT_STYLE} required />
                  </FieldGroup>
                  <div className="col-span-2 sm:col-span-1">
                    <FieldGroup label="Current Market Price">
                      <input type="number" step="any" value={currentMarketPrice} onChange={e => setCurrentMarketPrice(e.target.value)} placeholder="Defaults to entry — update to track distance" style={INPUT_STYLE} />
                    </FieldGroup>
                  </div>
                </div>
              </div>

              {/* Risk & Conviction */}
              <div>
                <GroupHeader>Risk &amp; Conviction</GroupHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldGroup label="Planned Risk %">
                    <input type="number" step="0.1" value={riskPct} onChange={e => setRiskPct(e.target.value)} placeholder="1.0" style={INPUT_STYLE} />
                  </FieldGroup>

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
                </div>
              </div>

              {/* Notes */}
              <div>
                <GroupHeader>Notes</GroupHeader>
                <FieldGroup label="Setup Notes">
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe the setup — key levels, conditions to watch..." rows={3} style={{ ...INPUT_STYLE, resize: "vertical" }} />
                </FieldGroup>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 shrink-0"
            style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}
          >
            {error && <span className="mr-auto text-sm" style={{ color: "#FCA5A5" }}>{error}</span>}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: "#64748B" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: "rgba(59,130,246,0.9)", color: "#fff", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : editId ? "Save Changes" : "Add to Watchlist"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
