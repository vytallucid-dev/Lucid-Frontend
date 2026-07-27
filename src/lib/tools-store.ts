"use client";

// Cross-tree "open your tools drawer" request. The Dock lives outside the
// NIFTY/Oracle layouts, so it posts a request here instead of calling their
// drawer state directly. Mirrors src/components/toast/toast-store.ts.

export type ToolsSection = "nifty" | "oracle";

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
