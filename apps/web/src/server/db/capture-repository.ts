import { desc, eq } from "drizzle-orm";

import type { CaptureRepository } from "@scroll-spark/core/capture/capture.service";
import type { Capture } from "@scroll-spark/core/capture/schemas";

import type { Database } from "./grant-repository";
import { captures } from "./schema";

function toCapture(row: typeof captures.$inferSelect): Capture {
  return {
    id: row.id,
    text: row.text,
    sourceUrl: row.sourceUrl,
    platform: row.platform,
    sourceName: row.sourceName,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createCaptureRepository({ db }: { db: Database }): CaptureRepository {
  return {
    async insert(capture) {
      const [row] = await db.insert(captures).values(capture).returning();

      if (row === undefined) {
        throw new Error("Saving the capture returned no row.");
      }

      return toCapture(row);
    },

    async listNewest(userId, limit) {
      const rows = await db
        .select()
        .from(captures)
        .where(eq(captures.userId, userId))
        .orderBy(desc(captures.createdAt))
        .limit(limit);

      return rows.map(toCapture);
    },
  };
}
