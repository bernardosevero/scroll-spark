import { and, count, eq, gte, isNull } from "drizzle-orm";

import type { DraftRunLog, IdeaLinks } from "@scroll-spark/core/ship/ship.service";

import type { Database } from "./grant-repository";
import { captures, draftRuns } from "./schema";

export function createIdeaLinkRepository({ db }: { db: Database }): IdeaLinks {
  async function find(userId: string, captureId: string) {
    const [row] = await db
      .select({ bufferIdeaId: captures.bufferIdeaId })
      .from(captures)
      .where(and(eq(captures.id, captureId), eq(captures.userId, userId)));

    return row?.bufferIdeaId ?? null;
  }

  return {
    find,

    async save(userId, captureId, ideaId) {
      // Only fills an empty column, so the first idea stays if two requests raced.
      const [row] = await db
        .update(captures)
        .set({ bufferIdeaId: ideaId })
        .where(
          and(
            eq(captures.id, captureId),
            eq(captures.userId, userId),
            isNull(captures.bufferIdeaId),
          ),
        )
        .returning({ bufferIdeaId: captures.bufferIdeaId });

      return row?.bufferIdeaId ?? (await find(userId, captureId)) ?? ideaId;
    },
  };
}

export function createDraftRunRepository({ db }: { db: Database }): DraftRunLog {
  return {
    async countSince(userId, since) {
      const [row] = await db
        .select({ used: count() })
        .from(draftRuns)
        .where(and(eq(draftRuns.userId, userId), gte(draftRuns.createdAt, since)));

      return row?.used ?? 0;
    },

    async record(userId, captureId, at) {
      await db.insert(draftRuns).values({ userId, captureId, createdAt: at });
    },
  };
}
