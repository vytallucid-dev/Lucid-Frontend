"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import {
  pairs,
  type PlannedTrade,
  type PlannedStatus,
  getDistanceToEntry,
} from "@/lib/demo-data";
import { usePlanned, useUpdatePlanned, useDeletePlanned } from "@/hooks/useTrading";
import { Skeleton } from "@/components/state/Skeleton";
import { ErrorState } from "@/components/state/ErrorState";
import { DetailDrawer } from "@/components/DetailDrawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AddPlannedTradeModal } from "./AddPlannedTradeModal";
import { PlannedDrawerContent, calcRR, ModelPill, ConvictionPill, DistanceBadge } from "./PlannedDrawerContent";
import { AddTradeModal } from "../journal/AddTradeModal";
import { toast } from "@/components/toast";

// ── Status section config ─────────────────────────────────────────────────────
const STATUS_ORDER: PlannedStatus[] = ["Ready", "Watching", "Invalidated", "Cancelled"];

const STATUS_STYLE: Record<PlannedStatus, { label: string; color: string; barColor: string }> = {
  Ready:       { label: "READY",       color: "var(--lucid-warn)", barColor: "var(--lucid-warn)" },
  Watching:    { label: "WATCHING",    color: "var(--lucid-ctx)", barColor: "var(--lucid-ctx)" },
  Invalidated: { label: "INVALIDATED", color: "var(--lucid-ink-3)", barColor: "var(--lucid-ink-3)" },
  Cancelled:   { label: "CANCELLED",   color: "var(--lucid-ink-3)", barColor: "var(--lucid-ink-3)" },
};

// ── Filter chips ──────────────────────────────────────────────────────────────
const FILTER_OPTIONS: Array<PlannedStatus | "All"> = ["All", "Watching", "Ready", "Invalidated", "Cancelled"];

