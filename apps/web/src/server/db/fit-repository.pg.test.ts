import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ChannelProfile } from "@scroll-spark/core/fit/fit.service";

import { createProfileRepository } from "./fit-repository";
import { users } from "./schema";
import { createTestDatabase } from "./test-database";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(databaseUrl === undefined)("profile repository on real Postgres", () => {
  const { pool, db, reset } = createTestDatabase(databaseUrl);
  const profiles = createProfileRepository({ db });

  async function createUser(bufferAccountId: string) {
    const [user] = await db.insert(users).values({ bufferAccountId }).returning();

    return String(user?.id);
  }

  const profileOf = (channelId: string, name = "Customers"): ChannelProfile => ({
    channelId,
    refreshedAt: "2026-11-06T12:00:00.000Z",
    readPosts: 7,
    clusters: [
      { id: "c1", name },
      { id: "c2", name: "Hiring" },
    ],
    posts: [
      {
        id: "p-new",
        text: "A newer post about customers.",
        summary: "Customers again",
        clusterId: "c1",
        postedAt: "2026-10-02T09:00:00.000Z",
        lastSentAt: "2026-10-02T09:00:00.000Z",
        scheduledAt: "2026-12-01T09:00:00.000Z",
      },
      {
        id: "p-old",
        text: "An older post about hiring.",
        summary: "Hiring once",
        clusterId: null,
        postedAt: "2026-09-02T09:00:00.000Z",
        lastSentAt: "2026-09-02T09:00:00.000Z",
        scheduledAt: null,
      },
    ],
  });

  beforeAll(reset);
  afterAll(() => pool.end());

  it("saves a profile and reads it back, newest post first", async () => {
    const userId = await createUser("round-trip");

    await profiles.save(userId, profileOf("ch-1"));

    await expect(profiles.find(userId, "ch-1")).resolves.toEqual(profileOf("ch-1"));
  });

  it("has no profile for a channel it hasn't seen", async () => {
    const userId = await createUser("empty");

    await expect(profiles.find(userId, "ch-none")).resolves.toBeNull();
  });

  it("replaces the old posts and clusters when a profile is saved again", async () => {
    const userId = await createUser("replace");
    await profiles.save(userId, profileOf("ch-1", "Before"));

    await profiles.save(userId, { ...profileOf("ch-1", "After"), posts: [] });

    const found = await profiles.find(userId, "ch-1");
    expect(found?.clusters[0]?.name).toBe("After");
    expect(found?.posts).toEqual([]);
  });

  it("keeps one user's profile from another's, even for the same channel", async () => {
    const mine = await createUser("mine");
    const theirs = await createUser("theirs");
    await profiles.save(mine, profileOf("shared-channel", "Mine"));

    await expect(profiles.find(theirs, "shared-channel")).resolves.toBeNull();

    await profiles.save(theirs, profileOf("shared-channel", "Theirs"));

    expect((await profiles.find(mine, "shared-channel"))?.clusters[0]?.name).toBe("Mine");
  });

  it("removes every profile table's rows when the user is deleted", async () => {
    const userId = await createUser("cascade");
    await profiles.save(userId, profileOf("ch-1"));

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    for (const table of ["channel_profiles", "channel_posts", "channel_clusters"]) {
      const { rows } = await pool.query<{ count: string }>(
        `SELECT count(*) FROM ${table} WHERE user_id = $1`,
        [userId],
      );
      expect(rows[0]?.count).toBe("0");
    }
  });
});
