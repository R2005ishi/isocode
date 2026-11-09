"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ApiClientError } from "@/components/staff/api";

/** TanStack Query for staff/admin screens. One client per browser tab. */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: true,
            // Auth/permission/validation errors will not fix themselves on retry.
            retry: (count, err) =>
              !(err instanceof ApiClientError && err.status >= 400 && err.status < 500) &&
              count < 2,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
