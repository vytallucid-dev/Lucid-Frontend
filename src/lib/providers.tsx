"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  MutationCache,
  keepPreviousData,
} from "@tanstack/react-query";
import { toast, toastErrorMessage } from "@/components/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Any failed mutation surfaces an error toast app-wide, so every
        // create/update/delete is covered without per-call wiring.
        mutationCache: new MutationCache({
          onError: (error) => toast.error(toastErrorMessage(error)),
        }),
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
            // Keep the previously-fetched data on screen while a query with a
            // new key (e.g. switching FX pair / scorecard asset / date range)
            // or a background refetch is in flight, instead of dropping to a
            // full loading spinner. Eliminates the "keeps on loading" flash.
            placeholderData: keepPreviousData,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
