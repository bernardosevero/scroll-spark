import { TRPCError, initTRPC } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server";

import type { AnalysisService } from "@scroll-spark/core/analysis/analysis.service";
import {
  captureIdInputSchema,
  capturedAnalysisSchema,
  setTrendsGeoInputSchema,
} from "@scroll-spark/core/analysis/schemas";
import type { ChannelSettingsService } from "@scroll-spark/core/buffer/channel-settings.service";
import {
  accountViewSchema,
  channelIdsInputSchema,
  channelsViewSchema,
  organizationIdInputSchema,
} from "@scroll-spark/core/buffer/schemas";
import type { CaptureService } from "@scroll-spark/core/capture/capture.service";
import {
  captureSchema,
  createCaptureInputSchema,
  inboxSchema,
  readLinkInputSchema,
  readLinkResultSchema,
} from "@scroll-spark/core/capture/schemas";
import { AppError } from "@scroll-spark/core/errors/app-error";
import type { AppErrorCode } from "@scroll-spark/core/errors/app-error";
import type { PingService } from "@scroll-spark/core/ping/ping.service";
import { pingInputSchema, pingOutputSchema } from "@scroll-spark/core/ping/schemas";

export interface ApiContext {
  /** Null when nobody is signed in. */
  userId: string | null;
  services: {
    ping: PingService;
    capture: CaptureService;
    analysis: AnalysisService;
    channels: ChannelSettingsService;
  };
}

const TRPC_CODE_BY_APP_CODE: Record<AppErrorCode, TRPC_ERROR_CODE_KEY> = {
  INVALID_INPUT: "BAD_REQUEST",
  OAUTH_FAILED: "BAD_REQUEST",
  NOT_SIGNED_IN: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  ANALYSIS_LIMIT_REACHED: "TOO_MANY_REQUESTS",
  LLM_FAILED: "BAD_GATEWAY",
  RECONNECT_REQUIRED: "UNAUTHORIZED",
  BUFFER_RATE_LIMITED: "TOO_MANY_REQUESTS",
  BUFFER_LIMIT_REACHED: "PRECONDITION_FAILED",
  LLM_REFUSED: "UNPROCESSABLE_CONTENT",
  BUFFER_FAILED: "BAD_GATEWAY",
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

const signedInProcedure = procedure.use(({ ctx, next }) => {
  if (ctx.userId === null) {
    throw new AppError("NOT_SIGNED_IN");
  }

  return next({ ctx: { userId: ctx.userId } });
});

/** Routers are one-line forwards. Decisions live in `core` services. */
export const appRouter = trpc.router({
  ping: procedure
    .input(pingInputSchema)
    .output(pingOutputSchema)
    .mutation(({ ctx, input }) => ctx.services.ping.ping(input)),

  capture: trpc.router({
    readLink: signedInProcedure
      .input(readLinkInputSchema)
      .output(readLinkResultSchema)
      .mutation(({ ctx, input }) => ctx.services.capture.readLink(input)),
    create: signedInProcedure
      .input(createCaptureInputSchema)
      .output(captureSchema)
      .mutation(({ ctx, input }) => ctx.services.capture.create(ctx.userId, input)),
    inbox: signedInProcedure
      .output(inboxSchema)
      .query(({ ctx }) => ctx.services.capture.listInbox(ctx.userId)),
    get: signedInProcedure
      .input(captureIdInputSchema)
      .output(capturedAnalysisSchema)
      .query(({ ctx, input }) => ctx.services.analysis.get(ctx.userId, input)),
    analyze: signedInProcedure
      .input(captureIdInputSchema)
      .output(capturedAnalysisSchema)
      .mutation(({ ctx, input }) => ctx.services.analysis.analyze(ctx.userId, input)),
  }),

  buffer: trpc.router({
    account: signedInProcedure
      .output(accountViewSchema)
      .query(({ ctx }) => ctx.services.channels.account(ctx.userId)),
    channels: signedInProcedure
      .output(channelsViewSchema)
      .query(({ ctx }) => ctx.services.channels.channels(ctx.userId)),
    setOrganization: signedInProcedure
      .input(organizationIdInputSchema)
      .mutation(({ ctx, input }) => ctx.services.channels.setOrganization(ctx.userId, input)),
    setDefaultChannels: signedInProcedure
      .input(channelIdsInputSchema)
      .mutation(({ ctx, input }) => ctx.services.channels.setDefaultChannels(ctx.userId, input)),
  }),

  settings: trpc.router({
    setTrendsGeo: signedInProcedure
      .input(setTrendsGeoInputSchema)
      .mutation(({ ctx, input }) => ctx.services.analysis.setTrendsGeo(ctx.userId, input)),
  }),
});

export type AppRouter = typeof appRouter;
