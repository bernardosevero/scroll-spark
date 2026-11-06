import { describe, expect, it, vi } from "vitest";

import { createAuthService } from "./auth.service";
import type { BufferAuthGateway, GrantRecord, GrantRepository, PkceCrypto } from "./auth.service";
import type { TokenSet } from "./schemas";

const NOW = new Date("2026-11-06T12:00:00.000Z");
const REDIRECT_URI = "https://localhost:3000/api/auth/callback";
const HOUR = 60 * 60 * 1000;

function tokens(name: string, expiresAt = new Date(NOW.getTime() + HOUR)): TokenSet {
  return { accessToken: `access-${name}`, refreshToken: `refresh-${name}`, expiresAt };
}

/** Behaves like the real table: the lock is one atomic check-and-set. */
function createGrants(): GrantRepository & { records: Map<string, GrantRecord> } {
  const records = new Map<string, GrantRecord>();

  function get(userId: string) {
    const record = records.get(userId);
    if (record === undefined) {
      throw new Error(`No grant for ${userId}`);
    }
    return record;
  }

  return {
    records,
    saveGrant(bufferAccountId, tokenSet) {
      const userId = `user-${bufferAccountId}`;
      records.set(userId, { tokens: tokenSet, refreshingUntil: null, needsReconnect: false });
      return Promise.resolve(userId);
    },
    read: (userId) => Promise.resolve(records.get(userId) ?? null),
    tryStartRefresh(userId, until) {
      const record = get(userId);
      if (record.refreshingUntil !== null || record.needsReconnect) {
        return Promise.resolve(false);
      }
      record.refreshingUntil = until;
      return Promise.resolve(true);
    },
    finishRefresh(userId, tokenSet) {
      const record = get(userId);
      record.tokens = tokenSet;
      record.refreshingUntil = null;
      return Promise.resolve();
    },
    markReconnectRequired(userId) {
      const record = get(userId);
      record.needsReconnect = true;
      record.refreshingUntil = null;
      return Promise.resolve();
    },
  };
}

const crypto: PkceCrypto = {
  randomToken: vi.fn(() => "random-value"),
  challengeFor: (verifier) => Promise.resolve(`challenge-of-${verifier}`),
};

function setup(gatewayOverrides: Partial<BufferAuthGateway> = {}, sleepGate?: Promise<void>) {
  const grants = createGrants();
  const clock = { now: () => NOW };
  const sleeps = { count: 0 };
  const gateway: BufferAuthGateway = {
    authorizeUrl: ({ state, codeChallenge, redirectUri }) =>
      `https://auth.example/auth?state=${state}&challenge=${codeChallenge}&redirect=${redirectUri}`,
    exchangeCode: vi.fn(() => Promise.resolve(tokens("first"))),
    refresh: vi.fn(() => Promise.resolve(tokens("second"))),
    fetchAccountId: vi.fn(() => Promise.resolve("buffer-1")),
    ...gatewayOverrides,
  };
  const service = createAuthService({
    gateway,
    grants,
    clock,
    crypto,
    sleep: () => {
      sleeps.count += 1;
      return sleepGate ?? Promise.resolve();
    },
  });

  return { service, gateway, grants, sleeps };
}

describe("connecting a Buffer account", () => {
  it("sends the user to Buffer with state and a PKCE challenge, then signs them in", async () => {
    const { service, gateway, grants } = setup();

    const { authorizeUrl, pending } = await service.beginConnect({ redirectUri: REDIRECT_URI });

    expect(authorizeUrl).toContain("state=random-value");
    expect(authorizeUrl).toContain("challenge=challenge-of-random-value");

    const { userId } = await service.completeConnect({
      code: "code-1",
      state: pending.state,
      pending,
      redirectUri: REDIRECT_URI,
    });

    expect(gateway.exchangeCode).toHaveBeenCalledWith({
      code: "code-1",
      codeVerifier: pending.codeVerifier,
      redirectUri: REDIRECT_URI,
    });
    expect(grants.records.get(userId)?.tokens.accessToken).toBe("access-first");
  });

  it.each([
    ["a state that doesn't match", "other-state"],
    ["no state at all", null],
  ])("refuses %s without calling Buffer", async (_case, state) => {
    const { service, gateway } = setup();
    const { pending } = await service.beginConnect({ redirectUri: REDIRECT_URI });

    await expect(
      service.completeConnect({ code: "code-1", state, pending, redirectUri: REDIRECT_URI }),
    ).rejects.toMatchObject({ code: "OAUTH_FAILED" });
    expect(gateway.exchangeCode).not.toHaveBeenCalled();
  });

  it("refuses a callback that has no pending connection", async () => {
    const { service } = setup();

    await expect(
      service.completeConnect({
        code: "code-1",
        state: "s",
        pending: null,
        redirectUri: REDIRECT_URI,
      }),
    ).rejects.toMatchObject({ code: "OAUTH_FAILED" });
  });

  it("clears a previous need to reconnect", async () => {
    const { service, grants } = setup();
    grants.records.set("user-buffer-1", {
      tokens: tokens("old"),
      refreshingUntil: null,
      needsReconnect: true,
    });
    const { pending } = await service.beginConnect({ redirectUri: REDIRECT_URI });

    await service.completeConnect({
      code: "c",
      state: pending.state,
      pending,
      redirectUri: REDIRECT_URI,
    });

    expect(await service.getAccessToken("user-buffer-1")).toBe("access-first");
  });
});

