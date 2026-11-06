import { AppError } from "../errors/app-error";
import type { Clock } from "../time/clock";
import type { PendingConnect, TokenSet } from "./schemas";

export interface BufferAuthGateway {
  authorizeUrl(params: { state: string; codeChallenge: string; redirectUri: string }): string;
  exchangeCode(params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<TokenSet>;
  fetchAccountId(accessToken: string): Promise<string>;
}

export interface GrantRecord {
  tokens: TokenSet;
  /** Set while a refresh is in flight. Past its time, that refresh's result is unknown. */
  refreshingUntil: Date | null;
  needsReconnect: boolean;
}

export interface GrantRepository {
  /** Creates or replaces the grant, clearing any lock or need to reconnect. */
  saveGrant(bufferAccountId: string, tokens: TokenSet): Promise<string>;
  read(userId: string): Promise<GrantRecord | null>;
  /** Atomic. True only for the one caller that may spend the refresh token. */
  tryStartRefresh(userId: string, until: Date): Promise<boolean>;
  finishRefresh(userId: string, tokens: TokenSet): Promise<void>;
  markReconnectRequired(userId: string): Promise<void>;
}

export interface PkceCrypto {
  randomToken(): string;
  challengeFor(verifier: string): Promise<string>;
}

export interface AuthService {
  beginConnect(params: {
    redirectUri: string;
  }): Promise<{ authorizeUrl: string; pending: PendingConnect }>;
  completeConnect(params: {
    code: string | null;
    state: string | null;
    pending: PendingConnect | null;
    redirectUri: string;
  }): Promise<{ userId: string }>;
  getAccessToken(userId: string): Promise<string>;
}

const REFRESH_EARLY_MS = 60_000;
const REFRESH_LEASE_MS = 30_000;
const WAIT_STEP_MS = 250;
const MAX_WAITS = 40;

export function createAuthService({
  gateway,
  grants,
  clock,
  crypto,
  sleep,
}: {
  gateway: BufferAuthGateway;
  grants: GrantRepository;
  clock: Clock;
  crypto: PkceCrypto;
  sleep: (ms: number) => Promise<void>;
}): AuthService {
  function isUsable(tokens: TokenSet) {
    return tokens.expiresAt.getTime() - clock.now().getTime() > REFRESH_EARLY_MS;
  }

  async function refreshOnce(userId: string, refreshToken: string) {
    try {
      const tokens = await gateway.refresh(refreshToken);
      // The old token is dead from here, so nothing may come before this save.
      await grants.finishRefresh(userId, tokens);
      return tokens.accessToken;
    } catch (cause) {
      await grants.markReconnectRequired(userId);
      throw new AppError("RECONNECT_REQUIRED", { cause });
    }
  }

  return {
    async beginConnect({ redirectUri }) {
      const pending = { state: crypto.randomToken(), codeVerifier: crypto.randomToken() };
      const codeChallenge = await crypto.challengeFor(pending.codeVerifier);

      return {
        authorizeUrl: gateway.authorizeUrl({ state: pending.state, codeChallenge, redirectUri }),
        pending,
      };
    },

    async completeConnect({ code, state, pending, redirectUri }) {
      if (pending === null || code === null || state !== pending.state) {
        throw new AppError("OAUTH_FAILED");
      }

      try {
        const tokens = await gateway.exchangeCode({
          code,
          codeVerifier: pending.codeVerifier,
          redirectUri,
        });
        const bufferAccountId = await gateway.fetchAccountId(tokens.accessToken);

        return { userId: await grants.saveGrant(bufferAccountId, tokens) };
      } catch (cause) {
        throw new AppError("OAUTH_FAILED", { cause });
      }
    },

    async getAccessToken(userId) {
      for (let waits = 0; waits < MAX_WAITS; waits += 1) {
        const record = await grants.read(userId);

        if (record === null || record.needsReconnect) {
          throw new AppError("RECONNECT_REQUIRED");
        }

        if (isUsable(record.tokens)) {
          return record.tokens.accessToken;
        }

        if (record.refreshingUntil === null) {
          const until = new Date(clock.now().getTime() + REFRESH_LEASE_MS);

          if (await grants.tryStartRefresh(userId, until)) {
            return refreshOnce(userId, record.tokens.refreshToken);
          }
        } else if (record.refreshingUntil <= clock.now()) {
          // That request may have spent the token, and reusing a spent one revokes the grant.
          await grants.markReconnectRequired(userId);
          throw new AppError("RECONNECT_REQUIRED");
        }

        await sleep(WAIT_STEP_MS);
      }

      throw new AppError("RECONNECT_REQUIRED");
    },
  };
}
