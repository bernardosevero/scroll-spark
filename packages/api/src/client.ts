import {
  TRPCClientError,
  createTRPCClient,
  httpBatchLink,
  httpLink,
  splitLink,
} from "@trpc/client";

import type { AppRouter } from "./router";

export type { CapturedAnalysis } from "@scroll-spark/core/analysis/schemas";
export { MAX_CAPTURE_LENGTH } from "@scroll-spark/core/capture/limits";
export type { Capture, CapturePlatform } from "@scroll-spark/core/capture/schemas";

/** Pass as an operation's context to send it alone, so it never shares a request with others. */
export const SEND_ALONE = { sendAlone: true } as const;

export function createApiClient({ url }: { url: string }) {
  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (operation) => operation.context["sendAlone"] === true,
        true: httpLink({ url }),
        false: httpBatchLink({ url }),
      }),
    ],
  });
}

/** The expected failure behind an error, or null for anything else, like a dropped connection. */
export function appCodeOf(error: unknown) {
  return error instanceof TRPCClientError
    ? ((error as TRPCClientError<AppRouter>).data?.appCode ?? null)
    : null;
}
