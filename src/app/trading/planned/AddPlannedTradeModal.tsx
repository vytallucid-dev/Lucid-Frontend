"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { PlannedTrade, Direction, Conviction } from "@/lib/demo-data";
import { useTradingModels, useTradingPairs, useCreatePlanned, useUpdatePlanned } from "@/hooks/useTrading";
import type { CreatePlannedPayload } from "@/lib/api/trading";
import { toast } from "@/components/toast";
import { ScreenshotUploader } from "@/components/ScreenshotUploader";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useScrollLock } from "@/hooks/useScrollLock";

interface AddPlannedTradeModalProps {
  open: boolean;
  onClose: () => void;
  /** When set, the modal updates this planned trade instead of creating one. */
  editId?: string;
  prefill?: Partial<PlannedTrade>;
}

/** Local `YYYY-MM-DD` string for a `date` input, defaulting to today. */
function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function FieldGroup({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "lx-field-full" : undefined}>
      <label className="lx-field-label">{label}</label>
      {children}
    </div>
  );
}

function GroupHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="lt-serif"
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--lucid-ink-3)",
        paddingBottom: 8,
        borderBottom: "1px solid var(--lucid-line)",
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
      style={{ background: "var(--lucid-surface-2)", border: "1px solid var(--lucid-line)" }}
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
              background: active ? (colors?.bg ?? "var(--lucid-accent-bg)") : "transparent",
              color: active ? (colors?.active ?? "var(--lucid-accent)") : "var(--lucid-ink-3)",
              border: active
                ? `1px solid ${colors?.active ? `color-mix(in srgb, ${colors.active} 40%, transparent)` : "var(--lucid-accent-bd)"}`
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
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLFormElement>(null);
  useFocusTrap(panelRef, open);
  useScrollLock(panelRef, open);

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
    setScreenshots(prefill?.screenshots ?? []);
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
      screenshots,
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
      <div className="lx-overlay-scrim fixed inset-0 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form
          ref={panelRef}
          className="lx-modal-panel lx-modal-form relative"
          onClick={e => e.stopPropagation()}
          onSubmit={handleSubmit}
        >
          {/* Header */}
          <div className="lx-overlay-header">
            <h2 className="lx-overlay-title">
              {editId ? "Edit Planned Trade" : "Add Planned Trade"}
            </h2>
            <button type="button" onClick={onClose} className="lx-overlay-close">
              <X size={15} />
            </button>
          </div>

          {/* Content */}
          <div className="lx-overlay-body">
            <div className="flex flex-col gap-6">
              {/* Setup */}
              <div>
                <GroupHeader>Setup</GroupHeader>
                <div className="lx-form-grid">
                  <FieldGroup label="Pair">
                    <select className="lx-input lx-select" value={pair} onChange={e => setPair(e.target.value)}>
                      {pairList.map(p => (
                        <option key={p.symbol} value={p.symbol}>{p.display_name}</option>
                      ))}
                    </select>
                  </FieldGroup>

                  <FieldGroup label="Model">
                    <select className="lx-input lx-select" value={model} onChange={e => setModel(e.target.value)}>
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
                        Buy: { active: "var(--lucid-pos)", bg: "var(--lucid-pos-bg)" },
                        Sell: { active: "var(--lucid-neg)", bg: "var(--lucid-neg-bg)" },
                      }}
                    />
                  </FieldGroup>

                  <FieldGroup label="Date Planned">
                    <input
                      type="date"
                      value={datePlanned}
                      onChange={e => setDatePlanned(e.target.value)}
                      className="lx-input lx-input-num"
                    />
                  </FieldGroup>
                </div>
              </div>

              {/* Levels */}
              <div>
                <GroupHeader>Price Levels</GroupHeader>
                <div className="lx-form-grid">
                  <FieldGroup label="Planned Entry">
                    <input type="number" step="any" value={plannedEntry} onChange={e => setPlannedEntry(e.target.value)} placeholder="1.2580" className="lx-input lx-input-num" required />
                  </FieldGroup>
                  <FieldGroup label="Stop Loss">
                    <input type="number" step="any" value={plannedSl} onChange={e => setPlannedSl(e.target.value)} placeholder="1.2540" className="lx-input lx-input-num" required />
                  </FieldGroup>
                  <FieldGroup label="First TP (optional)">
                    <input type="number" step="any" value={plannedFirstTp} onChange={e => setPlannedFirstTp(e.target.value)} placeholder="1.2620" className="lx-input lx-input-num" />
                  </FieldGroup>
                  <FieldGroup label="Main TP">
                    <input type="number" step="any" value={plannedMainTp} onChange={e => setPlannedMainTp(e.target.value)} placeholder="1.2680" className="lx-input lx-input-num" required />
                  </FieldGroup>
                  <FieldGroup label="Current Market Price">
                    <input type="number" step="any" value={currentMarketPrice} onChange={e => setCurrentMarketPrice(e.target.value)} placeholder="Defaults to entry — update to track distance" className="lx-input lx-input-num" />
                  </FieldGroup>
                </div>
              </div>

              {/* Risk & Conviction */}
              <div>
                <GroupHeader>Risk &amp; Conviction</GroupHeader>
                <div className="lx-form-grid">
                  <FieldGroup label="Planned Risk %">
                    <input type="number" step="0.1" value={riskPct} onChange={e => setRiskPct(e.target.value)} placeholder="1.0" className="lx-input lx-input-num" />
                  </FieldGroup>

                  <FieldGroup label="Conviction">
                    <SegmentedControl
                      options={["Low", "Medium", "High"] as const}
                      value={conviction}
                      onChange={setConviction}
                      colorMap={{
                        Low: { active: "var(--lucid-ink-3)", bg: "var(--lucid-surface-3)" },
                        Medium: { active: "var(--lucid-ink-2)", bg: "var(--lucid-surface-3)" },
                        High: { active: "var(--lucid-ink)", bg: "var(--lucid-line-2)" },
                      }}
                    />
                  </FieldGroup>
                </div>
              </div>

              {/* Notes & Screenshots */}
              <div>
                <GroupHeader>Notes &amp; Screenshots</GroupHeader>
                <FieldGroup label="Setup Notes" full>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe the setup — key levels, conditions to watch..." rows={3} className="lx-input lx-textarea" />
                </FieldGroup>
                <div className="mt-4">
                  <ScreenshotUploader value={screenshots} onChange={setScreenshots} />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="lx-overlay-footer">
            {error && <span className="lx-field-error mr-auto">{error}</span>}
            <button type="button" onClick={onClose} className="lx-btn lx-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="lx-btn lx-btn-primary">
              {saving ? "Saving…" : editId ? "Save Changes" : "Add to Watchlist"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
