"use client";

import { useMemo, useState } from "react";
import { Layers, ChevronUp, ChevronDown, ChevronsUpDown, Columns3, RotateCcw, Check } from "lucide-react";
import { type Trade, pairs, formatCurrency, formatDate } from "@/lib/demo-data";
import { getPrimaryExecution, isExecutionOpen, tradeAccountCount } from "@/lib/trade-helpers";
import { formatOracleScore, formatRr, oracleEntryTitle, realisedRr } from "@/lib/journal-format";
import { isTradeFlagged } from "@/lib/stats";
import { IntegrityMarker } from "./IntegrityMarker";
import { useJournalColumns, beginColumnResize } from "./useJournalColumns";

// ── Badges ───────────────────────────────────────────────────────────────────
//
// Every badge is inline-flex, shrink-0 and nowrap. A badge sizes to its content
// and is never allowed to wrap or compress — a two-line "↓ Sell" breaks the row
// height for the whole table, which is exactly what a too-narrow Dir column
// caused. The column widths below are set from the widest content each badge
// can hold, so the nowrap never has to fight the layout.

const BADGE_BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  flexShrink: 0,
  whiteSpace: "nowrap",
};

function Badge({
  children,
  bg,
  color,
  border,
  title,
}: {
  children: React.ReactNode;
  bg: string;
  color: string;
  border: string;
  title?: string;
}) {
  return (
    <span
      className="pill"
      title={title}
      style={{ ...BADGE_BASE, background: bg, color, border: `1px solid ${border}` }}
    >
      {children}
    </span>
  );
}

const NEUTRAL = { bg: "var(--lucid-surface-3)", color: "var(--lucid-ink-2)", border: "var(--lucid-line-2)" };

function ModelPill({ model }: { model: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    "4HPullBack": { bg: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "var(--lucid-accent-bd)" },
    Breakout: { bg: "var(--lucid-ctx-bg)", color: "var(--lucid-ctx)", border: "var(--lucid-ctx-bd)" },
  };
  const s = styles[model] ?? NEUTRAL;
  return <Badge {...s} title={model}>{model}</Badge>;
}

function DirectionPill({ direction }: { direction: string }) {
  const isBuy = direction === "Buy";
  return (
    <Badge
      bg={isBuy ? "var(--lucid-pos-bg)" : "var(--lucid-neg-bg)"}
      color={isBuy ? "var(--lucid-pos)" : "var(--lucid-neg)"}
      border={isBuy ? "var(--lucid-pos-bd)" : "var(--lucid-neg-bd)"}
    >
      {isBuy ? "↑" : "↓"} {direction}
    </Badge>
  );
}

function ExitTypePill({ type }: { type: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    TP: { bg: "var(--lucid-pos-bg)", color: "var(--lucid-pos)", border: "var(--lucid-pos-bd)" },
    "Partial+TP": { bg: "var(--lucid-pos-bg)", color: "var(--lucid-pos)", border: "var(--lucid-pos-bd)" },
    SL: { bg: "var(--lucid-neg-bg)", color: "var(--lucid-neg)", border: "var(--lucid-neg-bd)" },
    "Partial+SL": { bg: "var(--lucid-neg-bg)", color: "var(--lucid-neg)", border: "var(--lucid-neg-bd)" },
    Manual: { bg: "var(--lucid-warn-bg)", color: "var(--lucid-warn)", border: "var(--lucid-warn-bd)" },
  };
  return <Badge {...(map[type] ?? NEUTRAL)}>{type}</Badge>;
}

function ConvictionPill({ conviction }: { conviction: string }) {
  if (conviction === "High") {
    return (
      <Badge bg="var(--lucid-accent-bg)" color="var(--lucid-accent)" border="var(--lucid-accent-bd)">
        High
      </Badge>
    );
  }
  const dim = conviction === "Low";
  return (
    <Badge
      bg="var(--lucid-surface-3)"
      color={dim ? "var(--lucid-ink-3)" : "var(--lucid-ink-2)"}
      border={dim ? "var(--lucid-line)" : "var(--lucid-line-2)"}
    >
      {conviction}
    </Badge>
  );
}

