import { createTRPCClient, httpBatchLink } from "@trpc/client";

import type { AppRouter } from "./router";

export function createApiClient({ url }: { url: string }) {
  return createTRPCClient<AppRouter>({ links: [httpBatchLink({ url })] });
}
