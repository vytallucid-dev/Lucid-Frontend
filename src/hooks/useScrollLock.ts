"use client";

import { useEffect } from "react";

// Module-level so nested overlays (a confirm dialog opened from a drawer)
// share one counter. The lock only lifts, and the background only regains
// interaction, once every consumer that asked for it has released it.
let lockCount = 0;
let savedScrollY = 0;
let savedBodyPosition = "";
let savedBodyTop = "";
let savedBodyWidth = "";
let savedBodyPaddingRight = "";

function getScrollbarWidth(): number {
  return window.innerWidth - document.documentElement.clientWidth;
}

function lock() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY;
    const { body } = document;
    savedBodyPosition = body.style.position;
    savedBodyTop = body.style.top;
    savedBodyWidth = body.style.width;
    savedBodyPaddingRight = body.style.paddingRight;

    // Measure the scrollbar rather than assuming a fixed value — it varies by
    // OS, browser, and zoom level, and a wrong constant reintroduces the exact
    // layout shift this is meant to prevent.
    const scrollbarWidth = getScrollbarWidth();

    // Fixing the body at its current scroll offset (rather than just setting
    // overflow: hidden) is what keeps the page from silently scrolling back to
    // the top while locked, and gives us an exact position to restore later.
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY}px`;
    body.style.width = "100%";
    if (scrollbarWidth > 0) {
      const currentPaddingRight = parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }
  }
  lockCount++;
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    const { body } = document;
    body.style.position = savedBodyPosition;
    body.style.top = savedBodyTop;
    body.style.width = savedBodyWidth;
    body.style.paddingRight = savedBodyPaddingRight;
    window.scrollTo(0, savedScrollY);
  }
}

/**
 * None of this codebase's overlays render through a portal — they mount
 * in-place, nested inside whatever page rendered them. So the container the
 * background needs to be inert AROUND isn't a sibling of the overlay; it's an
 * ancestor several levels up, and the overlay is nested inside it. Marking
 * that ancestor inert would inert the overlay along with everything else.
 *
 * Instead this walks the DOM path from <body> down to the overlay's own
 * container and, at every level, marks that level's OTHER children inert —
 * everything not on the path to the overlay. What's left un-inerted is
 * exactly the chain of ancestors leading to the overlay plus the overlay
 * itself; every branch that peels off along the way (the rest of the page,
 * the dock, anything else) is shut out.
 */
function inertBackground(container: HTMLElement): Element[] {
  const inerted: Element[] = [];
  let node: HTMLElement = container;
  while (node.parentElement && node !== document.body) {
    const parent = node.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node) continue;
      if (sibling.hasAttribute("inert")) continue;
      sibling.setAttribute("inert", "");
      inerted.push(sibling);
    }
    node = parent;
  }
  return inerted;
}

/**
 * Locks page scroll and makes everything outside `containerRef` inert while
 * `active` is true — the background can't be scrolled, clicked, or focused.
 * Reference-counted at module scope, so a confirm dialog opened from within
 * an already-open drawer doesn't unlock scrolling when only the inner one
 * closes; the page only unlocks once the outermost consumer releases it.
 * Restores the exact prior scroll position on release. Does nothing while
 * inactive.
 *
 * Escape handling, backdrop-click behaviour, and focus trapping are each
 * still owned by the caller — this hook only ever touches scroll and
 * background interactivity.
 */
export function useScrollLock(containerRef: React.RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return;

    lock();

    const container = containerRef.current;
    const inertedSiblings = container ? inertBackground(container) : [];

    return () => {
      unlock();
      for (const el of inertedSiblings) el.removeAttribute("inert");
    };
  }, [active, containerRef]);
}
