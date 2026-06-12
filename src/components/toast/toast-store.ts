"use client";

// A tiny framework-agnostic store for toasts. Living outside React lets us fire
// toasts from anywhere — event handlers, the React Query mutation cache, plain
// utility functions — while <ToastViewport> subscribes via useSyncExternalStore.

import { TOAST_VARIANTS } from "./variants";
import type { ToastItem, ToastOptions, ToastType } from "./types";

type Listener = () => void;

let items: ToastItem[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

/** At most this many toasts stack at once; older ones drop off the top. */
const MAX_VISIBLE = 4;

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): ToastItem[] {
  return items;
}

export function addToast(
  type: ToastType,
  message: string,
  opts: ToastOptions = {},
): number {
  const variant = TOAST_VARIANTS[type];
  const id = nextId++;
  const item: ToastItem = {
    id,
    type,
    message,
    title: opts.title,
    duration: opts.duration ?? variant.duration,
  };
  // New array reference so useSyncExternalStore detects the change.
  items = [...items, item].slice(-MAX_VISIBLE);
  emit();
  return id;
}

export function dismissToast(id: number): void {
  const next = items.filter((t) => t.id !== id);
  if (next.length !== items.length) {
    items = next;
    emit();
  }
}

export interface ToastApi {
  (type: ToastType, message: string, opts?: ToastOptions): number;
  success: (message: string, opts?: ToastOptions) => number;
  error: (message: string, opts?: ToastOptions) => number;
  warning: (message: string, opts?: ToastOptions) => number;
  info: (message: string, opts?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const callable = (type: ToastType, message: string, opts?: ToastOptions) =>
  addToast(type, message, opts);

/**
 * The app-wide toast handle. Import and call from anywhere:
 *   toast.success("Trade logged");
 *   toast.error("Couldn't save");
 */
export const toast: ToastApi = Object.assign(callable, {
  success: (message: string, opts?: ToastOptions) => addToast("success", message, opts),
  error: (message: string, opts?: ToastOptions) => addToast("error", message, opts),
  warning: (message: string, opts?: ToastOptions) => addToast("warning", message, opts),
  info: (message: string, opts?: ToastOptions) => addToast("info", message, opts),
  dismiss: dismissToast,
});

/** Normalizes thrown values (Error, string, unknown) into a display message. */
export function toastErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
}
