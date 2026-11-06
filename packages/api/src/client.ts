import {
  TRPCClientError,
  createTRPCClient,
  httpBatchLink,
  httpLink,
  splitLink,
} from "@trpc/client";

import type { AppRouter } from "./router";

export type { CapturedAnalysis } from "@scroll-spark/core/analysis/schemas";
export type { ChannelView } from "@scroll-spark/core/buffer/schemas";
export { MAX_CAPTURE_LENGTH } from "@scroll-spark/core/capture/limits";
export type { Capture, CapturePlatform } from "@scroll-spark/core/capture/schemas";

export type { ConnectedToken, ExtensionToken } from "@scroll-spark/core/extension-token/schemas";

/** Pass as an operation's context to send it alone, so it never shares a request with others. */
export const SEND_ALONE = { sendAlone: true } as const;

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
  async function headers() {
    const token = (await getToken?.()) ?? null;
    return token === null ? {} : { authorization: `Bearer ${token}` };
  }

  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        condition: (operation) => operation.context["sendAlone"] === true,
        true: httpLink({ url, headers }),
        false: httpBatchLink({ url, headers }),
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
