import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { createAuthService } from "@scroll-spark/core/auth/auth.service";

import { createSealer } from "../crypto/seal";
import { handleCallback, handleConnect, handleDisconnect } from "./oauth-handlers";
import type { OAuthContext } from "./oauth-handlers";
import { PENDING_COOKIE, SESSION_COOKIE, openSession } from "./session";

const APP_URL = "https://app.example";
const NOW = new Date("2026-11-06T12:00:00.000Z");
const secretKey = Buffer.alloc(32, 3).toString("base64");

function setup() {
  const sessionSealer = createSealer({ secretKey, purpose: "session" });
  const pendingSealer = createSealer({ secretKey, purpose: "pending" });
  const exchangeCode = vi.fn(() =>
    Promise.resolve({ accessToken: "a", refreshToken: "r", expiresAt: NOW }),
  );
  const auth = createAuthService({
    gateway: {
      authorizeUrl: ({ state }) => `https://auth.example/auth?state=${state}`,
      exchangeCode,
      refresh: vi.fn(),
      fetchAccountId: () => Promise.resolve("buffer-1"),
    },
    grants: {
      saveGrant: () => Promise.resolve("user-1"),
      read: vi.fn(),
      tryStartRefresh: vi.fn(),
      finishRefresh: vi.fn(),
      markReconnectRequired: vi.fn(),
    },
    clock: { now: () => NOW },
    crypto: { randomToken: () => "state-1", challengeFor: (v) => Promise.resolve(v) },
    sleep: () => Promise.resolve(),
  });
  const warn = vi.fn();
  const context: OAuthContext = {
    auth,
    sessionSealer,
    pendingSealer,
    logger: { info: vi.fn(), warn, error: vi.fn() },
    appUrl: APP_URL,
    now: () => NOW,
  };

  async function connectedCookie() {
    const response = await handleConnect(context);
    return { response, pending: response.cookies.get(PENDING_COOKIE)?.value ?? "" };
  }

  function callback(query: string, pending?: string) {
    return handleCallback(
      new NextRequest(`${APP_URL}/api/auth/callback?${query}`, {
        headers: pending === undefined ? {} : { cookie: `${PENDING_COOKIE}=${pending}` },
      }),
      context,
    );
  }

  return { context, sessionSealer, warn, exchangeCode, connectedCookie, callback };
}

describe("OAuth routes", () => {
  it("sends the user to Buffer with an encrypted, HTTP-only, Lax cookie", async () => {
    const { connectedCookie } = setup();

    const { response, pending } = await connectedCookie();
    const cookie = response.cookies.get(PENDING_COOKIE);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://auth.example/auth?state=state-1");
    expect(pending).not.toContain("state-1");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  });

  it("signs the user in when they come back with the right state", async () => {
    const { connectedCookie, callback, sessionSealer } = setup();
    const { pending } = await connectedCookie();

    const response = await callback("code=code-1&state=state-1", pending);

    expect(response.headers.get("location")).toBe(`${APP_URL}/inbox`);
    expect(
      openSession({
        sealer: sessionSealer,
        cookie: response.cookies.get(SESSION_COOKIE)?.value,
        now: NOW,
      }),
    ).toBe("user-1");
    expect(response.cookies.get(PENDING_COOKIE)?.value).toBe("");
  });

  it.each([
    ["the wrong state", "code=code-1&state=forged"],
    ["a refusal on Buffer's page", "error=access_denied&state=state-1"],
  ])("shows a failure, with no session, for %s", async (_case, query) => {
    const { connectedCookie, callback, warn, exchangeCode } = setup();
    const { pending } = await connectedCookie();

    const response = await callback(query, pending);

    expect(response.headers.get("location")).toBe(`${APP_URL}/?connect=failed`);
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
    expect(exchangeCode).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it.each([
    ["no cookie", undefined],
    ["a forged cookie", "forged"],
  ])("shows a failure for %s", async (_case, pending) => {
    const { callback } = setup();

    const response = await callback("code=code-1&state=state-1", pending);

    expect(response.headers.get("location")).toBe(`${APP_URL}/?connect=failed`);
  });

  it("signs out by removing the session", () => {
    const { context } = setup();

    const response = handleDisconnect(context);

    expect(response.status).toBe(303);
    expect(response.cookies.get(SESSION_COOKIE)?.value).toBe("");
  });
});

describe("openSession", () => {
  const sealer = createSealer({ secretKey, purpose: "session" });
  const sealedFor = (expiresAt: number) =>
    sealer.seal(JSON.stringify({ userId: "user-1", expiresAt }));

  it.each([
    ["no cookie", undefined],
    ["a forged cookie", "forged"],
    ["an expired session", sealedFor(NOW.getTime() - 1)],
  ])("gives no user for %s", (_case, cookie) => {
    expect(openSession({ sealer, cookie, now: NOW })).toBeNull();
  });

  it("gives the user for a live session", () => {
    expect(openSession({ sealer, cookie: sealedFor(NOW.getTime() + 1), now: NOW })).toBe("user-1");
  });
});
