"use client";

import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { createApiClient } from "@scroll-spark/api/client";
import { TRPCProvider, useTRPC } from "@scroll-spark/api/react";
import { PingCard } from "@scroll-spark/ui/ping-card";

function PingResult() {
  const trpc = useTRPC();
  const { mutate, data, isError } = useMutation(trpc.ping.mutationOptions());

  useEffect(() => mutate({ name: "website" }), [mutate]);

  if (isError) {
    return <PingCard status="error" />;
  }

  return data ? <PingCard status="ready" message={data.message} /> : <PingCard status="loading" />;
}

export function PingPanel() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => createApiClient({ url: "/api/trpc" }));

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        <PingResult />
      </TRPCProvider>
    </QueryClientProvider>
  );
}
