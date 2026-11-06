import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import * as schema from "./schema";

/** For `*.pg.test.ts` files, which run one at a time because each one resets the database. */
export function createTestDatabase(databaseUrl: string | undefined) {
  const pool = new Pool({ connectionString: databaseUrl, max: 10 });
  const db = drizzle(pool, { schema });

  return {
    pool,
    db,
    async reset() {
      if (!new URL(String(databaseUrl)).pathname.includes("test")) {
        throw new Error("TEST_DATABASE_URL must name a test database, since tests reset it.");
      }

      await pool.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
      await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE;");
      await migrate(db, {
        migrationsFolder: fileURLToPath(new URL("../../../drizzle", import.meta.url)),
      });
    },
  };
}