function PairCell({ pair }: { pair: string }) {
  const config = pairs.find((p) => p.symbol === pair);
  return (
    <span style={{ ...BADGE_BASE, gap: 5, minWidth: 0 }}>
      {config && <span style={{ flexShrink: 0 }}>{config.flag_a}{config.flag_b}</span>}
      <span style={{ color: "var(--lucid-ink)", fontWeight: 500, whiteSpace: "nowrap" }}>
        {config?.display_name ?? pair}
      </span>
    </span>
  );
}

/** How many accounts this idea was executed across — a small badge so a
 * multi-account idea is visible at a glance. Not shown for single-account ideas. */
function AccountsBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <Badge
      bg="var(--lucid-ctx-bg)"
      color="var(--lucid-ctx)"
      border="var(--lucid-ctx-bd)"
      title={`Executed across ${count} accounts`}
    >
      <Layers size={10} /> {count}
    </Badge>
  );
}

// ── Sorting ──────────────────────────────────────────────────────────────────
//
// Each column declares how to reduce a row to something comparable. A column
// with no `sortValue` is simply not sortable, which is how "not on free text"
// is expressed — as the absence of a rule, not a list of exclusions.
//
// Nulls always sink to the bottom, in both directions: an open trade has no
// exit, no distance and no P&L, and a trade with no Oracle score has no score.
// Letting those float to the top on a descending sort would bury exactly the
// rows the sort was meant to surface.

type SortDirection = "asc" | "desc";
type SortValue = string | number | null;

interface Column {
  key: string;
  label: string;
  /**
   * Set from the widest content the column can hold — the longest badge label,
   * or a full-precision number at tabular width — so nothing ever wraps. See
   * the note against each non-obvious one.
   */
  width: number;
  /** Numeric columns right-align and render in tabular mono. */
  numeric?: boolean;
  /** Absent ⇒ this column cannot be sorted. */
  sortValue?: (row: Row) => SortValue;
  /** First click on this column sorts this way; the default is descending. */
  firstDirection?: SortDirection;
  title?: string;
  /** Cannot be hidden — the row stops being identifiable without it. */
  required?: boolean;
  /**
   * How this column draws a cell. Living on the column definition is what lets
   * the body follow the visible set: hiding a column removes its header, its
   * <col> and its cells together, with no third place to keep in step.
   */
  render: (row: Row) => React.ReactNode;
  /** Extra cell style on top of the numeric/text default. */
  cellStyle?: (row: Row) => React.CSSProperties;
}

/** A table row: the idea, plus everything read off its primary execution once. */
interface Row {
  trade: Trade;
  accountName: string;
  isLive: boolean;
  exitPrice: number | null;
  pips: number | null;
  realisedR: number | null;
  pnl: number | null;
  exitType: string | null;
  accountCount: number;
}

const CONVICTION_RANK: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

