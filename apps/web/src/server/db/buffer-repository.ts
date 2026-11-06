import { and, eq, like, sql } from "drizzle-orm";

import type { BufferCache, QuotaStore } from "@scroll-spark/core/buffer/buffer.service";
import type { BufferPreferences } from "@scroll-spark/core/buffer/channel-settings.service";

import type { Database } from "./grant-repository";
import { bufferCache, bufferQuota, users } from "./schema";

/** Keys hold IDs and colons, but a prefix with a LIKE wildcard in it must never match widely. */
function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function createBufferCacheRepository({ db }: { db: Database }): BufferCache {
  return {
    async get(userId, key) {
      const [row] = await db
        .select({ body: bufferCache.body, fetchedAt: bufferCache.fetchedAt })
        .from(bufferCache)
        .where(and(eq(bufferCache.userId, userId), eq(bufferCache.key, key)));

      return row ?? null;
    },

    async set(userId, key, body, fetchedAt) {
      await db
        .insert(bufferCache)
        .values({ userId, key, body, fetchedAt })
        .onConflictDoUpdate({
          target: [bufferCache.userId, bufferCache.key],
          set: { body, fetchedAt },
        });
    },

    async clearPrefix(userId, prefix) {
      await db
        .delete(bufferCache)
        .where(
          and(eq(bufferCache.userId, userId), like(bufferCache.key, `${escapeLike(prefix)}%`)),
        );
    },
  };
}

export function createBufferQuotaRepository({ db }: { db: Database }): QuotaStore {
  return {
    async read() {
      const rows = await db.select().from(bufferQuota);

      return rows.map((row) => ({
        windowSeconds: row.windowSeconds,
        quota: row.quota,
        remaining: row.remaining,
        resetsAt: row.resetsAt.toISOString(),
      }));
    },

    async record(windows) {
      for (const window of windows) {
        const resetsAt = new Date(window.resetsAt);

        // Within one window the lower remaining wins, so a slow response can't raise the count.
        // A reset later than the stored one by more than clock jitter starts a new window.
        await db
          .insert(bufferQuota)
          .values({
            windowSeconds: window.windowSeconds,
            quota: window.quota,
            remaining: window.remaining,
            resetsAt,
          })
          .onConflictDoUpdate({
            target: bufferQuota.windowSeconds,
            set: {
              quota: window.quota,
              remaining: sql`CASE
                WHEN ${bufferQuota.resetsAt} <= now()
                  OR ${resetsAt.toISOString()}::timestamptz > ${bufferQuota.resetsAt} + interval '30 seconds'
                THEN ${window.remaining}
                ELSE LEAST(${bufferQuota.remaining}, ${window.remaining})
              END`,
              resetsAt,
              updatedAt: sql`now()`,
            },
          });
      }
    },
  };
}

export function createBufferPreferencesRepository({ db }: { db: Database }): BufferPreferences {
  return {
    async get(userId) {
      const [row] = await db
        .select({
          organizationId: users.organizationId,
          defaultChannelIds: users.defaultChannelIds,
        })
        .from(users)
        .where(eq(users.id, userId));

      return row ?? { organizationId: null, defaultChannelIds: null };
    },

    async setOrganization(userId, organizationId) {
      await db
        .update(users)
        .set({ organizationId, defaultChannelIds: null })
        .where(eq(users.id, userId));
    },

    async setDefaultChannels(userId, channelIds) {
      await db.update(users).set({ defaultChannelIds: channelIds }).where(eq(users.id, userId));
    },
  };
}