describe("staying signed in as tokens rotate", () => {
  const expired = tokens("old", new Date(NOW.getTime() - 1000));

  async function signedInWith(
    tokenSet: TokenSet,
    overrides: Partial<BufferAuthGateway> = {},
    sleepGate?: Promise<void>,
  ) {
    const context = setup(overrides, sleepGate);
    const userId = await context.grants.saveGrant("buffer-1", tokenSet);
    return { ...context, userId };
  }

  it("uses a valid token without refreshing", async () => {
    const { service, gateway, userId } = await signedInWith(tokens("current"));

    await expect(service.getAccessToken(userId)).resolves.toBe("access-current");
    expect(gateway.refresh).not.toHaveBeenCalled();
  });

  it("refreshes a token that is about to expire, a minute early", async () => {
    const almostExpired = tokens("old", new Date(NOW.getTime() + 30_000));
    const { service, gateway, userId } = await signedInWith(almostExpired);

    await expect(service.getAccessToken(userId)).resolves.toBe("access-second");
    expect(gateway.refresh).toHaveBeenCalledWith("refresh-old");
  });

  it("saves the new token before returning, and releases the lock", async () => {
    const { service, grants, userId } = await signedInWith(expired);

    await service.getAccessToken(userId);

    expect(grants.records.get(userId)).toMatchObject({
      tokens: { refreshToken: "refresh-second" },
      refreshingUntil: null,
    });
  });

  it("spends a refresh token only once when two requests race", async () => {
    let finishRefresh: (tokenSet: TokenSet) => void = () => undefined;
    const refresh = vi.fn(
      () =>
        new Promise<TokenSet>((resolve) => {
          finishRefresh = resolve;
        }),
    );
    let wakeWaiter: () => void = () => undefined;
    const waiterAsleep = new Promise<void>((resolve) => {
      wakeWaiter = resolve;
    });
    const { service, sleeps, userId } = await signedInWith(expired, { refresh }, waiterAsleep);

    const first = service.getAccessToken(userId);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    const second = service.getAccessToken(userId);
    await vi.waitFor(() => expect(sleeps.count).toBe(1));
    finishRefresh(tokens("second"));
    await first;
    wakeWaiter();

    await expect(Promise.all([first, second])).resolves.toEqual(["access-second", "access-second"]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["Buffer refuses it", new Error("invalid_grant")],
    ["the result is unclear", new TypeError("network dropped")],
  ])("asks the user to reconnect when %s, and never retries", async (_case, failure) => {
    const refresh = vi.fn(() => Promise.reject(failure));
    const { service, grants, userId } = await signedInWith(expired, { refresh });

    await expect(service.getAccessToken(userId)).rejects.toMatchObject({
      code: "RECONNECT_REQUIRED",
    });
    await expect(service.getAccessToken(userId)).rejects.toMatchObject({
      code: "RECONNECT_REQUIRED",
    });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(grants.records.get(userId)?.needsReconnect).toBe(true);
  });

  it("treats a lock left by a crashed request as unclear, since its token may be spent", async () => {
    const { service, gateway, grants, userId } = await signedInWith(expired);
    grants.records.get(userId)!.refreshingUntil = new Date(NOW.getTime() - 1000);

    await expect(service.getAccessToken(userId)).rejects.toMatchObject({
      code: "RECONNECT_REQUIRED",
    });

    expect(gateway.refresh).not.toHaveBeenCalled();
    expect(grants.records.get(userId)?.needsReconnect).toBe(true);
  });

  it("stops waiting and asks to reconnect when another request never finishes", async () => {
    const { service, gateway, grants, sleeps, userId } = await signedInWith(expired);
    grants.records.get(userId)!.refreshingUntil = new Date(NOW.getTime() + 30_000);

    await expect(service.getAccessToken(userId)).rejects.toMatchObject({
      code: "RECONNECT_REQUIRED",
    });

    expect(sleeps.count).toBeGreaterThan(0);
    expect(gateway.refresh).not.toHaveBeenCalled();
  });

  it("asks to reconnect when there is no grant", async () => {
    const { service } = setup();

    await expect(service.getAccessToken("nobody")).rejects.toMatchObject({
      code: "RECONNECT_REQUIRED",
    });
  });
});
