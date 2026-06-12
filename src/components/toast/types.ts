// Shared types for the Lucid toast system.

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  /** Bold title shown above the message. Falls back to the per-type default. */
  title?: string;
  /** Auto-dismiss after N ms. Pass 0 to make the toast sticky. */
  duration?: number;
}

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
}
