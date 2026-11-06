import { sql } from "drizzle-orm";

import { createDb } from "./db/client";
import { getEnv } from "./env";

type DatabaseHealth = "ok" | "not_configured" | "error";

/** Grows into the daily check that also makes one tiny AI call and one Buffer call. */
export async function checkHealth(): Promise<{ isHealthy: boolean; database: DatabaseHealth }> {
  const { DATABASE_URL } = getEnv();

  if (DATABASE_URL === undefined) {
    return { isHealthy: true, database: "not_configured" };
  }

  try {
    await createDb(DATABASE_URL).execute(sql`select 1`);
    return { isHealthy: true, database: "ok" };
  } catch {
    return { isHealthy: false, database: "error" };
  }
}
