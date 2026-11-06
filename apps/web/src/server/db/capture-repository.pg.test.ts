import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCaptureRepository } from "./capture-repository";
import { users } from "./schema";
import { createTestDatabase } from "./test-database";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(databaseUrl === undefined)("capture repository on real Postgres", () => {
  const { pool, db, reset } = createTestDatabase(databaseUrl);
  const captures = createCaptureRepository({ db });

  async function createUser(bufferAccountId: string) {
    const [user] = await db.insert(users).values({ bufferAccountId }).returning();
    return String(user?.id);
  }

  const input = { text: "A post.", sourceUrl: null, platform: "pasted", sourceName: null } as const;

  beforeAll(reset);
  afterAll(() => pool.end());

  it("saves a capture with its source and returns it", async () => {
    const userId = await createUser("round-trip");

    const saved = await captures.insert({
      userId,
      text: "A video",
      sourceUrl: "https://youtu.be/a",
      platform: "youtube",
      sourceName: "Maker",
    });

    expect(saved).toMatchObject({
      text: "A video",
      sourceUrl: "https://youtu.be/a",
      platform: "youtube",
      sourceName: "Maker",
    });
    await expect(captures.listNewest(userId, 10)).resolves.toEqual([saved]);
  });

  it("lists only that user's captures, newest first, up to the limit", async () => {
    const userId = await createUser("mine");
    const otherId = await createUser("theirs");

    await captures.insert({ ...input, userId, text: "First" });
    await pool.query("SELECT pg_sleep(0.01)");
    await captures.insert({ ...input, userId, text: "Second" });
    await pool.query("SELECT pg_sleep(0.01)");
    await captures.insert({ ...input, userId, text: "Third" });
    await captures.insert({ ...input, userId: otherId, text: "Not mine" });

    const inbox = await captures.listNewest(userId, 2);

    expect(inbox.map(({ text }) => text)).toEqual(["Third", "Second"]);
  });

  it("removes a user's captures with the user", async () => {
    const userId = await createUser("leaving");
    await captures.insert({ ...input, userId });

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    await expect(captures.listNewest(userId, 10)).resolves.toEqual([]);
  });
});
