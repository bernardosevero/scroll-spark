import { eq } from "drizzle-orm";

import type { AccountRepository } from "@scroll-spark/core/account/account.service";

import type { Database } from "./grant-repository";
import { bufferGrants, users } from "./schema";

export function createAccountRepository({ db }: { db: Database }): AccountRepository {
  return {
    async deleteUser(userId) {
      // Grants, captures and analyses all cascade from the user row.
      await db.delete(users).where(eq(users.id, userId));
    },

    async needsReconnect(userId) {
      const [grant] = await db
        .select({ needsReconnect: bufferGrants.needsReconnect })
        .from(bufferGrants)
        .where(eq(bufferGrants.userId, userId));

      // No grant at all also means the user has to connect again.
      return grant?.needsReconnect ?? true;
    },
  };
}
