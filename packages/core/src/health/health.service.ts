import type { Logger } from "../logging/logger";

const NAMES = ["database", "ai", "buffer"] as const;
const DEFAULT_TIMEOUT_MS = 25_000;

type CheckName = (typeof NAMES)[number];
type CheckStatus = "ok" | "error" | "not_configured";

/** Each check resolves when the service answered. Null means it isn't set up here yet. */
export type HealthChecks = Record<CheckName, (() => Promise<unknown>) | null>;

export interface HealthReport {
  isHealthy: boolean;
  checks: Record<CheckName, CheckStatus>;
}

export interface HealthService {
  check(): Promise<HealthReport>;
}

function withinTime(check: () => Promise<unknown>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error("Timed out");
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([check(), expired]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * The daily look at everything judges depend on. Checks run side by side, so one failure can't
 * hide another, and the report only says which failed, so no detail can leak through it.
 */
export function createHealthService({
  checks,
  logger,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  checks: HealthChecks;
  logger: Logger;
  timeoutMs?: number;
}): HealthService {
  async function run(name: CheckName): Promise<CheckStatus> {
    const check = checks[name];

    if (check === null) {
      return "not_configured";
    }

    try {
      await withinTime(check, timeoutMs);
      return "ok";
    } catch (error) {
      logger.error("health.check_failed", {
        check: name,
        reason: error instanceof Error ? error.name : "unknown",
      });
      return "error";
    }
  }

  return {
    async check() {
      const [database, ai, buffer] = await Promise.all(NAMES.map(run));
      const report = {
        database: database ?? "error",
        ai: ai ?? "error",
        buffer: buffer ?? "error",
      };

      return {
        isHealthy: Object.values(report).every((status) => status === "ok"),
        checks: report,
      };
    },
  };
}
