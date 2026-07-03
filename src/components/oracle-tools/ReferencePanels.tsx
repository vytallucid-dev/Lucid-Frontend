"use client";

// ─── Reference panels rendered inside the Tools Launcher Drawer ─────────────
//
// Rate-Cycle Stance: now LIVE — reads /api/oracle/cycle-stances (effective-dated
// central-bank stance per currency).
//
// This-Week Calendar: still a shell + flag — no aggregated calendar endpoint
// exists yet (heatmap only carries a per-indicator nextRelease string).

import { useQuery } from "@tanstack/react-query";
import { getCycleStances, type CycleStanceEntry } from "@/lib/api/oracle";

const CURRENCY_FLAG: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
};

function stanceStyle(stance: CycleStanceEntry["stance"]): { color: string; bg: string; bd: string } {
  switch (stance) {
    case "HIKING":
      return { color: "var(--lucid-pos)", bg: "var(--lucid-pos-bg)", bd: "var(--lucid-pos-bd)" };
    case "CUTTING":
      return { color: "var(--lucid-neg)", bg: "var(--lucid-neg-bg)", bd: "var(--lucid-neg-bd)" };
    default:
      return { color: "var(--lucid-ink-2)", bg: "var(--lucid-surface-3)", bd: "var(--lucid-line-2)" };
  }
}

export function RateCycleStancePanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["oracle", "cycle-stances"],
    queryFn: getCycleStances,
    staleTime: 10 * 60 * 1000,
  });

  const stances = data?.stances ?? [];

  return (
    <div className="lt-card-2 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="lt-eyebrow">Rate-Cycle Stance</span>
      </div>
      {isLoading ? (
        <p className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
          Loading stances…
        </p>
      ) : error ? (
        <p className="text-xs" style={{ color: "var(--lucid-neg)" }}>
          Couldn&apos;t load cycle stances.
        </p>
      ) : stances.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--lucid-ink-3)" }}>
          No active stances recorded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {stances.map((s) => {
            const st = stanceStyle(s.stance);
            return (
              <div key={s.currencyCode} className="flex items-center justify-between gap-2">
                <span className="text-sm flex items-center gap-1.5" style={{ color: "var(--lucid-ink)" }}>
                  <span>{CURRENCY_FLAG[s.currencyCode] ?? ""}</span>
                  {s.currencyCode}
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
                  style={{ background: st.bg, color: st.color, border: `1px solid ${st.bd}` }}
                  title={s.notes ?? undefined}
                >
                  {s.stance}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ThisWeekCalendarPanel() {
  return (
    <div className="lt-card-2 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="lt-eyebrow">This-Week Calendar</span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "var(--lucid-ink-3)" }}>
        Not available yet — the heatmap API only carries a single next-release date per
        indicator, with no aggregated &quot;this week across all six instruments&quot; endpoint. Needs a
        backend aggregation endpoint.
      </p>
    </div>
  );
}
