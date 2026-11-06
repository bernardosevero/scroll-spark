import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import type { AccountService } from "@scroll-spark/core/account/account.service";
import type { AnalysisService } from "@scroll-spark/core/analysis/analysis.service";
import type { ChannelSettingsService } from "@scroll-spark/core/buffer/channel-settings.service";
import type { CaptureService } from "@scroll-spark/core/capture/capture.service";
import { AppError } from "@scroll-spark/core/errors/app-error";
import type { ExtensionTokenService } from "@scroll-spark/core/extension-token/extension-token.service";
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

const CAPTURED = { capture: CAPTURE, analysis: null, trendsGeo: "US" };
const CAPTURE_ID = "00000000-0000-4000-8000-000000000001";

function createAnalysis(): AnalysisService {
  return {
    analyze: vi.fn(() => Promise.resolve(CAPTURED)),
    get: vi.fn(() => Promise.resolve(CAPTURED)),
    setTrendsGeo: vi.fn(() => Promise.resolve()),
  };
}

function createExtensionTokens(): ExtensionTokenService {
  return {
    connect: vi.fn(),
    resolve: vi.fn(() => Promise.resolve(null)),
    list: vi.fn(() => Promise.resolve([])),
    revoke: vi.fn(() => Promise.resolve()),
  };
}

const ACCOUNT_VIEW = { organizations: [{ id: "org-1", name: "Studio" }], organizationId: "org-1" };
const CHANNELS_VIEW = { organizationId: "org-1", channels: [], defaultChannelIds: [] };

function createChannels(): ChannelSettingsService {
  return {
    account: vi.fn(() => Promise.resolve(ACCOUNT_VIEW)),
    channels: vi.fn(() => Promise.resolve(CHANNELS_VIEW)),
    setOrganization: vi.fn(() => Promise.resolve()),
    setDefaultChannels: vi.fn(() => Promise.resolve()),
  };
}

function callerWith(ping: PingService["ping"], userId: string | null = null) {
  const capture = createCapture();
  const analysis = createAnalysis();
  const channels = createChannels();
  const account: AccountService = {
    status: vi.fn(() => Promise.resolve({ needsReconnect: false })),
    deleteMyData: vi.fn(() => Promise.resolve()),
  };
  return {
    capture,
    analysis,
    channels,
    account,
    caller: appRouter.createCaller({
      userId,
      credential: userId === null ? null : "session",
      services: {
        ping: { ping },
        capture,
        analysis,
        channels,
        account,
        extensionTokens: createExtensionTokens(),
      },
    }),
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
    ["NOT_FOUND", "NOT_FOUND"],
    ["ANALYSIS_LIMIT_REACHED", "TOO_MANY_REQUESTS"],
    ["LLM_FAILED", "BAD_GATEWAY"],
    ["RECONNECT_REQUIRED", "UNAUTHORIZED"],
    ["BUFFER_RATE_LIMITED", "TOO_MANY_REQUESTS"],
    ["BUFFER_LIMIT_REACHED", "PRECONDITION_FAILED"],
    ["LLM_REFUSED", "UNPROCESSABLE_CONTENT"],
    ["BUFFER_FAILED", "BAD_GATEWAY"],
  ] as const)("maps AppError %s to tRPC %s", async (appCode, trpcCode) => {
    const { caller } = callerWith(() => {
      throw new AppError(appCode);
    });

    const error = await caller.ping({ name: "x" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code: trpcCode, message: appCode });
  });
});

describe("account API", () => {
  it.each([
    ["account.status", (caller: Caller) => caller.account.status()],
    ["account.deleteMyData", (caller: Caller) => caller.account.deleteMyData()],
  ])("refuses %s when signed out", async (_name, call) => {
    const { caller, account } = callerWith(noPing, null);

    await expect(call(caller)).rejects.toMatchObject({ message: "NOT_SIGNED_IN" });
    expect(account.status).not.toHaveBeenCalled();
    expect(account.deleteMyData).not.toHaveBeenCalled();
  });

  it("deletes only the signed-in user's data", async () => {
    const { caller, account } = callerWith(noPing, "user-1");

    await caller.account.deleteMyData();

    expect(account.deleteMyData).toHaveBeenCalledWith("user-1");
  });

  it("reports the signed-in user's connection", async () => {
    const { caller } = callerWith(noPing, "user-1");

    await expect(caller.account.status()).resolves.toEqual({ needsReconnect: false });
  });
});

describe("analysis API", () => {
  it.each([
    ["capture.analyze", (caller: Caller) => caller.capture.analyze({ captureId: CAPTURE_ID })],
    ["capture.get", (caller: Caller) => caller.capture.get({ captureId: CAPTURE_ID })],
    ["settings.setTrendsGeo", (caller: Caller) => caller.settings.setTrendsGeo({ geo: "BR" })],
  ])("refuses %s when signed out", async (_name, call) => {
    const { caller, analysis } = callerWith(noPing, null);

    await expect(call(caller)).rejects.toMatchObject({ message: "NOT_SIGNED_IN" });
    expect(analysis.analyze).not.toHaveBeenCalled();
    expect(analysis.setTrendsGeo).not.toHaveBeenCalled();
  });

  it("passes the signed-in user to the service", async () => {
    const { caller, analysis } = callerWith(noPing, "user-1");

    await expect(caller.capture.analyze({ captureId: CAPTURE_ID })).resolves.toEqual(CAPTURED);

    expect(analysis.analyze).toHaveBeenCalledWith("user-1", { captureId: CAPTURE_ID });
  });

  it("refuses a capture ID that isn't one", async () => {
    const { caller, analysis } = callerWith(noPing, "user-1");

    await expect(caller.capture.analyze({ captureId: "nope" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(analysis.analyze).not.toHaveBeenCalled();
  });

  it.each(["brazil", "br", "B", ""])("refuses %j as a country", async (geo) => {
    const { caller } = callerWith(noPing, "user-1");

    await expect(caller.settings.setTrendsGeo({ geo })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
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
