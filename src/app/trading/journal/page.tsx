"use client";

import { useState, useMemo, useCallback } from "react";
import { Plus, LayoutList, LayoutGrid, X, BookText, SlidersHorizontal } from "lucide-react";
import {
  trades as allTrades,
  accounts,
  pairs,
  models,
  formatCurrency,
  type Trade,
} from "@/lib/demo-data";
import { DetailDrawer } from "@/components/DetailDrawer";
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

const FILTER_OPTIONS: Record<FilterCategory, string[]> = {
  Pair: pairs.map(p => p.symbol),
  Model: models.map(m => m.name),
  Direction: ["Buy", "Sell"],
  Outcome: ["Win", "Loss", "BE"],
  Session: ["Asian", "London", "London-NY Overlap", "New York"],
  Conviction: ["High", "Medium", "Low"],
};

function FilterPopover({
  activeFilters,
  onAdd,
  onClose,
}: {
  activeFilters: ActiveFilter[];
  onAdd: (cat: FilterCategory, val: string) => void;
  onClose: () => void;
}) {
  const [selectedCat, setSelectedCat] = useState<FilterCategory | null>(null);
  const cats = Object.keys(FILTER_OPTIONS) as FilterCategory[];

  return (
    <div
      className="absolute top-full left-0 mt-1 z-50 rounded-xl overflow-hidden flex"
      style={{
        background: "rgba(14, 22, 34, 0.98)",
        border: "1px solid rgba(148, 163, 184, 0.15)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        minWidth: 280,
      }}
    >
      <div className="py-1 border-r" style={{ borderColor: "rgba(148,163,184,0.1)", minWidth: 148 }}>
        {cats.map(cat => (
          <button
            key={cat}
            className="w-full text-left px-3 py-2 text-sm transition-colors"
            style={{
              color: selectedCat === cat ? "#E2E8F0" : "#94A3B8",
              background: selectedCat === cat ? "rgba(59,130,246,0.1)" : "transparent",
            }}
            onMouseEnter={() => setSelectedCat(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      {selectedCat && (
        <div className="py-1" style={{ minWidth: 148 }}>
          {FILTER_OPTIONS[selectedCat].map(val => {
            const already = activeFilters.some(f => f.category === selectedCat && f.value === val);
            return (
              <button
                key={val}
                disabled={already}
                className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between"
                style={{
                  color: already ? "#64748B" : "#E2E8F0",
                  cursor: already ? "default" : "pointer",
                }}
                onMouseEnter={e => { if (!already) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                onClick={() => { if (!already) { onAdd(selectedCat, val); onClose(); } }}
              >
                <span>{val}</span>
                {already && <span style={{ color: "#64748B", fontSize: 10 }}>active</span>}
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

  const sortedTrades = useMemo(
    () => [...allTrades].sort((a, b) => new Date(b.date_opened).getTime() - new Date(a.date_opened).getTime()),
    []
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
      style={{ background: "var(--bg-page)" }}
      onClick={() => filterOpen && setFilterOpen(false)}
    >
      {/* Page header */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "#E2E8F0" }}>Journal</h1>
          <p className="mt-1 text-sm" style={{ color: "#64748B" }}>
            Every live trade. Every decision. Every outcome.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "#94A3B8" }}
        >
          <span className="font-medium">{count} trades</span>
          <span style={{ color: "#334155" }}>·</span>
          <span className="font-semibold" style={{ color: net >= 0 ? "var(--positive)" : "var(--negative)" }}>
            {formatCurrency(net)} net
          </span>
        </div>
      </div>

      {/* Controls bar */}
      <div
        className="px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-30"
        style={{
          background: "rgba(10, 14, 20, 0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(148, 163, 184, 0.08)",
        }}
      >
        {/* Left */}
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); setAddOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{ background: "#3B82F6", color: "#fff" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#2563EB"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#3B82F6"; }}
          >
            <Plus size={14} /> Add Trade
          </button>
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            className="text-sm rounded-lg px-2.5 py-1.5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", color: "#94A3B8", outline: "none" }}
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
              style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)", color: "#93C5FD" }}
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
                background: filterOpen ? "rgba(148,163,184,0.1)" : "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                color: "#94A3B8",
              }}
            >
              <SlidersHorizontal size={12} /> Add Filter
            </button>
            {filterOpen && (
              <FilterPopover activeFilters={activeFilters} onAdd={addFilter} onClose={() => setFilterOpen(false)} />
            )}
          </div>
        </div>

        {/* Right: view toggle */}
        <div className="flex rounded-lg p-0.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}>
          {(["table", "gallery"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: view === v ? "rgba(59,130,246,0.15)" : "transparent",
                color: view === v ? "#93C5FD" : "#64748B",
                border: view === v ? "1px solid rgba(59,130,246,0.2)" : "1px solid transparent",
              }}
            >
              {v === "table" ? <LayoutList size={13} /> : <LayoutGrid size={13} />}
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-4">
        {filteredTrades.length === 0 ? (
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
        title={selectedTrade ? `${getPairDisplayName(selectedTrade.pair)} · Trade #${selectedTrade.id.replace("trd_", "")}` : ""}
      >
        {selectedTrade && <TradeDrawerContent trade={selectedTrade} />}
      </DetailDrawer>

      <AddTradeModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function getPairDisplayName(symbol: string) {
  return pairs.find(p => p.symbol === symbol)?.display_name ?? symbol;
}

function EmptyState({ hasFilters, onClear, onAdd }: { hasFilters: boolean; onClear: () => void; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-center py-24">
      <div
        className="flex flex-col items-center gap-4 p-10 rounded-2xl text-center"
        style={{ maxWidth: 520, background: "var(--bg-card)", border: "1px solid var(--border-subtle)" }}
      >
        <BookText size={40} style={{ color: "#334155" }} />
        {hasFilters ? (
          <>
            <div>
              <p className="text-base font-semibold" style={{ color: "#E2E8F0" }}>No trades match these filters</p>
              <p className="mt-1 text-sm" style={{ color: "#64748B" }}>Try removing a filter or adjusting the date range.</p>
            </div>
            <button
              onClick={onClear}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "rgba(59,130,246,0.15)", color: "#93C5FD", border: "1px solid rgba(59,130,246,0.2)" }}
            >
              Clear Filters
            </button>
          </>
        ) : (
          <>
            <div>
              <p className="text-base font-semibold" style={{ color: "#E2E8F0" }}>Your journal is empty</p>
              <p className="mt-1 text-sm" style={{ color: "#64748B" }}>Add your first trade to start building your edge.</p>
            </div>
            <button
              onClick={onAdd}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: "#3B82F6", color: "#fff" }}
            >
              + Add Your First Trade
            </button>
            <p className="text-xs" style={{ color: "#334155" }}>
              Or paste a screenshot from MT4/MT5 to auto-fill (coming Phase 3)
            </p>
          </>
        )}
      </div>
    </div>
  );
}
