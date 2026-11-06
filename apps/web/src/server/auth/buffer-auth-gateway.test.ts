import { describe, expect, it, vi } from "vitest";

import { createBufferAuthGateway } from "./buffer-auth-gateway";

// Shapes copied from developers.buffer.com/guides/authentication.html. Replace them with recorded
// responses once the owner has run a real sign-in.
const TOKEN_RESPONSE = {
  access_token: "eyJhbGciOi",
  refresh_token: "v1.MjAyNi",
  token_type: "Bearer",
  expires_in: 3600,
  scope: "posts:write posts:read ideas:read ideas:write account:read offline_access",
};
const INVALID_GRANT = {
  error: "invalid_grant",
  error_description: "Authorization code has expired",
};

const NOW = new Date("2026-11-06T12:00:00.000Z");

function setup(status: number, body: unknown) {
  const send = vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
  const gateway = createBufferAuthGateway({
    clientId: "client-1",
    clientSecret: "secret-1",
    clock: { now: () => NOW },
    fetch: send,
  });

  function sentForm() {
    const [url, init] = send.mock.calls[0] ?? [];
    return { url, form: new URLSearchParams(init?.body as string) };
  }

  return { gateway, send, sentForm };
}

describe("Buffer auth gateway", () => {
  it("builds the authorize URL Buffer documents, asking for a refresh token", () => {
    const { gateway } = setup(200, {});

    const url = new URL(
      gateway.authorizeUrl({
        state: "state-1",
        codeChallenge: "challenge-1",
        redirectUri: "https://localhost:3000/api/auth/callback",
      }),
    );

    expect(url.origin + url.pathname).toBe("https://auth.buffer.com/auth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "client-1",
      redirect_uri: "https://localhost:3000/api/auth/callback",
      response_type: "code",
      state: "state-1",
      code_challenge: "challenge-1",
      code_challenge_method: "S256",
    });
    expect(url.searchParams.get("scope")?.split(" ")).toEqual(
      expect.arrayContaining(["ideas:write", "posts:write", "offline_access"]),
    );
  });

  it("exchanges a code with the secret and verifier, and works out the expiry", async () => {
    const { gateway, sentForm } = setup(200, TOKEN_RESPONSE);

    await expect(
      gateway.exchangeCode({
        code: "code-1",
        codeVerifier: "verifier-1",
        redirectUri: "https://x/cb",
      }),
    ).resolves.toEqual({
      accessToken: "eyJhbGciOi",
      refreshToken: "v1.MjAyNi",
      expiresAt: new Date("2026-11-06T13:00:00.000Z"),
    });

    const { url, form } = sentForm();
    expect(url).toBe("https://auth.buffer.com/token");
    expect(Object.fromEntries(form)).toEqual({
      client_id: "client-1",
      client_secret: "secret-1",
      grant_type: "authorization_code",
      code: "code-1",
      redirect_uri: "https://x/cb",
      code_verifier: "verifier-1",
    });
  });

  it("refreshes with the refresh token", async () => {
    const { gateway, sentForm } = setup(200, TOKEN_RESPONSE);

    await gateway.refresh("old-refresh");

    expect(Object.fromEntries(sentForm().form)).toMatchObject({
      grant_type: "refresh_token",
      refresh_token: "old-refresh",
    });
  });

  it("fails on a refused token request, without repeating Buffer's error body", async () => {
    const { gateway } = setup(400, INVALID_GRANT);

    await expect(gateway.refresh("spent")).rejects.toThrow("status 400");
  });

  it("fails when a response has no refresh token, since we couldn't refresh later", async () => {
    const { gateway } = setup(200, { access_token: "a", expires_in: 3600 });

    await expect(gateway.refresh("old")).rejects.toThrow();
  });

  it("reads the account ID with the access token", async () => {
    const { gateway, send } = setup(200, { data: { account: { id: "buffer-1" } } });

    await expect(gateway.fetchAccountId("token-1")).resolves.toBe("buffer-1");
    expect(send.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer token-1" });
  });
});
