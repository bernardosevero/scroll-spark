import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSealer } from "../crypto/seal";
import { createGrantRepository } from "./grant-repository";
import { createTestDatabase } from "./test-database";

// The lock is about concurrency, so a fake would prove nothing. Runs when a test database exists.
const databaseUrl = process.env.TEST_DATABASE_URL;

const tokens = (name: string) => ({
  accessToken: `access-${name}`,
  refreshToken: `refresh-${name}`,
  expiresAt: new Date("2026-11-06T13:00:00.000Z"),
});

describe.skipIf(databaseUrl === undefined)("grant repository on real Postgres", () => {
  const { pool, db, reset } = createTestDatabase(databaseUrl);
  const sealer = createSealer({
    secretKey: Buffer.alloc(32, 9).toString("base64"),
    purpose: "tokens",
  });
  const grants = createGrantRepository({ db, sealer });

  beforeAll(reset);
  afterAll(() => pool.end());

  it("lets exactly one of many simultaneous requests start a refresh", async () => {
    const userId = await grants.saveGrant("race", tokens("first"));
    const until = new Date(Date.now() + 30_000);

    const results = await Promise.all(
      Array.from({ length: 10 }, () => grants.tryStartRefresh(userId, until)),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("frees the lock with the new tokens once a refresh finishes", async () => {
    const userId = await grants.saveGrant("finish", tokens("first"));
    await grants.tryStartRefresh(userId, new Date(Date.now() + 30_000));

    await grants.finishRefresh(userId, tokens("second"));

    await expect(grants.read(userId)).resolves.toMatchObject({
      tokens: { refreshToken: "refresh-second" },
      refreshingUntil: null,
    });
    await expect(grants.tryStartRefresh(userId, new Date())).resolves.toBe(true);
  });

  it("refuses a refresh after the user must reconnect, until they do", async () => {
    const userId = await grants.saveGrant("reconnect", tokens("first"));
    await grants.markReconnectRequired(userId);

    await expect(grants.tryStartRefresh(userId, new Date())).resolves.toBe(false);

    await expect(grants.saveGrant("reconnect", tokens("again"))).resolves.toBe(userId);
    await expect(grants.read(userId)).resolves.toMatchObject({ needsReconnect: false });
  });

  it("stores tokens encrypted", async () => {
    const userId = await grants.saveGrant("sealed", tokens("first"));

    const { rows } = await pool.query<{ sealed_refresh_token: string }>(
      "SELECT sealed_refresh_token FROM buffer_grants WHERE user_id = $1",
      [userId],
    );

    expect(rows[0]?.sealed_refresh_token).not.toContain("refresh-first");
  });

  it("asks for a new connection when tokens can't be read with the current key", async () => {
    const userId = await grants.saveGrant("old-key", tokens("first"));
    const other = createSealer({
      secretKey: Buffer.alloc(32, 1).toString("base64"),
      purpose: "tokens",
    });

    await expect(createGrantRepository({ db, sealer: other }).read(userId)).resolves.toBeNull();
  });
});
