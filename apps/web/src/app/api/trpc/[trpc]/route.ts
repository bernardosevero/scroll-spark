import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "@scroll-spark/api/router";

import { currentUserId } from "@/server/auth/current-user";
import { getComposition } from "@/server/composition";
import { allowedOrigin, corsHeaders } from "@/server/cors";
import { getEnv } from "@/server/env";

// Analysis waits on Claude. The adapter gives up first, so the user sees a real message.
export const maxDuration = 60;

function originHeaders(request: Request) {
  const { EXTENSION_ORIGIN, NODE_ENV } = getEnv();

  return corsHeaders(
    allowedOrigin({
      origin: request.headers.get("origin"),
      extensionOrigin: EXTENSION_ORIGIN,
      isDevelopment: NODE_ENV === "development",
    }),
  );
}

async function handle(request: Request) {
  const { logger, services } = getComposition();

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: async () => ({ userId: await currentUserId(), services }),
    onError({ error, path }) {
      if (error.code === "INTERNAL_SERVER_ERROR") {
        logger.error("api.unexpected_error", { path: path ?? null, name: error.name });
      }
    },
  });

  new Headers(originHeaders(request)).forEach((value, key) => response.headers.set(key, value));
  return response;
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: originHeaders(request) });
}

export { handle as GET, handle as POST };