const COLUMNS: Column[] = [
  {
    key: "date", label: "Date", width: 96, required: true,
    sortValue: (r) => new Date(r.trade.date_opened).getTime(),
    cellStyle: () => ({ fontFamily: "var(--lucid-font-mono)", color: "var(--lucid-ink-2)" }),
    render: (r) => formatDate(r.trade.date_opened).replace(/, \d{4}$/, ""),
  },
  {
    // Two flag glyphs + "EUR/USD" + the multi-account badge + the danger glyph.
    key: "pair", label: "Pair", width: 132, required: true,
    sortValue: (r) => r.trade.pair, firstDirection: "asc",
    render: (r) => (
      <span style={{ ...BADGE_BASE, gap: 6 }}>
        <PairCell pair={r.trade.pair} />
        <AccountsBadge count={r.accountCount} />
        <IntegrityMarker trade={r.trade} />
      </span>
    ),
  },
  {
    // Longest seeded model name is "4HPullBack".
    key: "model", label: "Model", width: 128,
    sortValue: (r) => r.trade.model, firstDirection: "asc",
    render: (r) => <ModelPill model={r.trade.model} />,
  },
  {
    // "↓ Sell" + arrow + gap + 1px border + pill padding. 70 wrapped.
    key: "direction", label: "Dir", width: 92,
    sortValue: (r) => r.trade.direction, firstDirection: "asc",
    render: (r) => <DirectionPill direction={r.trade.direction} />,
  },
  {
    key: "account", label: "Account", width: 132,
    sortValue: (r) => r.accountName, firstDirection: "asc",
    cellStyle: () => ({ color: "var(--lucid-ink-2)", textOverflow: "ellipsis" }),
    render: (r) => r.accountName,
  },
  {
    // Six significant figures at tabular width, e.g. 5124.000 / 155.730.
    key: "planned_entry", label: "Entry", width: 104, numeric: true,
    sortValue: (r) => r.trade.planned_entry,
    title: "The idea's planned entry price — the plan, not the fill. Each account's actual fill is in the drawer.",
    cellStyle: () => ({ color: "var(--lucid-ink)" }),
    render: (r) => r.trade.planned_entry,
  },
  {
    key: "exit", label: "Exit", width: 104, numeric: true,
    sortValue: (r) => r.exitPrice,
    cellStyle: (r) => ({ color: r.isLive ? "var(--lucid-ink-3)" : "var(--lucid-ink)" }),
    render: (r) => r.exitPrice ?? "—",
  },
  {
    key: "pips", label: "Pips", width: 84, numeric: true,
    sortValue: (r) => r.pips,
    title: "Pips for forex; whole points for indices and metals.",
    cellStyle: (r) => ({ fontWeight: 600, color: r.pips == null ? "var(--lucid-ink-3)" : signColor(r.pips) }),
    render: (r) => (r.pips == null ? "—" : r.pips > 0 ? `+${r.pips}` : `${r.pips}`),
  },
  {
    key: "expected_rr", label: "Exp R", width: 80, numeric: true,
    sortValue: (r) => r.trade.expected_rr,
    title: "Planned reward divided by planned risk, from the idea's entry, stop and main target.",
    cellStyle: (r) => ({ color: r.trade.expected_rr == null ? "var(--lucid-ink-3)" : "var(--lucid-ink-2)" }),
    render: (r) => formatRr(r.trade.expected_rr),
  },
  {
    key: "realised_rr", label: "R", width: 80, numeric: true,
    sortValue: (r) => r.realisedR,
    title: "Realised R: distance achieved divided by distance risked.",
    cellStyle: (r) => ({ fontWeight: 600, color: r.realisedR == null ? "var(--lucid-ink-3)" : signColor(r.realisedR) }),
    render: (r) => formatRr(r.realisedR),
  },
  {
    // Signed, at most two digits.
    key: "oracle", label: "Oracle", width: 84, numeric: true,
    sortValue: (r) => r.trade.oracle_score_at_entry,
    title: "The Oracle score for this pair on the entry date, frozen when the trade was logged.",
    cellStyle: (r) => ({ color: r.trade.oracle_score_at_entry == null ? "var(--lucid-ink-3)" : "var(--lucid-ink-2)" }),
    render: (r) => <span title={oracleEntryTitle(r.trade)}>{formatOracleScore(r.trade.oracle_score_at_entry)}</span>,
  },
  {
    key: "pnl", label: "P&L", width: 112, numeric: true,
    sortValue: (r) => r.pnl,
    render: (r) =>
      r.isLive ? (
        <span style={{ ...BADGE_BASE, justifyContent: "flex-end", width: "100%", color: "var(--lucid-accent)", fontWeight: 700, gap: 6 }}>
          <span className="pulse-live" style={{ background: "var(--lucid-accent)", display: "inline-block", width: 6, height: 6, borderRadius: "50%" }} />
          Live
        </span>
      ) : (
        <span style={{ fontWeight: 700, color: signColor(r.pnl ?? 0) }}>{formatCurrency(r.pnl ?? 0)}</span>
      ),
  },
  {
    // Longest exit type is "Partial+SL".
    key: "exit_type", label: "Exit Type", width: 116,
    sortValue: (r) => r.exitType, firstDirection: "asc",
    render: (r) => (r.exitType ? <ExitTypePill type={r.exitType} /> : null),
  },
  {
    key: "conviction", label: "Conviction", width: 104,
    sortValue: (r) => CONVICTION_RANK[r.trade.conviction] ?? 0,
    render: (r) => <ConvictionPill conviction={r.trade.conviction} />,
  },
];

