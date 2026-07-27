"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ApiPair } from "@/lib/api/trading";
import type { PairBias } from "./dashboard-helpers";

// ─── The alignment field ──────────────────────────────────────────────────────
// A floating composition of orbs suspended in dark space — NOT a chart. There
// is no axis, no scale, no tick, no baseline, no tether: those read as an
// analysis tool, and the scorecard pages are where analysis lives. This is the
// dashboard's centrepiece, so it trades precision for atmosphere.
//
// Every orb is still the same pair, the same score, the same bias, and the same
// click-through target it has always been. Built from DOM elements + CSS only —
// no canvas, no animation library.

// Working range for horizontal placement. Deliberately NOT the theoretical
// maximum (±16 / ±17): real scores cluster in the middle, so scaling against
// the theoretical max leaves both ends permanently empty and squeezes every orb
// into the centre. ±8 is the range scores actually occupy; anything beyond it
// clamps to the edge, so an outlier sits at the far edge without compressing
// everyone else inward.
const WORKING_RANGE = 8;

// Horizontal span, as a percentage of the container. The composition uses its
// full width rather than hugging the middle.
const X_MIN = 8;
const X_MAX = 92;

// Vertical band. Position here carries NO meaning — it exists to scatter the
// composition, and is therefore free to move during collision relaxation.
// Sits high in its box on purpose: the hero is `justify-between` over 100vh,
// so the field's box already starts below a tall top block, and the dock is
// fixed at the viewport bottom. Scattering to 78% put the lowest orbs (plus
// their labels and halos) uncomfortably close to the dock.
const Y_MIN = 12;
const Y_MAX = 64;

// Orb geometry. Size is a secondary cue only; glow carries the weight.
const SIZE_BASE = 46;
const SIZE_MIN = 38;
const SIZE_MAX = 60;

// Label box, in percent of the container, used for collision relaxation only.
const LABEL_W_PCT = 11;
const LABEL_H_PCT = 15;

interface FieldOrb {
  key: string;
  label: string;
  score: number | null;
  isNifty: boolean;
  hasOpenPosition: boolean;
  href: string;
  ariaLabel: string;
}

type PlacedOrb = FieldOrb & { x: number; y: number };

function biasDirectionLabel(score: number | null): string {
  if (score === null) return "no data";
  if (score > 0) return "long bias";
  if (score < 0) return "short bias";
  return "flat";
}

function orbColor(score: number | null): string {
  if (score === null || score === 0) return "var(--lucid-ink-3)";
  return score > 0 ? "var(--lucid-pos)" : "var(--lucid-neg)";
}

/** Deterministic 0..1 from a stable string (the pair symbol). Used for vertical
 *  placement and motion phase so the composition looks scattered but never
 *  jumps between renders — the same symbol always lands in the same place. */
function stableUnit(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return (h % 1000) / 1000;
}

/** A second, decorrelated hash from the same string, so an orb's vertical
 *  position and its motion phase don't move together. */
function stableUnit2(key: string): number {
  let h = 7;
  for (let i = key.length - 1; i >= 0; i--) {
    h = (h * 131 + key.charCodeAt(i) * 17) >>> 0;
  }
  return (h % 997) / 997;
}

function clampX(x: number): number {
  return Math.max(X_MIN, Math.min(X_MAX, x));
}

/** Score → horizontal percent, against the WORKING range, clamped to the span.
 *  Missing/zero sits at centre. */
function scoreToX(score: number | null): number {
  const mid = (X_MIN + X_MAX) / 2;
  if (score === null || score === 0) return mid;
  const t = Math.max(-1, Math.min(1, score / WORKING_RANGE));
  return mid + t * ((X_MAX - X_MIN) / 2);
}

/**
 * Places every orb, then relaxes label collisions in two dimensions.
 *
 * Halos overlapping is the point of the design and is left alone; only LABEL
 * boxes are separated. Vertical position carries no meaning, so it absorbs
 * nearly all of the correction — horizontal is nudged only as a last resort,
 * because horizontal is the axis that actually encodes bias.
 */