// ── Row-level more-menu ───────────────────────────────────────────────────────
function MoreMenu({
  trade,
  onEdit,
  onInvalidate,
  onCancel,
  onDelete,
}: {
  trade: PlannedTrade;
  onEdit: () => void;
  onInvalidate: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Fixed-position coordinates for the portal-rendered menu, computed from the
  // trigger's rect. Rendering into document.body (rather than absolutely inside
  // the row) escapes the table's `overflow-x-auto` clip, which previously turned
  // the menu into in-row vertical scroll instead of an overlay.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const b = btnRef.current?.getBoundingClientRect();
    if (b) setPos({ top: b.bottom + 6, right: window.innerWidth - b.right });

    function onDoc(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function close() { setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const items: Array<{ label: string; action: () => void; danger?: boolean }> = [
    { label: "Edit", action: onEdit },
    ...(trade.status !== "Invalidated" ? [{ label: "Mark as Invalidated", action: onInvalidate }] : []),
    ...(trade.status !== "Cancelled" ? [{ label: "Mark as Cancelled", action: onCancel }] : []),
    { label: "Delete", action: onDelete, danger: true },
  ];

  return (
    <>
      <button
        ref={btnRef}
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="p-1.5 rounded-md transition-colors hover:bg-white/5"
        style={{ color: "var(--lucid-ink-3)" }}
      >
        <MoreHorizontal size={14} />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[120] rounded-xl py-1 min-w-44"
          style={{
            top: pos.top,
            right: pos.right,
            background: "var(--lucid-surface-2)",
            border: "1px solid var(--lucid-line)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {items.map(item => (
            <button
              key={item.label}
              onClick={e => { e.stopPropagation(); item.action(); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ color: item.danger ? "var(--lucid-neg)" : "var(--lucid-ink)" }}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Pair cell ─────────────────────────────────────────────────────────────────
function PairCell({ pair }: { pair: string }) {
  const config = pairs.find(p => p.symbol === pair);
  if (!config) return <span style={{ color: "var(--lucid-ink)", fontWeight: 500 }}>{pair}</span>;
  return (
    <span className="flex items-center gap-1.5">
      <span style={{ fontSize: 14 }}>{config.flag_a}{config.flag_b}</span>
      <span style={{ color: "var(--lucid-ink)", fontWeight: 500, fontSize: 13 }}>{config.display_name}</span>
    </span>
  );
}

// ── Planned trade row ─────────────────────────────────────────────────────────
function PlannedRow({
  trade,
  statusColor,
  onRowClick,
  onConvert,
  onInvalidate,
  onCancel,
  onDelete,
  onEdit,
}: {
  trade: PlannedTrade;
  statusColor: string;
  onRowClick: () => void;
  onConvert: () => void;
  onInvalidate: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const rr = calcRR(trade);
  const dist = getDistanceToEntry(trade);
  const canConvert = trade.status === "Watching" || trade.status === "Ready";
  const currentAboveEntry = trade.current_market_price > trade.planned_entry;
  const isFavorable =
    trade.direction === "Buy" ? !currentAboveEntry : currentAboveEntry;
  const priceColor = dist.direction === "at" ? "var(--lucid-pos)" : isFavorable ? "var(--lucid-pos)" : "var(--lucid-neg)";

  return (
    <tr
      onClick={onRowClick}
      className="transition-colors cursor-pointer"
      style={{ borderBottom: "1px solid var(--lucid-line)" }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--lucid-surface-2)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* Status bar */}
      <td style={{ padding: 0, width: 4 }}>
        <div style={{ width: 4, height: 44, background: statusColor, borderRadius: "2px 0 0 2px" }} />
      </td>

      {/* Pair */}
      <td style={{ padding: "10px 12px", width: 120 }}>
        <PairCell pair={trade.pair} />
      </td>

      {/* Model */}
      <td style={{ padding: "10px 8px", width: 110 }}>
        <ModelPill model={trade.model} />
      </td>

      {/* Direction */}
      <td style={{ padding: "10px 8px", width: 60 }}>
        <span className="lt-num" style={{ fontSize: 13, fontWeight: 600, color: trade.direction === "Buy" ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
          {trade.direction === "Buy" ? "↑" : "↓"} {trade.direction}
        </span>
      </td>

      {/* Planned Entry */}
      <td style={{ padding: "10px 8px", width: 100 }}>
        <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink)", fontVariantNumeric: "tabular-nums" }}>
          {trade.planned_entry}
        </span>
      </td>

      {/* Current Price */}
      <td style={{ padding: "10px 8px", width: 100 }}>
        <span className="lt-num" style={{ fontSize: 12, color: priceColor, fontVariantNumeric: "tabular-nums" }}>
          {trade.current_market_price}
        </span>
      </td>

      {/* Distance */}
      <td style={{ padding: "10px 8px", width: 120 }}>
        <DistanceBadge trade={trade} />
      </td>

      {/* R:R */}
      <td style={{ padding: "10px 8px", width: 80 }}>
        <span className="lt-num" style={{ fontSize: 12, color: rr >= 2 ? "var(--lucid-pos)" : "var(--lucid-ink-2)", fontWeight: 600 }}>
          {rr.toFixed(2)}R
        </span>
      </td>

      {/* Risk */}
      <td style={{ padding: "10px 8px", width: 60 }}>
        <span className="lt-num" style={{ fontSize: 12, color: "var(--lucid-ink-2)" }}>{trade.planned_risk_pct}%</span>
      </td>

      {/* Conviction */}
      <td style={{ padding: "10px 8px", width: 90 }}>
        <ConvictionPill conviction={trade.conviction} />
      </td>

      {/* Actions */}
      <td
        style={{ padding: "10px 8px", width: 130 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          {canConvert && (
            <button
              onClick={e => { e.stopPropagation(); onConvert(); }}
              className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "1px solid var(--lucid-accent-bd)" }}
            >
              Convert →
            </button>
          )}
          <MoreMenu
            trade={trade}
            onEdit={onEdit}
            onInvalidate={onInvalidate}
            onCancel={onCancel}
            onDelete={onDelete}
          />
        </div>
      </td>
    </tr>
  );
}

// ── Status section ────────────────────────────────────────────────────────────
function StatusSection({
  status,
  trades,
  defaultCollapsed,
  onRowClick,
  onConvert,
  onInvalidate,
  onCancel,
  onDelete,
  onEdit,
}: {
  status: PlannedStatus;
  trades: PlannedTrade[];
  defaultCollapsed?: boolean;
  onRowClick: (t: PlannedTrade) => void;
  onConvert: (t: PlannedTrade) => void;
  onInvalidate: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (t: PlannedTrade) => void;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);
  const cfg = STATUS_STYLE[status];

  if (trades.length === 0 && status !== "Ready") return null;

  return (
    <div>
      {/* Section heading */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center gap-3 mb-2"
        style={{ paddingBottom: 6 }}
      >
        <span
          className="lt-serif"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: cfg.color,
          }}
        >
          {cfg.label}
        </span>
        <div style={{ flex: 1, height: 1, background: "var(--lucid-line)" }} />
        <span
          className="lt-num"
          style={{
            fontSize: 11,
            color: cfg.color,
            opacity: 0.8,
            fontWeight: 600,
          }}
        >
          {trades.length}
        </span>
        <span style={{ color: "var(--lucid-ink-3)" }}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>

      {!collapsed && (
        <>
          {trades.length === 0 ? (
            <div
              className="flex items-center justify-center rounded-lg mb-4"
              style={{
                height: 52,
                border: "1px dashed var(--lucid-line)",
                color: "var(--lucid-ink-3)",
                fontSize: 12,
              }}
            >
              No {status.toLowerCase()} setups
            </div>
          ) : (
            <div className="rounded-xl mb-4 overflow-hidden" style={{ border: "1px solid var(--lucid-line)" }}>
              <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ background: "var(--lucid-surface)", minWidth: 760 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
                    <th style={{ width: 4, padding: 0 }} />
                    {["Pair", "Model", "Dir", "Entry", "Current", "Distance", "R:R", "Risk", "Conviction", ""].map(h => (
                      <th
                        key={h}
                        className="text-left"
                        style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "var(--lucid-ink-3)", padding: "8px 8px", textTransform: "uppercase" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.map(trade => (
                    <PlannedRow
                      key={trade.id}
                      trade={trade}
                      statusColor={cfg.barColor}
                      onRowClick={() => onRowClick(trade)}
                      onConvert={() => onConvert(trade)}
                      onInvalidate={() => onInvalidate(trade.id)}
                      onCancel={() => onCancel(trade.id)}
                      onDelete={() => onDelete(trade.id)}
                      onEdit={() => onEdit(trade)}
                    />
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PlannedPage() {
  const plannedQuery = usePlanned();
  const updatePlannedM = useUpdatePlanned();
  const deletePlannedM = useDeletePlanned();

  const trades = useMemo(() => plannedQuery.data ?? [], [plannedQuery.data]);

  const [statusFilter, setStatusFilter] = useState<PlannedStatus | "All">("All");
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [convertId, setConvertId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const drawerTrade = trades.find(t => t.id === drawerId) ?? null;
  const convertTrade = trades.find(t => t.id === convertId) ?? null;
  const editTrade = trades.find(t => t.id === editId) ?? null;
  const pendingDeleteTrade = trades.find(t => t.id === pendingDeleteId) ?? null;

  const filteredTrades = useMemo(() =>
    statusFilter === "All" ? trades : trades.filter(t => t.status === statusFilter),
    [trades, statusFilter]
  );

  const grouped = useMemo(() => {
    const map: Record<PlannedStatus, PlannedTrade[]> = {
      Ready: [], Watching: [], Invalidated: [], Cancelled: [],
    };
    for (const t of filteredTrades) map[t.status].push(t);
    return map;
  }, [filteredTrades]);

  const activeCount = trades.filter(t => t.status === "Watching" || t.status === "Ready").length;
  const invalidatedCount = trades.filter(t => t.status === "Invalidated").length;

  function updateStatus(id: string, status: PlannedStatus) {
    updatePlannedM.mutate(
      { id, body: { status } },
      {
        onSuccess: () => {
          if (status === "Invalidated")
            toast.warning("Setup invalidated — price action broke the plan.", { title: "Setup invalidated" });
          else if (status === "Cancelled") toast.info("Setup cancelled.");
          else toast.success(`Setup marked as ${status.toLowerCase()}.`);
        },
      },
    );
  }

  function handleDelete(id: string) {
    setPendingDeleteId(id);
  }

  function confirmDelete() {
    const id = pendingDeleteId;
    if (!id) return;
    deletePlannedM.mutate(id, {
      onSuccess: () => toast.success("Planned trade deleted."),
      onSettled: () => setPendingDeleteId(null),
    });
    if (drawerId === id) setDrawerId(null);
  }

  function handleConvert(trade: PlannedTrade) {
    setConvertId(trade.id);
    setDrawerId(null);
  }

  return (
    <div className="flex flex-col gap-6 px-4 sm:px-6 py-4 sm:py-6 max-w-full">

      {/* Page header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="lt-serif text-xl font-bold" style={{ color: "var(--lucid-ink)" }}>Planned Trades</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--lucid-ink-3)" }}>
            Setups in waiting. Setups in motion.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 12, color: "var(--lucid-ink-3)" }}>
            <span className="lt-num" style={{ color: "var(--lucid-accent)", fontWeight: 600 }}>{activeCount} active</span>
            {" · "}
            <span>{invalidatedCount} invalidated</span>
          </span>
        </div>
      </div>

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_OPTIONS.map(opt => {
            const active = statusFilter === opt;
            const isStatus = opt !== "All";
            const cfg = isStatus ? STATUS_STYLE[opt as PlannedStatus] : null;
            return (
              <button
                key={opt}
                onClick={() => setStatusFilter(opt as PlannedStatus | "All")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: active
                    ? isStatus
                      ? `color-mix(in srgb, ${cfg!.barColor} 15%, transparent)`
                      : "var(--lucid-accent-bg)"
                    : "var(--lucid-surface)",
                  color: active
                    ? isStatus ? cfg!.color : "var(--lucid-accent)"
                    : "var(--lucid-ink-3)",
                  border: active
                    ? `1px solid ${isStatus ? `color-mix(in srgb, ${cfg!.barColor} 40%, transparent)` : "var(--lucid-accent-bd)"}`
                    : "1px solid var(--lucid-line)",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {/* Add button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: "var(--lucid-accent)", color: "var(--lucid-bg)" }}
        >
          <Plus size={14} />
          Add Planned Trade
        </button>
      </div>

      {/* Loading / error */}
      {/* Status sections keep their shape: a header strip and a few rows each. */}
      {plannedQuery.isLoading && (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--lucid-line)", background: "var(--lucid-surface)" }}
            >
              <div
                className="flex items-center gap-3 px-4"
                style={{ height: 46, borderBottom: "1px solid var(--lucid-line)" }}
              >
                <Skeleton bare height={10} width={104} />
                <Skeleton bare height={16} width={28} radius={999} style={{ marginLeft: 4 }} />
              </div>
              {Array.from({ length: 3 - s }).map((_, r) => (
                <div
                  key={r}
                  className="flex items-center gap-4 px-4"
                  style={{ height: 52, borderBottom: "1px solid var(--lucid-line)" }}
                >
                  <Skeleton bare height={11} width={128} />
                  <Skeleton bare height={11} width={92} />
                  <Skeleton bare height={11} width={72} style={{ marginLeft: "auto" }} />
                  <Skeleton bare height={18} width={64} radius={999} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {plannedQuery.isError && (
        <ErrorState error={plannedQuery.error} onRetry={() => plannedQuery.refetch()} title="Couldn't load planned trades" />
      )}

      {/* Empty state */}
      {!plannedQuery.isLoading && !plannedQuery.isError && trades.length === 0 && (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl"
          style={{
            minHeight: 240,
            background: "var(--lucid-surface)",
            border: "1px solid var(--lucid-line)",
          }}
        >
          <span style={{ fontSize: 32 }}>📋</span>
          <p style={{ fontSize: 14, color: "var(--lucid-ink-2)", fontWeight: 500 }}>
            No setups being watched.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: "var(--lucid-accent)", color: "var(--lucid-bg)" }}
          >
            + Add Planned Trade
          </button>
        </div>
      )}

      {/* Status sections */}
      {trades.length > 0 && (
        <div className="flex flex-col gap-2">
          {STATUS_ORDER.map(status => (
            <StatusSection
              key={status}
              status={status}
              trades={grouped[status]}
              defaultCollapsed={status === "Cancelled"}
              onRowClick={t => setDrawerId(t.id)}
              onConvert={handleConvert}
              onInvalidate={id => updateStatus(id, "Invalidated")}
              onCancel={id => updateStatus(id, "Cancelled")}
              onDelete={handleDelete}
              onEdit={t => { setEditId(t.id); setShowAddModal(true); }}
            />
          ))}
        </div>
      )}

      {/* Detail drawer */}
      <DetailDrawer
        open={!!drawerTrade}
        onClose={() => setDrawerId(null)}
        expandHref={drawerTrade ? `/trading/planned/${drawerTrade.id}` : undefined}
        title={drawerTrade
          ? `${pairs.find(p => p.symbol === drawerTrade.pair)?.display_name ?? drawerTrade.pair} · ${drawerTrade.model}`
          : ""}
      >
        {drawerTrade && (
          <PlannedDrawerContent
            trade={drawerTrade}
            onConvert={handleConvert}
            onMarkInvalidated={t => updateStatus(t.id, "Invalidated")}
          />
        )}
      </DetailDrawer>

      {/* Add / Edit planned trade modal */}
      <AddPlannedTradeModal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setEditId(null); }}
        editId={editId ?? undefined}
        prefill={editTrade ?? undefined}
      />

      {/* Convert to live trade — opens AddTradeModal pre-filled */}
      {convertTrade && (
        <AddTradeModal
          open={!!convertTrade}
          prefill={{
            pair: convertTrade.pair,
            model: convertTrade.model,
            direction: convertTrade.direction,
            entry_price: convertTrade.planned_entry,
            sl_price: convertTrade.planned_sl,
            first_tp_price: convertTrade.planned_first_tp,
            main_tp_price: convertTrade.planned_main_tp,
            risk_pct: convertTrade.planned_risk_pct,
            conviction: convertTrade.conviction,
          }}
          onSubmitted={() =>
            updatePlannedM.mutate({
              id: convertTrade.id,
              body: {
                status: "Cancelled",
                notes: (convertTrade.notes ? convertTrade.notes + "\n" : "") + "[Converted to Live Trade]",
              },
            })
          }
          onClose={() => setConvertId(null)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!pendingDeleteTrade}
        title="Delete planned trade?"
        message={pendingDeleteTrade
          ? `${pairs.find(p => p.symbol === pendingDeleteTrade.pair)?.display_name ?? pendingDeleteTrade.pair} ${pendingDeleteTrade.direction} will be permanently removed from your watchlist.`
          : undefined}
        confirmLabel="Delete"
        loading={deletePlannedM.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
