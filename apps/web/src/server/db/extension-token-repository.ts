import { and, desc, eq, isNull } from "drizzle-orm";

import type { ExtensionTokenRepository } from "@scroll-spark/core/extension-token/extension-token.service";

import type { Database } from "./grant-repository";
import { extensionTokens } from "./schema";

export function createExtensionTokenRepository({ db }: { db: Database }): ExtensionTokenRepository {
  return {
    async insert(row) {
      const [saved] = await db.insert(extensionTokens).values(row).returning();

      if (saved === undefined) {
        throw new Error("Saving the extension token returned no row.");
      }

      return saved;
    },

    async findByHash(tokenHash) {
      const [row] = await db
        .select()
        .from(extensionTokens)
        .where(eq(extensionTokens.tokenHash, tokenHash));

      return row ?? null;
    },

    listForUser(userId) {
      return db
        .select()
        .from(extensionTokens)
        .where(eq(extensionTokens.userId, userId))
        .orderBy(desc(extensionTokens.createdAt));
    },

    async revoke(userId, tokenId, at) {
      const owned = and(eq(extensionTokens.id, tokenId), eq(extensionTokens.userId, userId));

      // Only the first revocation sets the time, so a second click keeps the original.
      await db
        .update(extensionTokens)
        .set({ revokedAt: at })
        .where(and(owned, isNull(extensionTokens.revokedAt)));
      const [row] = await db.select({ id: extensionTokens.id }).from(extensionTokens).where(owned);

      return row !== undefined;
    },
  };
}
