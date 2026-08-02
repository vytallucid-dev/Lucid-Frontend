// ─── Alignment field geometry ────────────────────────────────────────────────
// Pure functions: sizing, label-box metrics, and collision relaxation for the
// Dashboard's alignment field. No React, no DOM, no styling — kept separate
// from AlignmentField.tsx so the layout can be reasoned about (and exercised
// against pathological score sets) on its own.

// Working range for horizontal placement. Deliberately NOT the theoretical
// maximum (±16 / ±17): real scores cluster in the middle, so scaling against
// the theoretical max leaves both ends permanently empty and squeezes every orb
// into the centre. ±8 is the range scores actually occupy.
export const WORKING_RANGE = 8;

// Horizontal span, as a percentage of the container.
export const X_MIN = 8;
export const X_MAX = 92;

// Vertical band. Position here carries NO meaning — it exists to scatter the
// composition, and is therefore free to absorb collision correction. Widened
// slightly from the previous 12–64 now that weak orbs carry a one-line label
// (they need less height each, but the band needs the room for the tall ones).
export const Y_MIN = 10;
export const Y_MAX = 70;

// ─── Size ────────────────────────────────────────────────────────────────────
// size(|s|) = SIZE_ZERO + K·|s|^γ, clamped at SIZE_MAX.
//
// γ = 1.08 — an exponent above 1, so each additional point of score is worth
// MORE pixels than the one before it, which is the same thing as saying weak
// signals shrink faster than linear. It is fitted, not guessed: the required
// band centres are (0 → 26), (1.5 → 34), (3.5 → 46), (5.5 → 59). Solving the
// first two for a power law gives γ = ln(2.5)/ln(7/3) = 1.081 and K = 5.16;
// substituting back predicts 32.6 at |s| = 5.5 against a target of 33. Every
// integer score therefore lands within ~1.1px of its required band:
//   0 → 26 · 1 → 31.2 · 2 → 36.9 · 3 → 42.9 · 4 → 49.1 · 5 → 55.6 · 6+ → 62
// A steeper exponent would satisfy "shrinks faster" more dramatically but
// would collapse |s| = 1 onto the zero size, which the spec explicitly
// separates (24–28 vs 32–36). This is the steepest curve that still hits every
// band, so the curvature is as aggressive as the required anchors allow.
export const SIZE_ZERO = 26;
export const SIZE_MAX = 62;
const SIZE_K = 5.2;
const SIZE_GAMMA = 1.08;

// NIFTY is a different kind of instrument (an index, not a pair), so it keeps a
// small constant premium at equivalent strength rather than a bigger score.
export const NIFTY_PREMIUM = 1.07;

export type LabelMode = "full" | "weak" | "idle";

/** Zero/null → symbol only, smallest and most muted. |score| ≤ 2 → symbol only,
 *  small and muted (a score of 1 is not worth a second line). Otherwise the
 *  full two-line treatment: symbol above, score beneath. */
export function labelMode(score: number | null): LabelMode {
  if (score === null || score === 0) return "idle";
  return Math.abs(score) <= 2 ? "weak" : "full";
}

export function orbSize(score: number | null, isNifty: boolean): number {
  const mag = score === null ? 0 : Math.abs(score);
  const base = Math.min(SIZE_MAX, SIZE_ZERO + SIZE_K * Math.pow(mag, SIZE_GAMMA));
  return isNifty ? base * NIFTY_PREMIUM : base;
}

// ─── Label metrics ───────────────────────────────────────────────────────────
// IBM Plex Mono is monospaced with an advance width of 600/1000 em — every
// glyph is exactly 0.6em wide. The orb label adds 0.08em of tracking, and
// letter-spacing in CSS is applied after every character including the last.
// So one character occupies (0.6 + 0.08) = 0.68em, i.e. 6.8px at the 10px
// label size, 6.12px at 9px, 5.78px at 8.5px. Derived from the font's own
// metric rather than measured, so it holds before first paint and on the
// server, where there is nothing to measure.
const MONO_ADVANCE_EM = 0.6;
const MONO_TRACKING_EM = 0.08;
const CHAR_EM = MONO_ADVANCE_EM + MONO_TRACKING_EM;

