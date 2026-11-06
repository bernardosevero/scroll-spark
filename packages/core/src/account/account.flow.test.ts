import { describe, expect, it } from "vitest";

import { createAccountService } from "./account.service";
import type { AccountRepository } from "./account.service";

/** Behaves like the real tables: removing a user removes everything that belongs to them. */
function createAccounts(userIds: string[], needingReconnect: string[] = []) {
  const users = new Set(userIds);

  const repository: AccountRepository = {
    deleteUser(userId) {
      users.delete(userId);
      return Promise.resolve();
    },
    needsReconnect: (userId) => Promise.resolve(needingReconnect.includes(userId)),
  };

  return { users, repository };
}

describe("account flow", () => {
  it("deleting my data removes me and leaves other users alone", async () => {
    const { users, repository } = createAccounts(["me", "someone-else"]);

    await createAccountService({ accounts: repository }).deleteMyData("me");

    expect([...users]).toEqual(["someone-else"]);
  });

  it("deleting data twice is not an error", async () => {
    const { repository } = createAccounts(["me"]);
    const service = createAccountService({ accounts: repository });

    await service.deleteMyData("me");

    await expect(service.deleteMyData("me")).resolves.toBeUndefined();
  });

  it.each([
    ["needs to reconnect", ["me"], true],
    ["is connected", [], false],
  ])("reports when a user %s", async (_name, needing, expected) => {
    const { repository } = createAccounts(["me"], needing);

    await expect(createAccountService({ accounts: repository }).status("me")).resolves.toEqual({
      needsReconnect: expected,
    });
  });
});
