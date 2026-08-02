"use client";

// Cross-tree state for the keyboard layer. The Dock lives outside the shortcut
// host (both are siblings under AppShell), so the dock's `?` hint and its
// pending-`g` chip read from here rather than reaching into each other.
// Mirrors src/lib/tools-store.ts.

type Listener = () => void;

function makeStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener>();
  return {
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get(): T {
      return value;
    },
    set(next: T): void {
      if (Object.is(value, next)) return;
      value = next;
      listeners.forEach((l) => l());
    },
  };
}

/** Whether the shortcut help overlay is showing. */
export const helpStore = makeStore(false);

/** Whether a `g` navigation prefix is currently armed. */
export const pendingStore = makeStore(false);

export function toggleHelp(): void {
  helpStore.set(!helpStore.get());
}

export function closeHelp(): void {
  helpStore.set(false);
}
