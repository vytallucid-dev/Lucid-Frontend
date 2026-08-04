"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, Sparkles, Plus, Trash2, Star } from "lucide-react";
import { accountTypeLabel, type Direction, type Conviction, type ExitType, type Trade } from "@/lib/demo-data";
import {
  useAccounts,
  useTradingModels,
  useTradingPairs,
  useCreateTrade,
  useUpdateTrade,
  useAddExecution,
  useUpdateExecution,
  useRemoveExecution,
} from "@/hooks/useTrading";
import type { CreateTradePayload, CreateExecutionPayload, UpdateExecutionPayload } from "@/lib/api/trading";
import { getFxPair, getScorecardAsset, type ScorecardAssetKey } from "@/lib/api/oracle";
import { toast } from "@/components/toast";
import { ScreenshotUploader } from "@/components/ScreenshotUploader";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useScrollLock } from "@/hooks/useScrollLock";

// Pairs the Oracle can produce a Lucid score for via the FX scorecard (all
// nine pairs, now that AUDUSD/AUDJPY/EURAUD/GBPAUD are tradable journal
// instruments too — Issue 3). Gold and the three indices score via the asset
// scorecard instead (SCORECARD_LUCID_ASSETS below), not the FX scorecard.
const FX_LUCID_PAIRS = new Set([
  "EURUSD", "GBPUSD", "USDJPY", "EURJPY", "GBPJPY",
  "AUDUSD", "AUDJPY", "EURAUD", "GBPAUD",
]);
// Symbols scored via /api/oracle/scorecard rather than /api/oracle/fx-scorecard.
// Gold's scorecard key is "Gold", not its trading symbol "XAUUSD" — every
// other entry here uses its trading symbol directly as the scorecard key.
const SCORECARD_LUCID_ASSETS = new Set(["XAUUSD", "SPY", "NAS100", "US30"]);

/** Fetch the current Lucid (Oracle) score for a pair symbol; null when unsupported. */
async function fetchLucidScore(symbol: string): Promise<number | null> {
  if (symbol === "XAUUSD") return (await getScorecardAsset("Gold")).totalScore;
  // Runtime-verified by the Set membership check above; the plain `string`
  // parameter can't narrow to the literal union on its own.
  if (SCORECARD_LUCID_ASSETS.has(symbol)) return (await getScorecardAsset(symbol as ScorecardAssetKey)).totalScore;
  if (FX_LUCID_PAIRS.has(symbol)) return (await getFxPair(symbol)).totalScore;
  return null;
}

/** Formats a Date as the local `YYYY-MM-DDTHH:mm` string a datetime-local input expects. */
function toLocalDatetimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Optional pre-fill, e.g. when converting a planned trade into a live one.
 * risk_pct seeds the first account row's risk % (risk is execution-level now). */
export interface AddTradePrefill {
  pair?: string;
  model?: string;
  direction?: Direction;
  planned_entry?: number;
  planned_sl?: number;
  planned_first_tp?: number | null;
  planned_main_tp?: number;
  risk_pct?: number;
  conviction?: Conviction;
}

interface AddTradeModalProps {
  open: boolean;
  onClose: () => void;
  prefill?: AddTradePrefill;
  /** When set, the modal edits this trade instead of creating a new one. */
  editTrade?: Trade;
  /** Called after a trade is successfully created/updated (before onClose). */
  onSubmitted?: () => void;
}

function FieldGroup({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "lx-field-full" : undefined}>
      <label className="lx-field-label">{label}</label>
      {children}
    </div>
  );
}

function GroupHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--lucid-ink-3)",
        paddingBottom: 8,
        borderBottom: "1px solid var(--lucid-line)",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span>{children}</span>
      {action}
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
      style={{ background: "var(--lucid-surface-3)", border: "1px solid var(--lucid-line)" }}
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
              border: active ? `1px solid ${colors?.active ? colors.active + "40" : "var(--lucid-accent-bd)"}` : "1px solid transparent",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// One account's fill, as edited in the form. `executionId` is set only when
