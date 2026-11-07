import { z } from "zod";

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const secretKey = z
  .base64()
  .refine((value) => Buffer.from(value, "base64").length === 32, "must be 32 bytes, in base64");

const REQUIRED_IN_PRODUCTION = [
  "ANTHROPIC_API_KEY",
  "APP_URL",
  "BUFFER_CLIENT_ID",
  "BUFFER_CLIENT_SECRET",
  "DATABASE_URL",
  "SECRET_KEY",
] as const;

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    VERCEL_ENV: z.string().optional(),
    LOG_LEVEL: z.enum(["info", "warn", "error"]).default("info"),
    ANTHROPIC_API_KEY: optional(z.string()),
    APP_URL: optional(z.url()),
    BUFFER_CLIENT_ID: optional(z.string()),
    BUFFER_CLIENT_SECRET: optional(z.string()),
    DATABASE_URL: optional(z.url()),
    /** Guards the deep health check. Until it's set, that route doesn't exist. */
    HEALTH_SECRET: optional(z.string().min(32)),
    /** The owner's user ID, whose Buffer grant the daily check uses for its one Buffer call. */
    HEALTH_BUFFER_USER_ID: optional(z.uuid()),
    EXTENSION_ORIGIN: optional(z.string().startsWith("chrome-extension://")),
    SECRET_KEY: optional(secretKey),
    /** Swaps real services for fakes in browser flows. Refused on any Vercel deployment. */
    E2E_FAKES: optional(z.literal("1")),
    /** Sample answers instead of Claude, with Buffer and the database still real. Refused on Vercel. */
    FAKE_CLAUDE: optional(z.literal("1")),
  })
  .superRefine((env, context) => {
    if (env.VERCEL_ENV !== undefined && env.E2E_FAKES !== undefined) {
      context.addIssue({ code: "custom", path: ["E2E_FAKES"], message: "is for local tests only" });
    }

    if (env.VERCEL_ENV !== undefined && env.FAKE_CLAUDE !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["FAKE_CLAUDE"],
        message: "is for local tests only",
      });
    }

    if (env.VERCEL_ENV !== "production") {
      return;
    }

    for (const name of REQUIRED_IN_PRODUCTION) {
      if (env[name] === undefined) {
        context.addIssue({ code: "custom", path: [name], message: "is required in production" });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}

let cached: Env | undefined;

/** The only reader of `process.env`. `instrumentation.ts` calls it, so bad config fails at startup. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
