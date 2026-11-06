import Anthropic from "@anthropic-ai/sdk";

import type { ApiContext } from "@scroll-spark/api/router";
import { createAnalysisService } from "@scroll-spark/core/analysis/analysis.service";
import type { LlmGateway } from "@scroll-spark/core/analysis/analysis.service";
import { createAuthService } from "@scroll-spark/core/auth/auth.service";
import { createCaptureService } from "@scroll-spark/core/capture/capture.service";
import type { Logger } from "@scroll-spark/core/logging/logger";
import { createPingService } from "@scroll-spark/core/ping/ping.service";

import { createBufferAuthGateway } from "./auth/buffer-auth-gateway";
import type { OAuthContext } from "./auth/oauth-handlers";
import { pkceCrypto } from "./auth/pkce";
import {
  createMemoryAnalysisRepository,
  createMemoryCaptureRepository,
  createMemoryUserSettings,
  fakeLinkReader,
  fakeLlm,
} from "./capture/fakes";
import { createLinkReader } from "./capture/link-reader";
import { createSafeGet } from "./capture/safe-get";
import { createSealer } from "./crypto/seal";
import { createAnalysisRepository, createUserSettingsRepository } from "./db/analysis-repository";
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
    return {
      captures: createMemoryCaptureRepository(),
      analyses: createMemoryAnalysisRepository(),
      settings: createMemoryUserSettings(),
    };
  }

  const db = createDb(DATABASE_URL);

  return {
    captures: createCaptureRepository({ db }),
    analyses: createAnalysisRepository({ db }),
    settings: createUserSettingsRepository({ db }),
  };
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

function composeProductServices(logger: Logger) {
  const { captures, analyses, settings } = composeStores();
  const linkReader =
    getEnv().E2E_FAKES === undefined
      ? createLinkReader({ get: createSafeGet(), logger })
      : fakeLinkReader;

  return {
    capture: createCaptureService({ captures, linkReader }),
    analysis: createAnalysisService({
      llm: composeLlm(logger),
      analyses,
      captures,
      settings,
      clock,
    }),
  };
}

let cached: Composition | undefined;

/** The one place services meet their real adapters. Tests build services with fakes instead. */
export function getComposition(): Composition {
  if (cached === undefined) {
    const logger = createLogger({ level: getEnv().LOG_LEVEL });

    cached = {
      logger,
      services: { ping: createPingService({ clock }), ...composeProductServices(logger) },
      oauth: composeOAuth(logger),
    };
  }

  return cached;
}
