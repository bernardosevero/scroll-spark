"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";

import { useTRPC } from "@scroll-spark/api/react";
import { PingCard } from "@scroll-spark/ui/ping-card";

import { ApiProvider } from "../api/api-provider";

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
  return (
    <ApiProvider>
      <PingResult />
    </ApiProvider>
  );
}