function layoutOrbs(orbs: FieldOrb[]): PlacedOrb[] {
  const placed: PlacedOrb[] = orbs.map((o) => ({
    ...o,
    x: scoreToX(o.score),
    // Scatter across the vertical band deterministically.
    y: Y_MIN + stableUnit(o.key) * (Y_MAX - Y_MIN),
  }));

  // Pre-spread exact ties. Orbs sharing a score sit at the identical x — very
  // common at zero, and universal before the first scores land — and pairwise
  // relaxation cannot separate a fully-stacked column: every nudge re-collides
  // with the next neighbour, so the passes expire still overlapping. Dealing
  // each tied group its own vertical slot up front solves it structurally,
  // costs no horizontal drift, and keeps the whole layout deterministic.
  const byX = new Map<number, PlacedOrb[]>();
  for (const o of placed) {
    const group = byX.get(o.x);
    if (group) group.push(o);
    else byX.set(o.x, [o]);
  }
  for (const group of byX.values()) {
    if (group.length < 2) continue;
    // Stable order (by key) so the same set always deals the same way.
    group.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

    // The band fits floor(height / label height) orbs in a single column. Past
    // that, a tied group physically cannot stack — nine 15%-tall labels need
    // 135% of a 52% band — so it wraps into as many columns as it needs and
    // fans them symmetrically around the score's own x. Ties carry no bias
    // information to lose (they all scored the same), so spending horizontal
    // room here costs nothing; only tied orbs are ever moved sideways.
    const perColumn = Math.max(1, Math.floor((Y_MAX - Y_MIN) / LABEL_H_PCT));
    const columns = Math.ceil(group.length / perColumn);
    const spread = (columns - 1) * LABEL_W_PCT;
    // Anchor the fan so it stays inside the span. Clamping each column
    // independently would collapse several of them onto the same edge x when
    // the tie sits at ±max (every orb scoring +12, say) — which is exactly a
    // case that needs the columns to stay distinct.
    const leftX = Math.max(X_MIN, Math.min(X_MAX - spread, group[0].x - spread / 2));

    group.forEach((o, idx) => {
      const col = Math.floor(idx / perColumn);
      const rowsHere = Math.min(perColumn, group.length - col * perColumn);
      const row = idx % perColumn;
      const step = (Y_MAX - Y_MIN) / rowsHere;
      o.y = Y_MIN + step * (row + 0.5);
      o.x = clampX(leftX + col * LABEL_W_PCT);
    });
  }

  const PASSES = 24;
  for (let pass = 0; pass < PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = LABEL_W_PCT - Math.abs(dx);
        const overlapY = LABEL_H_PCT - Math.abs(dy);
        // Label boxes only collide when they overlap on BOTH axes.
        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;

        // Push apart vertically first — free axis, no meaning attached.
        const signY = dy === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dy);
        const shiftY = (overlapY / 2 + 0.5) * signY;
        const beforeY = { a: a.y, b: b.y };
        a.y = Math.max(Y_MIN, Math.min(Y_MAX, a.y - shiftY));
        b.y = Math.max(Y_MIN, Math.min(Y_MAX, b.y + shiftY));

        // Fall back to a horizontal nudge only when the vertical push actually
        // failed to buy separation — i.e. the clamp above ate most of it. Test
        // the movement we GOT, not whether an orb happens to sit on the band
        // edge: two orbs colliding mid-band with the same x (a score tie at
        // centre) are never "pinned", so an edge test lets them shove each
        // other vertically forever and the passes expire still overlapping.
        const gainedY = Math.abs(a.y - beforeY.a) + Math.abs(b.y - beforeY.b);
        if (gainedY < Math.abs(shiftY)) {
          const signX = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx);
          // Enough to actually clear the label box, capped so a crowded field
          // can't drag an orb far from the position its score earned.
          const shiftX = Math.min(overlapX / 2 + 0.5, 3) * signX;
          a.x = clampX(a.x - shiftX);
          b.x = clampX(b.x + shiftX);
        }
      }
    }
    if (!moved) break;
  }

  return placed;
}

