"use client";

import { useState, useMemo, useCallback } from "react";
import { Plus, LayoutList, LayoutGrid, X, BookText, SlidersHorizontal } from "lucide-react";
import {
  formatCurrency,
  type Trade,
} from "@/lib/demo-data";
import { useTrades, useAccounts, useTradingModels, useTradingPairs, useDeleteTrade } from "@/hooks/useTrading";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { DetailDrawer } from "@/components/DetailDrawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/components/toast";
import { JournalTable } from "./JournalTable";
import { JournalGallery } from "./JournalGallery";
import { AddTradeModal } from "./AddTradeModal";
import { TradeDrawerContent } from "./TradeDrawerContent";

type FilterCategory = "Pair" | "Model" | "Direction" | "Outcome" | "Session" | "Conviction";

interface ActiveFilter {
  id: string;
  category: FilterCategory;
  value: string;
}

function getOutcome(trade: Trade): "Win" | "Loss" | "BE" | "Live" {
  if (!trade.date_closed) return "Live";
  if (trade.blended_rr > 0) return "Win";
  if (trade.blended_rr < 0) return "Loss";
  return "BE";
}

function calcSummary(tradeList: Trade[]) {
  const closed = tradeList.filter(t => t.date_closed);
  const net = closed.reduce((sum, t) => sum + t.blended_pnl, 0);
  return { count: tradeList.length, net };
}

