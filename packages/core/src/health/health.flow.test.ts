import { describe, expect, it, vi } from "vitest";

import { createHealthService } from "./health.service";
import type { HealthChecks } from "./health.service";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const passing = (): HealthChecks => ({
  database: vi.fn(() => Promise.resolve()),
  ai: vi.fn(() => Promise.resolve()),
  buffer: vi.fn(() => Promise.resolve()),
});

describe("the daily health check", () => {
  it("is healthy when the database, Claude and Buffer all answer", async () => {
    const service = createHealthService({ checks: passing(), logger });

    await expect(service.check()).resolves.toEqual({
      isHealthy: true,
      checks: { database: "ok", ai: "ok", buffer: "ok" },
    });
  });

  it.each(["database", "ai", "buffer"] as const)(
    "reports %s alone when only it fails, and still tries the others",
    async (failing) => {
      const checks = passing();
      checks[failing] = vi.fn(() => Promise.reject(new Error("down")));
      const service = createHealthService({ checks, logger });

      const result = await service.check();

      expect(result.isHealthy).toBe(false);
      expect(result.checks).toEqual({
        database: "ok",
        ai: "ok",
        buffer: "ok",
        [failing]: "error",
      });
      expect(checks.database).toHaveBeenCalledTimes(1);
      expect(checks.ai).toHaveBeenCalledTimes(1);
      expect(checks.buffer).toHaveBeenCalledTimes(1);
    },
  );

  it("counts a check that isn't set up as unhealthy, since it can't warn anyone", async () => {
    const service = createHealthService({
      checks: { ...passing(), buffer: null },
      logger,
    });

    await expect(service.check()).resolves.toEqual({
      isHealthy: false,
      checks: { database: "ok", ai: "ok", buffer: "not_configured" },
    });
  });

  it("gives up on a check that never answers", async () => {
    const service = createHealthService({
      checks: { ...passing(), ai: () => new Promise(() => undefined) },
      logger,
      timeoutMs: 5,
    });

    await expect(service.check()).resolves.toMatchObject({
      isHealthy: false,
      checks: { ai: "error" },
    });
  });

  it("keeps failure details out of its answer and its logs", async () => {
    const secret = "sk-live-token-and-post-text";
    const service = createHealthService({
      checks: { ...passing(), buffer: () => Promise.reject(new Error(secret)) },
      logger,
    });

    const result = await service.check();

    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(secret);
    expect(logger.error).toHaveBeenCalledWith("health.check_failed", {
      check: "buffer",
      reason: "Error",
    });
  });
});
