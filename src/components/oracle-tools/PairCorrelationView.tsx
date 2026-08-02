"use client";

// NOTE: Pair Correlation is a relationship view, not a time-series trend, so it
// is intentionally NOT built on the ApexCharts analysis shell (FullScreenAnalysis).
// It is left as the current snapshot-alignment view and FLAGGED for its own
// dedicated design pass (a proper correlation matrix / relationship visual).

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { LoadingState } from "@/components/state/LoadingState";
import { ErrorState } from "@/components/state/ErrorState";
import { fetchPairAlignmentSnapshot, type CorrelationRow } from "./adapters";

interface PairCorrelationViewProps {
  onClose: () => void;
}

function DirectionIcon({ direction }: { direction: CorrelationRow["direction"] }) {
  if (direction === "up") return <ArrowUp size={16} style={{ color: "var(--lucid-pos)" }} />;
  if (direction === "down") return <ArrowDown size={16} style={{ color: "var(--lucid-neg)" }} />;
  return <Minus size={16} style={{ color: "var(--lucid-ink-3)" }} />;
}

export function PairCorrelationView({ onClose }: PairCorrelationViewProps) {
  const query = useQuery({
    queryKey: ["oracle", "tools", "pair-correlation"],
    queryFn: fetchPairAlignmentSnapshot,
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const rows = query.data ?? [];
  const aligned = rows.filter((r) => r.direction === "up");
  const diverged = rows.filter((r) => r.direction === "down");
  const flat = rows.filter((r) => r.direction === "flat");

  return (
    // data-lucid-overlay marks this as an overlay for the global shortcut guard.
    <div data-lucid-overlay className="fixed inset-0 z-[100] flex flex-col" style={{ background: "var(--lucid-bg)" }}>
      <div
        className="shrink-0 flex items-center justify-between gap-4 px-4 sm:px-6 py-4"
        style={{ borderBottom: "1px solid var(--lucid-line)" }}
      >
        <span className="lt-eyebrow">Pair Correlation</span>
        <button
          onClick={onClose}
          className="p-2 rounded-md transition-colors hover:bg-white/5"
          style={{ color: "var(--lucid-ink-3)" }}
          title="Close (Esc)"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="lt-serif text-2xl font-semibold" style={{ color: "var(--lucid-ink)" }}>
              Current Alignment — Active Pairs
            </h1>
            <p className="text-sm max-w-3xl leading-relaxed" style={{ color: "var(--lucid-ink-2)" }}>
              This view shows <strong>score-direction alignment</strong>, not true price correlation.
              A shared price-correlation data source is not wired into Oracle yet — instruments below
              are grouped by whether their current fundamental score points bullish or bearish, as a
              stand-in confirmation filter.
            </p>
          </div>

          {query.isLoading ? (
            <LoadingState message="Loading pair alignment..." />
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { title: "Bullish alignment", rows: aligned, colorVar: "--lucid-pos" },
                  { title: "Bearish alignment", rows: diverged, colorVar: "--lucid-neg" },
                  { title: "Flat / neutral", rows: flat, colorVar: "--lucid-ink-3" },
                ].map((group) => (
                  <div key={group.title} className="lt-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="lt-eyebrow">{group.title}</span>
                      <span className="lt-num text-sm" style={{ color: `var(${group.colorVar})` }}>
                        {group.rows.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {group.rows.length === 0 ? (
                        <span className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
                          None
                        </span>
                      ) : (
                        group.rows.map((r) => (
                          <div key={r.id} className="flex items-center justify-between">
                            <span className="text-sm" style={{ color: "var(--lucid-ink)" }}>
                              {r.label}
                            </span>
                            <span className="lt-num text-xs" style={{ color: `var(${group.colorVar})` }}>
                              {r.score !== null ? (r.score > 0 ? `+${r.score}` : r.score) : "—"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="lt-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--lucid-line)" }}>
                      <th className="lt-eyebrow text-left px-4 py-3">Instrument</th>
                      <th className="lt-eyebrow text-right px-4 py-3">Score</th>
                      <th className="lt-eyebrow text-right px-4 py-3">Bias</th>
                      <th className="lt-eyebrow text-center px-4 py-3">Direction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} style={{ borderBottom: "1px solid var(--lucid-line)" }}>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--lucid-ink)" }}>
                          {r.label}
                        </td>
                        <td className="px-4 py-3 text-sm text-right lt-num" style={{ color: "var(--lucid-ink)" }}>
                          {r.score !== null ? (r.score > 0 ? `+${r.score}` : r.score) : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right" style={{ color: "var(--lucid-ink-2)" }}>
                          {r.bias ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center">
                            <DirectionIcon direction={r.direction} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
