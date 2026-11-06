import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCaptureRepository } from "./capture-repository";
import { captures, draftRuns, users } from "./schema";
import { createDraftRunRepository, createIdeaLinkRepository } from "./ship-repository";
import { createTestDatabase } from "./test-database";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(databaseUrl === undefined)("ship repositories on real Postgres", () => {
  const { pool, db, reset } = createTestDatabase(databaseUrl);
  const captureRepository = createCaptureRepository({ db });
  const ideas = createIdeaLinkRepository({ db });
  const runs = createDraftRunRepository({ db });

  async function createCapture(bufferAccountId: string) {
    const [user] = await db.insert(users).values({ bufferAccountId }).returning();
    const userId = String(user?.id);
    const capture = await captureRepository.insert({
      userId,
      text: "A post.",
      sourceUrl: null,
      platform: "pasted",
      sourceName: null,
    });

    return { userId, captureId: capture.id };
  }

  beforeAll(reset);
  afterAll(() => pool.end());

  it("starts with no idea, then remembers the one saved", async () => {
    const { userId, captureId } = await createCapture("idea-round-trip");

    await expect(ideas.find(userId, captureId)).resolves.toBeNull();
    await expect(ideas.save(userId, captureId, "idea-1")).resolves.toBe("idea-1");
    await expect(ideas.find(userId, captureId)).resolves.toBe("idea-1");
  });

  it("keeps the first idea when two requests race", async () => {
    const { userId, captureId } = await createCapture("idea-race");

    await ideas.save(userId, captureId, "first");

    await expect(ideas.save(userId, captureId, "second")).resolves.toBe("first");
    await expect(ideas.find(userId, captureId)).resolves.toBe("first");
  });

  it("never shows or changes someone else's capture", async () => {
    const owner = await createCapture("idea-owner");
    const stranger = await createCapture("idea-stranger");

    await ideas.save(owner.userId, owner.captureId, "mine");

    await expect(ideas.find(stranger.userId, owner.captureId)).resolves.toBeNull();
    await ideas.save(stranger.userId, owner.captureId, "theirs");
    await expect(ideas.find(owner.userId, owner.captureId)).resolves.toBe("mine");
  });

  it("counts only this user's drafts since a moment", async () => {
    const mine = await createCapture("runs-mine");
    const other = await createCapture("runs-other");

    await runs.record(mine.userId, mine.captureId, new Date("2026-11-05T23:00:00.000Z"));
    await runs.record(mine.userId, mine.captureId, new Date("2026-11-06T09:00:00.000Z"));
    await runs.record(other.userId, other.captureId, new Date("2026-11-06T09:00:00.000Z"));

    await expect(runs.countSince(mine.userId, new Date("2026-11-06T00:00:00.000Z"))).resolves.toBe(
      1,
    );
  });

  it("goes away with the user", async () => {
    const { userId, captureId } = await createCapture("runs-cascade");
    await runs.record(userId, captureId, new Date());

    await db.delete(users).where(eq(users.id, userId));

    await expect(db.select().from(draftRuns).where(eq(draftRuns.userId, userId))).resolves.toEqual(
      [],
    );
    await expect(db.select().from(captures).where(eq(captures.userId, userId))).resolves.toEqual(
      [],
    );
  });
});
