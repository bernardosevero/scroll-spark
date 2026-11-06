import { describe, expect, it, vi } from "vitest";

import type { AnalysisService } from "@scroll-spark/core/analysis/analysis.service";
import type { CaptureService } from "@scroll-spark/core/capture/capture.service";
import type { ExtensionTokenService } from "@scroll-spark/core/extension-token/extension-token.service";

import { resolveCaller } from "./context";
import { appRouter } from "./router";

const CAPTURE = {
  id: "capture-1",
  text: "A post.",
  sourceUrl: null,
  platform: "pasted",
  sourceName: null,
  createdAt: "2026-11-06T12:00:00.000Z",
} as const;
const INPUT = { text: "A post.", sourceUrl: null, platform: "pasted", sourceName: null } as const;

function setup() {
  const extensionTokens: ExtensionTokenService = {
    connect: vi.fn(),
    list: vi.fn(() => Promise.resolve([])),
    revoke: vi.fn(() => Promise.resolve()),
    resolve: vi.fn((token: string) =>
      Promise.resolve(token === "good-token" ? "token-user" : null),
    ),
  };
  const capture: CaptureService = {
    create: vi.fn(() => Promise.resolve(CAPTURE)),
    listInbox: vi.fn(() => Promise.resolve([])),
    readLink: vi.fn(),
  };
  const services = {
    ping: { ping: vi.fn() },
    capture,
    analysis: {} as AnalysisService,
    extensionTokens,
  };

  async function callCreate(request: {
    authorization: string | null;
    sessionUserId: string | null;
  }) {
    const caller = await resolveCaller({ ...request, extensionTokens });
    return appRouter.createCaller({ ...caller, services }).capture.create(INPUT);
  }

  return { capture, extensionTokens, callCreate };
}

describe("who is calling", () => {
  it("lets a bearer token reach capture.create as its user", async () => {
    const { capture, callCreate } = setup();

    await expect(
      callCreate({ authorization: "Bearer good-token", sessionUserId: null }),
    ).resolves.toEqual(CAPTURE);

    expect(capture.create).toHaveBeenCalledWith("token-user", INPUT);
  });

  it("lets a session cookie reach capture.create as its user", async () => {
    const { capture, callCreate } = setup();

    await callCreate({ authorization: null, sessionUserId: "cookie-user" });

    expect(capture.create).toHaveBeenCalledWith("cookie-user", INPUT);
  });

  it.each([
    ["an unknown token", "Bearer bad-token", null],
    ["a token with the wrong scheme", "Basic good-token", null],
    ["an empty token", "Bearer ", null],
    ["a bad token, even beside a good cookie", "Bearer bad-token", "cookie-user"],
    ["nothing at all", null, null],
  ])("signs out %s", async (_case, authorization, sessionUserId) => {
    const { capture, callCreate } = setup();

    await expect(callCreate({ authorization, sessionUserId })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "NOT_SIGNED_IN",
    });
    expect(capture.create).not.toHaveBeenCalled();
  });
});

describe("minting and revoking connections", () => {
  it("is for the website's session only, so a stolen token can't renew itself", async () => {
    const { extensionTokens } = setup();
    const caller = appRouter.createCaller({
      userId: "token-user",
      credential: "extension",
      services: {
        ping: { ping: vi.fn() },
        capture: {} as CaptureService,
        analysis: {} as AnalysisService,
        extensionTokens,
      },
    });

    await expect(caller.extension.connect()).rejects.toMatchObject({ message: "NOT_SIGNED_IN" });
    await expect(caller.extension.list()).rejects.toMatchObject({ message: "NOT_SIGNED_IN" });
    expect(extensionTokens.connect).not.toHaveBeenCalled();
  });
});
