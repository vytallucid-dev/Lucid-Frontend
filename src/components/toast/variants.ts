// Per-type toast theme. Each toast variant (success / error / warning / info)
// gets its own self-contained visual definition here, matched to the Lucid
// dark-glass palette used across the app (see globals.css design tokens).

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  type LucideIcon,
} from "lucide-react";
import type { ToastType } from "./types";

export interface ToastVariant {
  /** Leading icon. */
  icon: LucideIcon;
  /** Icon + title accent color. */
  accent: string;
  /** Panel background (dark glass, tinted toward the accent). */
  background: string;
  /** Panel border color. */
  border: string;
  /** Left accent bar + progress bar color. */
  bar: string;
  /** Soft glow used in the box-shadow. */
  glow: string;
  /** Default title when the caller doesn't supply one. */
  defaultTitle: string;
  /** Default auto-dismiss duration in ms. */
  duration: number;
}

export const TOAST_VARIANTS: Record<ToastType, ToastVariant> = {
  success: {
    icon: CheckCircle2,
    accent: "var(--lucid-pos)",
    background: "var(--lucid-surface-2)",
    border: "var(--lucid-pos-bd)",
    bar: "var(--lucid-pos)",
    glow: "var(--lucid-pos-bg)",
    defaultTitle: "Success",
    duration: 4000,
  },
  error: {
    icon: XCircle,
    accent: "var(--lucid-neg)",
    background: "var(--lucid-surface-2)",
    border: "var(--lucid-neg-bd)",
    bar: "var(--lucid-neg)",
    glow: "var(--lucid-neg-bg)",
    defaultTitle: "Something went wrong",
    duration: 6000,
  },
  warning: {
    icon: AlertTriangle,
    accent: "var(--lucid-warn)",
    background: "var(--lucid-surface-2)",
    border: "var(--lucid-warn-bd)",
    bar: "var(--lucid-warn)",
    glow: "var(--lucid-warn-bg)",
    defaultTitle: "Heads up",
    duration: 5000,
  },
  info: {
    icon: Info,
    accent: "var(--lucid-gold-bright)",
    background: "var(--lucid-surface-2)",
    border: "var(--lucid-accent-bd)",
    bar: "var(--lucid-accent)",
    glow: "var(--lucid-accent-bg)",
    defaultTitle: "Lucid",
    duration: 4500,
  },
};
