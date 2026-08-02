"use client";

// ─── Scorecard picker ────────────────────────────────────────────────────────
// A hand-built, keyboard-first combobox. Replaces the wall of selectable
// buttons on the Asset and FX scorecards.
//
// Shared by both pages on purpose. The two data sets are genuinely different
// (assets carry a flag and a deferred flag; pairs carry neither) but the
// INTERACTION is identical, and the component only ever sees a normalised
// option — key, label, glyph, score, bias, note. It has no branch anywhere for
// "which scorecard am I serving", so it is not contorting itself for two
// masters: the pages adapt to the option shape, not the other way round.
//
// Every colour is a token; the panel's motion is CSS and is disabled under
// prefers-reduced-motion in lucid-theme.css.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";
import { shortcutAllowed } from "@/lib/shortcuts";

export interface PickerOption {
  key: string;
  /** What the trader reads: "EUR/USD", "USD", "Gold". */
  label: string;
  /** Flag(s) or emblem, if the data set has one. */
  glyph?: string;
  /** Current score, shown inline so the picker doubles as an overview. */
  score?: number | null;
  /** Bias word ("Bullish", "Neutral"…), shown under the label. */
  bias?: string | null;
  /** Status footnote, e.g. "Deferred". */
  note?: string | null;
  /** Extra text to match against ("euro dollar", "EU"). */
  keywords?: string;
}

function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "var(--lucid-ink-3)";
  if (score > 0) return "var(--lucid-pos)";
  if (score < 0) return "var(--lucid-neg)";
  return "var(--lucid-ink-2)";
}

function scoreText(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return score > 0 ? `+${score}` : `${score}`;
}

