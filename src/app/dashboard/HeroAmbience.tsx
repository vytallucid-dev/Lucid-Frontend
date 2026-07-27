"use client";

import { useState } from "react";
import { useCompass } from "@/hooks/useCompass";
import { usePrefersReducedMotion } from "@/components/motion";

// ─── Hero ambience (Step 6, B4; widened Fix 5) ─────────────────────────────────
// Reuses the exact hook + query key the Oracle Top Setups page already calls
// (src/hooks/useCompass.ts → queryKey ['oracle','compass']), so React Query
// serves this from cache — no new endpoint, no new query. This is the one
// exception the step authorises.
//
// The regime changes the environment, never the orbs: each of the three blobs
// carries its own colour and opacity, and per regime those genuinely lean the
// whole composition warm (Risk-On, gold-dominant with a cool blue counterpoint
// well down in the mix) or cool (Risk-Off, red/blue-dominant with gold nearly
// gone) — not just "the same three colours, brighter." Atmosphere only — if
// the query is loading or errored, this renders at Risk-On's base ambience
// with no label and no error state; it must never block the hero.

const BASE_DRIFT_S = 42; // matches --lucid-dur-drift

type Regime = "Risk-On" | "Caution" | "Risk-Off";

interface BlobSpec {
  color: string;
  opacityPct: number;
}

type Ambience = {
  /** Each blob's own colour token + opacity — a real per-blob mix, not one
   *  shared intensity multiplier applied uniformly across all three. */
  blobs: [BlobSpec, BlobSpec, BlobSpec];
  /** Drift animation duration in seconds — lower = faster. */
  driftSeconds: number;
  /** Human label using the backend's own vocabulary, or null (no regime yet). */
  label: string | null;
};

function ambienceFor(regime: Regime | undefined): Ambience {
  switch (regime) {
    case "Caution":
      // Amber creeps in, gold cools slightly, blue is nearly gone — visibly
      // between the other two without tipping into either.
      return {
        blobs: [
          { color: "var(--lucid-warn)", opacityPct: 11 },
          { color: "var(--lucid-pos)", opacityPct: 5 },
          { color: "var(--lucid-neg)", opacityPct: 9 },
        ],
        driftSeconds: BASE_DRIFT_S * 0.72,
        label: "Caution",
      };
    case "Risk-Off":
      // Red and cool blue dominate; gold's warmth is almost entirely displaced.
      // This is the actual colour-BALANCE shift the effect needs — not the
      // same three colours turned up together.
      return {
        blobs: [
          { color: "var(--lucid-neg)", opacityPct: 16 },
          { color: "var(--lucid-ctx)", opacityPct: 9 },
          { color: "var(--lucid-neg)", opacityPct: 11 },
        ],
        driftSeconds: BASE_DRIFT_S * 0.42,
        label: "Risk-Off",
      };
    case "Risk-On":
      return {
        blobs: [
          { color: "var(--lucid-accent)", opacityPct: 9 },
          { color: "var(--lucid-pos)", opacityPct: 6 },
          { color: "var(--lucid-cool)", opacityPct: 3 },
        ],
        driftSeconds: BASE_DRIFT_S,
        label: "Risk-On",
      };
    default:
      // Loading / errored / not yet classified — Risk-On's base ambience, no label.
      return {
        blobs: [
          { color: "var(--lucid-accent)", opacityPct: 9 },
          { color: "var(--lucid-pos)", opacityPct: 6 },
          { color: "var(--lucid-cool)", opacityPct: 3 },
        ],
        driftSeconds: BASE_DRIFT_S,
        label: null,
      };
  }
}

const DEV_MODE = process.env.NODE_ENV !== "production";

/**
 * Dev-only ambience preview toggle. Cycles the three regimes so the effect can
 * be judged without waiting for the market to actually move through them.
 * Touches nothing but this component's own blob colours/opacity/drift — the
 * real regime label elsewhere in the hero comes from useRegimeLabel(), which
 * reads the Compass query directly and is untouched by this override.
 *
 * Deletable in one edit: remove the `previewRegime` prop, the `<RegimePreviewControl>`
 * render, and this component, and HeroAmbience reverts to reading the real
 * regime only.
 */