/** Default layout, used by the loading skeleton — real widths come from the
 * user's stored preferences once the table mounts. */
export const JOURNAL_TABLE_SKELETON_COLUMNS = [4, ...COLUMNS.map((c) => c.width)];
export const JOURNAL_TABLE_MIN_WIDTH = 4 + COLUMNS.reduce((sum, c) => sum + c.width, 0);

/** Positive green, negative red, flat neutral — the one rule for signed values. */
function signColor(n: number): string {
  return n > 0 ? "var(--lucid-pos)" : n < 0 ? "var(--lucid-neg)" : "var(--lucid-ink-2)";
}

function compare(a: SortValue, b: SortValue, direction: SortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // nulls last, whichever way the column is pointing
  if (b === null) return -1;
  const sign = direction === "asc" ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * sign;
  return String(a).localeCompare(String(b)) * sign;
}

// ── Cell and header styling ──────────────────────────────────────────────────
//
// One rule, applied consistently: numbers are right-aligned tabular mono, text
// and badges are left. Headers align to their own column so the label sits over
// the digits it names. Nothing wraps anywhere.

const GUTTER = 12;
const ROW_HEIGHT = 46;

const TH_BASE: React.CSSProperties = {
  padding: `9px ${GUTTER}px`,
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--lucid-ink-3)",
  whiteSpace: "nowrap",
  userSelect: "none",
  background: "var(--lucid-surface-2)",
};

const TD_BASE: React.CSSProperties = {
  padding: `0 ${GUTTER}px`,
  height: ROW_HEIGHT,
  fontSize: 13,
  whiteSpace: "nowrap",
  overflow: "hidden",
};

const TD_NUM: React.CSSProperties = {
  ...TD_BASE,
  textAlign: "right",
  fontFamily: "var(--lucid-font-mono)",
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-0.01em",
};

/**
 * The 5px grab strip on a column's trailing edge. Sits inside the header cell,
 * full height, and stops the pointer-down from reaching the sort button beneath
 * it — otherwise every resize would also re-sort the table.
 */
