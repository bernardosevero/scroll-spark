import Anthropic from "@anthropic-ai/sdk";

import type { ApiContext } from "@scroll-spark/api/router";
import { createAccountService } from "@scroll-spark/core/account/account.service";
import { createAnalysisService } from "@scroll-spark/core/analysis/analysis.service";
import type { LlmGateway } from "@scroll-spark/core/analysis/analysis.service";
import { createAuthService } from "@scroll-spark/core/auth/auth.service";
import { createBufferService } from "@scroll-spark/core/buffer/buffer.service";
import { createChannelSettingsService } from "@scroll-spark/core/buffer/channel-settings.service";
import { createCaptureService } from "@scroll-spark/core/capture/capture.service";
import { AppError } from "@scroll-spark/core/errors/app-error";
import type { Logger } from "@scroll-spark/core/logging/logger";
import { createPingService } from "@scroll-spark/core/ping/ping.service";

import { createBufferAuthGateway } from "./auth/buffer-auth-gateway";
import type { OAuthContext } from "./auth/oauth-handlers";
import { pkceCrypto } from "./auth/pkce";
import { createBufferGateway } from "./buffer/buffer-gateway";
import {
  createMemoryBufferCache,
  createMemoryBufferPreferences,
  createMemoryQuotaStore,
  fakeBufferGateway,
  fakeTokenAuth,
} from "./buffer/fakes";
import {
  createMemoryAccountRepository,
  createMemoryAnalysisRepository,
  createMemoryCaptureRepository,
  createMemoryUserSettings,
  fakeLinkReader,
  fakeLlm,
} from "./capture/fakes";
import { createLinkReader } from "./capture/link-reader";
import { createSafeGet } from "./capture/safe-get";
import { createSealer } from "./crypto/seal";
import { createAccountRepository } from "./db/account-repository";
import { createAnalysisRepository, createUserSettingsRepository } from "./db/analysis-repository";
import {
  createBufferCacheRepository,
  createBufferPreferencesRepository,
  createBufferQuotaRepository,
} from "./db/buffer-repository";
import { createCaptureRepository } from "./db/capture-repository";
import { createDb } from "./db/client";
import { createGrantRepository } from "./db/grant-repository";
import { getEnv } from "./env";
import { createAnthropicGateway } from "./llm/anthropic-gateway";
import { createLogger } from "./logger";

interface Composition {
  logger: Logger;
  services: ApiContext["services"];
  /** Null until auth is configured. Production refuses to start without it. */
  oauth: OAuthContext | null;
}

const clock = { now: () => new Date() };

function composeOAuth(logger: Logger): OAuthContext | null {
  const { APP_URL, BUFFER_CLIENT_ID, BUFFER_CLIENT_SECRET, DATABASE_URL, SECRET_KEY } = getEnv();

  if (!APP_URL || !BUFFER_CLIENT_ID || !BUFFER_CLIENT_SECRET || !DATABASE_URL || !SECRET_KEY) {
    return null;
  }

  return {
    auth: createAuthService({
      gateway: createBufferAuthGateway({
        clientId: BUFFER_CLIENT_ID,
        clientSecret: BUFFER_CLIENT_SECRET,
        clock,
      }),
      grants: createGrantRepository({
        db: createDb(DATABASE_URL),
        sealer: createSealer({ secretKey: SECRET_KEY, purpose: "buffer-tokens" }),
      }),
      clock,
      crypto: pkceCrypto,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    }),
    sessionSealer: createSealer({ secretKey: SECRET_KEY, purpose: "session" }),
    pendingSealer: createSealer({ secretKey: SECRET_KEY, purpose: "oauth-pending" }),
    logger,
    appUrl: APP_URL.replace(/\/$/, ""),
    now: clock.now,
  };
}

function composeStores() {
  const { DATABASE_URL, E2E_FAKES } = getEnv();

  // With no database nobody can sign in, so the memory stores are only reached by browser flows.
  if (DATABASE_URL === undefined || E2E_FAKES !== undefined) {
    const captures = createMemoryCaptureRepository();
    const analyses = createMemoryAnalysisRepository();
    const settings = createMemoryUserSettings();

    return {
      captures,
      analyses,
      settings,
      accounts: createMemoryAccountRepository([captures, analyses, settings]),
      bufferCache: createMemoryBufferCache(),
      bufferQuota: createMemoryQuotaStore(),
      bufferPreferences: createMemoryBufferPreferences(),
    };
  }

  const db = createDb(DATABASE_URL);

  return {
    captures: createCaptureRepository({ db }),
    analyses: createAnalysisRepository({ db }),
    settings: createUserSettingsRepository({ db }),
    bufferCache: createBufferCacheRepository({ db }),
    bufferQuota: createBufferQuotaRepository({ db }),
    bufferPreferences: createBufferPreferencesRepository({ db }),
    accounts: createAccountRepository({ db }),
  };
}

/** Every Buffer call comes through here: cache and quota first, then the one gateway. */
function composeBuffer(
  logger: Logger,
  oauth: OAuthContext | null,
  stores: ReturnType<typeof composeStores>,
) {
  const isFake = getEnv().E2E_FAKES !== undefined;
  // Without OAuth nobody can be signed in, so this is only reached by mistake.
  const auth = isFake
    ? fakeTokenAuth
    : (oauth?.auth ?? {
        getAccessToken: () => Promise.reject(new AppError("RECONNECT_REQUIRED")),
      });

  const buffer = createBufferService({
    gateway: isFake ? fakeBufferGateway : createBufferGateway({ clock, logger }),
    auth,
    cache: stores.bufferCache,
    quota: stores.bufferQuota,
    clock,
    logger,
  });

  return createChannelSettingsService({ buffer, preferences: stores.bufferPreferences });
}

function composeLlm(logger: Logger): LlmGateway {
  const { ANTHROPIC_API_KEY, E2E_FAKES } = getEnv();

  if (E2E_FAKES !== undefined) {
    return fakeLlm;
  }

  // A key may be missing in development, and then each analysis fails with a clear message.
  // No retries, since each one costs money, and a timeout under the route's own limit.
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY ?? "", maxRetries: 0, timeout: 50_000 });

  return createAnthropicGateway({ parse: (request) => client.messages.parse(request), logger });
}

function composeProductServices(logger: Logger, oauth: OAuthContext | null) {
  const stores = composeStores();
  const { captures, analyses, settings, accounts } = stores;
  const linkReader =
    getEnv().E2E_FAKES === undefined
      ? createLinkReader({ get: createSafeGet(), logger })
      : fakeLinkReader;

  return {
    account: createAccountService({ accounts }),
    capture: createCaptureService({ captures, linkReader }),
    analysis: createAnalysisService({
      llm: composeLlm(logger),
      analyses,
      captures,
      settings,
      clock,
    }),
    channels: composeBuffer(logger, oauth, stores),
  };
}

let cached: Composition | undefined;

/** The one place services meet their real adapters. Tests build services with fakes instead. */
export function getComposition(): Composition {
  if (cached === undefined) {
    const logger = createLogger({ level: getEnv().LOG_LEVEL });

    const oauth = composeOAuth(logger);

    cached = {
      logger,
      services: { ping: createPingService({ clock }), ...composeProductServices(logger, oauth) },
      oauth,
    };
  }

  return cached;
}
