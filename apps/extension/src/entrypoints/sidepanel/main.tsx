import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createApiClient } from "@scroll-spark/api/client";
import { TRPCProvider } from "@scroll-spark/api/react";

import { WEB_ORIGIN } from "~/lib/config";
import { chromeEnvironment } from "~/panel/environment";
import { SidePanel } from "~/panel/side-panel";
import "./style.css";

// An expected failure, like a revoked token, won't change by asking again.
const queryClient = new QueryClient({
  defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
});
const trpcClient = createApiClient({
  url: `${WEB_ORIGIN}/api/trpc`,
  getToken: async () => (await chromeEnvironment.readToken())?.value ?? null,
});
const container = document.querySelector("#root");

if (container === null) {
  throw new Error("The side panel page has no #root element.");
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        <SidePanel environment={chromeEnvironment} webOrigin={WEB_ORIGIN} />
      </TRPCProvider>
    </QueryClientProvider>
  </StrictMode>,
);