function ResizeHandle({ width, onWidth }: { width: number; onWidth: (w: number) => void }) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      className="lx-col-resize"
      onPointerDown={(e) => beginColumnResize(e, width, onWidth)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function SortHeader({
  column,
  active,
  direction,
  onSort,
  width,
  onWidth,
}: {
  column: Column;
  active: boolean;
  direction: SortDirection;
  onSort: (key: string) => void;
  width: number;
  onWidth: (w: number) => void;
}) {
  const align = column.numeric ? "flex-end" : "flex-start";
  if (!column.sortValue) {
    return (
      <th
        scope="col"
        style={{ ...TH_BASE, textAlign: column.numeric ? "right" : "left", position: "relative" }}
        title={column.title}
      >
        {column.label}
        <ResizeHandle width={width} onWidth={onWidth} />
      </th>
    );
  }
  // Only the active column carries a direction; the rest show a neutral glyph
  // that surfaces on hover, so fourteen icons do not compete for attention.
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ChevronUp : ChevronDown;
  return (
    <th
      scope="col"
      style={{ ...TH_BASE, padding: 0, position: "relative" }}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        title={column.title ?? `Sort by ${column.label}`}
        className="lx-th-sort"
        style={{
          ...TH_BASE,
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 5,
          justifyContent: align,
          border: "none",
          cursor: "pointer",
          color: active ? "var(--lucid-ink)" : "var(--lucid-ink-3)",
        }}
      >
        {column.label}
        <Icon
          size={11}
          aria-hidden
          style={{
            flexShrink: 0,
            opacity: active ? 1 : 0,
            transition: "opacity 120ms ease",
            color: active ? "var(--lucid-accent)" : "currentColor",
          }}
          className={active ? undefined : "lx-th-sort-idle"}
        />
      </button>
      <ResizeHandle width={width} onWidth={onWidth} />
    </th>
  );
}

/**
 * Which columns are on screen. A journal is a workspace — what matters depends
 * on what you are looking for — so the set is the user's, stored locally, and
 * the table widens and scrolls rather than compressing to fit.
 */
export function ColumnMenu() {
  // No props and no context: the menu reads the same external store the table
  // does, so the two stay in step wherever each is rendered. That is what lets
  // this button live up in the page's controls bar while the table it governs
  // sits further down.
  const api = useJournalColumns(COLUMNS);
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
        style={{
          background: open ? "var(--lucid-surface-3)" : "var(--lucid-surface)",
          border: "1px solid var(--lucid-line)",
          color: "var(--lucid-ink-2)",
        }}
      >
        <Columns3 size={12} /> Columns
        {api.hiddenCount > 0 && (
          <span style={{ color: "var(--lucid-accent)", fontVariantNumeric: "tabular-nums" }}>
            {api.visibleKeys.length}/{COLUMNS.length}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-away target, behind the panel. */}
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div
            className="lt-modal-enter"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 50,
              minWidth: 210,
              padding: 6,
              borderRadius: 10,
              background: "var(--lucid-grad-surface-2)",
              border: "1px solid var(--lucid-line-2)",
              boxShadow: "var(--lucid-elev-2)",
            }}
          >
            {COLUMNS.map((c) => {
              const on = api.isVisible(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={c.required}
                  onClick={() => api.toggleVisible(c.key)}
                  className="lx-menu-row"
                  title={c.required ? "Always shown" : undefined}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "none",
                    background: "transparent",
                    fontSize: 12.5,
                    textAlign: "left",
                    color: c.required ? "var(--lucid-ink-3)" : on ? "var(--lucid-ink)" : "var(--lucid-ink-3)",
                    cursor: c.required ? "default" : "pointer",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      flexShrink: 0,
                      background: on ? "var(--lucid-accent-bg)" : "transparent",
                      border: `1px solid ${on ? "var(--lucid-accent-bd)" : "var(--lucid-line-2)"}`,
                      color: "var(--lucid-accent)",
                    }}
                  >
                    {on && <Check size={10} strokeWidth={3} />}
                  </span>
                  {c.label}
                </button>
              );
            })}
            <div style={{ borderTop: "1px solid var(--lucid-line)", margin: "6px 0 4px" }} />
            {api.hiddenCount > 0 && (
              <button
                type="button"
                onClick={api.showAll}
                className="lx-menu-row"
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 8px",
                  borderRadius: 6, border: "none", background: "transparent", fontSize: 12,
                  textAlign: "left", color: "var(--lucid-ink-2)", cursor: "pointer",
                }}
              >
                <Check size={11} /> Show all {COLUMNS.length} columns
              </button>
            )}
            <button
              type="button"
              onClick={() => { api.reset(); setOpen(false); }}
              className="lx-menu-row"
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 8px",
                borderRadius: 6, border: "none", background: "transparent", fontSize: 12,
                textAlign: "left", color: "var(--lucid-ink-3)", cursor: "pointer",
              }}
            >
              <RotateCcw size={11} /> Reset widths &amp; columns
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// A row is an idea. Exit/distance/R/P&L come from the PRIMARY execution — or,
// when `trades` has been pre-filtered to one account (see the Journal page's
// account filter), from that account's own single execution: getPrimaryExecution
// falls back to the only execution present, so both cases resolve correctly
// with no special-casing here.
//
// Expected R and the Oracle entry score belong to the idea, not to a fill, so
// they are the same whichever account is in view.
export function JournalTable({
  trades,
  onRowClick,
  accountNames,
}: {
  trades: Trade[];
  onRowClick: (t: Trade) => void;
  /** account_id → display name, for the Account column. */
  accountNames?: Map<string, string>;
}) {
  // Newest first, matching how the journal has always opened.
  const [sort, setSort] = useState<{ key: string; direction: SortDirection }>({
    key: "date",
    direction: "desc",
  });

  // Width and visibility are the user's, persisted locally. Until the stored
  // preferences are read the defaults render, so the server and client markup
  // agree on the first paint.
  const cols = useJournalColumns(COLUMNS);
  const shown = useMemo(() => COLUMNS.filter((c) => cols.isVisible(c.key)), [cols]);
  const tableWidth = useMemo(
    () => 4 + shown.reduce((sum, c) => sum + cols.widthOf(c.key), 0),
    [shown, cols],
  );

  const rows = useMemo<Row[]>(
    () =>
      trades.map((trade) => {
        const primary = getPrimaryExecution(trade);
        const isLive = !primary || isExecutionOpen(primary);
        return {
          trade,
          accountName: primary ? (accountNames?.get(primary.account_id) ?? "—") : "—",
          isLive,
          exitPrice: !isLive && primary ? primary.main_exit_price : null,
          pips: !isLive && primary ? primary.total_pips : null,
          realisedR: primary ? realisedRr(primary) : null,
          pnl: !isLive && primary ? primary.blended_pnl : null,
          exitType: primary ? primary.exit_type : null,
          accountCount: tradeAccountCount(trade),
        };
      }),
    [trades, accountNames],
  );

  const sortedRows = useMemo(() => {
    const column = COLUMNS.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const read = column.sortValue;
    // Sort a copy — `rows` is derived from props and must not be mutated.
    return [...rows].sort((a, b) => compare(read(a), read(b), sort.direction));
  }, [rows, sort]);

  function handleSort(key: string) {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      const column = COLUMNS.find((c) => c.key === key);
      return { key, direction: column?.firstDirection ?? "desc" };
    });
  }

  return (
    <div className="lx-card" style={{ padding: 0, overflow: "hidden" }}>
      {/*
        Fourteen columns do not fit a laptop, and compressing them to fit would
        wrap badges and truncate prices — the thing this table must never do.
        So the table keeps its natural width and pans sideways INSIDE this
        container: the page itself never scrolls horizontally.
      */}
      <div className="overflow-x-auto" style={{ overscrollBehaviorX: "contain" }}>
        <table
          className="w-full border-collapse"
          style={{ tableLayout: "fixed", minWidth: tableWidth }}
        >
          <colgroup>
            <col style={{ width: 4 }} />
            {shown.map((c) => (
              <col key={c.key} style={{ width: cols.widthOf(c.key) }} />
            ))}
          </colgroup>
          <thead>
            {/*
              The header reads as its own band — a distinct surface with a
              heavier rule beneath — rather than as a slightly different first
              row. That is what carries column separation here; vertical rules
              on every cell would turn fourteen columns into a spreadsheet.
            */}
            <tr style={{ borderBottom: "1px solid var(--lucid-line-2)" }}>
              <th style={{ ...TH_BASE, padding: 0 }} />
              {shown.map((c) => (
                <SortHeader
                  key={c.key}
                  column={c}
                  active={sort.key === c.key}
                  direction={sort.direction}
                  onSort={handleSort}
                  width={cols.widthOf(c.key)}
                  onWidth={(w) => cols.setWidth(c.key, w)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const flagged = isTradeFlagged(row.trade);
              return (
                <tr
                  key={row.trade.id}
                  onClick={() => onRowClick(row.trade)}
                  className={`trade-row lx-row-hover${flagged ? " lx-row-flagged" : ""}`}
                  style={{
                    cursor: "pointer",
                    borderBottom: `1px solid ${flagged ? "var(--lucid-neg-bd)" : "var(--lucid-line)"}`,
                  }}
                >
                  {/* Accent stripe: danger outranks conviction and live — a row
                      quietly corrupting your statistics should read first. */}
                  <td
                    style={{
                      padding: 0,
                      width: 4,
                      background: flagged
                        ? "var(--lucid-neg)"
                        : row.isLive
                        ? "transparent"
                        : row.trade.conviction === "High"
                        ? "var(--lucid-accent)"
                        : row.trade.conviction === "Medium"
                        ? "var(--lucid-ink-3)"
                        : "transparent",
                    }}
                  >
                    {row.isLive && !flagged && (
                      <div
                        className="pulse-live"
                        style={{ background: "var(--lucid-accent)", width: 4, height: "100%", minHeight: ROW_HEIGHT }}
                      />
                    )}
                  </td>

                  {shown.map((c) => (
                    <td key={c.key} style={{ ...(c.numeric ? TD_NUM : TD_BASE), ...(c.cellStyle?.(row) ?? {}) }}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
