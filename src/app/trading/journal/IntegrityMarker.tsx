"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import type { Trade } from "@/lib/demo-data";
import { isTradeFlagged } from "@/lib/stats";

/**
 * The needs-attention marker: a single danger glyph beside the instrument, and
 * a proper hover card rather than a browser tooltip.
 *
 * A word-badge on every flagged row competes with the pair name for the one
 * place the eye lands. A glyph reads instantly and costs almost no width; the
 * detail belongs in the card, where it can be laid out — field, severity,
 * message — instead of being crushed into a single-line `title` with no
 * formatting and a half-second delay.
 *
 * ── WHY THIS IS A PORTAL ────────────────────────────────────────────────────
 * The marker lives in a <td> that sets `overflow: hidden` (so long values
 * ellipsize) inside a horizontally scrolling container. An absolutely
 * positioned card in that subtree is clipped to the cell — it renders squashed
 * inside the row, or not at all. Nothing about z-index fixes that; only leaving
 * the clipping context does. So the card renders into <body> at fixed
 * coordinates measured from the trigger, and flips when it would run off the
 * viewport.
 *
 * `trade.integrity` is computed server-side. Nothing here decides correctness.
 */
const CARD_WIDTH = 340;
const GAP = 8;

interface CardPosition {
  top: number;
  left: number;
  width: number;
  placeAbove: boolean;
}

export function IntegrityMarker({ trade }: { trade: Trade }) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  // Null until the marker is hovered or focused. No mount flag is needed: the
  // portal only renders once a position exists, and a position can only be set
  // by a pointer or focus event — neither of which happens on the server.
  const [position, setPosition] = useState<CardPosition | null>(null);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(CARD_WIDTH, window.innerWidth - 24);
    // Prefer left-aligned to the glyph; pull back inside the viewport when the
    // row is near the right edge, which it often is on a wide, scrolled table.
    const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
    // Flip above when there is not enough room below — a flagged row near the
    // bottom of a long journal is the common case.
    const placeAbove = r.bottom + GAP + 240 > window.innerHeight && r.top > 260;
    setPosition({
      top: placeAbove ? r.top - GAP : r.bottom + GAP,
      left,
      width,
      placeAbove,
    });
  }, []);

  const open = useCallback(() => place(), [place]);
  const close = useCallback(() => setPosition(null), []);

  // A card measured against the viewport has to be dismissed when the viewport
  // moves under it, rather than floating away from its row.
  useEffect(() => {
    if (!position) return;
    const onMove = (): void => close();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [position, close]);

  if (!isTradeFlagged(trade)) return null;
  const problems = trade.integrity.problems;

  return (
    <>
      <span
        ref={triggerRef}
        role="img"
        aria-label={`Needs attention: ${problems.length} issue${problems.length === 1 ? "" : "s"}`}
        tabIndex={0}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          flexShrink: 0,
          borderRadius: 5,
          background: "var(--lucid-neg-bg)",
          border: "1px solid var(--lucid-neg-bd)",
          color: "var(--lucid-neg)",
          cursor: "help",
          outline: "none",
        }}
      >
        <AlertTriangle size={11} strokeWidth={2.5} />
      </span>

      {position &&
        createPortal(
          <div
            role="tooltip"
            onMouseEnter={open}
            onMouseLeave={close}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              transform: position.placeAbove ? "translateY(-100%)" : undefined,
              zIndex: 90,
              width: position.width,
              padding: 12,
              borderRadius: 10,
              background: "var(--lucid-grad-surface-2)",
              border: "1px solid var(--lucid-neg-bd)",
              boxShadow: "var(--lucid-elev-2)",
              cursor: "default",
              textAlign: "left",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--lucid-neg)",
                marginBottom: 9,
              }}
            >
              <AlertTriangle size={11} />
              Needs attention · {problems.length} {problems.length === 1 ? "issue" : "issues"}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {problems.map((pr, i) => (
                <div
                  key={`${pr.field}-${pr.execution_id ?? "trade"}-${i}`}
                  style={{ borderLeft: "2px solid var(--lucid-neg-bd)", paddingLeft: 9 }}
                >
                  <div
                    style={{
                      fontFamily: "var(--lucid-font-mono)",
                      fontSize: 10,
                      color: "var(--lucid-ink-3)",
                      letterSpacing: "0.04em",
                      marginBottom: 2,
                    }}
                  >
                    {pr.field}
                    {pr.severity === "blocking" ? " · blocking" : ""}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--lucid-ink-2)" }}>{pr.message}</div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 10,
                paddingTop: 8,
                borderTop: "1px solid var(--lucid-line)",
                fontSize: 11,
                lineHeight: 1.5,
                color: "var(--lucid-ink-3)",
              }}
            >
              Excluded from every edge statistic until fixed. Open the trade to correct it — the flag clears itself.
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
