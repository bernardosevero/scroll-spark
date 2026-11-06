import { describe, expect, it, vi } from "vitest";

import { AppError } from "../errors/app-error";
import { createBufferService } from "./buffer.service";
import type { BufferCache, BufferGateway, QuotaStore } from "./buffer.service";
import type { BufferAccount, BufferChannel, QuotaWindow } from "./schemas";

const T0 = new Date("2026-11-06T12:00:00.000Z");
const HOUR = 3_600_000;
const ACCOUNT: BufferAccount = {
  id: "acct-1",
  organizations: [{ id: "org-1", name: "Studio", channelCount: 1 }],
};
const CHANNEL: BufferChannel = {
  id: "ch-1",
  service: "linkedin",
  name: "studio",
  isLocked: false,
  isDisconnected: false,
};

function window(used: number, windowSeconds = 900, quota = 100): QuotaWindow {
  return {
    windowSeconds,
    quota,
    remaining: quota - used,
    // Far enough away that it hasn't reset when a test moves the clock forward an hour.
    resetsAt: new Date(T0.getTime() + 2 * 86_400_000).toISOString(),
  };
}

function setup({ quota: startingQuota = [] as QuotaWindow[] } = {}) {
  let now = T0;
  let quotaWindows = startingQuota;
  const entries = new Map<string, { body: unknown; fetchedAt: Date }>();
  const cache: BufferCache = {
    get: (userId, key) => Promise.resolve(entries.get(`${userId}|${key}`) ?? null),
    set(userId, key, body, fetchedAt) {
      entries.set(`${userId}|${key}`, { body, fetchedAt });
      return Promise.resolve();
    },
    clearPrefix(userId, prefix) {
      for (const key of [...entries.keys()]) {
        if (key.startsWith(`${userId}|${prefix}`)) {
          entries.delete(key);
        }
      }
      return Promise.resolve();
    },
  };
  const quota: QuotaStore = {
    read: () => Promise.resolve(quotaWindows),
    record(windows) {
      quotaWindows = windows;
      return Promise.resolve();
    },
  };
  const gateway = {
    account: vi.fn(() => Promise.resolve({ data: ACCOUNT, quota: [window(1)] })),
    channels: vi.fn(() => Promise.resolve({ data: [CHANNEL], quota: [window(2)] })),
    posts: vi.fn(() =>
      Promise.resolve({
        data: { posts: [], endCursor: null, hasNextPage: false },
        quota: [window(3)],
      }),
    ),
    ideas: vi.fn(() => Promise.resolve({ data: [], quota: [window(4)] })),
    createIdea: vi.fn(() => Promise.resolve({ data: { id: "idea-1" }, quota: [window(5)] })),
    createPost: vi.fn(() =>
      Promise.resolve({
        data: { id: "post-1", channelId: "ch-1", status: "draft" },
        quota: [window(6)],
      }),
    ),
  } satisfies BufferGateway;
  const getAccessToken = vi.fn<(userId: string) => Promise<string>>(() =>
    Promise.resolve("token-1"),
  );
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const service = createBufferService({
    gateway,
    auth: { getAccessToken },
    cache,
    quota,
    clock: { now: () => now },
    logger,
  });

  return {
    service,
    cache,
    logger,
    gateway,
    getAccessToken,
    entries,
    quota,
    setQuota(windows: QuotaWindow[]) {
      quotaWindows = windows;
    },
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
}

describe("reading from Buffer", () => {
  it("serves a repeat read from the cache, and refreshes it once it is stale", async () => {
    const { service, gateway, advance } = setup();

    await service.account("user-1");
    await expect(service.account("user-1")).resolves.toEqual(ACCOUNT);
    expect(gateway.account).toHaveBeenCalledTimes(1);

    advance(HOUR + 1000);
    await service.account("user-1");

    expect(gateway.account).toHaveBeenCalledTimes(2);
  });

  it("keeps each user's cache to themselves", async () => {
    const { service, gateway } = setup();

    await service.account("user-1");
    await service.account("user-2");

    expect(gateway.account).toHaveBeenCalledTimes(2);
  });

  it("remembers the quota Buffer reported", async () => {
    const { service, quota } = setup();

    await service.account("user-1");

    await expect(quota.read()).resolves.toEqual([window(1)]);
  });

  it.each([
    ["the 15 minute window", [window(80, 900)]],
    ["the daily window", [window(10, 900), window(200, 86_400, 250)]],
    ["the monthly window", [window(2_400, 2_592_000, 3_000)]],
    // The handbook's 100 is the budget even when the header says 150.
    ["the handbook budget, not the header's larger quota", [window(80, 900, 150)]],
  ])(
    "at 80%% of %s, stale reads come from cache and writes still go through",
    async (_name, windows) => {
      const { service, gateway, advance, setQuota } = setup();
      await service.channels("user-1", "org-1");
      await service.channels("user-1", "org-1");
      expect(gateway.channels).toHaveBeenCalledTimes(1);

      advance(HOUR + 1000);
      setQuota(windows);

      await expect(service.channels("user-1", "org-1")).resolves.toEqual([CHANNEL]);
      expect(gateway.channels).toHaveBeenCalledTimes(1);

      await service.createIdea("user-1", { organizationId: "org-1", text: "An idea." });
      expect(gateway.createIdea).toHaveBeenCalledTimes(1);
    },
  );

  it("goes back to the network once the busy window has reset", async () => {
    const { service, gateway, advance, setQuota } = setup();
    await service.channels("user-1", "org-1");
    setQuota([{ ...window(90), resetsAt: new Date(T0.getTime() + 600_000).toISOString() }]);

    advance(HOUR + 1000);
    await service.channels("user-1", "org-1");

    expect(gateway.channels).toHaveBeenCalledTimes(2);
  });

  it("below 80% still reads from the network", async () => {
    const { service, gateway, advance } = setup({ quota: [window(79)] });
    await service.channels("user-1", "org-1");

    advance(HOUR + 1000);
    await service.channels("user-1", "org-1");

    expect(gateway.channels).toHaveBeenCalledTimes(2);
  });

  it("at 80% with nothing cached, a read fails and makes no call", async () => {
    const { service, gateway } = setup({ quota: [window(80)] });

    await expect(service.account("user-1")).rejects.toMatchObject({
      code: "BUFFER_RATE_LIMITED",
    });
    expect(gateway.account).not.toHaveBeenCalled();
  });

  it("ignores a cached body that no longer parses and reads again", async () => {
    const { service, gateway, entries } = setup();
    entries.set("user-1|account", { body: { nonsense: true }, fetchedAt: T0 });

    await expect(service.account("user-1")).resolves.toEqual(ACCOUNT);
    expect(gateway.account).toHaveBeenCalledTimes(1);
  });
});

describe("writing to Buffer", () => {
  it.each([
    ["recording the quota", "quota"],
    ["clearing the cache", "cache"],
  ] as const)(
    "still returns the post when %s fails afterwards, so nobody posts twice",
    async (_name, failing) => {
      const { service, gateway, quota, cache, logger } = setup();
      const boom = new Error("database hiccup SECRET-POST-TEXT");
      if (failing === "quota") {
        vi.spyOn(quota, "record").mockRejectedValue(boom);
      } else {
        vi.spyOn(cache, "clearPrefix").mockRejectedValue(boom);
      }

      await expect(
        service.createPost("user-1", {
          organizationId: "org-1",
          channelId: "ch-1",
          text: "SECRET-POST-TEXT",
          mode: "addToQueue",
          saveToDraft: true,
        }),
      ).resolves.toMatchObject({ id: "post-1" });

      expect(gateway.createPost).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith("buffer.write_bookkeeping_failed", {
        operation: "createPost",
      });
      expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("SECRET");
    },
  );

  it("clears the matching cache keys, and only those", async () => {
    const { service, gateway } = setup();
    await service.ideas("user-1", "org-1");
    await service.posts("user-1", { organizationId: "org-1" });
    await service.account("user-1");

    await service.createIdea("user-1", { organizationId: "org-1", text: "An idea." });
    await service.ideas("user-1", "org-1");
    await service.posts("user-1", { organizationId: "org-1" });
    await service.account("user-1");

    expect(gateway.ideas).toHaveBeenCalledTimes(2);
    expect(gateway.posts).toHaveBeenCalledTimes(1);
    expect(gateway.account).toHaveBeenCalledTimes(1);
  });

  it("clears posts and ideas after a post", async () => {
    const { service, gateway } = setup();
    await service.ideas("user-1", "org-1");
    await service.posts("user-1", { organizationId: "org-1" });

    await service.createPost("user-1", {
      organizationId: "org-1",
      channelId: "ch-1",
      text: "A post.",
      mode: "addToQueue",
      saveToDraft: true,
    });
    await service.ideas("user-1", "org-1");
    await service.posts("user-1", { organizationId: "org-1" });

    expect(gateway.ideas).toHaveBeenCalledTimes(2);
    expect(gateway.posts).toHaveBeenCalledTimes(2);
  });

  it("keeps the cache when the write fails, and never tries it twice", async () => {
    const { service, gateway } = setup();
    await service.ideas("user-1", "org-1");
    gateway.createIdea.mockRejectedValueOnce(new AppError("BUFFER_LIMIT_REACHED"));

    await expect(
      service.createIdea("user-1", { organizationId: "org-1", text: "An idea." }),
    ).rejects.toMatchObject({ code: "BUFFER_LIMIT_REACHED" });
    await service.ideas("user-1", "org-1");

    expect(gateway.createIdea).toHaveBeenCalledTimes(1);
    expect(gateway.ideas).toHaveBeenCalledTimes(1);
  });
});

describe("when Buffer pushes back", () => {
  it("fails a 429 with BUFFER_RATE_LIMITED, carrying Retry-After, after one call", async () => {
    const { service, gateway } = setup();
    gateway.account.mockRejectedValue(
      new AppError("BUFFER_RATE_LIMITED", { retryAfterSeconds: 42 }),
    );

    const error = await service.account("user-1").catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "BUFFER_RATE_LIMITED", retryAfterSeconds: 42 });
    expect(gateway.account).toHaveBeenCalledTimes(1);
  });

  it("never retries a rate-limited write", async () => {
    const { service, gateway } = setup();
    gateway.createPost.mockRejectedValue(new AppError("BUFFER_RATE_LIMITED"));

    await expect(
      service.createPost("user-1", {
        organizationId: "org-1",
        channelId: "ch-1",
        text: "A post.",
        mode: "addToQueue",
        saveToDraft: true,
      }),
    ).rejects.toMatchObject({ code: "BUFFER_RATE_LIMITED" });
    expect(gateway.createPost).toHaveBeenCalledTimes(1);
  });

  it("passes RECONNECT_REQUIRED through from auth with no Buffer call", async () => {
    const { service, gateway, getAccessToken } = setup();
    getAccessToken.mockRejectedValue(new AppError("RECONNECT_REQUIRED"));

    await expect(service.account("user-1")).rejects.toMatchObject({
      code: "RECONNECT_REQUIRED",
    });
    await expect(
      service.createIdea("user-1", { organizationId: "org-1", text: "An idea." }),
    ).rejects.toMatchObject({ code: "RECONNECT_REQUIRED" });
    expect(gateway.account).not.toHaveBeenCalled();
    expect(gateway.createIdea).not.toHaveBeenCalled();
  });
});
