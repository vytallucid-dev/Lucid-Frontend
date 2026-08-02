"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiPair } from "@/lib/api/trading";
import { scorecardHrefFor, type PublicAssetData } from "@/lib/api/oracle";
import {
  layoutOrbs,
  stableUnit2,
  type OrbInput,
  type Placement,
} from "./alignment-layout";

// ─── The alignment field ──────────────────────────────────────────────────────
// A floating composition of orbs suspended in dark space — NOT a chart. There
// is no axis, no scale, no tick, no baseline, no tether: those read as an
// analysis tool, and the scorecard pages are where analysis lives. This is the
// dashboard's centrepiece, so it trades precision for atmosphere.
//
// The field is a picture of what Oracle currently scores, not of what the user
// has configured for logging — its instrument list comes from useAssets(),
// filtered to outcome === "scored". `pairsConfig` (the user's own trading
// pairs) supplies display labels only, as a cosmetic fallback lookup; it never
// decides which orbs exist.
//
// Every orb is still the same instrument, the same score, the same bias, and
// links to the correct one on its destination scorecard. Built from DOM
// elements + CSS only — no canvas, no animation library.
//
// All geometry (the size curve, label-box metrics, collision relaxation) lives
// in ./alignment-layout — this file is rendering only.

interface FieldOrb extends OrbInput {
  hasOpenPosition: boolean;
  href: string;
  ariaLabel: string;
}

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

/** The container box, in px. Label widths come from character counts and known
 *  font metrics, so collision has to know how many pixels a percent is worth —
 *  11% of a 1360px hero and 11% of a 343px phone are not the same label. */
function useBoxSize(ref: React.RefObject<HTMLDivElement | null>) {
  // A sensible desktop default for SSR and the first paint; the observer
  // corrects it on mount. Orbs are absolutely positioned, so a correction
  // moves orbs — it never reflows anything around them.
  const [size, setSize] = useState({ w: 1200, h: 380 });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setSize((prev) =>
        Math.abs(prev.w - r.width) < 1 && Math.abs(prev.h - r.height) < 1
          ? prev
          : { w: r.width, h: r.height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

/** One orb: halo, glass body, specular highlight, optional position ring, and
 *  its label — all inside a single focusable link. */
function Orb({
  orb,
  onNavigate,
  reducedMotion,
}: {
  orb: FieldOrb & Placement;
  onNavigate: (href: string) => void;
  reducedMotion: boolean;
}) {
  const color = orbColor(orb.score);
  const { size, unit, haloSize, haloOpacity, mode, labelFs } = orb.metrics;
  const idle = mode === "idle";

  // Body fill and rim track the same strength the size curve uses, so a weak
  // orb is dim as well as small and reads as present but quiet.
  const coreMix = idle ? 40 : 52 + Math.round(unit * 26);
  const midMix = idle ? 15 : 20 + Math.round(unit * 12);
  const rimMix = idle ? 22 : 30 + Math.round(unit * 20);

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
              background: `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${color} ${coreMix}%, transparent) 0%, color-mix(in srgb, ${color} ${midMix}%, transparent) 45%, color-mix(in srgb, ${color} 6%, transparent) 100%)`,
              border: `1px solid color-mix(in srgb, ${color} ${rimMix}%, transparent)`,
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
                opacity: idle ? 0.35 : 0.55 + unit * 0.3,
              }}
            />
          </span>

          {/* Label. Moderate and strong orbs get symbol + score on two lines.
              Weak and no-signal orbs get the symbol only, smaller and more
              muted — a score of 1 is not worth a second line, and halving the
              label height is what un-crowds the centre of the field, which is
              exactly where the weak orbs sit. The score stays in the orb's
              accessible name in every mode. */}
          <span
            className="flex flex-col items-center pointer-events-none"
            style={{ marginTop: 10 }}
          >
            <span
              className="lucid-orb-label"
              style={{
                fontFamily: "var(--lucid-font-mono)",
                fontSize: labelFs,
                fontWeight: mode === "full" ? 500 : 400,
                letterSpacing: "0.08em",
                lineHeight: 1.3,
                color:
                  mode === "full"
                    ? "var(--lucid-ink)"
                    : mode === "weak"
                      ? "var(--lucid-ink-2)"
                      : "var(--lucid-ink-3)",
                whiteSpace: "nowrap",
              }}
            >
              {orb.label}
            </span>
            {mode === "full" && (
              <span
                style={{
                  fontFamily: "var(--lucid-font-mono)",
                  fontSize: 9.5,
                  lineHeight: 1.3,
                  fontVariantNumeric: "tabular-nums",
                  color,
                  whiteSpace: "nowrap",
                }}
              >
                {orb.score !== null ? `${orb.score > 0 ? "+" : ""}${orb.score}` : "—"}
              </span>
            )}
          </span>
        </Link>
      </div>
    </div>
  );
}