const LABEL_FS: Record<LabelMode, number> = { full: 10, weak: 9, idle: 8.5 };
const SCORE_FS = 9.5;
const LABEL_LINE = 1.3; // line-height multiplier
const LABEL_GAP = 10; // body → label clearance, px
const BOX_PAD_X = 12; // breathing room between adjacent label boxes, px
const BOX_PAD_Y = 8;

export function charWidthPx(fontSize: number): number {
  return fontSize * CHAR_EM;
}

export interface OrbMetrics {
  size: number;
  /** 0..1 strength, derived from the size curve so halo and body never disagree. */
  unit: number;
  haloSize: number;
  haloOpacity: number;
  mode: LabelMode;
  labelFs: number;
  /** Full bounding box of body + label, in px. Centred on the orb's (x, y),
   *  because the body and label are a centred flex column inside one wrapper
   *  that is itself translate(-50%, -50%)'d onto the point. */
  boxW: number;
  boxH: number;
}

export interface OrbInput {
  key: string;
  label: string;
  score: number | null;
  isNifty: boolean;
}

export function orbMetrics(orb: OrbInput): OrbMetrics {
  const size = orbSize(orb.score, orb.isNifty);
  const plain = orb.isNifty ? size / NIFTY_PREMIUM : size;
  const unit = Math.min(1, Math.max(0, (plain - SIZE_ZERO) / (SIZE_MAX - SIZE_ZERO)));

  const mode = labelMode(orb.score);
  const labelFs = LABEL_FS[mode];

  const symbolW = orb.label.length * charWidthPx(labelFs);
  const scoreText = orb.score === null ? "—" : `${orb.score > 0 ? "+" : ""}${orb.score}`;
  const scoreW = mode === "full" ? scoreText.length * charWidthPx(SCORE_FS) : 0;

  const boxW = Math.max(size, symbolW, scoreW) + BOX_PAD_X;
  const boxH =
    size + LABEL_GAP + labelFs * LABEL_LINE + (mode === "full" ? SCORE_FS * LABEL_LINE : 0) + BOX_PAD_Y;

  return {
    size,
    unit,
    // Halo grows faster than the body, so a strong orb's field of light reads
    // as bigger, not just brighter. Overlap between neighbouring halos is the
    // signature effect and is never suppressed.
    haloSize: size * (2.6 + 0.9 * unit),
    haloOpacity: mode === "idle" ? 0.06 : 0.1 + 0.2 * unit,
    mode,
    labelFs,
    boxW,
    boxH,
  };
}

// ─── Placement ───────────────────────────────────────────────────────────────

export interface Placement {
  x: number; // percent of container width
  y: number; // percent of container height
  baseX: number; // the x the score alone earned, before any relaxation
  metrics: OrbMetrics;
  halfW: number; // half box width, percent
  halfH: number; // half box height, percent
}

export type PlacedOrb = OrbInput & Placement;

/** Deterministic 0..1 from a stable string (the pair symbol), so the
 *  composition looks scattered but never jumps between renders. */
export function stableUnit(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/** A second, decorrelated hash, so vertical position and motion phase don't move together. */
export function stableUnit2(key: string): number {
  let h = 7;
  for (let i = key.length - 1; i >= 0; i--) h = (h * 131 + key.charCodeAt(i) * 17) >>> 0;
  return (h % 997) / 997;
}

function clampX(x: number): number {
  return Math.max(X_MIN, Math.min(X_MAX, x));
}

/** Score → horizontal percent. Missing/zero sits at centre. */
export function scoreToX(score: number | null): number {
  const mid = (X_MIN + X_MAX) / 2;
  if (score === null || score === 0) return mid;
  const t = Math.max(-1, Math.min(1, score / WORKING_RANGE));
  return mid + t * ((X_MAX - X_MIN) / 2);
}

const MAX_PASSES = 80;
/** How far relaxation may drag an orb off the x its score earned, in percent. */
const MAX_X_DRIFT = 4;

function overlaps(a: PlacedOrb, b: PlacedOrb): boolean {
  return (
    Math.abs(a.x - b.x) < a.halfW + b.halfW && Math.abs(a.y - b.y) < a.halfH + b.halfH
  );
}

/** Every pair of label boxes that still intersects. Exported for verification. */
export function collidingPairs(placed: PlacedOrb[]): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (overlaps(placed[i], placed[j])) out.push([placed[i].key, placed[j].key]);
    }
  }
  return out;
}

