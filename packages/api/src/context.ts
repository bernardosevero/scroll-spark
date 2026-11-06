import type { ExtensionTokenService } from "@scroll-spark/core/extension-token/extension-token.service";

/** How a request proved who it is: the website's cookie, or the side panel's bearer token. */
export type Credential = "session" | "extension";

export interface Caller {
  /** Null when nobody is signed in. */
  userId: string | null;
  credential: Credential | null;
}

const SIGNED_OUT: Caller = { userId: null, credential: null };

/**
 * A bearer token wins when one is sent, and a bad one signs the request out rather than falling
 * back to a cookie, so a stale panel never silently acts as someone else.
 */
export async function resolveCaller({
  authorization,
  sessionUserId,
  extensionTokens,
}: {
  authorization: string | null;
  sessionUserId: string | null;
  extensionTokens: Pick<ExtensionTokenService, "resolve">;
}): Promise<Caller> {
  if (authorization !== null) {
    const token = /^Bearer (\S+)$/i.exec(authorization)?.[1];
    const userId = token === undefined ? null : await extensionTokens.resolve(token);

    return userId === null ? SIGNED_OUT : { userId, credential: "extension" };
  }

  return sessionUserId === null ? SIGNED_OUT : { userId: sessionUserId, credential: "session" };
}
