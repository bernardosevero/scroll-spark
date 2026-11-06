"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { SEND_ALONE, appCodeOf } from "@scroll-spark/api/client";
import { useTRPC } from "@scroll-spark/api/react";

/**
 * True when Buffer needs the user to connect again: either the account says so on arrival, or any
 * call made while the page is open fails that way.
 */
export function useReconnectNeeded() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const status = useQuery(
    trpc.account.status.queryOptions(undefined, { trpc: { context: SEND_ALONE } }),
  );
  const [hasFailedOnReconnect, setHasFailedOnReconnect] = useState(false);

  useEffect(() => {
    const noteFailure = (event: { type: string; action?: { type: string; error?: unknown } }) => {
      if (
        event.type === "updated" &&
        event.action?.type === "error" &&
        appCodeOf(event.action.error) === "RECONNECT_REQUIRED"
      ) {
        setHasFailedOnReconnect(true);
      }
    };
    const stopQueries = queryClient.getQueryCache().subscribe(noteFailure);
    const stopMutations = queryClient.getMutationCache().subscribe(noteFailure);

    return () => {
      stopQueries();
      stopMutations();
    };
  }, [queryClient]);

  return hasFailedOnReconnect || status.data?.needsReconnect === true;
}