/** Restores left-to-right ordering along the bias axis after horizontal nudges.
 *  Orbs that share a base x (a score tie) carry no ordering to preserve, so
 *  they are exempt; anything else may never cross a neighbour. */
function repairOrder(placed: PlacedOrb[]): void {
  const order = [...placed].sort((a, b) => a.baseX - b.baseX || (a.key < b.key ? -1 : 1));
  for (let i = 1; i < order.length; i++) {
    const prev = order[i - 1];
    const cur = order[i];
    if (cur.baseX === prev.baseX) continue;
    if (cur.x < prev.x) cur.x = prev.x;
  }
}

/** Minimum clear space between two boxes in the fallback grid, percent. */
const FB_GAP = 1.5;

/**
 * Last-resort deterministic packing. Only runs if relaxation could not converge
 * — a field so crowded that no amount of pushing separates it. Lays every orb
 * out on a shared row/column grid in bias order (left to right, then down),
 * which sacrifices the exact x-position a score earned but guarantees zero
 * label overlap wherever the container can physically hold the boxes, and keeps
 * the ordering along the bias axis intact. Degrading the precision of the
 * position is strictly better than shipping unreadable overlapping labels.
 *
 * Rows are a single grid shared by every column (rather than each column
 * dividing the band by its own row count), so columns cannot near-miss each
 * other diagonally. It also spends the FULL container rather than the scatter
 * bands: vertical position carries no meaning, the container does not clip, and
 * the extra room is often the difference between "fits cleanly" and "cannot
 * fit" at phone width.
 */
function gridFallback(placed: PlacedOrb[]): void {
  const order = [...placed].sort((a, b) => a.baseX - b.baseX || (a.key < b.key ? -1 : 1));
  const cellW = Math.max(...order.map((o) => o.halfW * 2)) + FB_GAP;
  const cellH = Math.max(...order.map((o) => o.halfH * 2)) + FB_GAP;

  const colsFit = Math.max(1, Math.floor(100 / cellW));
  const rowsFit = Math.max(1, Math.floor(100 / cellH));

  // As few columns as the row capacity allows (keeps the composition wide and
  // shallow), capped by how many columns physically fit. If the two cannot both
  // be satisfied the container simply cannot hold this many orbs at this size;
  // spacing then compresses rather than anything being clipped or dropped.
  const columns = Math.max(1, Math.min(colsFit, Math.ceil(order.length / rowsFit)));
  const rows = Math.max(1, Math.ceil(order.length / columns));

  const stepX = 100 / columns;
  const stepY = 100 / rows;

  order.forEach((o, idx) => {
    const col = Math.floor(idx / rows);
    const row = idx % rows;
    // Keep each box inside the container even in the corners.
    o.x = Math.max(o.halfW, Math.min(100 - o.halfW, stepX * (col + 0.5)));
    o.y = Math.max(o.halfH, Math.min(100 - o.halfH, stepY * (row + 0.5)));
  });
}

/**
 * Places every orb, then relaxes collisions on the LABEL BOX — not the orb
 * circle. Halos overlapping is the point of the design and is left completely
 * alone; only the boxes that contain readable text are separated.
 *
 * Vertical position carries no meaning, so it absorbs nearly all of the
 * correction. Horizontal is nudged only when the vertical push was eaten by the
 * band clamp, is capped at MAX_X_DRIFT from the x the score earned, and can
 * never reorder two orbs along the bias axis.
 *
 * `width`/`height` are the measured container box in px — label boxes are
 * computed in px from known font metrics and converted here, because "11% of
 * the container" means a very different number of characters on a phone than
 * on a 1440px page.
 */
