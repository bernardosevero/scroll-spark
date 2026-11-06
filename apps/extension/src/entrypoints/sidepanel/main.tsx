import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createApiClient } from "@scroll-spark/api/client";
import { TRPCProvider } from "@scroll-spark/api/react";

import { SidePanel } from "./side-panel";
import "./style.css";

const API_ORIGIN =
  (import.meta.env.WXT_API_ORIGIN as string | undefined) ?? "http://localhost:3000";

const queryClient = new QueryClient();
const trpcClient = createApiClient({ url: `${API_ORIGIN}/api/trpc` });
const container = document.querySelector("#root");

if (container === null) {
  throw new Error("The side panel page has no #root element.");
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        <SidePanel />
      </TRPCProvider>
    </QueryClientProvider>
  </StrictMode>,
);
