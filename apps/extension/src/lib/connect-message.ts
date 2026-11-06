/** What the connect page sends. Keep in step with `ConnectMessage` in apps/web. */
export interface StoredToken {
  value: string;
  expiresAt: string;
}

/** The token from a connect message, or null for anything else. */
export function parseConnectMessage(message: unknown): StoredToken | null {
  if (typeof message !== "object" || message === null) {
    return null;
  }

  const { type, token, expiresAt } = message as Record<string, unknown>;

  if (
    type !== "scroll-spark.connect" ||
    typeof token !== "string" ||
    token === "" ||
    typeof expiresAt !== "string" ||
    Number.isNaN(Date.parse(expiresAt))
  ) {
    return null;
  }

  return { value: token, expiresAt };
}

export function isExpired(token: StoredToken, now = new Date()) {
  return Date.parse(token.expiresAt) <= now.getTime();
}