function RegimePreviewControl({ value, onChange }: { value: Regime | null; onChange: (r: Regime | null) => void }) {
  const options: (Regime | null)[] = [null, "Risk-On", "Caution", "Risk-Off"];
  return (
    <div
      className="absolute bottom-2 left-2 flex items-center gap-1 pointer-events-auto"
      style={{ zIndex: 5 }}
    >
      <span
        className="lx-micro"
        style={{ color: "var(--lucid-ink-3)", opacity: 0.6, marginRight: 2 }}
      >
        preview:
      </span>
      {options.map((opt) => (
        <button
          key={opt ?? "live"}
          type="button"
          onClick={() => onChange(opt)}
          title={opt ? `Preview ${opt} ambience (dev only)` : "Use live regime (dev only)"}
          className="lx-micro"
          style={{
            padding: "2px 6px",
            borderRadius: 4,
            border: "1px solid var(--lucid-line-2)",
            background: value === opt ? "var(--lucid-hover-soft)" : "transparent",
            color: value === opt ? "var(--lucid-ink)" : "var(--lucid-ink-3)",
            opacity: 0.7,
          }}
        >
          {opt ?? "live"}
        </button>
      ))}
    </div>
  );
}

export function HeroAmbience() {
  const reducedMotion = usePrefersReducedMotion();
  // Reused exactly as Oracle calls it — same hook, same query key. Errors are
  // swallowed on purpose: atmosphere must never surface a loading/error state.
  const compassQuery = useCompass();
  const realRegime = compassQuery.data?.current?.finalRegime;

  // Dev-only preview override — always undefined (i.e. inert) in production,
  // since DEV_MODE is a build-time constant and this branch never runs there.
  const [previewRegime, setPreviewRegime] = useState<Regime | null>(null);
  const regime = DEV_MODE && previewRegime ? previewRegime : realRegime;
  const ambience = ambienceFor(regime);

  const driftStyle = (delaySeconds: number): React.CSSProperties =>
    reducedMotion
      ? {}
      : { animationDuration: `${ambience.driftSeconds}s`, animationDelay: `${delaySeconds}s` };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        className={reducedMotion ? "" : "lucid-blob"}
        style={{
          position: "absolute",
          top: "10%",
          left: "15%",
          width: "42vw",
          height: "42vw",
          maxWidth: 640,
          maxHeight: 640,
          borderRadius: "9999px",
          background: `radial-gradient(circle, color-mix(in srgb, ${ambience.blobs[0].color} ${ambience.blobs[0].opacityPct}%, transparent), transparent 70%)`,
          filter: "blur(100px)",
          ...driftStyle(0),
        }}
      />
      <div
        className={reducedMotion ? "" : "lucid-blob"}
        style={{
          position: "absolute",
          bottom: "5%",
          right: "10%",
          width: "36vw",
          height: "36vw",
          maxWidth: 560,
          maxHeight: 560,
          borderRadius: "9999px",
          background: `radial-gradient(circle, color-mix(in srgb, ${ambience.blobs[1].color} ${ambience.blobs[1].opacityPct}%, transparent), transparent 70%)`,
          filter: "blur(100px)",
          ...driftStyle(-14),
        }}
      />
      <div
        className={reducedMotion ? "" : "lucid-blob"}
        style={{
          position: "absolute",
          top: "45%",
          right: "30%",
          width: "30vw",
          height: "30vw",
          maxWidth: 480,
          maxHeight: 480,
          borderRadius: "9999px",
          background: `radial-gradient(circle, color-mix(in srgb, ${ambience.blobs[2].color} ${ambience.blobs[2].opacityPct}%, transparent), transparent 70%)`,
          filter: "blur(100px)",
          ...driftStyle(-28),
        }}
      />
      {DEV_MODE && <RegimePreviewControl value={previewRegime} onChange={setPreviewRegime} />}
    </div>
  );
}

/** Small helper for HeroBand to read the regime label without duplicating the
 *  useCompass call — same query key, same cache entry, second read is free.
 *  Always the REAL regime: unaffected by HeroAmbience's dev-only preview. */
export function useRegimeLabel(): string | null {
  const compassQuery = useCompass();
  return ambienceFor(compassQuery.data?.current?.finalRegime).label;
}
