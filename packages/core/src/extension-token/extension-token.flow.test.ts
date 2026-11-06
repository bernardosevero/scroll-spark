import { describe, expect, it } from "vitest";

import { AppError } from "../errors/app-error";
import { createExtensionTokenService } from "./extension-token.service";
import type {
  ExtensionTokenRecord,
  ExtensionTokenRepository,
  TokenCrypto,
} from "./extension-token.service";

const DAY_MS = 24 * 60 * 60 * 1000;

function createRepository() {
  const rows: ExtensionTokenRecord[] = [];

  const repository: ExtensionTokenRepository = {
    insert({ userId, tokenHash, expiresAt, createdAt }) {
      const row = {
        id: `token-${rows.length + 1}`,
        userId,
        tokenHash,
        expiresAt,
        createdAt,
        revokedAt: null,
      };
      rows.push(row);
      return Promise.resolve({ ...row });
    },
    findByHash(tokenHash) {
      return Promise.resolve(rows.find((row) => row.tokenHash === tokenHash) ?? null);
    },
    listForUser(userId) {
      return Promise.resolve(rows.filter((row) => row.userId === userId).reverse());
    },
    revoke(userId, tokenId, at) {
      const row = rows.find((candidate) => candidate.id === tokenId && candidate.userId === userId);
      if (row === undefined) {
        return Promise.resolve(false);
      }
      row.revokedAt ??= at;
      return Promise.resolve(true);
    },
  };

  return { rows, repository };
}

function setup() {
  const { rows, repository } = createRepository();
  let now = new Date("2026-11-06T12:00:00.000Z");
  let counter = 0;
  const crypto: TokenCrypto = {
    randomToken: () => `token-value-${++counter}`,
    hash: (token) => `hash(${token})`,
  };
  const service = createExtensionTokenService({
    tokens: repository,
    crypto,
    clock: { now: () => now },
  });

  return {
    rows,
    service,
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
}

describe("connecting the extension", () => {
  it("stores only a hash and returns the token once", async () => {
    const { service, rows } = setup();

    const connected = await service.connect("user-1");

    expect(connected.token).toBe("token-value-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe("hash(token-value-1)");
    expect(Object.values(rows[0] ?? {})).not.toContain(connected.token);
    expect(JSON.stringify(await service.list("user-1"))).not.toContain(`"token"`);
  });

  it("gives each connection its own token, valid for 30 days", async () => {
    const { service } = setup();

    const first = await service.connect("user-1");
    const second = await service.connect("user-1");

    expect(second.token).not.toBe(first.token);
    expect(first.expiresAt).toBe("2026-12-06T12:00:00.000Z");
  });
});

describe("using a token", () => {
  it("resolves a valid token to its user", async () => {
    const { service } = setup();
    const { token } = await service.connect("user-1");

    await expect(service.resolve(token)).resolves.toBe("user-1");
  });

  it("refuses a token the moment it expires", async () => {
    const { service, advance } = setup();
    const { token } = await service.connect("user-1");

    advance(30 * DAY_MS - 1);
    await expect(service.resolve(token)).resolves.toBe("user-1");

    advance(1);
    await expect(service.resolve(token)).resolves.toBeNull();
  });

  it("refuses a revoked token", async () => {
    const { service } = setup();
    const { id, token } = await service.connect("user-1");

    await service.revoke("user-1", { tokenId: id });

    await expect(service.resolve(token)).resolves.toBeNull();
  });

  it.each(["", "never-issued", "hash(token-value-1)"])("refuses %j", async (token) => {
    const { service } = setup();
    await service.connect("user-1");

    await expect(service.resolve(token)).resolves.toBeNull();
  });
});

describe("revoking", () => {
  it("lets a user revoke only their own token", async () => {
    const { service } = setup();
    const { id, token } = await service.connect("user-1");

    const error = await service
      .revoke("user-2", { tokenId: id })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: "NOT_FOUND" });
    await expect(service.resolve(token)).resolves.toBe("user-1");
  });

  it("lists only the user's tokens that still work", async () => {
    const { service, advance } = setup();
    const old = await service.connect("user-1");
    advance(31 * DAY_MS);
    const revoked = await service.connect("user-1");
    const kept = await service.connect("user-1");
    await service.connect("user-2");
    await service.revoke("user-1", { tokenId: revoked.id });

    const listed = await service.list("user-1");

    expect(listed.map(({ id }) => id)).toEqual([kept.id]);
    expect(listed.map(({ id }) => id)).not.toContain(old.id);
  });
});