/** Fold "EUR/USD" → "eurusd" so typing "eurusd" or "eur/usd" or "usd" all hit. */
function fold(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readRecent(storageKey: string | undefined): string[] {
  if (!storageKey || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  return (
    <span
      className="lx-tnum"
      style={{
        fontFamily: "var(--lucid-font-mono)",
        fontSize: 12,
        color: scoreColor(score),
        minWidth: 26,
        textAlign: "right",
      }}
    >
      {scoreText(score)}
    </span>
  );
}

/** How far below/above the trigger the panel needs before it will fit, px. */
const PANEL_CLEARANCE = 340;

export function ScorecardPicker({
  options,
  value,
  onChange,
  label,
  /** localStorage key for the recently-viewed list. Omit to disable it. */
  recentStorageKey,
  /** Single-character shortcut that opens the picker from anywhere on the page. */
  shortcut = "/",
  /**
   * Supply the trigger's INSIDES and the picker still owns the button — the
   * click, the keyboard, aria-haspopup/expanded, the focus target. The popover
   * itself (search, keyboard walk, Escape, Recent, score display, focus return)
   * is untouched; only what it hangs off changes. Omit for the built-in pill.
   */
  triggerContent,
  triggerClassName,
  triggerStyle,
  triggerLabel,
  /**
   * "match-trigger" (default) sizes the panel to the trigger, which is right for
   * the pill. "fixed" gives it its own readable measure, for when the trigger is
   * a whole card and stretching the list across it would be absurd.
   */
  panelWidth = "match-trigger",
}: {
  options: PickerOption[];
  value: string;
  onChange: (key: string) => void;
  label: string;
  recentStorageKey?: string;
  shortcut?: string;
  triggerContent?: ReactNode;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  triggerLabel?: string;
  panelWidth?: "match-trigger" | "fixed";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [placement, setPlacement] = useState<"below" | "above">("below");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.key === value) ?? options[0];

  /** Read recents at the moment of opening — never during render, which would
   *  desync server and client markup, and never in an effect, which would cost
   *  a cascading render on every mount. */
  const openPanel = useCallback(() => {
    setRecent(readRecent(recentStorageKey));
    setQuery("");
    // Decide the side here, in the event that opens it — measuring in an effect
    // would mean one frame rendered on the wrong side, and a cascading render.
    // Below unless there genuinely isn't room and there is room above.
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      setPlacement(below < PANEL_CLEARANCE && rect.top > below ? "above" : "below");
    }
    setOpen(true);
  }, [recentStorageKey]);

  const commit = useCallback(
    (key: string) => {
      onChange(key);
      if (recentStorageKey && typeof window !== "undefined") {
        const next = [key, ...readRecent(recentStorageKey).filter((k) => k !== key)].slice(0, 3);
        setRecent(next);
        try {
          window.localStorage.setItem(recentStorageKey, JSON.stringify(next));
        } catch {
          // Storage unavailable (private mode / quota) — recents are a
          // convenience, never a requirement.
        }
      }
      setOpen(false);
    },
    [onChange, recentStorageKey],
  );

  // The flat, ordered list the keyboard walks. Recents float to the top, but
  // only while the trader is browsing — the moment they start typing, ranking
  // by anything other than the query is a surprise.
  const rows = useMemo(() => {
    const q = fold(query);
    const matches = q
      ? options.filter(
          (o) =>
            fold(o.label).includes(q) ||
            fold(o.key).includes(q) ||
            (o.keywords ? fold(o.keywords).includes(q) : false),
        )
      : options;

    if (q || recent.length === 0) {
      return matches.map((opt) => ({ opt, section: null as string | null }));
    }

    const recents = recent
      .map((k) => matches.find((o) => o.key === k))
      .filter((o): o is PickerOption => !!o);
    const rest = matches.filter((o) => !recents.includes(o));

    return [
      ...recents.map((opt, i) => ({ opt, section: i === 0 ? "Recent" : null })),
      ...rest.map((opt, i) => ({ opt, section: i === 0 && recents.length > 0 ? "All" : null })),
    ];
  }, [options, query, recent]);

  // Cursor placement, adjusted during render rather than in an effect (the
  // pattern LoadingState already uses in this codebase): opening lands on the
  // current selection so Enter alone is a no-op, and typing re-ranks the list
  // so the cursor returns to the top of it.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevQuery, setPrevQuery] = useState(query);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setPrevQuery(query);
    if (open) {
      const idx = rows.findIndex((r) => r.opt.key === value);
      setActiveIdx(idx >= 0 ? idx : 0);
    }
  } else if (prevQuery !== query) {
    setPrevQuery(query);
    setActiveIdx(0);
  }

  // Keep the active row in view without scrolling the page.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Click-away.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Page-level shortcut. The guard it runs through is the app's shared one
  // (src/lib/shortcuts.ts) — this hook's original inline version is what that
  // guard was extracted from, so behaviour here is unchanged, and there is now
  // exactly one definition of "the trader is busy, don't fire" in the codebase.
  useEffect(() => {
    if (open || !shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      // allowShift, for the same reason `?` needs it: `/` sits on a SHIFTED
      // position on several European layouts, and the guard must not veto a
      // key the layout can only produce with Shift held. `e.key` is the
      // character actually produced, so the comparison above is what decides.
      if (e.key !== shortcut || !shortcutAllowed(e, { allowShift: true })) return;
      e.preventDefault();
      openPanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, shortcut, openPanel]);

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((i) => (rows.length === 0 ? 0 : (i + 1) % rows.length));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((i) => (rows.length === 0 ? 0 : (i - 1 + rows.length) % rows.length));
        break;
      case "Home":
        e.preventDefault();
        setActiveIdx(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIdx(Math.max(0, rows.length - 1));
        break;
      case "Enter": {
        e.preventDefault();
        const row = rows[activeIdx];
        if (row) commit(row.opt.key);
        triggerRef.current?.focus();
        break;
      }
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  const custom = triggerContent !== undefined;

  return (
    <div className={`lx-picker ${custom ? "lx-picker-block" : ""}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName ?? "lx-picker-trigger"}
        style={triggerStyle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={triggerLabel ?? `${label}: ${selected?.label ?? "none"}. Press to change.`}
        onClick={() => {
          if (open) setOpen(false);
          else openPanel();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            openPanel();
          }
        }}
      >
        {custom ? (
          triggerContent
        ) : (
          <>
            {selected?.glyph && <span style={{ fontSize: 16, lineHeight: 1 }}>{selected.glyph}</span>}
            <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              <span className="lx-picker-name">{selected?.label ?? "—"}</span>
              <span className="lx-micro" style={{ letterSpacing: "0.06em" }}>
                {label}
                {selected?.bias ? ` · ${selected.bias}` : ""}
                {selected?.note ? ` · ${selected.note}` : ""}
              </span>
            </span>
            {selected && selected.score !== undefined && (
              <span
                className="lx-tnum"
                style={{
                  marginLeft: "auto",
                  fontFamily: "var(--lucid-font-mono)",
                  fontSize: 15,
                  color: scoreColor(selected.score),
                }}
              >
                {scoreText(selected.score)}
              </span>
            )}
            <ChevronDown size={15} className="lx-picker-chev" style={{ marginLeft: 8 }} />
          </>
        )}
      </button>

      {open && (
        <div
          className={`lx-picker-panel ${panelWidth === "fixed" ? "lx-picker-panel-fixed" : ""} ${
            placement === "above" ? "lx-picker-panel-above" : ""
          }`}
          role="dialog"
          aria-label={label}
        >
          <div className="lx-picker-search">
            <div style={{ position: "relative" }}>
              <Search
                size={13}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--lucid-ink-3)",
                  pointerEvents: "none",
                }}
              />
              <input
                ref={inputRef}
                // The panel only exists while open, so the search field is
                // focused on mount — no effect needed, and no focus steal.
                autoFocus
                className="lx-input"
                style={{ paddingLeft: 30 }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder="Type to filter…"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={rows[activeIdx] ? `${listId}-${activeIdx}` : undefined}
              />
            </div>
          </div>

          <div className="lx-picker-list" ref={listRef} id={listId} role="listbox" aria-label={label}>
            {rows.length === 0 && (
              <p className="lx-picker-empty lx-micro">Nothing matches “{query}”.</p>
            )}
            {rows.map((row, idx) => (
              <div key={row.opt.key}>
                {row.section && (
                  <p className="lx-picker-group lx-eyebrow" aria-hidden="true">
                    {row.section}
                  </p>
                )}
                <button
                  type="button"
                  role="option"
                  id={`${listId}-${idx}`}
                  data-idx={idx}
                  aria-selected={row.opt.key === value}
                  className={`lx-picker-option ${idx === activeIdx ? "is-active" : ""} ${
                    row.opt.key === value ? "is-selected" : ""
                  }`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => {
                    commit(row.opt.key);
                    triggerRef.current?.focus();
                  }}
                >
                  {row.opt.glyph && (
                    <span style={{ fontSize: 14, lineHeight: 1 }} aria-hidden="true">
                      {row.opt.glyph}
                    </span>
                  )}
                  <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: "var(--lucid-font-sans)",
                        fontSize: 13,
                        color: "inherit",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.opt.label}
                    </span>
                    {(row.opt.bias || row.opt.note) && (
                      <span className="lx-micro">
                        {[row.opt.bias, row.opt.note].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  <span style={{ marginLeft: "auto" }}>
                    <ScoreBadge score={row.opt.score} />
                  </span>
                </button>
              </div>
            ))}
          </div>

          <div className="lx-picker-foot lx-micro">
            <span>
              <span className="lx-picker-key">↑</span> <span className="lx-picker-key">↓</span> move
            </span>
            <span>
              <span className="lx-picker-key">↵</span> select
            </span>
            <span>
              <span className="lx-picker-key">esc</span> cancel
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
