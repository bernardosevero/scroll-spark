import { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter } from "./router";

/** The website and side panel share these, so both call the API the same way. */
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
