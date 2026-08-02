"use client";

// Cross-tree "open your tools drawer" request. The Dock lives outside the
// NIFTY/Oracle layouts, so it posts a request here instead of calling their
// drawer state directly. Mirrors src/components/toast/toast-store.ts.

import { findActiveSection } from "./nav";

export type ToolsSection = "nifty" | "oracle";

/**
 * Which nav sections own a tools drawer, keyed by NavSection.key. Lives here
 * rather than in the Dock now that the keyboard layer needs the same fact —
 * two copies of "these sections have tools" is one copy too many.
 */
export const TOOLS_SECTIONS: Record<string, ToolsSection> = {
  nifty: "nifty",
  oracle: "oracle",
};

/**
 * The tools drawer for the section a path belongs to, or null if that section
 * has none. Callers MUST honour the null: only /nifty/* and /oracle/* mount a
 * bridge that consumes a request and clears it, so a request posted from
 * anywhere else would sit in the store unread and then fire unprompted the
 * next time the trader wandered into that section.
 */
export function toolsSectionForPath(pathname: string): ToolsSection | null {
  const section = findActiveSection(pathname);
  return section ? (TOOLS_SECTIONS[section.key] ?? null) : null;
}

type Listener = () => void;

let requested: ToolsSection | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): ToolsSection | null {
  return requested;
}

/** Called by the Dock when the user clicks a section's Tools entry. */
export function requestTools(section: ToolsSection): void {
  requested = section;
  emit();
}

/** Called by the owning layout once it has acted on the request. */
export function clearToolsRequest(): void {
  if (requested === null) return;
  requested = null;
  emit();
}
