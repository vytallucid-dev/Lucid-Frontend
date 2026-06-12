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
    accent: "#10B981",
    background: "rgba(9,19,18,0.97)",
    border: "rgba(16,185,129,0.32)",
    bar: "#10B981",
    glow: "rgba(16,185,129,0.18)",
    defaultTitle: "Success",
    duration: 4000,
  },
  error: {
    icon: XCircle,
    accent: "#F87171",
    background: "rgba(22,11,13,0.97)",
    border: "rgba(239,68,68,0.32)",
    bar: "#EF4444",
    glow: "rgba(239,68,68,0.18)",
    defaultTitle: "Something went wrong",
    duration: 6000,
  },
  warning: {
    icon: AlertTriangle,
    accent: "#F59E0B",
    background: "rgba(23,17,7,0.97)",
    border: "rgba(245,158,11,0.32)",
    bar: "#F59E0B",
    glow: "rgba(245,158,11,0.16)",
    defaultTitle: "Heads up",
    duration: 5000,
  },
  info: {
    icon: Info,
    accent: "#60A5FA",
    background: "rgba(10,17,28,0.97)",
    border: "rgba(59,130,246,0.32)",
    bar: "#3B82F6",
    glow: "rgba(59,130,246,0.16)",
    defaultTitle: "Lucid",
    duration: 4500,
  },
};
