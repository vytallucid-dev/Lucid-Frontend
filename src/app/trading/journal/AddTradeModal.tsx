"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Sparkles, Plus, Trash2, Star } from "lucide-react";
import { accountTypeLabel, type Direction, type Conviction, type ExitType, type Trade } from "@/lib/demo-data";
import { isAccountActive } from "@/lib/account-capital";
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
import { toast } from "@/components/toast";
import { ScreenshotUploader } from "@/components/ScreenshotUploader";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useScrollLock } from "@/hooks/useScrollLock";

// The Oracle score is NOT fetched here any more. It used to be read live from
// /api/oracle the moment a pair was picked, which meant the number stored
// against a trade depended on when the form happened to be open rather than on
// when the trade was taken. The server now snapshots the score for the entry
// DATE at write time; this field only shows what was stored and lets the user
// override it. That is also why the pair→endpoint tables that used to live
// here are gone: instrument resolution is the server's job, derived from the
// asset registry, not a list duplicated in the UI.

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

// ─── Field-anchored validation ───────────────────────────────────────────────
//
// Errors attach to the input that caused them, not to a single line in the
// footer. Twelve inputs and one generic message means hunting for what is
// actually wrong.
//
// Keys are the field name for idea-level fields ("planned_sl") and
// "<rowKey>:<field>" for an account row, so two rows can carry different
// errors on the same field at the same time. Wording matches the server's
// rules in trade-validation.ts verbatim — the two repos share no package, so
// the messages are mirrored deliberately rather than diverging quietly.

// A failure carries the same severity the server assigns it. On create every
// failure blocks; on edit only the blocking ones do, and the rest are shown as
// warnings on the field while the save goes through. Without that, a trade that
// is already wrong cannot be corrected — the correction is itself a save.
type FieldSeverity = "blocking" | "advisory";
interface FieldIssue {
  message: string;
  severity: FieldSeverity;
}
type FieldErrors = Record<string, FieldIssue>;

/** Only these three refuse a write on every path — see trade-validation.ts. */
function blocks(issue: FieldIssue, isEdit: boolean): boolean {
  return issue.severity === "blocking" || !isEdit;
}

const RISK_PCT_MIN = 0.01;
const RISK_PCT_MAX = 10;
/** Clock-skew grace on the "not in the future" rules, matching the server. */
const FUTURE_GRACE_MS = 60_000;

function rowKeyFor(rowKey: string, field: string): string {
  return `${rowKey}:${field}`;
}

