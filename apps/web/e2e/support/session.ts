import { randomUUID } from "node:crypto";

import type { BrowserContext } from "@playwright/test";

import { SESSION_COOKIE, sealSession } from "../../src/server/auth/session";
import { createSealer } from "../../src/server/crypto/seal";

/** Only ever a test value. The server under test starts with this key. */
export const E2E_SECRET_KEY = Buffer.alloc(32, 1).toString("base64");

/** The extension the server under test accepts. Only ever a test value. */
export const EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";

/**
 * Signs in by sealing a real session, so the app needs no test-only way in. Each call is a new
 * user, because tests share one in-memory store.
 */
export async function signIn(
  context: BrowserContext,
  { userId = randomUUID() }: { userId?: string } = {},
) {
  const value = sealSession({
    sealer: createSealer({ secretKey: E2E_SECRET_KEY, purpose: "session" }),
    userId,
    now: new Date(),
  });

  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
