import type { ApiContext } from "@scroll-spark/api/router";
import type { Logger } from "@scroll-spark/core/logging/logger";
import { createPingService } from "@scroll-spark/core/ping/ping.service";

import { getEnv } from "./env";
import { createLogger } from "./logger";

interface Composition {
  logger: Logger;
  services: ApiContext["services"];
}

let cached: Composition | undefined;

/** The one place services meet their real adapters. Tests build services with fakes instead. */
export function getComposition(): Composition {
  cached ??= {
    logger: createLogger({ level: getEnv().LOG_LEVEL }),
    services: {
      ping: createPingService({ clock: { now: () => new Date() } }),
    },
  };

  return cached;
}
