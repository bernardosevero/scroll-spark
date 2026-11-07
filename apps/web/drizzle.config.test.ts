import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Config } from "drizzle-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FROM_FILE = "postgresql://from-file@127.0.0.1:1/x";
const FROM_ENVIRONMENT = "postgresql://from-environment@127.0.0.1:1/x";

/** The config reads its file at import, from the folder the command runs in. */
async function databaseUrl(): Promise<string> {
  vi.resetModules();
  const { default: config } = await import("./drizzle.config");
  return (config as Extract<Config, { dbCredentials: { url: string } }>).dbCredentials.url;
}

describe("drizzle.config", () => {
  const originalFolder = process.cwd();
  let folder: string;

  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), "drizzle-config-"));
    process.chdir(folder);
    vi.stubEnv("DATABASE_URL", undefined);
  });

  afterEach(() => {
    process.chdir(originalFolder);
    rmSync(folder, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("reads DATABASE_URL from .env.local", async () => {
    writeFileSync(".env.local", `DATABASE_URL=${FROM_FILE}\n`);

    expect(await databaseUrl()).toBe(FROM_FILE);
  });

  it("lets a value already in the environment win over the file", async () => {
    writeFileSync(".env.local", `DATABASE_URL=${FROM_FILE}\n`);
    vi.stubEnv("DATABASE_URL", FROM_ENVIRONMENT);

    expect(await databaseUrl()).toBe(FROM_ENVIRONMENT);
  });

  it("loads without error when there is no .env.local", async () => {
    expect(await databaseUrl()).toBe("");
  });
});
