import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createExtensionTokenRepository } from "./extension-token-repository";
import { users } from "./schema";
import { createTestDatabase } from "./test-database";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(databaseUrl === undefined)("extension token repository on real Postgres", () => {
  const { pool, db, reset } = createTestDatabase(databaseUrl);
  const tokens = createExtensionTokenRepository({ db });

  async function createUser(bufferAccountId: string) {
    const [user] = await db.insert(users).values({ bufferAccountId }).returning();
    return String(user?.id);
  }

  const row = (userId: string, tokenHash: string) => ({
    userId,
    tokenHash,
    expiresAt: new Date("2026-12-06T12:00:00.000Z"),
    createdAt: new Date("2026-11-06T12:00:00.000Z"),
  });

  beforeAll(reset);
  afterAll(() => pool.end());

  it("finds a token by its hash", async () => {
    const userId = await createUser("finder");
    const saved = await tokens.insert(row(userId, "hash-find"));

    await expect(tokens.findByHash("hash-find")).resolves.toEqual(saved);
    await expect(tokens.findByHash("hash-other")).resolves.toBeNull();
  });

  it("refuses two tokens with one hash", async () => {
    const userId = await createUser("twice");
    await tokens.insert(row(userId, "hash-twice"));

    await expect(tokens.insert(row(userId, "hash-twice"))).rejects.toThrow();
  });

  it("lets a user revoke only their own token, and keeps the first revocation time", async () => {
    const owner = await createUser("owner");
    const other = await createUser("other");
    const saved = await tokens.insert(row(owner, "hash-revoke"));

    await expect(tokens.revoke(other, saved.id, new Date())).resolves.toBe(false);
    await expect(tokens.findByHash("hash-revoke")).resolves.toMatchObject({ revokedAt: null });

    const first = new Date("2026-11-07T00:00:00.000Z");
    await expect(tokens.revoke(owner, saved.id, first)).resolves.toBe(true);
    await expect(tokens.revoke(owner, saved.id, new Date())).resolves.toBe(true);
    await expect(tokens.findByHash("hash-revoke")).resolves.toMatchObject({ revokedAt: first });
  });

  it("lists only that user's tokens, newest first", async () => {
    const userId = await createUser("lister");
    const otherId = await createUser("not-lister");
    await tokens.insert(row(userId, "hash-old"));
    await tokens.insert({
      ...row(userId, "hash-new"),
      createdAt: new Date("2026-11-06T13:00:00Z"),
    });
    await tokens.insert(row(otherId, "hash-theirs"));

    const listed = await tokens.listForUser(userId);

    expect(listed.map(({ tokenHash }) => tokenHash)).toEqual(["hash-new", "hash-old"]);
  });

  it("removes a user's tokens with the user", async () => {
    const userId = await createUser("leaving");
    await tokens.insert(row(userId, "hash-leaving"));

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    await expect(tokens.findByHash("hash-leaving")).resolves.toBeNull();
  });
});
