"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fires a one-shot sign-aware flash class whenever a numeric value changes
 * (e.g. a trade closes and P&L moves). The baseline is taken on the first
 * render where `ready` is true, so the loading→loaded transition never
 * flashes. The class is toggled off/on across a frame so consecutive changes
 * restart the animation.
 */
export function useValueFlash(value: number, ready: boolean): string {
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<"pos" | "neg" | null>(null);

  useEffect(() => {
    if (!ready) return; // still loading — don't baseline placeholder values
    if (prev.current === null) {
      prev.current = value; // first loaded value = baseline, no flash
      return;
    }
    if (value === prev.current) return;
    const dir: "pos" | "neg" = value > prev.current ? "pos" : "neg";
    prev.current = value;
    // Clear then re-apply across two frames so back-to-back changes restart
    // the CSS animation (all setState calls live in rAF callbacks).
    let raf2: number | null = null;
    const raf1 = requestAnimationFrame(() => {
      setFlash(null);
      raf2 = requestAnimationFrame(() => setFlash(dir));
    });
    const t = setTimeout(() => setFlash(null), 1600);
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
      clearTimeout(t);
    };
  }, [value, ready]);

  return flash ? `lt-flash-${flash}` : "";
}

/**
 * Tracks which ids appeared since the previous render pass (e.g. a freshly
 * logged trade) so their rows can play the gold "new" highlight. The baseline
 * snapshot is taken on the first render where `ready` is true (data loaded),
 * so the initial list never flashes — only genuinely new arrivals do.
 */
export function useNewIds(ids: string[], ready: boolean): Set<string> {
  const prevRef = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const key = ids.join("|");

  useEffect(() => {
    if (!ready) return; // still loading — don't take a baseline from empty data
    const cur = new Set(ids);
    if (prevRef.current === null) {
      prevRef.current = cur; // first loaded snapshot = baseline, no flash
      return;
    }
    const added = ids.filter((id) => !prevRef.current!.has(id));
    prevRef.current = cur;
    if (added.length === 0) return;
    const raf = requestAnimationFrame(() => setFresh(new Set(added)));
    const t = setTimeout(() => setFresh(new Set()), 2400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  return fresh;
}
