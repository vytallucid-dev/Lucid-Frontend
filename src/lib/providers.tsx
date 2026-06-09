"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  keepPreviousData,
} from "@tanstack/react-query";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
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