export function layoutOrbs<T extends OrbInput>(
  orbs: T[],
  width: number,
  height: number,
): (T & Placement)[] {
  const w = Math.max(1, width);
  const h = Math.max(1, height);

  const placed: (T & Placement)[] = orbs.map((o) => {
    const metrics = orbMetrics(o);
    const baseX = scoreToX(o.score);
    return {
      ...o,
      metrics,
      baseX,
      x: baseX,
      y: Y_MIN + stableUnit(o.key) * (Y_MAX - Y_MIN),
      halfW: ((metrics.boxW / w) * 100) / 2,
      halfH: ((metrics.boxH / h) * 100) / 2,
    };
  });

  if (placed.length < 2) return placed;

  // Pre-spread exact ties. Orbs sharing a score sit at an identical x — very
  // common at zero, and universal before the first scores land — and pairwise
  // relaxation cannot separate a fully stacked column: every nudge re-collides
  // with the next neighbour, so the passes expire still overlapping. Dealing
  // each tied group its own slot up front solves it structurally. Ties carry no
  // bias information to lose (they all scored the same), so spending horizontal
  // room here costs nothing.
  const byX = new Map<number, PlacedOrb[]>();
  for (const o of placed) {
    const group = byX.get(o.baseX);
    if (group) group.push(o);
    else byX.set(o.baseX, [o]);
  }
  for (const group of byX.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

    const colW = Math.max(...group.map((o) => o.halfW * 2));
    const rowH = Math.max(...group.map((o) => o.halfH * 2));
    const perColumn = Math.max(1, Math.floor((Y_MAX - Y_MIN) / rowH));
    const columns = Math.ceil(group.length / perColumn);
    const spread = (columns - 1) * colW;
    // Anchor the fan so it stays inside the span. Clamping each column
    // independently would collapse several onto the same edge x when the tie
    // sits at ±max — exactly a case that needs the columns to stay distinct.
    const leftX = Math.max(X_MIN, Math.min(X_MAX - spread, group[0].baseX - spread / 2));

    group.forEach((o, idx) => {
      const col = Math.floor(idx / perColumn);
      const rowsHere = Math.min(perColumn, group.length - col * perColumn);
      const row = idx % perColumn;
      const step = (Y_MAX - Y_MIN) / rowsHere;
      o.y = Y_MIN + step * (row + 0.5);
      o.x = clampX(leftX + col * colW);
    });
  }

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = a.halfW + b.halfW - Math.abs(dx);
        const overlapY = a.halfH + b.halfH - Math.abs(dy);
        // Boxes only collide when they overlap on BOTH axes.
        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;

        // Push apart vertically first — free axis, no meaning attached.
        const signY = dy === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dy);
        const shiftY = (overlapY / 2 + 0.4) * signY;
        const beforeAy = a.y;
        const beforeBy = b.y;
        a.y = Math.max(Y_MIN, Math.min(Y_MAX, a.y - shiftY));
        b.y = Math.max(Y_MIN, Math.min(Y_MAX, b.y + shiftY));

        // Fall back to a horizontal nudge only when the vertical push actually
        // failed to buy separation — i.e. the band clamp ate most of it. Test
        // the movement we GOT, not whether an orb happens to sit on the band
        // edge: two orbs colliding mid-band at the same x are never "pinned",
        // so an edge test lets them shove each other forever.
        const gainedY = Math.abs(a.y - beforeAy) + Math.abs(b.y - beforeBy);
        if (gainedY < Math.abs(shiftY)) {
          const signX = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx);
          const shiftX = Math.min(overlapX / 2 + 0.4, 2.5) * signX;
          a.x = clampX(Math.max(a.baseX - MAX_X_DRIFT, Math.min(a.baseX + MAX_X_DRIFT, a.x - shiftX)));
          b.x = clampX(Math.max(b.baseX - MAX_X_DRIFT, Math.min(b.baseX + MAX_X_DRIFT, b.x + shiftX)));
        }
      }
    }
    repairOrder(placed);
    if (!moved) break;
  }

  // Converged? If not, degrade to a guaranteed-clean packing rather than
  // shipping overlapping text.
  if (collidingPairs(placed).length > 0) gridFallback(placed);

  return placed;
}
