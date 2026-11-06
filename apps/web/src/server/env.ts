import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["info", "warn", "error"]).default("info"),
  // Optional only until the first database issue makes it required.
  DATABASE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  EXTENSION_ORIGIN: z.preprocess(
    emptyToUndefined,
    z.string().startsWith("chrome-extension://").optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;

function emptyToUndefined(value: unknown) {
  return value === "" ? undefined : value;
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}

let cached: Env | undefined;

/** The only reader of `process.env`. `instrumentation.ts` calls it, so bad config fails at startup. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
