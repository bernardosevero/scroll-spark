import { defineConfig } from "drizzle-kit";

// Next.js reads `.env.local` for the app, but drizzle-kit doesn't. Values already in the
// environment win over the file, which is how Vercel and CI set theirs.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No such file, which is fine.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
