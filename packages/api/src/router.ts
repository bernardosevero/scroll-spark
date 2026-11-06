import { TRPCError, initTRPC } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server";

import { AppError } from "@scroll-spark/core/errors/app-error";
import type { AppErrorCode } from "@scroll-spark/core/errors/app-error";
import type { PingService } from "@scroll-spark/core/ping/ping.service";
import { pingInputSchema, pingOutputSchema } from "@scroll-spark/core/ping/schemas";

export interface ApiContext {
  services: {
    ping: PingService;
  };
}

const TRPC_CODE_BY_APP_CODE: Record<AppErrorCode, TRPC_ERROR_CODE_KEY> = {
  INVALID_INPUT: "BAD_REQUEST",
  OAUTH_FAILED: "BAD_REQUEST",
  RECONNECT_REQUIRED: "UNAUTHORIZED",
  BUFFER_RATE_LIMITED: "TOO_MANY_REQUESTS",
  BUFFER_LIMIT_REACHED: "PRECONDITION_FAILED",
  LLM_REFUSED: "UNPROCESSABLE_CONTENT",
};

const trpc = initTRPC.context<ApiContext>().create({
  errorFormatter({ shape, error }) {
    const appCode = error.cause instanceof AppError ? error.cause.code : null;
    return { ...shape, data: { ...shape.data, appCode } };
  },
});

const procedure = trpc.procedure.use(async ({ next }) => {
  const result = await next();

  if (!result.ok && result.error.cause instanceof AppError) {
    const { cause } = result.error;
    throw new TRPCError({ code: TRPC_CODE_BY_APP_CODE[cause.code], message: cause.code, cause });
  }

  return result;
});

/** Routers are one-line forwards. Decisions live in `core` services. */
export const appRouter = trpc.router({
  ping: procedure
    .input(pingInputSchema)
    .output(pingOutputSchema)
    .mutation(({ ctx, input }) => ctx.services.ping.ping(input)),
});

export type AppRouter = typeof appRouter;