// this row mirrors an existing Execution (edit mode) — its presence is what
// tells submit() whether to PATCH or POST.
interface ExecutionRow {
  key: string;
  executionId?: string;
  accountId: string;
  isPrimary: boolean;
  riskPct: string;
  lotSize: string;
  entryPrice: string;
  isClosed: boolean;
  partialExit: string;
  partialPct: string;
  mainExit: string;
  mainExitAuto: boolean;
  dateClosed: string;
  exitType: ExitType;
  netPnl: string;
}

let rowKeySeq = 0;
function newRowKey() {
  rowKeySeq += 1;
  return `new-${rowKeySeq}`;
}

function blankRow(accountId: string, isPrimary: boolean, riskPct?: number): ExecutionRow {
  return {
    key: newRowKey(),
    accountId,
    isPrimary,
    riskPct: riskPct != null ? String(riskPct) : "",
    lotSize: "",
    entryPrice: "",
    isClosed: false,
    partialExit: "",
    partialPct: "",
    mainExit: "",
    mainExitAuto: true,
    dateClosed: "",
    exitType: "TP",
    netPnl: "",
  };
}

export function AddTradeModal({ open, onClose, prefill, editTrade, onSubmitted }: AddTradeModalProps) {
  const accountsQuery = useAccounts();
  const modelsQuery = useTradingModels();
  const pairsQuery = useTradingPairs();
  const createTrade = useCreateTrade();
  const updateTrade = useUpdateTrade();
  const addExecution = useAddExecution();
  const updateExecution = useUpdateExecution();
  const removeExecution = useRemoveExecution();

  const isEdit = !!editTrade;

  const accountList = accountsQuery.data ?? [];
  const modelList = modelsQuery.data ?? [];
  const pairList = pairsQuery.data ?? [];

  // Idea fields
  const [pair, setPair] = useState("");
  const [model, setModel] = useState("");
  const [direction, setDirection] = useState<Direction>("Buy");
  const [plannedEntry, setPlannedEntry] = useState("");
  const [plannedSl, setPlannedSl] = useState("");
  const [plannedFirstTp, setPlannedFirstTp] = useState("");
  const [plannedMainTp, setPlannedMainTp] = useState("");
  const [conviction, setConviction] = useState<Conviction>("Medium");
  const [fundScore, setFundScore] = useState("");
  // Whether the Lucid score should still auto-fill from the Oracle. Set false once
  // the user types in the field; reset to true whenever the pair changes.
  const [lucidAuto, setLucidAuto] = useState(true);
  const [psychology, setPsychology] = useState("");
  const [notes, setNotes] = useState("");
  const [dateOpened, setDateOpened] = useState("");
  const [screenshots, setScreenshots] = useState<string[]>([]);

  // Execution rows — one per account
  const [rows, setRows] = useState<ExecutionRow[]>([]);
  const [removedExecutionIds, setRemovedExecutionIds] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);
  useScrollLock(panelRef, open);

  // Lucid (Oracle) score for the selected pair — auto-prefills the field.
  const lucidQuery = useQuery({
    queryKey: ["lucid-score", pair],
    queryFn: () => fetchLucidScore(pair),
    enabled: open && !!pair,
    staleTime: 5 * 60 * 1000,
    placeholderData: undefined, // don't carry the previous pair's score across
  });

  // Reset the form each time the modal opens, seeding from editTrade (edit mode)
  // or prefill (create / convert-from-planned).
  useEffect(() => {
    if (!open) return;
    const e = editTrade;
    setPair(e?.pair ?? prefill?.pair ?? "");
    setModel(e?.model ?? prefill?.model ?? "");
    setDirection(e?.direction ?? prefill?.direction ?? "Buy");
    setPlannedEntry(e ? String(e.planned_entry) : prefill?.planned_entry != null ? String(prefill.planned_entry) : "");
    setPlannedSl(e ? String(e.planned_sl) : prefill?.planned_sl != null ? String(prefill.planned_sl) : "");
    setPlannedFirstTp(e?.planned_first_tp != null ? String(e.planned_first_tp) : prefill?.planned_first_tp != null ? String(prefill.planned_first_tp) : "");
    setPlannedMainTp(e ? String(e.planned_main_tp) : prefill?.planned_main_tp != null ? String(prefill.planned_main_tp) : "");
    setConviction(e?.conviction ?? prefill?.conviction ?? "Medium");
    setFundScore(e?.fundamental_score != null ? String(e.fundamental_score) : "");
    setLucidAuto(!e); // in edit mode keep the saved score; in create mode auto-fill
    setPsychology(e?.psychology ?? "");
    setNotes(e?.notes ?? "");
    setDateOpened(toLocalDatetimeInput(e?.date_opened ? new Date(e.date_opened) : new Date()));
    setScreenshots(e?.screenshots ?? []);
    setError(null);
    setRemovedExecutionIds([]);

    if (e) {
      setRows(
        e.executions.map((ex) => ({
          key: ex.id,
          executionId: ex.id,
          accountId: ex.account_id,
          isPrimary: ex.is_primary,
          riskPct: String(ex.risk_pct),
          lotSize: String(ex.lot_size),
          entryPrice: String(ex.entry_price),
          isClosed: !!ex.date_closed,
          partialExit: ex.partial_exit_price != null ? String(ex.partial_exit_price) : "",
          partialPct: ex.partial_exit_lot_pct != null ? String(ex.partial_exit_lot_pct) : "",
          mainExit: ex.date_closed && ex.main_exit_price ? String(ex.main_exit_price) : "",
          mainExitAuto: false,
          dateClosed: ex.date_closed ? toLocalDatetimeInput(new Date(ex.date_closed)) : "",
          exitType: ex.exit_type,
          netPnl: ex.date_closed && ex.blended_pnl != null ? String(ex.blended_pnl) : "",
        })),
      );
    } else {
      setRows([blankRow("", true, prefill?.risk_pct)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fill the dropdown defaults once the lists have loaded (covers the race where
  // the modal opens before queries resolve). Skipped in edit mode (already seeded).
  useEffect(() => {
    if (!open || isEdit) return;
    if (!pair && pairList.length) setPair(prefill?.pair ?? pairList[0].symbol);
    if (!model && modelList.length) setModel(prefill?.model ?? modelList[0].name);
    if (accountList.length) {
      setRows((rs) => (rs.length === 1 && !rs[0].accountId ? [{ ...rs[0], accountId: accountList[0].id }] : rs));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pairList, modelList, accountList]);

  // Auto-prefill the Lucid score when the pair's Oracle score resolves, unless
  // the user has manually edited it. `isPlaceholderData` guards against filling
  // with a stale pair's number mid-fetch.
  useEffect(() => {
    if (!open || !lucidAuto || lucidQuery.isPlaceholderData) return;
    if (lucidQuery.data != null) setFundScore(String(lucidQuery.data));
  }, [lucidQuery.data, lucidQuery.isPlaceholderData, lucidAuto, open]);

  // Reset auto-fill intent whenever the pair changes (create mode only).
  useEffect(() => {
    if (!open || isEdit) return;
    setLucidAuto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair]);

  // Auto-fill each row's exit price from the idea's planned TP/SL when that
  // row is closed: exit type TP → Main TP, SL → Stop Loss. Convenience
  // prefill only — editable, and never clobbers a hand-typed exit.
  useEffect(() => {
    if (!open) return;
    setRows((rs) =>
      rs.map((r) => {
        if (!r.isClosed || !r.mainExitAuto) return r;
        if (r.exitType === "TP") return { ...r, mainExit: plannedMainTp };
        if (r.exitType === "SL") return { ...r, mainExit: plannedSl };
        return r;
      }),
    );
  }, [open, plannedMainTp, plannedSl, rows.map((r) => `${r.isClosed}:${r.exitType}`).join("|")]);

  if (!open) return null;

  const noAccounts = !accountsQuery.isLoading && accountList.length === 0;
  const saving =
    createTrade.isPending || updateTrade.isPending || addExecution.isPending || updateExecution.isPending || removeExecution.isPending;

  function updateRow(key: string, patch: Partial<ExecutionRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    const used = new Set(rows.map((r) => r.accountId));
    const next = accountList.find((a) => !used.has(a.id))?.id ?? accountList[0]?.id ?? "";
    setRows((rs) => [...rs, blankRow(next, false)]);
  }
  function removeRow(key: string) {
    setRows((rs) => {
      if (rs.length <= 1) return rs; // last execution can't be removed
      const removed = rs.find((r) => r.key === key);
      const remaining = rs.filter((r) => r.key !== key);
      if (removed?.executionId) setRemovedExecutionIds((ids) => [...ids, removed.executionId!]);
      // Mirrors the backend's own promotion rule (earliest-added remaining
      // execution becomes primary) so the form doesn't submit zero primaries.
      if (removed?.isPrimary && remaining.length > 0 && !remaining.some((r) => r.isPrimary)) {
        remaining[0] = { ...remaining[0], isPrimary: true };
      }
      return remaining;
    });
  }
  function setPrimary(key: string) {
    setRows((rs) => rs.map((r) => ({ ...r, isPrimary: r.key === key })));
  }

  async function handleSubmit() {
    setError(null);
    if (rows.length === 0 || rows.some((r) => !r.accountId)) {
      setError("Select an account for every row.");
      return;
    }
    const plannedEntryNum = parseFloat(plannedEntry);
    const plannedSlNum = parseFloat(plannedSl);
    const plannedMainTpNum = parseFloat(plannedMainTp);
    if ([plannedEntryNum, plannedSlNum, plannedMainTpNum].some(Number.isNaN)) {
      setError("Entry, Stop Loss, and Main TP are required numbers.");
      return;
    }
    for (const r of rows) {
      if ([parseFloat(r.riskPct), parseFloat(r.lotSize), parseFloat(r.entryPrice)].some(Number.isNaN)) {
        setError("Entry, Stop Loss, Main TP and Lot Size are required numbers.");
        return;
      }
      if (r.isClosed && !r.mainExit) {
        setError("Main Exit Price is required to log a closed trade.");
        return;
      }
    }

    const ideaBody = {
      model: model || (modelList[0]?.name ?? ""),
      pair: pair || (pairList[0]?.symbol ?? ""),
      direction,
      planned_entry: plannedEntryNum,
      planned_sl: plannedSlNum,
      planned_first_tp: plannedFirstTp ? parseFloat(plannedFirstTp) : null,
      planned_main_tp: plannedMainTpNum,
      conviction,
      fundamental_score: fundScore !== "" ? parseInt(fundScore, 10) : null,
      psychology: psychology.trim() || null,
      notes: notes.trim() || null,
      screenshots,
      ...(dateOpened ? { date_opened: new Date(dateOpened).toISOString() } : {}),
    };

    function executionBody(r: ExecutionRow): CreateExecutionPayload {
      return {
        account_id: r.accountId,
        is_primary: r.isPrimary || undefined,
        risk_pct: parseFloat(r.riskPct) || 0,
        lot_size: parseFloat(r.lotSize),
        entry_price: parseFloat(r.entryPrice),
        is_closed: r.isClosed,
        exit_type: r.exitType,
        ...(r.isClosed
          ? {
              partial_exit_price: r.partialExit ? parseFloat(r.partialExit) : null,
              partial_exit_lot_pct: r.partialPct ? parseFloat(r.partialPct) : null,
              main_exit_price: r.mainExit ? parseFloat(r.mainExit) : null,
              date_closed: r.dateClosed ? new Date(r.dateClosed).toISOString() : null,
              net_pnl: r.netPnl !== "" ? parseFloat(r.netPnl) : null,
            }
          : {}),
      };
    }

    try {
      if (editTrade) {
        await updateTrade.mutateAsync({ id: editTrade.id, body: ideaBody });
        for (const id of removedExecutionIds) {
          await removeExecution.mutateAsync({ tradeId: editTrade.id, executionId: id });
        }
        for (const r of rows) {
          if (r.executionId) {
            const body: UpdateExecutionPayload = executionBody(r);
            if (!r.isPrimary) delete body.is_primary; // never send is_primary:false — rejected
            await updateExecution.mutateAsync({ tradeId: editTrade.id, executionId: r.executionId, body });
          }
        }
        for (const r of rows) {
          if (!r.executionId) {
            await addExecution.mutateAsync({ tradeId: editTrade.id, body: executionBody(r) });
          }
        }
        toast.success(`${pair || ideaBody.pair} ${direction} updated.`, { title: "Trade updated" });
      } else {
        const payload: CreateTradePayload = { ...ideaBody, executions: rows.map(executionBody) };
        await createTrade.mutateAsync(payload);
        const anyClosed = rows.some((r) => r.isClosed);
        toast.success(
          `${pair || payload.pair} ${direction} ${anyClosed ? "saved" : "is now live"} in your journal.`,
          { title: anyClosed ? "Trade logged" : "Trade opened" },
        );
      }
      onSubmitted?.();
      onClose();
    } catch {
      // The global mutation handler surfaces the error toast.
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="lx-overlay-scrim fixed inset-0 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          ref={panelRef}
          className="lx-modal-panel lx-modal-form relative"
          onClick={e => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className="lx-overlay-header">
            <h2 className="lx-overlay-title">{isEdit ? "Edit Trade" : "Add Trade"}</h2>
            <button onClick={onClose} className="lx-overlay-close">
              <X size={15} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="lx-overlay-body">

            {noAccounts && (
              <div
                className="mb-6 rounded-lg px-4 py-3 text-sm"
                style={{ background: "var(--lucid-warn-bg)", border: "1px solid var(--lucid-warn-bd)", color: "var(--lucid-warn)" }}
              >
                You need at least one account before logging a trade. Add one in the Accounts tab.
              </div>
            )}

            <div className="flex flex-col gap-6">

              {/* Group 1: Setup */}
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

                  <FieldGroup label="Date Opened">
                    <input
                      type="datetime-local"
                      value={dateOpened}
                      onChange={e => setDateOpened(e.target.value)}
                      className="lx-input lx-input-num"
                    />
                  </FieldGroup>
                </div>
              </div>

              {/* Group 2: Prices (the plan — shared across every account) */}
              <div>
                <GroupHeader>Prices</GroupHeader>
                <div className="lx-form-grid">
                  <FieldGroup label="Entry Price">
                    <input type="number" step="any" value={plannedEntry} onChange={e => setPlannedEntry(e.target.value)} placeholder="1.0865" className="lx-input lx-input-num" />
                  </FieldGroup>
                  <FieldGroup label="Stop Loss">
                    <input type="number" step="any" value={plannedSl} onChange={e => setPlannedSl(e.target.value)} placeholder="1.0905" className="lx-input lx-input-num" />
                  </FieldGroup>
                  <FieldGroup label="First TP (optional)">
                    <input type="number" step="any" value={plannedFirstTp} onChange={e => setPlannedFirstTp(e.target.value)} placeholder="1.0825" className="lx-input lx-input-num" />
                  </FieldGroup>
                  <FieldGroup label="Main TP">
                    <input type="number" step="any" value={plannedMainTp} onChange={e => setPlannedMainTp(e.target.value)} placeholder="1.0780" className="lx-input lx-input-num" />
                  </FieldGroup>
                </div>
              </div>

              {/* Group 3: Conviction & Context */}
              <div>
                <GroupHeader>Conviction &amp; Context</GroupHeader>
                <div className="lx-form-grid">
                  <FieldGroup label="Conviction">
                    <SegmentedControl
                      options={["Low", "Medium", "High"] as const}
                      value={conviction}
                      onChange={setConviction}
                      colorMap={{
                        Low: { active: "var(--lucid-ink-3)", bg: "var(--lucid-surface-3)" },
                        Medium: { active: "var(--lucid-ink-2)", bg: "var(--lucid-surface-3)" },
                        High: { active: "var(--lucid-accent)", bg: "var(--lucid-accent-bg)" },
                      }}
                    />
                  </FieldGroup>

                  <div>
                    <label className="lx-field-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Sparkles size={11} style={{ color: "var(--lucid-accent)" }} />
                      Lucid Score
                      {lucidQuery.isFetching && !lucidQuery.isPlaceholderData && (
                        <span className="flex items-center gap-1" style={{ textTransform: "none", fontWeight: 400, color: "var(--lucid-accent)" }}>
                          <Loader2 size={10} className="animate-spin" /> fetching…
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={fundScore}
                      onChange={e => { setFundScore(e.target.value); setLucidAuto(false); }}
                      placeholder={lucidQuery.isFetching ? "Fetching…" : "Auto from Oracle"}
                      className="lx-input lx-input-num"
                    />
                    <p style={{ fontSize: 10.5, color: "var(--lucid-ink-3)", marginTop: 4 }}>
                      {lucidAuto && lucidQuery.data != null
                        ? "Auto-filled from the live Oracle score — edit to override."
                        : !lucidAuto
                        ? "Manually set."
                        : pair && !lucidQuery.isFetching && lucidQuery.data == null
                        ? "No Oracle score for this pair."
                        : "Fetched from the Oracle when you pick a pair."}
                    </p>
                  </div>

                  <FieldGroup label="Psychology" full>
                    <input type="text" value={psychology} onChange={e => setPsychology(e.target.value)} placeholder="One word: confident, patient, eager, frustrated..." className="lx-input" />
                  </FieldGroup>
                </div>
              </div>

              {/* Group 4: Notes */}
              <div>
                <GroupHeader>Notes &amp; Screenshots</GroupHeader>
                <FieldGroup label="Notes">
                  <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Setup notes, observations, things you noticed..." className="lx-input lx-textarea" />
                </FieldGroup>
                <div className="mt-4">
                  <ScreenshotUploader value={screenshots} onChange={setScreenshots} />
                </div>
              </div>

              {/* Group 5: Accounts — one card per execution. Same idea, different
                  account, different risk/size/exit. */}
              <div>
                <GroupHeader
                  action={
                    <button
                      type="button"
                      onClick={addRow}
                      disabled={accountList.length === 0}
                      className="flex items-center gap-1"
                      style={{ fontSize: 11, fontWeight: 600, color: "var(--lucid-accent)", textTransform: "none", letterSpacing: 0 }}
                    >
                      <Plus size={12} /> Add Account
                    </button>
                  }
                >
                  Accounts
                </GroupHeader>

                <div className="flex flex-col gap-4">
                  {rows.map((r, i) => (
                    <div
                      key={r.key}
                      className="rounded-lg p-4"
                      style={{ background: "var(--lucid-surface-2)", border: `1px solid ${r.isPrimary ? "var(--lucid-accent-bd)" : "var(--lucid-line)"}` }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <button
                          type="button"
                          onClick={() => setPrimary(r.key)}
                          className="flex items-center gap-1.5"
                          style={{ fontSize: 11, fontWeight: 700, color: r.isPrimary ? "var(--lucid-accent)" : "var(--lucid-ink-3)" }}
                          title="The idea's outcome, for edge statistics, is the primary execution's outcome."
                        >
                          <Star size={12} fill={r.isPrimary ? "var(--lucid-accent)" : "none"} />
                          {r.isPrimary ? "Primary" : "Set primary"}
                        </button>
                        {rows.length > 1 && (
                          <button type="button" onClick={() => removeRow(r.key)} className="lx-icon-btn" title="Remove this account">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div className="lx-form-grid">
                        <FieldGroup label="Account">
                          <select
                            className="lx-input lx-select"
                            value={r.accountId}
                            onChange={e => updateRow(r.key, { accountId: e.target.value })}
                          >
                            {accountList.length === 0 && <option value="">No accounts</option>}
                            {accountList.map(a => (
                              <option key={a.id} value={a.id}>{a.account_name} ({accountTypeLabel(a.account_type)})</option>
                            ))}
                          </select>
                        </FieldGroup>
                        <FieldGroup label="Risk %">
                          <input type="number" step="0.1" value={r.riskPct} onChange={e => updateRow(r.key, { riskPct: e.target.value })} placeholder="1.0" className="lx-input lx-input-num" />
                        </FieldGroup>
                        <FieldGroup label="Lot Size">
                          <input type="number" step="any" value={r.lotSize} onChange={e => updateRow(r.key, { lotSize: e.target.value })} placeholder="0.45" className="lx-input lx-input-num" />
                        </FieldGroup>
                        <FieldGroup label="Entry Price">
                          <input type="number" step="any" value={r.entryPrice} onChange={e => updateRow(r.key, { entryPrice: e.target.value })} placeholder="1.0865" className="lx-input lx-input-num" />
                        </FieldGroup>
                      </div>

                      <div className="flex items-center gap-3 mt-4 mb-1">
                        <button
                          type="button"
                          onClick={() => updateRow(r.key, { isClosed: !r.isClosed })}
                          className="relative flex-shrink-0 rounded-full transition-colors duration-200"
                          style={{
                            width: 40, height: 24,
                            background: r.isClosed ? "var(--lucid-accent)" : "var(--lucid-surface-3)",
                            border: r.isClosed ? "1px solid var(--lucid-accent-bd)" : "1px solid var(--lucid-line-2)",
                          }}
                        >
                          <span
                            className="absolute rounded-full transition-transform duration-200"
                            style={{ width: 16, height: 16, top: 3, left: 3, background: "var(--lucid-ink)", transform: r.isClosed ? "translateX(16px)" : "translateX(0)", boxShadow: "var(--lucid-elev-thumb)" }}
                          />
                        </button>
                        <span style={{ fontSize: 13, color: "var(--lucid-ink-2)" }}>This account&apos;s trade is closed</span>
                      </div>

                      {r.isClosed && (
                        <div className="lx-form-grid mt-3">
                          <FieldGroup label="Partial Exit Price">
                            <input type="number" step="any" value={r.partialExit} onChange={e => updateRow(r.key, { partialExit: e.target.value })} placeholder="Optional" className="lx-input lx-input-num" />
                          </FieldGroup>
                          <FieldGroup label="Partial Lot %">
                            <input type="number" value={r.partialPct} onChange={e => updateRow(r.key, { partialPct: e.target.value })} placeholder="25" className="lx-input lx-input-num" />
                          </FieldGroup>
                          <FieldGroup label="Main Exit Price">
                            <input type="number" step="any" value={r.mainExit} onChange={e => updateRow(r.key, { mainExit: e.target.value, mainExitAuto: false })} placeholder="1.0820" className="lx-input lx-input-num" />
                          </FieldGroup>
                          <FieldGroup label="Date Closed">
                            <input type="datetime-local" value={r.dateClosed} onChange={e => updateRow(r.key, { dateClosed: e.target.value })} className="lx-input lx-input-num" />
                          </FieldGroup>
                          <FieldGroup label="Exit Type" full>
                            <select className="lx-input lx-select" value={r.exitType} onChange={e => updateRow(r.key, { exitType: e.target.value as ExitType })}>
                              {(["TP", "SL", "Manual", "Partial+TP", "Partial+SL", "BE"] as ExitType[]).map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </FieldGroup>
                          <FieldGroup label="Net P&amp;L" full>
                            <input type="number" step="any" value={r.netPnl} onChange={e => updateRow(r.key, { netPnl: e.target.value })} placeholder="e.g. 284 or -100" className="lx-input lx-input-num" />
                            <p style={{ fontSize: 10.5, color: "var(--lucid-ink-3)", marginTop: 4 }}>
                              This account&apos;s actual closed P&amp;L. Positive = profit, negative = loss, 0 = break-even. Decides this execution&apos;s outcome.
                            </p>
                          </FieldGroup>
                        </div>
                      )}
                    </div>
                  ))}
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
            <button
              type="button"
              disabled={saving || noAccounts}
              className="lx-btn lx-btn-primary"
              onClick={handleSubmit}
            >
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Trade"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
