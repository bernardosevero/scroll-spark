import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import type { AccountService } from "@scroll-spark/core/account/account.service";
import type { AnalysisService } from "@scroll-spark/core/analysis/analysis.service";
import type { ChannelSettingsService } from "@scroll-spark/core/buffer/channel-settings.service";
import type { CaptureService } from "@scroll-spark/core/capture/capture.service";
import type { ShipService } from "@scroll-spark/core/ship/ship.service";
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

const CAPTURED = { capture: CAPTURE, analysis: null, trendsGeo: "US" };
const CAPTURE_ID = "00000000-0000-4000-8000-000000000001";

function createAnalysis(): AnalysisService {
  return {
    analyze: vi.fn(() => Promise.resolve(CAPTURED)),
    get: vi.fn(() => Promise.resolve(CAPTURED)),
    setTrendsGeo: vi.fn(() => Promise.resolve()),
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

const DRAFT = {
  text: "A draft.",
  voice: { sampleCount: 8, isMatched: true },
  overlap: { isClose: false, share: 0 },
};

function createShip(): ShipService {
  return {
    saveAsIdea: vi.fn(() => Promise.resolve({ ideaId: "idea-1", isNew: true })),
    ideaOf: vi.fn(() => Promise.resolve({ ideaId: null })),
    draft: vi.fn(() => Promise.resolve(DRAFT)),
    createPost: vi.fn(() =>
      Promise.resolve({ postId: "post-1", kind: "draft" as const, channelId: "ch-1" }),
    ),
  };
}

function callerWith(ping: PingService["ping"], userId: string | null = null) {
  const capture = createCapture();
  const analysis = createAnalysis();
  const channels = createChannels();
  const ship = createShip();
  const account: AccountService = {
    status: vi.fn(() => Promise.resolve({ needsReconnect: false })),
    deleteMyData: vi.fn(() => Promise.resolve()),
  };
  return {
    capture,
    analysis,
    channels,
    account,
    ship,
    caller: appRouter.createCaller({
      userId,
      services: { ping: { ping }, capture, analysis, channels, account, ship },
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
    ["CHANNEL_NOT_SUPPORTED", "BAD_REQUEST"],
    ["POST_TOO_LONG", "BAD_REQUEST"],
    ["DRAFT_LIMIT_REACHED", "TOO_MANY_REQUESTS"],
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

describe("ship API", () => {
  const postInput = {
    captureId: CAPTURE_ID,
    channelId: "ch-1",
    text: "A post.",
    kind: "queue",
  } as const;
  const draftInput = { captureId: CAPTURE_ID, channelId: "ch-1" } as const;

  it.each([
    [
      "capture.saveAsIdea",
      (caller: Caller) => caller.capture.saveAsIdea({ captureId: CAPTURE_ID }),
    ],
    ["capture.ideaOf", (caller: Caller) => caller.capture.ideaOf({ captureId: CAPTURE_ID })],
    ["draft.create", (caller: Caller) => caller.draft.create(draftInput)],
    ["post.create", (caller: Caller) => caller.post.create(postInput)],
  ])("refuses %s when signed out", async (_name, call) => {
    const { caller, ship } = callerWith(noPing, null);

    await expect(call(caller)).rejects.toMatchObject({ message: "NOT_SIGNED_IN" });
    expect(ship.saveAsIdea).not.toHaveBeenCalled();
    expect(ship.draft).not.toHaveBeenCalled();
    expect(ship.createPost).not.toHaveBeenCalled();
  });

  it("passes the signed-in user to the service, with the language following the channel", async () => {
    const { caller, ship } = callerWith(noPing, "user-1");

    await caller.capture.saveAsIdea({ captureId: CAPTURE_ID });
    await expect(caller.draft.create(draftInput)).resolves.toEqual(DRAFT);
    await caller.post.create(postInput);

    expect(ship.saveAsIdea).toHaveBeenCalledWith("user-1", { captureId: CAPTURE_ID });
    expect(ship.draft).toHaveBeenCalledWith("user-1", { ...draftInput, language: "same" });
    expect(ship.createPost).toHaveBeenCalledWith("user-1", postInput);
  });

  it.each([
    ["a capture ID that isn't one", { ...postInput, captureId: "nope" }],
    ["a post kind we don't have", { ...postInput, kind: "now" }],
    ["far too much text", { ...postInput, text: "a".repeat(10_001) }],
  ])("refuses %s", async (_name, bad) => {
    const { caller, ship } = callerWith(noPing, "user-1");

    await expect(caller.post.create(bad as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(ship.createPost).not.toHaveBeenCalled();
  });
});
