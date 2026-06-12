"use client";

import { toast } from "./toast-store";
import type { ToastApi } from "./toast-store";

/**
 * Hook form of the toast API, for components that prefer a hook over a direct
 * import. The handle is a stable singleton, so this never causes re-renders.
 *
 *   const toast = useToast();
 *   toast.success("Saved");
 */
export function useToast(): ToastApi {
  return toast;
}
