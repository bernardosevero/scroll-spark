import { TRPCError, initTRPC } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server";

import type { AccountService } from "@scroll-spark/core/account/account.service";
import { accountStatusSchema } from "@scroll-spark/core/account/schemas";
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
import type { ShipService } from "@scroll-spark/core/ship/ship.service";
import {
  assistantPromptSchema,
  draftInputSchema,
  draftResultSchema,
  ideaStateSchema,
  postInputSchema,
  postResultSchema,
  savedIdeaSchema,
  shipCaptureInputSchema,
} from "@scroll-spark/core/ship/schemas";
import type { ExtensionTokenService } from "@scroll-spark/core/extension-token/extension-token.service";
import {
  connectedTokenSchema,
  extensionTokenSchema,
  revokeTokenInputSchema,
} from "@scroll-spark/core/extension-token/schemas";
import type { PingService } from "@scroll-spark/core/ping/ping.service";
import { pingInputSchema, pingOutputSchema } from "@scroll-spark/core/ping/schemas";

import type { Caller } from "./context";

export interface ApiContext extends Caller {
  services: {
    ping: PingService;
    account: AccountService;
    capture: CaptureService;
    analysis: AnalysisService;
    extensionTokens: ExtensionTokenService;
    channels: ChannelSettingsService;
    ship: ShipService;
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
  CHANNEL_NOT_SUPPORTED: "BAD_REQUEST",
  POST_TOO_LONG: "BAD_REQUEST",
  DRAFT_LIMIT_REACHED: "TOO_MANY_REQUESTS",
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

/** For the website only: a side panel's token must not be able to mint or revoke tokens. */
const sessionProcedure = signedInProcedure.use(({ ctx, next }) => {
  if (ctx.credential !== "session") {
    throw new AppError("NOT_SIGNED_IN");
  }

  return next();
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
    ideaOf: signedInProcedure
      .input(shipCaptureInputSchema)
      .output(ideaStateSchema)
      .query(({ ctx, input }) => ctx.services.ship.ideaOf(ctx.userId, input)),
    saveAsIdea: signedInProcedure
      .input(shipCaptureInputSchema)
      .output(savedIdeaSchema)
      .mutation(({ ctx, input }) => ctx.services.ship.saveAsIdea(ctx.userId, input)),
  }),

  draft: trpc.router({
    create: signedInProcedure
      .input(draftInputSchema)
      .output(draftResultSchema)
      .mutation(({ ctx, input }) => ctx.services.ship.draft(ctx.userId, input)),
    assistantPrompt: signedInProcedure
      .input(draftInputSchema)
      .output(assistantPromptSchema)
      .query(({ ctx, input }) => ctx.services.ship.assistantPrompt(ctx.userId, input)),
  }),

  post: trpc.router({
    create: signedInProcedure
      .input(postInputSchema)
      .output(postResultSchema)
      .mutation(({ ctx, input }) => ctx.services.ship.createPost(ctx.userId, input)),
  }),

  extension: trpc.router({
    connect: sessionProcedure
      .output(connectedTokenSchema)
      .mutation(({ ctx }) => ctx.services.extensionTokens.connect(ctx.userId)),
    list: sessionProcedure
      .output(extensionTokenSchema.array())
      .query(({ ctx }) => ctx.services.extensionTokens.list(ctx.userId)),
    revoke: sessionProcedure
      .input(revokeTokenInputSchema)
      .mutation(({ ctx, input }) => ctx.services.extensionTokens.revoke(ctx.userId, input)),
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

  account: trpc.router({
    status: signedInProcedure
      .output(accountStatusSchema)
      .query(({ ctx }) => ctx.services.account.status(ctx.userId)),
    // Website only, so a stolen side panel token can't erase an account.
    deleteMyData: sessionProcedure.mutation(({ ctx }) =>
      ctx.services.account.deleteMyData(ctx.userId),
    ),
  }),

  settings: trpc.router({
    setTrendsGeo: signedInProcedure
      .input(setTrendsGeoInputSchema)
      .mutation(({ ctx, input }) => ctx.services.analysis.setTrendsGeo(ctx.userId, input)),
  }),
});

export type AppRouter = typeof appRouter;
