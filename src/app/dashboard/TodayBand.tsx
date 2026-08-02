"use client";

// ─── Band 3 — Today ──────────────────────────────────────────────────────────
// The full-bleed breath between two data-heavy bands. Nothing here is fetched:
// the only input is the wall clock, and everything else is geometry.
//
// The NIFTY macro pulse card spans beneath both columns rather than sitting
// inside the left one — see the note above it.

import { useSyncExternalStore } from "react";
import { usePrefersReducedMotion } from "@/components/motion";
import type { PublicScorecard } from "@/lib/api/nifty";
import { SessionGlobe } from "./SessionGlobe";
import { NiftyPulseBand } from "./NiftyPulseBand";
import { SESSIONS, isSessionOpen, nextOpening } from "./sessions";

// ── Clock ────────────────────────────────────────────────────────────────────
// useSyncExternalStore, the same primitive motion.tsx uses, so the server and
// the hydrating client agree: both render the placeholder, and only then does
// the real time appear. A `new Date()` read during render would mismatch.
// The snapshot is bucketed to 15s so it is referentially stable between
// renders; HH:MM and an "Xh Ym" countdown need nothing finer.
const TICK_MS = 15000;

function subscribeClock(onChange: () => void): () => void {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
}
function clockSnapshot(): number {
  return Math.floor(Date.now() / TICK_MS);
}
function clockServerSnapshot(): number {
  return 0;
}

function useClock(): Date | null {
  const bucket = useSyncExternalStore(subscribeClock, clockSnapshot, clockServerSnapshot);
  return bucket === 0 ? null : new Date(bucket * TICK_MS);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function TodayBand({
  niftyLatestLoading,
  niftyLatest,
  niftyHistory,
}: {
  niftyLatestLoading: boolean;
  niftyLatest: PublicScorecard | undefined;
  niftyHistory: number[];
}) {
  const reducedMotion = usePrefersReducedMotion();
  const now = useClock();

  const utcHours = now ? now.getUTCHours() + now.getUTCMinutes() / 60 : 0;
  const openSessions = now ? SESSIONS.filter((s) => isSessionOpen(s, utcHours)) : [];
  const next = now ? nextOpening(utcHours) : null;

  // IST, the timezone the rest of this app reasons in (see getGreeting).
  const ist = now ? new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000) : null;

  return (
    <section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:items-center">
        {/* ── Left: the written account ── */}
        <div>
          <div className="lx-eyebrow">Today</div>
          <h2 className="dash-title">
            {!now
              ? "Session clock"
              : openSessions.length > 0
                ? `${openSessions.length} market${openSessions.length === 1 ? "" : "s"} open`
                : "Markets closed"}
          </h2>
          <p className="lx-body" style={{ marginTop: 14, maxWidth: 400 }}>
            Currency markets have no exchange — liquidity moves around the planet. The dial is
            24 hours UTC; each ring is one session.
          </p>

          <div style={{ marginTop: 28 }}>
            {SESSIONS.map((s) => {
              const open = now ? isSessionOpen(s, utcHours) : false;
              return (
                <div key={s.id} className="dash-session">
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 999,
                        background: open ? `var(${s.token})` : "var(--lucid-line-2)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--lucid-font-mono)",
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: "0.16em",
                        color: open ? "var(--lucid-ink)" : "var(--lucid-ink-3)",
                      }}
                    >
                      {s.id}
                    </span>
                  </div>
                  <span
                    className="lx-tnum"
                    style={{
                      fontFamily: "var(--lucid-font-mono)",
                      fontSize: 10,
                      color: open ? `var(${s.token})` : "var(--lucid-ink-3)",
                    }}
                  >
                    {open ? "OPEN" : `${pad(Math.floor(s.start))}:${pad(Math.round((s.start % 1) * 60))} UTC`}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-end gap-10" style={{ marginTop: 26 }}>
            <div>
              <div className="lx-eyebrow">Local · IST</div>
              <div className="lx-metric-sm lx-tnum" style={{ marginTop: 7 }}>
                {ist ? `${pad(ist.getHours())}:${pad(ist.getMinutes())}` : "—"}
              </div>
            </div>
            <div>
              <div className="lx-eyebrow">Next open · {next ? next.session.id : "—"}</div>
              <div className="lx-metric-sm lx-tnum" style={{ marginTop: 7 }}>
                {next
                  ? `${pad(Math.floor(next.hours))}h ${pad(Math.floor((next.hours % 1) * 60))}m`
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: the globe. Fixed height so the canvas mounting after
            hydration cannot shift anything around it. ── */}
        <div className="relative" style={{ height: 380 }}>
          {now && <SessionGlobe utcHours={utcHours} reducedMotion={reducedMotion} />}
        </div>
      </div>

      {/* ── NIFTY macro pulse — spanning both columns.
          Its card is a single wide row (identity, three composites, sparkline,
          CTA) and is designed to breathe horizontally; nesting it in the left
          column would force that row to wrap into a stack and would leave the
          left side twice the height of the globe. Full width beneath both keeps
          the two-column composition balanced and gives the card its natural
          shape. Every state and field it renders is untouched. ── */}
      <div style={{ marginTop: 40, paddingTop: 36, borderTop: "1px solid var(--lucid-line)" }}>
        <NiftyPulseBand
          niftyLatestLoading={niftyLatestLoading}
          niftyLatest={niftyLatest}
          niftyHistory={niftyHistory}
        />
      </div>
    </section>
  );
}
