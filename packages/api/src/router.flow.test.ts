import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import type { CaptureService } from "@scroll-spark/core/capture/capture.service";
import { AppError } from "@scroll-spark/core/errors/app-error";
import type { PingService } from "@scroll-spark/core/ping/ping.service";

import { appRouter } from "./router";

const CAPTURE = {
  id: "capture-1",
  text: "A post.",
  sourceUrl: null,
  platform: "pasted",
  sourceName: null,
  createdAt: "2026-11-06T12:00:00.000Z",
} as const;

function createCapture(): CaptureService {
  return {
    create: vi.fn(() => Promise.resolve(CAPTURE)),
    listInbox: vi.fn(() => Promise.resolve([CAPTURE])),
    readLink: vi.fn(({ url }: { url: string }) =>
      Promise.resolve({ status: "paste_needed" as const, url, platform: "web" as const }),
    ),
  };
}

function callerWith(ping: PingService["ping"], userId: string | null = null) {
  const capture = createCapture();
  return {
    capture,
    caller: appRouter.createCaller({ userId, services: { ping: { ping }, capture } }),
  };
}

type Caller = ReturnType<typeof callerWith>["caller"];

const noPing: PingService["ping"] = () => ({ message: "", answeredAt: "" });

describe("API flow", () => {
  it("forwards ping to the service", async () => {
    const { caller } = callerWith(({ name }) => ({
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
    ["NOT_SIGNED_IN", "UNAUTHORIZED"],
    ["RECONNECT_REQUIRED", "UNAUTHORIZED"],
    ["BUFFER_RATE_LIMITED", "TOO_MANY_REQUESTS"],
    ["BUFFER_LIMIT_REACHED", "PRECONDITION_FAILED"],
    ["LLM_REFUSED", "UNPROCESSABLE_CONTENT"],
  ] as const)("maps AppError %s to tRPC %s", async (appCode, trpcCode) => {
    const { caller } = callerWith(() => {
      throw new AppError(appCode);
    });

    const error = await caller.ping({ name: "x" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code: trpcCode, message: appCode });
  });
});

describe("capture API", () => {
  const input = { text: "A post.", sourceUrl: null, platform: "pasted", sourceName: null } as const;

  it.each([
    ["capture.create", (caller: Caller) => caller.capture.create(input)],
    ["capture.inbox", (caller: Caller) => caller.capture.inbox()],
    [
      "capture.readLink",
      (caller: Caller) => caller.capture.readLink({ url: "https://example.org/" }),
    ],
  ])("refuses %s when signed out", async (_name, call) => {
    const { caller, capture } = callerWith(noPing, null);

    await expect(call(caller)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "NOT_SIGNED_IN",
    });
    expect(capture.create).not.toHaveBeenCalled();
    expect(capture.listInbox).not.toHaveBeenCalled();
    expect(capture.readLink).not.toHaveBeenCalled();
  });

  it("passes the signed-in user to the service", async () => {
    const { caller, capture } = callerWith(noPing, "user-1");

    await expect(caller.capture.create(input)).resolves.toEqual(CAPTURE);
    await expect(caller.capture.inbox()).resolves.toEqual([CAPTURE]);

    expect(capture.create).toHaveBeenCalledWith("user-1", input);
    expect(capture.listInbox).toHaveBeenCalledWith("user-1");
  });

  it.each([
    ["blank text", { ...input, text: "   " }],
    ["far too much text", { ...input, text: "a".repeat(50_001) }],
    ["a script link", { ...input, sourceUrl: "javascript:alert(1)" }],
    ["a file link", { ...input, sourceUrl: "file:///etc/passwd" }],
  ])("refuses %s", async (_case, bad) => {
    const { caller, capture } = callerWith(noPing, "user-1");

    await expect(caller.capture.create(bad)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(capture.create).not.toHaveBeenCalled();
  });

  it.each(["javascript:alert(1)", "file:///etc/passwd", "not a link"])(
    "won't read %s",
    async (url) => {
      const { caller, capture } = callerWith(noPing, "user-1");

      await expect(caller.capture.readLink({ url })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(capture.readLink).not.toHaveBeenCalled();
    },
  );
});
