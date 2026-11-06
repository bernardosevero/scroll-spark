import { and, count, eq, gte } from "drizzle-orm";
import { z } from "zod";

import type {
  AnalysisRepository,
  UserSettings,
} from "@scroll-spark/core/analysis/analysis.service";
import type { Analysis } from "@scroll-spark/core/analysis/schemas";
import { channelFitSchema, duplicatesSchema } from "@scroll-spark/core/fit/schemas";

import type { Database } from "./grant-repository";
import { analyses, users } from "./schema";

/** A column that no longer parses counts as no fit yet, rather than breaking the capture. */
function readColumn<T>(schema: z.ZodType<T>, value: unknown) {
  const parsed = schema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

function toAnalysis(row: typeof analyses.$inferSelect): Analysis {
  return {
    captureId: row.captureId,
    summary: row.summary,
    topic: row.topic,
    angle: row.angle,
    trendPhrases: row.trendPhrases,
    channels: readColumn(z.array(channelFitSchema), row.channels),
    duplicates: readColumn(duplicatesSchema, row.duplicates),
    model: row.model,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createAnalysisRepository({ db }: { db: Database }): AnalysisRepository {
  async function find(captureId: string) {
    const [row] = await db.select().from(analyses).where(eq(analyses.captureId, captureId));

    return row === undefined ? null : toAnalysis(row);
  }

  return {
    find,

    async countSince(userId, since) {
      const [row] = await db
        .select({ used: count() })
        .from(analyses)
        .where(and(eq(analyses.userId, userId), gte(analyses.createdAt, since)));

      return row?.used ?? 0;
    },

    async save(userId, analysis) {
      const [row] = await db
        .insert(analyses)
        .values({ ...analysis, userId, createdAt: new Date(analysis.createdAt) })
        .onConflictDoNothing({ target: analyses.captureId })
        .returning();

      // No row means another request saved first, so its answer stands.
      return row === undefined ? ((await find(analysis.captureId)) ?? analysis) : toAnalysis(row);
    },
  };
}

export function createUserSettingsRepository({ db }: { db: Database }): UserSettings {
  return {
    async getTrendsGeo(userId) {
      const [row] = await db
        .select({ trendsGeo: users.trendsGeo })
        .from(users)
        .where(eq(users.id, userId));

      return row?.trendsGeo ?? null;
    },

    async setTrendsGeo(userId, geo) {
      await db.update(users).set({ trendsGeo: geo }).where(eq(users.id, userId));
    },
  };
}