export function AlignmentField({
  oracleAssets,
  pairsConfig,
  niftyNetScore,
  livePairSymbols,
  onNavigate,
  reducedMotion,
}: {
  /** From useAssets() — undefined while loading, [] on error or once resolved
   *  with nothing scored. Either way the field degrades to "no Oracle orbs,
   *  NIFTY still present" rather than blocking anything. */
  oracleAssets: PublicAssetData[] | undefined;
  /** The user's own configured pairs — used only to look up a display label
   *  for an Oracle-scored code (e.g. "EUR/USD" for "EURUSD"). Never decides
   *  which orbs exist; a fallback to the raw code covers any Oracle instrument
   *  the user hasn't configured for logging. */
  pairsConfig: ApiPair[];
  niftyNetScore: number | null;
  livePairSymbols: Set<string>;
  onNavigate: (href: string) => void;
  reducedMotion: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const box = useBoxSize(boxRef);

  const orbs = useMemo<FieldOrb[]>(() => {
    // Only what Oracle actually scores — "deferred" (no ingestion pipeline
    // for this instrument at all) and "insufficient_data" are excluded: an
    // orb for an instrument with nothing behind it is noise, not signal.
    // This was never gated by a hardcoded instrument list — every
    // Oracle-scored instrument gets an orb, currency or pair or index alike,
    // so AUD, the four AUD pairs and all three equity indices (SPY, NAS100,
    // US30 — active since Phase 4) already appear here with no edit.
    const scored = (oracleAssets ?? []).filter((a) => a.outcome === "scored");

    const oracle: FieldOrb[] = scored.map((a) => {
      const label = pairsConfig.find((p) => p.symbol === a.asset)?.display_name ?? a.asset;
      return {
        key: a.asset,
        label,
        score: a.score,
        isNifty: false,
        hasOpenPosition: livePairSymbols.has(a.asset),
        href: scorecardHrefFor(a),
        ariaLabel: `${label}, score ${a.score !== null ? a.score : "unavailable"}, ${biasDirectionLabel(a.score)}`,
      };
    });

    // NIFTY is sourced independently of the Oracle assets query, exactly as
    // before, and always present regardless of whether that query is loading,
    // empty, or failed.
    const nifty: FieldOrb = {
      key: "NIFTY",
      label: "NIFTY",
      score: niftyNetScore,
      isNifty: true,
      hasOpenPosition: false,
      href: "/nifty/scorecard",
      ariaLabel: `NIFTY 50 macro, net score ${niftyNetScore !== null ? niftyNetScore : "unavailable"}, ${biasDirectionLabel(niftyNetScore)}`,
    };

    return [...oracle, nifty];
  }, [oracleAssets, pairsConfig, niftyNetScore, livePairSymbols]);

  const positioned = useMemo(() => layoutOrbs(orbs, box.w, box.h), [orbs, box.w, box.h]);

  return (
    // `overflow-visible` is load-bearing: halos extend well past each orb and
    // clipping them would flatten the composition back into circles on a page.
    <div
      ref={boxRef}
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
