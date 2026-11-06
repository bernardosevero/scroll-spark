import { TRPCClientError, createTRPCClient, httpBatchLink } from "@trpc/client";

import type { AppRouter } from "./router";

export type { CapturedAnalysis } from "@scroll-spark/core/analysis/schemas";
export { MAX_CAPTURE_LENGTH } from "@scroll-spark/core/capture/limits";
export type { Capture, CapturePlatform } from "@scroll-spark/core/capture/schemas";

export type { ConnectedToken, ExtensionToken } from "@scroll-spark/core/extension-token/schemas";

/**
 * The website sends its cookie. The side panel passes `getToken`, and each request then carries
 * that bearer token instead.
 */
export function createApiClient({
  url,
  getToken,
}: {
  url: string;
  getToken?: () => Promise<string | null>;
}) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url,
        async headers() {
          const token = (await getToken?.()) ?? null;
          return token === null ? {} : { authorization: `Bearer ${token}` };
        },
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
