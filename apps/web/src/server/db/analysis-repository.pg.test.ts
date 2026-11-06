import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAnalysisRepository, createUserSettingsRepository } from "./analysis-repository";
import { createCaptureRepository } from "./capture-repository";
import { users } from "./schema";
import { createTestDatabase } from "./test-database";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(databaseUrl === undefined)("analysis repository on real Postgres", () => {
  const { pool, db, reset } = createTestDatabase(databaseUrl);
  const captures = createCaptureRepository({ db });
  const analyses = createAnalysisRepository({ db });
  const settings = createUserSettingsRepository({ db });

  async function createCapture(bufferAccountId: string) {
    const [user] = await db.insert(users).values({ bufferAccountId }).returning();
    const userId = String(user?.id);
    const capture = await captures.insert({
      userId,
      text: "A post.",
      sourceUrl: null,
      platform: "pasted",
      sourceName: null,
    });

    return { userId, captureId: capture.id };
  }

  const analysisOf = (captureId: string, topic = "A topic") => ({
    captureId,
    summary: "A summary.",
    topic,
    angle: "An angle.",
    trendPhrases: ["one", "two"],
    channels: null,
    duplicates: null,
    model: "test-model",
    createdAt: "2026-11-06T12:00:00.000Z",
  });

  beforeAll(reset);
  afterAll(() => pool.end());

  it("saves an analysis and reads it back", async () => {
    const { userId, captureId } = await createCapture("round-trip");

    await analyses.save(userId, analysisOf(captureId));

    await expect(analyses.find(captureId)).resolves.toEqual(analysisOf(captureId));
  });

  it("keeps the fit it was saved with", async () => {
    const { userId, captureId } = await createCapture("fit");
    const fit = {
      channels: [
        {
          channelId: "ch-1",
          channelName: "LinkedIn",
          state: "fits" as const,
          usablePosts: 12,
          readPosts: 14,
          clusterName: "AI tools",
          matchingPosts: 3,
          lastPostedAt: "2026-09-29T14:00:00.000Z",
          nextScheduledAt: null,
        },
      ],
      duplicates: { ideas: 2, queuedPosts: 0 },
    };

    await analyses.save(userId, { ...analysisOf(captureId), ...fit });

    await expect(analyses.find(captureId)).resolves.toMatchObject(fit);
  });

  it("reads a row from before the fit check as having no fit yet", async () => {
    const { userId, captureId } = await createCapture("legacy");
    await analyses.save(userId, analysisOf(captureId));
    await pool.query(
      "UPDATE analyses SET channels = NULL, duplicates = NULL WHERE capture_id = $1",
      [captureId],
    );

    await expect(analyses.find(captureId)).resolves.toMatchObject({
      channels: null,
      duplicates: null,
    });
  });

  it("reads a fit that no longer parses as no fit yet", async () => {
    const { userId, captureId } = await createCapture("odd-fit");
    await analyses.save(userId, analysisOf(captureId));
    await pool.query(`UPDATE analyses SET channels = '[{"old": "shape"}]' WHERE capture_id = $1`, [
      captureId,
    ]);

    await expect(analyses.find(captureId)).resolves.toMatchObject({ channels: null });
  });

  it("keeps the first answer when two requests race", async () => {
    const { userId, captureId } = await createCapture("race");

    await analyses.save(userId, analysisOf(captureId, "First"));
    const second = await analyses.save(userId, analysisOf(captureId, "Second"));

    expect(second.topic).toBe("First");
  });

  it("counts only this user's analyses since a moment", async () => {
    const mine = await createCapture("counted");
    const theirs = await createCapture("not-counted");
    await analyses.save(mine.userId, analysisOf(mine.captureId));
    await analyses.save(theirs.userId, analysisOf(theirs.captureId));

    await expect(
      analyses.countSince(mine.userId, new Date("2026-11-06T00:00:00.000Z")),
    ).resolves.toBe(1);
    await expect(
      analyses.countSince(mine.userId, new Date("2026-11-07T00:00:00.000Z")),
    ).resolves.toBe(0);
  });

  it("finds a capture only for its owner", async () => {
    const mine = await createCapture("owner");
    const other = await createCapture("stranger");

    await expect(captures.findOwned(mine.userId, mine.captureId)).resolves.toMatchObject({
      id: mine.captureId,
    });
    await expect(captures.findOwned(other.userId, mine.captureId)).resolves.toBeNull();
  });

  it("removes an analysis with its capture", async () => {
    const { userId, captureId } = await createCapture("cascade");
    await analyses.save(userId, analysisOf(captureId));

    await pool.query("DELETE FROM captures WHERE id = $1", [captureId]);

    await expect(analyses.find(captureId)).resolves.toBeNull();
  });

  it("remembers a user's Trends country", async () => {
    const { userId } = await createCapture("settings");

    await expect(settings.getTrendsGeo(userId)).resolves.toBeNull();

    await settings.setTrendsGeo(userId, "BR");

    await expect(settings.getTrendsGeo(userId)).resolves.toBe("BR");
  });
});
