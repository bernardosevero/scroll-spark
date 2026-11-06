import { z } from "zod";

import type { BufferAuthGateway } from "@scroll-spark/core/auth/auth.service";
import type { TokenSet } from "@scroll-spark/core/auth/schemas";
import type { Clock } from "@scroll-spark/core/time/clock";

const AUTHORIZE_URL = "https://auth.buffer.com/auth";
const TOKEN_URL = "https://auth.buffer.com/token";
const GRAPHQL_URL = "https://api.buffer.com";
const SCOPES = "account:read posts:read posts:write ideas:read ideas:write offline_access";

// Stays under how long a waiting request will wait for a refresh.
const TIMEOUT_MS = 8_000;

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
});

const accountResponseSchema = z.object({
  data: z.object({ account: z.object({ id: z.string().min(1) }) }),
});

export function createBufferAuthGateway({
  clientId,
  clientSecret,
  clock,
  fetch: send = fetch,
}: {
  clientId: string;
  clientSecret: string;
  clock: Clock;
  fetch?: typeof fetch;
}): BufferAuthGateway {
  async function requestTokens(fields: Record<string, string>): Promise<TokenSet> {
    const response = await send(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        ...fields,
      }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      // The body can describe the request, so only the status leaves this function.
      throw new Error(`Buffer token request failed with status ${response.status}`);
    }

    const body = tokenResponseSchema.parse(await response.json());

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: new Date(clock.now().getTime() + body.expires_in * 1000),
    };
  }

  return {
    authorizeUrl({ state, codeChallenge, redirectUri }) {
      const url = new URL(AUTHORIZE_URL);
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "consent",
      }).toString();

      return url.toString();
    },

    exchangeCode: ({ code, codeVerifier, redirectUri }) =>
      requestTokens({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),

    refresh: (refreshToken) =>
      requestTokens({ grant_type: "refresh_token", refresh_token: refreshToken }),

    async fetchAccountId(accessToken) {
      const response = await send(GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ query: "{ account { id } }" }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Buffer account request failed with status ${response.status}`);
      }

      return accountResponseSchema.parse(await response.json()).data.account.id;
    },
  };
}