function FilterPopover({
  activeFilters,
  filterOptions,
  onAdd,
  onClose,
}: {
  activeFilters: ActiveFilter[];
  filterOptions: Record<FilterCategory, string[]>;
  onAdd: (cat: FilterCategory, val: string) => void;
  onClose: () => void;
}) {
  const [selectedCat, setSelectedCat] = useState<FilterCategory | null>(null);
  const cats = Object.keys(filterOptions) as FilterCategory[];

  return (
    <div
      className="absolute top-full left-0 mt-1 z-50 rounded-xl overflow-hidden flex"
      style={{
        background: "var(--lucid-surface-2)",
        border: "1px solid var(--lucid-line-2)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        minWidth: 280,
      }}
    >
      <div className="py-1 border-r" style={{ borderColor: "var(--lucid-line)", minWidth: 148 }}>
        {cats.map(cat => (
          <button
            key={cat}
            className="w-full text-left px-3 py-2 text-sm transition-colors"
            style={{
              color: selectedCat === cat ? "var(--lucid-ink)" : "var(--lucid-ink-2)",
              background: selectedCat === cat ? "var(--lucid-accent-bg)" : "transparent",
            }}
            onMouseEnter={() => setSelectedCat(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      {selectedCat && (
        <div className="py-1" style={{ minWidth: 148 }}>
          {filterOptions[selectedCat].map(val => {
            const already = activeFilters.some(f => f.category === selectedCat && f.value === val);
            return (
              <button
                key={val}
                disabled={already}
                className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between"
                style={{
                  color: already ? "var(--lucid-ink-3)" : "var(--lucid-ink)",
                  cursor: already ? "default" : "pointer",
                }}
                onMouseEnter={e => { if (!already) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                onClick={() => { if (!already) { onAdd(selectedCat, val); onClose(); } }}
              >
                <span>{val}</span>
                {already && <span style={{ color: "var(--lucid-ink-3)", fontSize: 10 }}>active</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function JournalPage() {
  const [view, setView] = useState<"table" | "gallery">("table");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Trade | null>(null);

  const tradesQuery = useTrades();
  const accountsQuery = useAccounts();
  const modelsQuery = useTradingModels();
  const pairsQuery = useTradingPairs();
  const deleteTrade = useDeleteTrade();

  function confirmDelete() {
    const t = pendingDelete;
    if (!t) return;
    deleteTrade.mutate(t.id, {
      onSuccess: () => { toast.success("Trade deleted."); setSelectedTrade(null); },
      onSettled: () => setPendingDelete(null),
    });
  }

  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);

  const filterOptions = useMemo<Record<FilterCategory, string[]>>(() => ({
    Pair: (pairsQuery.data ?? []).map(p => p.symbol),
    Model: (modelsQuery.data ?? []).map(m => m.name),
    Direction: ["Buy", "Sell"],
    Outcome: ["Win", "Loss", "BE"],
    Session: ["Asian", "London", "London-NY Overlap", "New York"],
    Conviction: ["High", "Medium", "Low"],
  }), [pairsQuery.data, modelsQuery.data]);

  const sortedTrades = useMemo(
    () => [...(tradesQuery.data ?? [])].sort((a, b) => new Date(b.date_opened).getTime() - new Date(a.date_opened).getTime()),
    [tradesQuery.data]
  );

  const filteredTrades = useMemo(() => {
    let list = sortedTrades;
    if (selectedAccount !== "all") list = list.filter(t => t.account_id === selectedAccount);
    if (activeFilters.length === 0) return list;
    const byCategory = activeFilters.reduce<Record<string, string[]>>((acc, f) => {
      if (!acc[f.category]) acc[f.category] = [];
      acc[f.category].push(f.value);
      return acc;
    }, {});
    return list.filter(trade =>
      Object.entries(byCategory).every(([cat, vals]) => {
        switch (cat) {
          case "Pair": return vals.includes(trade.pair);
          case "Model": return vals.includes(trade.model);
          case "Direction": return vals.includes(trade.direction);
          case "Outcome": return vals.includes(getOutcome(trade));
          case "Session": return vals.includes(trade.session);
          case "Conviction": return vals.includes(trade.conviction);
          default: return true;
        }
      })
    );
  }, [sortedTrades, selectedAccount, activeFilters]);

  const { count, net } = calcSummary(filteredTrades);

  const addFilter = useCallback((cat: FilterCategory, val: string) => {
    setActiveFilters(prev => [...prev, { id: `${cat}-${val}-${Date.now()}`, category: cat, value: val }]);
  }, []);

  const removeFilter = useCallback((id: string) => {
    setActiveFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearFilters = useCallback(() => setActiveFilters([]), []);

  return (
    <div
      className="flex flex-col min-h-full"
      onClick={() => filterOpen && setFilterOpen(false)}
    >
      {/* Page header */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold lt-serif" style={{ color: "var(--lucid-ink)" }}>Journal</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--lucid-ink-3)" }}>
            Every live trade. Every decision. Every outcome.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm self-start"
          style={{ background: "var(--lucid-surface)", border: "1px solid var(--lucid-line)", color: "var(--lucid-ink-2)" }}
        >
          <span className="font-medium lt-num">{count} trades</span>
          <span style={{ color: "var(--lucid-ink-3)" }}>·</span>
          <span className="font-semibold lt-num" style={{ color: net >= 0 ? "var(--lucid-pos)" : "var(--lucid-neg)" }}>
            {formatCurrency(net)} net
          </span>
        </div>
      </div>

      {/* Controls bar */}
      <div
        className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 sticky top-0 z-30"
        style={{
          background: "var(--lucid-surface)",
          borderBottom: "1px solid var(--lucid-line)",
        }}
      >
        {/* Left */}
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); setAddOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{ background: "var(--lucid-accent)", color: "var(--lucid-bg)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--lucid-accent-bd)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--lucid-accent)"; }}
          >
            <Plus size={14} /> Add Trade
          </button>
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            className="text-sm rounded-lg px-2.5 py-1.5"
            style={{ background: "var(--lucid-surface)", border: "1px solid var(--lucid-line)", color: "var(--lucid-ink-2)", outline: "none" }}
          >
            <option value="all">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
          </select>
        </div>

        {/* Middle: filters */}
        <div className="flex items-center gap-2 flex-wrap relative" onClick={e => e.stopPropagation()}>
          {activeFilters.map(f => (
            <span
              key={f.id}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
              style={{ background: "var(--lucid-accent-bg)", border: "1px solid var(--lucid-accent-bd)", color: "var(--lucid-accent)" }}
            >
              {f.category}: {f.value}
              <button onClick={() => removeFilter(f.id)} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
                <X size={10} />
              </button>
            </span>
          ))}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(o => !o)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: filterOpen ? "var(--lucid-surface-3)" : "var(--lucid-surface)",
                border: "1px solid var(--lucid-line)",
                color: "var(--lucid-ink-2)",
              }}
            >
              <SlidersHorizontal size={12} /> Add Filter
            </button>
            {filterOpen && (
              <FilterPopover activeFilters={activeFilters} filterOptions={filterOptions} onAdd={addFilter} onClose={() => setFilterOpen(false)} />
            )}
          </div>
        </div>

        {/* Right: view toggle */}
        <div className="flex rounded-lg p-0.5 ml-auto" style={{ background: "var(--lucid-surface)", border: "1px solid var(--lucid-line)" }}>
          {(["table", "gallery"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: view === v ? "var(--lucid-accent-bg)" : "transparent",
                color: view === v ? "var(--lucid-accent)" : "var(--lucid-ink-3)",
                border: view === v ? "1px solid var(--lucid-accent-bd)" : "1px solid transparent",
              }}
            >
              {v === "table" ? <LayoutList size={13} /> : <LayoutGrid size={13} />}
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 sm:px-6 py-4">
        {tradesQuery.isLoading ? (
          <LoadingState message="Loading trades…" />
        ) : tradesQuery.isError ? (
          <ErrorState error={tradesQuery.error} onRetry={() => tradesQuery.refetch()} title="Couldn't load trades" />
        ) : filteredTrades.length === 0 ? (
          <EmptyState
            hasFilters={activeFilters.length > 0 || selectedAccount !== "all"}
            onClear={clearFilters}
            onAdd={() => setAddOpen(true)}
          />
        ) : view === "table" ? (
          <JournalTable trades={filteredTrades} onRowClick={setSelectedTrade} />
        ) : (
          <JournalGallery trades={filteredTrades} onCardClick={setSelectedTrade} />
        )}
      </div>

      <DetailDrawer
        open={!!selectedTrade}
        onClose={() => setSelectedTrade(null)}
        expandHref={selectedTrade ? `/trading/journal/${selectedTrade.id}` : undefined}
        title={selectedTrade ? `${getPairDisplayName(selectedTrade.pair, pairsQuery.data)} · Trade #${selectedTrade.id.slice(0, 8)}` : ""}
      >
        {selectedTrade && (
          <TradeDrawerContent
            trade={selectedTrade}
            onEdit={() => { setEditTrade(selectedTrade); setSelectedTrade(null); }}
            onDelete={() => setPendingDelete(selectedTrade)}
          />
        )}
      </DetailDrawer>

      <AddTradeModal open={addOpen} onClose={() => setAddOpen(false)} />
      <AddTradeModal
        open={!!editTrade}
        editTrade={editTrade ?? undefined}
        onClose={() => setEditTrade(null)}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete trade?"
        message={pendingDelete ? `This ${pendingDelete.pair} ${pendingDelete.direction} trade will be permanently deleted. Account balances update accordingly.` : undefined}
        confirmLabel="Delete"
        loading={deleteTrade.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function getPairDisplayName(symbol: string, pairs?: { symbol: string; display_name: string }[]) {
  return pairs?.find(p => p.symbol === symbol)?.display_name ?? symbol;
}

function EmptyState({ hasFilters, onClear, onAdd }: { hasFilters: boolean; onClear: () => void; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-center py-24">
      <div
        className="flex flex-col items-center gap-4 p-10 rounded-2xl text-center"
        style={{ maxWidth: 520, background: "var(--lucid-surface)", border: "1px solid var(--lucid-line)" }}
      >
        <BookText size={40} style={{ color: "var(--lucid-ink-3)" }} />
        {hasFilters ? (
          <>
            <div>
              <p className="text-base font-semibold" style={{ color: "var(--lucid-ink)" }}>No trades match these filters</p>
              <p className="mt-1 text-sm" style={{ color: "var(--lucid-ink-3)" }}>Try removing a filter or adjusting the date range.</p>
            </div>
            <button
              onClick={onClear}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--lucid-accent-bg)", color: "var(--lucid-accent)", border: "1px solid var(--lucid-accent-bd)" }}
            >
              Clear Filters
            </button>
          </>
        ) : (
          <>
            <div>
              <p className="text-base font-semibold" style={{ color: "var(--lucid-ink)" }}>Your journal is empty</p>
              <p className="mt-1 text-sm" style={{ color: "var(--lucid-ink-3)" }}>Add your first trade to start building your edge.</p>
            </div>
            <button
              onClick={onAdd}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: "var(--lucid-accent)", color: "var(--lucid-bg)" }}
            >
              + Add Your First Trade
            </button>
            <p className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
              Or paste a screenshot from MT4/MT5 to auto-fill (coming Phase 3)
            </p>
          </>
        )}
      </div>
    </div>
  );
}
