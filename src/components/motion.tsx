"use client";

// Shared motion primitives for the Lucid design system.
// Purely presentational — no data or business logic lives here.

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void): () => void {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

/** Tracks the user's reduced-motion preference (SSR-safe). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false, // server snapshot — assume motion, CSS gates the rest
  );
}

/**
 * Eases a numeric value toward `target` (easeOutCubic) and returns the
 * in-flight value each frame. Starts from 0 on mount, and from the currently
 * displayed value on retarget — so switching assets sweeps from the previous
 * score to the new one instead of jumping. Honors reduced-motion by snapping.
 */
export function useAnimatedValue(target: number, duration = 1000): number {
  const reduced = usePrefersReducedMotion();
  const [val, setVal] = useState(0);
  const displayRef = useRef(0); // last value actually shown
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      // Snap on the next frame (setState in a rAF callback, not the effect body).
      rafRef.current = requestAnimationFrame(() => {
        displayRef.current = target;
        setVal(target);
      });
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
    const from = displayRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (target - from) * eased;
      displayRef.current = v;
      setVal(v);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, reduced]);

  return val;
}

/**
 * Animated count-up for metric values. Formats each frame, so currency
 * figures roll their digits. Snaps under reduced-motion.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 950,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const display = useAnimatedValue(value, duration);
  return <>{format(display)}</>;
}

/** Splits a line into span-wrapped words for a staggered blur-in reveal. */
export function AnimatedGreeting({ text }: { text: string }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <>{text}</>;
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        // The space is a sibling text node, NOT inside the inline-block span —
        // a trailing space inside an inline-block is trimmed by the browser,
        // which was collapsing the greeting into one run-on word.
        <Fragment key={i}>
          <span
            className="lt-word"
            style={{ animationDelay: `${0.05 + i * 0.07}s` }}
          >
            {w}
          </span>
          {i < words.length - 1 ? " " : ""}
        </Fragment>
      ))}
    </>
  );
}
