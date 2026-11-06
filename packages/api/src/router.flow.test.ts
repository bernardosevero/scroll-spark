import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { AppError } from "@scroll-spark/core/errors/app-error";
import type { PingService } from "@scroll-spark/core/ping/ping.service";

import { appRouter } from "./router";

function callerWith(ping: PingService["ping"]) {
  return appRouter.createCaller({ services: { ping: { ping } } });
}

describe("API flow", () => {
  it("forwards ping to the service", async () => {
    const caller = callerWith(({ name }) => ({
      message: `pong, ${name}`,
      answeredAt: "2026-11-06T12:00:00.000Z",
    }));

    await expect(caller.ping({ name: "extension" })).resolves.toEqual({
      message: "pong, extension",
      answeredAt: "2026-11-06T12:00:00.000Z",
    });
  });

  it.each([
    ["INVALID_INPUT", "BAD_REQUEST"],
    ["OAUTH_FAILED", "BAD_REQUEST"],
    ["RECONNECT_REQUIRED", "UNAUTHORIZED"],
    ["BUFFER_RATE_LIMITED", "TOO_MANY_REQUESTS"],
    ["BUFFER_LIMIT_REACHED", "PRECONDITION_FAILED"],
    ["LLM_REFUSED", "UNPROCESSABLE_CONTENT"],
  ] as const)("maps AppError %s to tRPC %s", async (appCode, trpcCode) => {
    const caller = callerWith(() => {
      throw new AppError(appCode);
    });

    const error = await caller.ping({ name: "x" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code: trpcCode, message: appCode });
  });
});