function stamp(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

/** Parses a numeric input, returning null for blank or non-numeric. */
function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface PlanValues {
  direction: Direction;
  entry: number;
  sl: number;
  firstTp: number | null;
  mainTp: number;
  dateOpened: Date | null;
}

/** Idea-level rules: stop side, target side, first-TP ordering, entry date. */
function validatePlan(v: PlanValues, now: Date): FieldErrors {
  const errors: FieldErrors = {};
  const isBuy = v.direction === "Buy";

  if (v.sl === v.entry) {
    // Blocking on every path: risk is zero, so R is a division by zero.
    errors.planned_sl = {
      severity: "blocking",
      message: `Stop loss cannot equal the entry price — that is zero risk, so R is undefined. Entry and stop are both ${v.entry}.`,
    };
  } else if (isBuy ? v.sl > v.entry : v.sl < v.entry) {
    errors.planned_sl = {
      severity: "advisory",
      message: isBuy
        ? `Stop loss must be below the entry price for a Buy — entry ${v.entry}, stop ${v.sl}. Did you mean this to be a Sell?`
        : `Stop loss must be above the entry price for a Sell — entry ${v.entry}, stop ${v.sl}. Did you mean this to be a Buy?`,
    };
  }

  if (v.mainTp === v.entry) {
    errors.planned_main_tp = {
      severity: "advisory",
      message: `Main TP cannot equal the entry price — there is no reward to target. Entry and target are both ${v.entry}.`,
    };
  } else if (isBuy ? v.mainTp < v.entry : v.mainTp > v.entry) {
    errors.planned_main_tp = {
      severity: "advisory",
      message: isBuy
        ? `Main TP must be above the entry price for a Buy — entry ${v.entry}, target ${v.mainTp}. Did you mean this to be a Sell?`
        : `Main TP must be below the entry price for a Sell — entry ${v.entry}, target ${v.mainTp}. Did you mean this to be a Buy?`,
    };
  }

  if (v.firstTp != null) {
    if (v.firstTp === v.entry) {
      errors.planned_first_tp = {
        severity: "advisory",
        message: `First TP cannot equal the entry price — there is no reward to target. Entry and target are both ${v.entry}.`,
      };
    } else if (isBuy ? v.firstTp < v.entry : v.firstTp > v.entry) {
      errors.planned_first_tp = {
        severity: "advisory",
        message: isBuy
          ? `First TP must be above the entry price for a Buy — entry ${v.entry}, target ${v.firstTp}. Did you mean this to be a Sell?`
          : `First TP must be below the entry price for a Sell — entry ${v.entry}, target ${v.firstTp}. Did you mean this to be a Buy?`,
      };
    } else if (isBuy ? v.firstTp > v.mainTp : v.firstTp < v.mainTp) {
      errors.planned_first_tp = {
        severity: "advisory",
        message: `First TP must come before the main TP — first TP ${v.firstTp} is ${isBuy ? "above" : "below"} the main TP ${v.mainTp}. Swap them, or clear the first TP.`,
      };
    }
  }

  if (v.dateOpened && v.dateOpened.getTime() > now.getTime() + FUTURE_GRACE_MS) {
    errors.date_opened = {
      severity: "advisory",
      message: `Entry date cannot be in the future — you entered ${stamp(v.dateOpened)}, and it is now ${stamp(now)}. Log it in Planned Trades until it fills.`,
    };
  }

  return errors;
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

function FieldGroup({
  label,
  children,
  full,
  error,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  /**
   * Anchors a validation message directly beneath this field's input.
   * `blocking` decides how it reads: a hard error that stops the save, or a
   * warning that will be recorded as a needs-attention flag on the saved trade.
   */
  error?: { message: string; blocking: boolean };
  /** Non-error guidance, hidden while an error is showing. */
  hint?: string;
}) {
  return (
    <div className={full ? "lx-field-full" : undefined}>
      <label className="lx-field-label">{label}</label>
      {children}
      {error ? (
        <p
          className={error.blocking ? "lx-field-error" : undefined}
          style={
            error.blocking
              ? undefined
              : { marginTop: 6, fontFamily: "var(--lucid-font-mono)", fontSize: 10, color: "var(--lucid-warn)" }
          }
        >
          {error.blocking ? error.message : `Will be flagged — ${error.message}`}
        </p>
      ) : hint ? (
        <p style={{ fontSize: 10.5, color: "var(--lucid-ink-3)", marginTop: 4 }}>{hint}</p>
      ) : null}
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
  /** While true, this row's entry price tracks the idea's planned entry (B2). */
  entryPriceAuto: boolean;
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
    entryPriceAuto: true,
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

  const accountList = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
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
  // The stored Oracle entry snapshot, shown so it can be overridden. Blank in
  // create mode: the server takes the snapshot from the entry date on save.
  const [oracleScore, setOracleScore] = useState("");
  // True once the user has typed in the Oracle field, which turns the value
  // into an explicit override rather than "let the server snapshot".
  const [oracleScoreTouched, setOracleScoreTouched] = useState(false);
  const [psychology, setPsychology] = useState("");
  const [notes, setNotes] = useState("");
  const [dateOpened, setDateOpened] = useState("");
  const [screenshots, setScreenshots] = useState<string[]>([]);

  // Execution rows — one per account
  const [rows, setRows] = useState<ExecutionRow[]>([]);
  const [removedExecutionIds, setRemovedExecutionIds] = useState<string[]>([]);

  // Footer error is reserved for failures with no field to point at (a rejected
  // save, a server rule the client cannot pre-check). Everything the client can
  // attribute to an input goes in `fieldErrors` instead.
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  /**
   * The errors as the fields should render them: message plus whether it stops
   * the save on THIS path. Resolved once here so no call site has to know about
   * severity, and so create and edit cannot drift apart.
   */
  const shownErrors = useMemo(() => {
    const out: Record<string, { message: string; blocking: boolean }> = {};
    for (const [key, issue] of Object.entries(fieldErrors)) {
      out[key] = { message: issue.message, blocking: blocks(issue, isEdit) };
    }
    return out;
  }, [fieldErrors, isEdit]);

  /** Failures that will be recorded as flags rather than refusing the save. */
  const advisoryCount = useMemo(
    () => Object.values(fieldErrors).filter((issue) => !blocks(issue, isEdit)).length,
    [fieldErrors, isEdit],
  );

  /** Drops a field's error the moment the user edits that field. */
  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, open);
  useScrollLock(panelRef, open);

  // B1 — the add-trade selector offers ACTIVE accounts only; a Passed, Blown or
  // Closed account can hold history but cannot take a new fill. Derived from
  // isAccountActive (status === "Active") rather than a list of excluded
  // statuses, so a status added later needs no edit here.
  //
  // Edit mode is deliberately exempt and offers every account: a trade already
  // logged against an account that has since closed must stay editable, or an
  // old entry can never be corrected. This is the only account selector in the
  // app that filters at all — the journal/analytics filters, the two cash-flow
  // pickers and account management all still list everything.
  const selectableAccounts = useMemo(
    () => (isEdit ? accountList : accountList.filter(isAccountActive)),
    [accountList, isEdit],
  );

  // What the Oracle field is currently showing, in words. Reads the stored
  // provenance rather than guessing: a legacy value carried over from before
  // dated snapshots existed carries far less weight than a real dated read,
  // and the reader should not have to work out which one they are looking at.
  const oracleSnapshotNote = useMemo(() => {
    if (!editTrade) return "Captured from the entry date when you save — or type a value to override it.";
    switch (editTrade.oracle_score_entry_source) {
      case "snapshot":
        return `Snapshotted from the Oracle for ${editTrade.oracle_score_entry_date}. Editing overrides it.`;
      case "legacy":
        return "Carried over from before dated snapshots existed — it belongs to no particular date.";
      case "manual":
        return "Set by hand on this trade.";
      default:
        return editTrade.oracle_score_entry_date
          ? `No Oracle score existed for ${editTrade.oracle_score_entry_date}.`
          : "No Oracle score stored for this trade.";
    }
  }, [editTrade]);

  // Reset the form each time the modal opens, seeding from editTrade (edit mode)
  // or prefill (create / convert-from-planned).
  useEffect(() => {
    if (!open) return;
    const e = editTrade;
    setPair(e?.pair ?? prefill?.pair ?? "");
    setModel(e?.model ?? prefill?.model ?? "");
    setDirection(e?.direction ?? prefill?.direction ?? "Buy");
    const initialPlannedEntry = e
      ? String(e.planned_entry)
      : prefill?.planned_entry != null
        ? String(prefill.planned_entry)
        : "";
    setPlannedEntry(initialPlannedEntry);
    setPlannedSl(e ? String(e.planned_sl) : prefill?.planned_sl != null ? String(prefill.planned_sl) : "");
    setPlannedFirstTp(e?.planned_first_tp != null ? String(e.planned_first_tp) : prefill?.planned_first_tp != null ? String(prefill.planned_first_tp) : "");
    setPlannedMainTp(e ? String(e.planned_main_tp) : prefill?.planned_main_tp != null ? String(prefill.planned_main_tp) : "");
    setConviction(e?.conviction ?? prefill?.conviction ?? "Medium");
    // Edit mode shows the stored snapshot; create mode stays blank and lets the
    // server snapshot from the entry date on save.
    setOracleScore(e?.oracle_score_at_entry != null ? String(e.oracle_score_at_entry) : "");
    setOracleScoreTouched(false);
    setPsychology(e?.psychology ?? "");
    setNotes(e?.notes ?? "");
    setDateOpened(toLocalDatetimeInput(e?.date_opened ? new Date(e.date_opened) : new Date()));
    setScreenshots(e?.screenshots ?? []);
    setError(null);
    setFieldErrors({});
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
          entryPriceAuto: false, // an existing fill is the real fill, never re-derived
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
      setRows([{ ...blankRow("", true, prefill?.risk_pct), entryPrice: initialPlannedEntry }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fill the dropdown defaults once the lists have loaded (covers the race where
  // the modal opens before queries resolve). Skipped in edit mode (already seeded).
  useEffect(() => {
    if (!open || isEdit) return;
    if (!pair && pairList.length) setPair(prefill?.pair ?? pairList[0].symbol);
    if (!model && modelList.length) setModel(prefill?.model ?? modelList[0].name);
    if (selectableAccounts.length) {
      setRows((rs) => (rs.length === 1 && !rs[0].accountId ? [{ ...rs[0], accountId: selectableAccounts[0].id }] : rs));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pairList, modelList, selectableAccounts]);

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

  const noAccounts = !accountsQuery.isLoading && selectableAccounts.length === 0;
  // Distinguishes "you have no accounts" from "every account you have is
  // closed" — different problems with different fixes.
  const allAccountsInactive = noAccounts && accountList.length > 0;
  const saving =
    createTrade.isPending || updateTrade.isPending || addExecution.isPending || updateExecution.isPending || removeExecution.isPending;

  function updateRow(key: string, patch: Partial<ExecutionRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  /**
   * B2 — the idea's entry price flows down into every account row that has not
   * been given its own, exactly as the planned TP/SL already flow into the exit
   * price. A convenience prefill, not a constraint: real fills slip, and typing
   * a row's own entry detaches it permanently.
   */
  function changePlannedEntry(value: string) {
    setPlannedEntry(value);
    setRows((rs) => rs.map((r) => (r.entryPriceAuto ? { ...r, entryPrice: value } : r)));
    clearFieldError("planned_entry");
    clearFieldError("planned_sl");
    clearFieldError("planned_main_tp");
    clearFieldError("planned_first_tp");
  }
  function addRow() {
    const used = new Set(rows.map((r) => r.accountId));
    const next = selectableAccounts.find((a) => !used.has(a.id))?.id ?? selectableAccounts[0]?.id ?? "";
    // A row added mid-session inherits the planned entry immediately (B2)
    // rather than one render later when the effect happens to run.
    setRows((rs) => [...rs, { ...blankRow(next, false), entryPrice: plannedEntry }]);
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

  /**
   * Every rule, each anchored to the input that broke it. Returns the full map
   * rather than stopping at the first problem, so one save surfaces everything
   * that needs fixing instead of one thing at a time.
   */
  function validate(): FieldErrors {
    const now = new Date();
    const errors: FieldErrors = {};

    const entryNum = numOrNull(plannedEntry);
    const slNum = numOrNull(plannedSl);
    const mainTpNum = numOrNull(plannedMainTp);
    const firstTpNum = numOrNull(plannedFirstTp);
    const openedAt = dateOpened ? new Date(dateOpened) : null;
    const openedValid = openedAt != null && !Number.isNaN(openedAt.getTime());

    if (entryNum == null) errors.planned_entry = { severity: "blocking", message: "Entry price is required — the price the plan was built around." };
    if (slNum == null) errors.planned_sl = { severity: "blocking", message: "Stop loss is required — it is the level that says the idea was wrong." };
    if (mainTpNum == null) errors.planned_main_tp = { severity: "blocking", message: "Main TP is required — without a target there is no expected R." };
    if (plannedFirstTp.trim() !== "" && firstTpNum == null) {
      errors.planned_first_tp = { severity: "blocking", message: "First TP must be a number, or left blank." };
    }
    if (dateOpened && !openedValid) {
      errors.date_opened = { severity: "blocking", message: "Entry date is not a valid date and time." };
    }

    // Side-of-entry and ordering rules only mean anything once the prices parse.
    if (entryNum != null && slNum != null && mainTpNum != null) {
      Object.assign(
        errors,
        validatePlan(
          {
            direction,
            entry: entryNum,
            sl: slNum,
            firstTp: firstTpNum,
            mainTp: mainTpNum,
            dateOpened: openedValid ? openedAt : null,
          },
          now,
        ),
      );
    } else if (openedValid && openedAt.getTime() > now.getTime() + FUTURE_GRACE_MS) {
      errors.date_opened = { severity: "advisory", message: "Entry date cannot be in the future — you entered " + stamp(openedAt) + ", and it is now " + stamp(now) + ". Log it in Planned Trades until it fills." };
    }

    for (const r of rows) {
      const k = (field: string): string => rowKeyFor(r.key, field);
      if (!r.accountId) {
        errors[k("account_id")] = { severity: "blocking", message: "Pick the account this fill went into." };
      }

      const risk = numOrNull(r.riskPct);
      if (risk == null) {
        errors[k("risk_pct")] = { severity: "blocking", message: "Risk % is required — it is what turns this fill into R." };
      } else if (risk < RISK_PCT_MIN) {
        errors[k("risk_pct")] = { severity: "advisory", message: `Risk % must be at least ${RISK_PCT_MIN} — you entered ${risk}. A trade risking nothing has no R to measure.` };
      } else if (risk > RISK_PCT_MAX) {
        errors[k("risk_pct")] = { severity: "advisory", message: `Risk % must be at most ${RISK_PCT_MAX} — you entered ${risk}. If you meant ${risk / 10}%, drop a digit.` };
      }

      const lot = numOrNull(r.lotSize);
      if (lot == null) errors[k("lot_size")] = { severity: "blocking", message: "Lot size is required — what this fill was actually sized at." };
      else if (lot <= 0) errors[k("lot_size")] = { severity: "blocking", message: `Lot size must be greater than 0 — you entered ${lot}.` };

      if (numOrNull(r.entryPrice) == null) {
        errors[k("entry_price")] = { severity: "blocking", message: "Entry price is required — the price this account actually filled at." };
      }

      if (r.isClosed) {
        const exit = numOrNull(r.mainExit);
        if (exit == null) {
          // Blocking on every path: with no exit price there are no pips, no R
          // and no outcome — the fill cannot be resolved at all.
          errors[k("main_exit_price")] = {
            severity: "blocking",
            message:
              "Exit price is required to mark this account closed — enter the price it actually exited at, or switch the trade back to open.",
          };
        }

        const partialPrice = numOrNull(r.partialExit);
        const partialPct = numOrNull(r.partialPct);
        if (partialPrice != null && partialPct == null) {
          errors[k("partial_exit_lot_pct")] = { severity: "advisory", message: `Partial exit price ${partialPrice} needs a partial lot % — how much of the position came off there.` };
        }
        if (partialPct != null && partialPrice == null) {
          errors[k("partial_exit_price")] = { severity: "advisory", message: `Partial lot ${partialPct}% needs a partial exit price — the price that portion came off at.` };
        }
        if (partialPct != null && (partialPct <= 0 || partialPct > 100)) {
          errors[k("partial_exit_lot_pct")] = { severity: "advisory", message: `Partial lot % must be between 0 and 100 — you entered ${partialPct}.` };
        }

        const closedAt = r.dateClosed ? new Date(r.dateClosed) : null;
        if (r.dateClosed && (closedAt == null || Number.isNaN(closedAt.getTime()))) {
          errors[k("date_closed")] = { severity: "blocking", message: "Exit date is not a valid date and time." };
        } else if (closedAt != null && !Number.isNaN(closedAt.getTime())) {
          if (closedAt.getTime() > now.getTime() + FUTURE_GRACE_MS) {
            errors[k("date_closed")] = { severity: "advisory", message: "Exit date cannot be in the future — you entered " + stamp(closedAt) + ", and it is now " + stamp(now) + "." };
          } else if (openedValid && closedAt.getTime() < openedAt.getTime()) {
            // Advisory: correcting a mistyped exit year requires saving the row,
            // so refusing that save would make the typo permanent.
            errors[k("date_closed")] = { severity: "advisory", message: "Exit date cannot be before the entry date — opened " + stamp(openedAt) + ", closed " + stamp(closedAt) + "." };
          }
        }
      }
    }

    return errors;
  }

  async function handleSubmit() {
    setError(null);
    const found = validate();
    setFieldErrors(found);

    // Create: everything blocks — a hand-entered trade should be right the
    // first time. Edit: only the blocking failures stop the save; the rest are
    // left on the fields as warnings and the trade saves flagged, so an
    // already-wrong trade can be corrected one field at a time.
    const blocking = Object.values(found).filter((issue) => blocks(issue, isEdit));
    if (blocking.length > 0) {
      const n = blocking.length;
      setError(`${n} field${n === 1 ? "" : "s"} to fix — see the highlighted inputs.`);
      panelRef.current?.querySelector(".lx-field-error")?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    const plannedEntryNum = parseFloat(plannedEntry);
    const plannedSlNum = parseFloat(plannedSl);
    const plannedMainTpNum = parseFloat(plannedMainTp);

    const ideaBody = {
      model: model || (modelList[0]?.name ?? ""),
      pair: pair || (pairList[0]?.symbol ?? ""),
      direction,
      planned_entry: plannedEntryNum,
      planned_sl: plannedSlNum,
      planned_first_tp: plannedFirstTp ? parseFloat(plannedFirstTp) : null,
      planned_main_tp: plannedMainTpNum,
      conviction,
      // Omitting the key asks the server to snapshot the score for the entry
      // date; sending it is an explicit override. On create the field starts
      // blank, so a blank field means "snapshot it" and the key is left out
      // entirely — sending null would suppress the snapshot instead. On edit
      // the field starts seeded with what is stored, so a blank field is a
      // deliberate clear and null is exactly right.
      ...(isEdit
        ? { oracle_score_at_entry: oracleScore !== "" ? parseInt(oracleScore, 10) : null }
        : oracleScore !== ""
          ? { oracle_score_at_entry: parseInt(oracleScore, 10) }
          : {}),
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
                {allAccountsInactive
                  ? "Every account is Passed, Blown or Closed. Reopen one, or add a new account in the Accounts tab, before logging a trade. Trades already logged against a closed account still show in the journal and can still be edited."
                  : "You need at least one account before logging a trade. Add one in the Accounts tab."}
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
                      onChange={(d) => {
                        setDirection(d);
                        // Direction decides which side of entry the stop and
                        // targets belong on, so flipping it invalidates those
                        // three errors rather than leaving them stale.
                        clearFieldError("planned_sl");
                        clearFieldError("planned_main_tp");
                        clearFieldError("planned_first_tp");
                      }}
                      colorMap={{
                        Buy: { active: "var(--lucid-pos)", bg: "var(--lucid-pos-bg)" },
                        Sell: { active: "var(--lucid-neg)", bg: "var(--lucid-neg-bg)" },
                      }}
                    />
                  </FieldGroup>

                  <FieldGroup
                    label="Date Opened"
                    error={shownErrors.date_opened}
                    hint="The Oracle score is snapshotted for this date when you save."
                  >
                    <input
                      type="datetime-local"
                      value={dateOpened}
                      onChange={e => { setDateOpened(e.target.value); clearFieldError("date_opened"); }}
                      className="lx-input lx-input-num"
                    />
                  </FieldGroup>
                </div>
              </div>

              {/* Group 2: Prices (the plan — shared across every account) */}
              <div>
                <GroupHeader>Prices</GroupHeader>
                <div className="lx-form-grid">
                  <FieldGroup label="Entry Price" error={shownErrors.planned_entry}>
                    <input type="number" step="any" value={plannedEntry} onChange={e => changePlannedEntry(e.target.value)} placeholder="1.0865" className="lx-input lx-input-num" />
                  </FieldGroup>
                  <FieldGroup label="Stop Loss" error={shownErrors.planned_sl}>
                    <input type="number" step="any" value={plannedSl} onChange={e => { setPlannedSl(e.target.value); clearFieldError("planned_sl"); }} placeholder="1.0905" className="lx-input lx-input-num" />
                  </FieldGroup>
                  <FieldGroup label="First TP (optional)" error={shownErrors.planned_first_tp}>
                    <input type="number" step="any" value={plannedFirstTp} onChange={e => { setPlannedFirstTp(e.target.value); clearFieldError("planned_first_tp"); }} placeholder="1.0825" className="lx-input lx-input-num" />
                  </FieldGroup>
                  <FieldGroup label="Main TP" error={shownErrors.planned_main_tp}>
                    <input type="number" step="any" value={plannedMainTp} onChange={e => { setPlannedMainTp(e.target.value); clearFieldError("planned_main_tp"); }} placeholder="1.0780" className="lx-input lx-input-num" />
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
                      Oracle Score
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={oracleScore}
                      onChange={e => { setOracleScore(e.target.value); setOracleScoreTouched(true); }}
                      placeholder={isEdit ? "No score" : "Snapshotted on save"}
                      className="lx-input lx-input-num"
                    />
                    <p style={{ fontSize: 10.5, color: "var(--lucid-ink-3)", marginTop: 4 }}>
                      {oracleScoreTouched
                        ? "Manual override — this exact value is stored."
                        : oracleSnapshotNote}
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
                        <FieldGroup label="Account" error={shownErrors[rowKeyFor(r.key, "account_id")]}>
                          <select
                            className="lx-input lx-select"
                            value={r.accountId}
                            onChange={e => { updateRow(r.key, { accountId: e.target.value }); clearFieldError(rowKeyFor(r.key, "account_id")); }}
                          >
                            {selectableAccounts.length === 0 && <option value="">No accounts</option>}
                            {selectableAccounts.map(a => (
                              <option key={a.id} value={a.id}>{a.account_name} ({accountTypeLabel(a.account_type)})</option>
                            ))}
                          </select>
                        </FieldGroup>
                        <FieldGroup label="Risk %" error={shownErrors[rowKeyFor(r.key, "risk_pct")]}>
                          <input type="number" step="0.1" value={r.riskPct} onChange={e => { updateRow(r.key, { riskPct: e.target.value }); clearFieldError(rowKeyFor(r.key, "risk_pct")); }} placeholder="1.0" className="lx-input lx-input-num" />
                        </FieldGroup>
                        <FieldGroup label="Lot Size" error={shownErrors[rowKeyFor(r.key, "lot_size")]}>
                          <input type="number" step="any" value={r.lotSize} onChange={e => { updateRow(r.key, { lotSize: e.target.value }); clearFieldError(rowKeyFor(r.key, "lot_size")); }} placeholder="0.45" className="lx-input lx-input-num" />
                        </FieldGroup>
                        <FieldGroup
                          label="Entry Price"
                          error={shownErrors[rowKeyFor(r.key, "entry_price")]}
                          hint={r.entryPriceAuto && r.entryPrice ? "Filled from the plan — edit if this account filled elsewhere." : undefined}
                        >
                          {/* B2: typing here detaches the row from the plan, the
                              same way typing an exit price detaches it below. */}
                          <input type="number" step="any" value={r.entryPrice} onChange={e => { updateRow(r.key, { entryPrice: e.target.value, entryPriceAuto: false }); clearFieldError(rowKeyFor(r.key, "entry_price")); }} placeholder="1.0865" className="lx-input lx-input-num" />
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
                          <FieldGroup label="Partial Exit Price" error={shownErrors[rowKeyFor(r.key, "partial_exit_price")]}>
                            <input type="number" step="any" value={r.partialExit} onChange={e => { updateRow(r.key, { partialExit: e.target.value }); clearFieldError(rowKeyFor(r.key, "partial_exit_price")); clearFieldError(rowKeyFor(r.key, "partial_exit_lot_pct")); }} placeholder="Optional" className="lx-input lx-input-num" />
                          </FieldGroup>
                          <FieldGroup label="Partial Lot %" error={shownErrors[rowKeyFor(r.key, "partial_exit_lot_pct")]}>
                            <input type="number" value={r.partialPct} onChange={e => { updateRow(r.key, { partialPct: e.target.value }); clearFieldError(rowKeyFor(r.key, "partial_exit_lot_pct")); clearFieldError(rowKeyFor(r.key, "partial_exit_price")); }} placeholder="25" className="lx-input lx-input-num" />
                          </FieldGroup>
                          <FieldGroup label="Main Exit Price" error={shownErrors[rowKeyFor(r.key, "main_exit_price")]}>
                            <input type="number" step="any" value={r.mainExit} onChange={e => { updateRow(r.key, { mainExit: e.target.value, mainExitAuto: false }); clearFieldError(rowKeyFor(r.key, "main_exit_price")); }} placeholder="1.0820" className="lx-input lx-input-num" />
                          </FieldGroup>
                          <FieldGroup
                            label="Date Closed"
                            error={shownErrors[rowKeyFor(r.key, "date_closed")]}
                            hint="The exit-side Oracle score is snapshotted for this date."
                          >
                            <input type="datetime-local" value={r.dateClosed} onChange={e => { updateRow(r.key, { dateClosed: e.target.value }); clearFieldError(rowKeyFor(r.key, "date_closed")); }} className="lx-input lx-input-num" />
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
            {error ? (
              <span className="lx-field-error mr-auto">{error}</span>
            ) : advisoryCount > 0 ? (
              /* Edit path only: these do not stop the save, so say what saving
                 will do rather than pretending nothing is wrong. */
              <span
                className="mr-auto"
                style={{ fontFamily: "var(--lucid-font-mono)", fontSize: 10, color: "var(--lucid-warn)" }}
              >
                Saves with {advisoryCount} {advisoryCount === 1 ? "issue" : "issues"} — the trade will be flagged as
                needing attention and left out of your statistics until fixed.
              </span>
            ) : null}
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
