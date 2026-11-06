import type { ApiContext } from "@scroll-spark/api/router";
import { createAuthService } from "@scroll-spark/core/auth/auth.service";
import { createCaptureService } from "@scroll-spark/core/capture/capture.service";
import type { Logger } from "@scroll-spark/core/logging/logger";
import { createPingService } from "@scroll-spark/core/ping/ping.service";

import { createBufferAuthGateway } from "./auth/buffer-auth-gateway";
import type { OAuthContext } from "./auth/oauth-handlers";
import { pkceCrypto } from "./auth/pkce";
import { createMemoryCaptureRepository, fakeLinkReader } from "./capture/fakes";
import { createLinkReader } from "./capture/link-reader";
import { createSafeGet } from "./capture/safe-get";
import { createSealer } from "./crypto/seal";
import { createCaptureRepository } from "./db/capture-repository";
import { createDb } from "./db/client";
import { createGrantRepository } from "./db/grant-repository";
import { getEnv } from "./env";
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

function composeCapture(logger: Logger) {
  const { DATABASE_URL, E2E_FAKES } = getEnv();

  if (E2E_FAKES !== undefined) {
    return createCaptureService({
      captures: createMemoryCaptureRepository(),
      linkReader: fakeLinkReader,
    });
  }

  return createCaptureService({
    // With no database nobody can sign in, so this store is never reached.
    captures: DATABASE_URL
      ? createCaptureRepository({ db: createDb(DATABASE_URL) })
      : createMemoryCaptureRepository(),
    linkReader: createLinkReader({ get: createSafeGet(), logger }),
  });
}

let cached: Composition | undefined;

/** The one place services meet their real adapters. Tests build services with fakes instead. */
export function getComposition(): Composition {
  if (cached === undefined) {
    const logger = createLogger({ level: getEnv().LOG_LEVEL });

    cached = {
      logger,
      services: { ping: createPingService({ clock }), capture: composeCapture(logger) },
      oauth: composeOAuth(logger),
    };
  }

  return cached;
}
