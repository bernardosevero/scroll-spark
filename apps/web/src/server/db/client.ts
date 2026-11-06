import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import type { Database } from "./grant-repository";
import * as schema from "./schema";

export function createDb(databaseUrl: string): Database {
  return drizzle(neon(databaseUrl), { schema });
}
