import { and, eq, isNull } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type { GrantRepository } from "@scroll-spark/core/auth/auth.service";
import type { TokenSet } from "@scroll-spark/core/auth/schemas";

import type { Sealer } from "../crypto/seal";
import type * as schema from "./schema";
import { bufferGrants, users } from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createGrantRepository({
  db,
  sealer,
}: {
  db: Database;
  sealer: Sealer;
}): GrantRepository {
  function sealed({ accessToken, refreshToken, expiresAt }: TokenSet) {
    return {
      sealedAccessToken: sealer.seal(accessToken),
      sealedRefreshToken: sealer.seal(refreshToken),
      expiresAt,
      refreshingUntil: null,
      updatedAt: new Date(),
    };
  }

  return {
    async saveGrant(bufferAccountId, tokens) {
      const [user] = await db
        .insert(users)
        .values({ bufferAccountId })
        .onConflictDoUpdate({ target: users.bufferAccountId, set: { bufferAccountId } })
        .returning({ id: users.id });

      if (user === undefined) {
        throw new Error("Saving the user returned no row.");
      }

      const values = { ...sealed(tokens), needsReconnect: false };
      await db
        .insert(bufferGrants)
        .values({ userId: user.id, ...values })
        .onConflictDoUpdate({ target: bufferGrants.userId, set: values });

      return user.id;
    },

    async read(userId) {
      const [row] = await db.select().from(bufferGrants).where(eq(bufferGrants.userId, userId));

      if (row === undefined) {
        return null;
      }

      const accessToken = sealer.open(row.sealedAccessToken);
      const refreshToken = sealer.open(row.sealedRefreshToken);

      // A changed key leaves tokens we can't read, so the user has to connect again.
      if (accessToken === null || refreshToken === null) {
        return null;
      }

      return {
        tokens: { accessToken, refreshToken, expiresAt: row.expiresAt },
        refreshingUntil: row.refreshingUntil,
        needsReconnect: row.needsReconnect,
      };
    },

    async tryStartRefresh(userId, until) {
      const won = await db
        .update(bufferGrants)
        .set({ refreshingUntil: until })
        .where(
          and(
            eq(bufferGrants.userId, userId),
            isNull(bufferGrants.refreshingUntil),
            eq(bufferGrants.needsReconnect, false),
          ),
        )
        .returning({ userId: bufferGrants.userId });

      return won.length === 1;
    },

    async finishRefresh(userId, tokens) {
      await db.update(bufferGrants).set(sealed(tokens)).where(eq(bufferGrants.userId, userId));
    },

    async markReconnectRequired(userId) {
      await db
        .update(bufferGrants)
        .set({ needsReconnect: true, refreshingUntil: null, updatedAt: new Date() })
        .where(eq(bufferGrants.userId, userId));
    },
  };
}
