import { TRPCClientError, createTRPCClient, httpBatchLink } from "@trpc/client";

import type { AppRouter } from "./router";

export type { CapturedAnalysis } from "@scroll-spark/core/analysis/schemas";
export type { ChannelView } from "@scroll-spark/core/buffer/schemas";
export { MAX_CAPTURE_LENGTH } from "@scroll-spark/core/capture/limits";
export type { Capture, CapturePlatform } from "@scroll-spark/core/capture/schemas";

export function createApiClient({ url }: { url: string }) {
  return createTRPCClient<AppRouter>({ links: [httpBatchLink({ url })] });
}

/** The expected failure behind an error, or null for anything else, like a dropped connection. */
export function appCodeOf(error: unknown) {
  return error instanceof TRPCClientError
    ? ((error as TRPCClientError<AppRouter>).data?.appCode ?? null)
    : null;
}
