import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSealer } from "../crypto/seal";
import { createAccountRepository } from "./account-repository";
import { createGrantRepository } from "./grant-repository";
import { analyses, bufferGrants, captures, users } from "./schema";
import { createTestDatabase } from "./test-database";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(databaseUrl === undefined)("account repository on real Postgres", () => {
  const { pool, db, reset } = createTestDatabase(databaseUrl);
  const sealer = createSealer({
    secretKey: Buffer.alloc(32, 9).toString("base64"),
    purpose: "tokens",
  });
  const grants = createGrantRepository({ db, sealer });
  const accounts = createAccountRepository({ db });

  beforeAll(reset);
  afterAll(() => pool.end());

  /** A user with a grant, a capture and an analysis, like someone who has used the app. */
  async function createUserWithData(bufferAccountId: string) {
    const userId = await grants.saveGrant(bufferAccountId, {
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: new Date("2026-11-06T13:00:00.000Z"),
    });
    const [capture] = await db
      .insert(captures)
      .values({ userId, text: "A post.", platform: "pasted" })
      .returning({ id: captures.id });
    const captureId = String(capture?.id);

    await db.insert(analyses).values({
      captureId,
      userId,
      summary: "Summary",
      topic: "Topic",
      angle: "Angle",
      trendPhrases: ["phrase"],
      model: "fake",
    });

    return userId;
  }

  async function countsFor(userId: string) {
    const [user] = await db.select({ n: count() }).from(users).where(eq(users.id, userId));
    const [grant] = await db
      .select({ n: count() })
      .from(bufferGrants)
      .where(eq(bufferGrants.userId, userId));
    const [capture] = await db
      .select({ n: count() })
      .from(captures)
      .where(eq(captures.userId, userId));
    const [analysis] = await db
      .select({ n: count() })
      .from(analyses)
      .where(eq(analyses.userId, userId));

    return [user?.n, grant?.n, capture?.n, analysis?.n];
  }

  it("cascades the deletion through grants, captures and analyses", async () => {
    const userId = await createUserWithData("leaving");
    await expect(countsFor(userId)).resolves.toEqual([1, 1, 1, 1]);

    await accounts.deleteUser(userId);

    await expect(countsFor(userId)).resolves.toEqual([0, 0, 0, 0]);
  });

  it("leaves other users and their data alone", async () => {
    const leaving = await createUserWithData("leaving-2");
    const staying = await createUserWithData("staying");

    await accounts.deleteUser(leaving);

    await expect(countsFor(staying)).resolves.toEqual([1, 1, 1, 1]);
  });

  it("deleting someone already gone is not an error", async () => {
    const userId = await createUserWithData("twice");
    await accounts.deleteUser(userId);

    await expect(accounts.deleteUser(userId)).resolves.toBeUndefined();
  });

  it("reports whether the grant needs renewing", async () => {
    const userId = await createUserWithData("status");
    await expect(accounts.needsReconnect(userId)).resolves.toBe(false);

    await grants.markReconnectRequired(userId);

    await expect(accounts.needsReconnect(userId)).resolves.toBe(true);
  });
});