/** One orb: halo, glass body, specular highlight, optional position ring, and
 *  its label — all inside a single focusable link. */
function Orb({
  orb,
  onNavigate,
  reducedMotion,
}: {
  orb: PlacedOrb;
  onNavigate: (href: string) => void;
  reducedMotion: boolean;
}) {
  const color = orbColor(orb.score);
  const missing = orb.score === null || orb.score === 0;

  // Signal strength 0..1 against the same working range the x-position uses.
  const strength = orb.score === null ? 0 : Math.min(1, Math.abs(orb.score) / WORKING_RANGE);

  // Size: subtle variance around the base. Weakest ≈38px, strongest ≈60px.
  const size = missing
    ? SIZE_MIN + 4
    : strength < 0.5
      ? SIZE_MIN + (SIZE_BASE - SIZE_MIN) * (strength / 0.5)
      : SIZE_BASE + (SIZE_MAX - SIZE_BASE) * ((strength - 0.5) / 0.5);

  // Halo: 3.2× the body, opacity 0.12 (weakest) → 0.30 (strongest). Missing
  // data reads noticeably dimmer than any live orb.
  const haloSize = size * 3.2;
  const haloOpacity = missing ? 0.08 : 0.12 + strength * 0.18;

  // Deterministic motion phase — stable per symbol, decorrelated from position.
  const phase = stableUnit2(orb.key);
  const floatDuration = 7 + phase * 6; // 7–13s
  const floatDelay = -(phase * 11); // staggered, so nothing pulses in unison
  const ringDuration = 9 + phase * 3; // 9–12s

  return (
    <div
      className="absolute"
      style={{
        left: `${orb.x}%`,
        top: `${orb.y}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Float wrapper — keeps the drift transform off the link, so hover
          scale and the ambient float never fight over `transform`. */}
      <div
        className={reducedMotion ? "" : "lucid-orb-float"}
        style={
          reducedMotion
            ? undefined
            : { animationDuration: `${floatDuration}s`, animationDelay: `${floatDelay}s` }
        }
      >
        <Link
          href={orb.href}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(orb.href);
          }}
          aria-label={orb.ariaLabel}
          className="lucid-orb-link relative flex flex-col items-center"
        >
          {/* Halo — wide, soft, unbordered, unclipped. Neighbouring halos
              overlapping is the whole effect; nothing may clip them. */}
          <span
            aria-hidden="true"
            className="lucid-orb-halo absolute rounded-full pointer-events-none"
            style={{
              width: haloSize,
              height: haloSize,
              left: "50%",
              top: size / 2,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, color-mix(in srgb, ${color} ${Math.round(haloOpacity * 100)}%, transparent) 0%, transparent 68%)`,
            }}
          />

          {/* Open-position ring — slow dashed rotation, 8px outside the body. */}
          {orb.hasOpenPosition && (
            <span
              aria-hidden="true"
              className={`absolute rounded-full pointer-events-none ${reducedMotion ? "" : "lucid-ring-spin"}`}
              style={{
                width: size + 16,
                height: size + 16,
                left: "50%",
                top: size / 2,
                marginLeft: -(size + 16) / 2,
                marginTop: -(size + 16) / 2,
                border: `1px dashed color-mix(in srgb, ${color} 55%, transparent)`,
                animationDuration: reducedMotion ? undefined : `${ringDuration}s`,
              }}
            />
          )}

          {/* Body — a glass sphere: light from the upper-left, falling to
              near-transparent at the edge, with a hairline rim. */}
          <span
            className="lucid-orb-body relative rounded-full"
            style={{
              width: size,
              height: size,
              background: `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${color} ${missing ? 42 : 72}%, transparent) 0%, color-mix(in srgb, ${color} ${missing ? 16 : 28}%, transparent) 45%, color-mix(in srgb, ${color} 6%, transparent) 100%)`,
              border: `1px solid color-mix(in srgb, ${color} ${missing ? 24 : 45}%, transparent)`,
            }}
          >
            {/* Specular highlight — the detail that makes it a sphere. */}
            <span
              aria-hidden="true"
              className="absolute rounded-full pointer-events-none"
              style={{
                width: size * 0.26,
                height: size * 0.26,
                left: "26%",
                top: "22%",
                background: `radial-gradient(circle, var(--lucid-orb-specular) 0%, transparent 70%)`,
                opacity: missing ? 0.4 : 0.85,
              }}
            />
          </span>

          {/* Label — symbol, then score on the line below. 12px clear of body. */}
          <span
            className="flex flex-col items-center pointer-events-none"
            style={{ marginTop: 12 }}
          >
            <span
              className="lucid-orb-label"
              style={{
                fontFamily: "var(--lucid-font-mono)",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.08em",
                color: "var(--lucid-ink)",
                whiteSpace: "nowrap",
              }}
            >
              {orb.label}
            </span>
            <span
              style={{
                fontFamily: "var(--lucid-font-mono)",
                fontSize: 9.5,
                fontVariantNumeric: "tabular-nums",
                color,
                whiteSpace: "nowrap",
              }}
            >
              {orb.score !== null ? `${orb.score > 0 ? "+" : ""}${orb.score}` : "—"}
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}

export function AlignmentField({
  pairsConfig,
  biasByPair,
  niftyNetScore,
  livePairSymbols,
  onNavigate,
  reducedMotion,
}: {
  pairsConfig: ApiPair[];
  biasByPair: Map<string, PairBias>;
  niftyNetScore: number | null;
  livePairSymbols: Set<string>;
  onNavigate: (href: string) => void;
  reducedMotion: boolean;
}) {
  const orbs = useMemo<FieldOrb[]>(() => {
    const fx: FieldOrb[] = pairsConfig.map((pair) => {
      const data = biasByPair.get(pair.symbol);
      const score = data?.score ?? null;
      const target =
        pair.symbol === "XAUUSD"
          ? "/oracle/scorecard"
          : biasByPair.has(pair.symbol)
          ? "/oracle/fx-scorecard"
          : "/oracle";
      return {
        key: pair.symbol,
        label: pair.display_name,
        score,
        isNifty: false,
        hasOpenPosition: livePairSymbols.has(pair.symbol),
        href: target,
        ariaLabel: `${pair.display_name}, score ${score !== null ? score : "unavailable"}, ${biasDirectionLabel(score)}`,
      };
    });

    const nifty: FieldOrb = {
      key: "NIFTY",
      label: "NIFTY",
      score: niftyNetScore,
      isNifty: true,
      hasOpenPosition: false,
      href: "/nifty/scorecard",
      ariaLabel: `NIFTY 50 macro, net score ${niftyNetScore !== null ? niftyNetScore : "unavailable"}, ${biasDirectionLabel(niftyNetScore)}`,
    };

    return [...fx, nifty];
  }, [pairsConfig, biasByPair, niftyNetScore, livePairSymbols]);

  const positioned = useMemo(() => layoutOrbs(orbs), [orbs]);

  return (
    // `overflow-visible` is load-bearing: halos extend well past each orb and
    // clipping them would flatten the composition back into circles on a page.
    <div
      className="relative w-full h-full min-h-[340px] overflow-visible"
      role="group"
      aria-label="Fundamental bias alignment field"
    >
      {positioned.map((orb) => (
        <Orb key={orb.key} orb={orb} onNavigate={onNavigate} reducedMotion={reducedMotion} />
      ))}
    </div>
  );
}
