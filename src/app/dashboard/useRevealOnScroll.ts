"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/motion";

/**
 * Attaches to a band and returns true once that band has scrolled into view,
 * then stays true (one-shot — bands don't re-hide on scrolling back past
 * them). Pairs with the `lt-rise` class already used elsewhere in the app so
 * bands "fade and rise slightly" the first time they enter the viewport,
 * instead of all firing on mount like the old single-screen layout did.
 * Under reduced motion the band is simply visible immediately, no animation
 * class applied — same policy motion.tsx already uses everywhere else.
 */
export function useRevealOnScroll<T extends HTMLElement>(): {
  ref: React.RefObject<T | null>;
  revealed: boolean;
  reducedMotion: boolean;
} {
  const reducedMotion = usePrefersReducedMotion();
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  return { ref, revealed, reducedMotion };
}
