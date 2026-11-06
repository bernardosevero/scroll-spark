"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";

import { appCodeOf, createApiClient } from "@scroll-spark/api/client";
import { TRPCProvider } from "@scroll-spark/api/react";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Try once more after a dropped connection. An expected failure won't change on its own.
        retry: (failures, error) => failures < 1 && appCodeOf(error) === null,
      },
    },
  });
}

export function ApiProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [trpcClient] = useState(() => createApiClient({ url: "/api/trpc" }));

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
