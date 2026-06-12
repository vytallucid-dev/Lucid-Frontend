// Public entry point for the Lucid toast system.
//
//   import { toast } from "@/components/toast";
//   toast.success("Trade logged");
//   toast.error("Couldn't save the trade");
//   toast.warning("Double-check your stop loss");
//   toast.info("Lucid AI activates in Phase 3");

export { toast, toastErrorMessage } from "./toast-store";
export type { ToastApi } from "./toast-store";
export { useToast } from "./useToast";
export { ToastViewport } from "./ToastViewport";
export { TOAST_VARIANTS } from "./variants";
export type { ToastType, ToastOptions, ToastItem } from "./types";
