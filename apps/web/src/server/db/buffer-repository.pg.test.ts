import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createBufferCacheRepository,
  createBufferPreferencesRepository,
  createBufferQuotaRepository,
} from "./buffer-repository";
import { users } from "./schema";
import { createTestDatabase } from "./test-database";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(databaseUrl === undefined)("Buffer repositories on real Postgres", () => {
  const { pool, db, reset } = createTestDatabase(databaseUrl);
  const cache = createBufferCacheRepository({ db });
  const quota = createBufferQuotaRepository({ db });
  const preferences = createBufferPreferencesRepository({ db });
  const fetchedAt = new Date("2026-11-06T12:00:00.000Z");

  async function createUser(bufferAccountId: string) {
    const [user] = await db.insert(users).values({ bufferAccountId }).returning();
    return String(user?.id);
  }

  beforeAll(reset);
  afterAll(() => pool.end());

  it("saves a read and gives it back, replacing an older one", async () => {
    const userId = await createUser("cache-round-trip");

    await cache.set(userId, "channels:org-1", [{ id: "a" }], fetchedAt);
    await cache.set(userId, "channels:org-1", [{ id: "b" }], fetchedAt);

    await expect(cache.get(userId, "channels:org-1")).resolves.toEqual({
      body: [{ id: "b" }],
      fetchedAt,
    });
    await expect(cache.get(userId, "channels:org-2")).resolves.toBeNull();
  });

  it("keeps one user's cache from another", async () => {
    const mine = await createUser("cache-mine");
    const theirs = await createUser("cache-theirs");
    await cache.set(mine, "account", { id: "mine" }, fetchedAt);

    await expect(cache.get(theirs, "account")).resolves.toBeNull();

    await cache.clearPrefix(theirs, "account");

    await expect(cache.get(mine, "account")).resolves.not.toBeNull();
  });

  it("clears by prefix, and treats wildcards in a prefix as plain text", async () => {
    const userId = await createUser("cache-prefix");
    await cache.set(userId, "posts:org-1:a", {}, fetchedAt);
    await cache.set(userId, "posts:org-1:b", {}, fetchedAt);
    await cache.set(userId, "posts:org-2:a", {}, fetchedAt);
    await cache.set(userId, "ideas:org-1", {}, fetchedAt);

    await cache.clearPrefix(userId, "posts:org-1:");
    await cache.clearPrefix(userId, "%");
    await cache.clearPrefix(userId, "_deas");

    await expect(cache.get(userId, "posts:org-1:a")).resolves.toBeNull();
    await expect(cache.get(userId, "posts:org-1:b")).resolves.toBeNull();
    await expect(cache.get(userId, "posts:org-2:a")).resolves.not.toBeNull();
    await expect(cache.get(userId, "ideas:org-1")).resolves.not.toBeNull();
  });

  it("removes a user's cache with the user", async () => {
    const userId = await createUser("cache-cascade");
    await cache.set(userId, "account", {}, fetchedAt);

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    await expect(cache.get(userId, "account")).resolves.toBeNull();
  });

  it("records quota per window, and lets the lowest remaining stand within a window", async () => {
    const resetsAt = new Date(Date.now() + 600_000);
    const window = (remaining: number, offsetSeconds = 0) => ({
      windowSeconds: 900,
      quota: 100,
      remaining,
      resetsAt: new Date(resetsAt.getTime() + offsetSeconds * 1000).toISOString(),
    });

    await quota.record([window(50), { ...window(200), windowSeconds: 86_400, quota: 250 }]);
    // A slower response, with a higher count and a second of jitter in the reset time.
    await quota.record([window(70, 1)]);

    const rows = await quota.read();

    expect(rows.find((row) => row.windowSeconds === 900)?.remaining).toBe(50);
    expect(rows.find((row) => row.windowSeconds === 86_400)?.remaining).toBe(200);
  });

  it("starts a fresh count when the window has moved on", async () => {
    const first = new Date(Date.now() + 600_000);
    await quota.record([
      { windowSeconds: 3600, quota: 100, remaining: 5, resetsAt: first.toISOString() },
    ]);

    const next = new Date(first.getTime() + 3600_000);
    await quota.record([
      { windowSeconds: 3600, quota: 100, remaining: 99, resetsAt: next.toISOString() },
    ]);

    const rows = await quota.read();

    expect(rows.find((row) => row.windowSeconds === 3600)?.remaining).toBe(99);
  });

  it("remembers the organization and default channels, and resets channels with it", async () => {
    const userId = await createUser("preferences");

    await expect(preferences.get(userId)).resolves.toEqual({
      organizationId: null,
      defaultChannelIds: null,
    });

    await preferences.setOrganization(userId, "org-1");
    await preferences.setDefaultChannels(userId, ["ch-1", "ch-2"]);

    await expect(preferences.get(userId)).resolves.toEqual({
      organizationId: "org-1",
      defaultChannelIds: ["ch-1", "ch-2"],
    });

    await preferences.setOrganization(userId, "org-2");

    await expect(preferences.get(userId)).resolves.toEqual({
      organizationId: "org-2",
      defaultChannelIds: null,
    });
  });
});
