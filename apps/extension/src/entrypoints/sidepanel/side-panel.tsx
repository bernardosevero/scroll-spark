import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";

import { useTRPC } from "@scroll-spark/api/react";
import { PingCard } from "@scroll-spark/ui/ping-card";

export function SidePanel() {
  const trpc = useTRPC();
  const { mutate, data, isError } = useMutation(trpc.ping.mutationOptions());

  useEffect(() => mutate({ name: "side panel" }), [mutate]);

  return (
    <main className="flex flex-col gap-6 p-5">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Scroll Spark</h1>
      {isError && <PingCard status="error" />}
      {!isError && data && <PingCard status="ready" message={data.message} />}
      {!isError && !data && <PingCard status="loading" />}
    </main>
  );
}
