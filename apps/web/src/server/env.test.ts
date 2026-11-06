import { describe, expect, it } from "vitest";

import { parseEnv } from "./env";

const COMPLETE = {
  ANTHROPIC_API_KEY: "key",
  APP_URL: "https://app.example",
  BUFFER_CLIENT_ID: "client",
  BUFFER_CLIENT_SECRET: "secret",
  DATABASE_URL: "postgres://u:p@host/db",
  SECRET_KEY: Buffer.alloc(32, 1).toString("base64"),
};

describe("parseEnv", () => {
  it("treats blank optional values as missing", () => {
    expect(parseEnv({ DATABASE_URL: "", EXTENSION_ORIGIN: "" })).toMatchObject({
      DATABASE_URL: undefined,
      EXTENSION_ORIGIN: undefined,
    });
  });

  it.each([
    { DATABASE_URL: "not a url" },
    { EXTENSION_ORIGIN: "https://example.com" },
    { SECRET_KEY: Buffer.alloc(16, 1).toString("base64") },
  ])("rejects bad configuration: %j", (source) => {
    expect(() => parseEnv(source)).toThrow();
  });

  it("lets development run before accounts exist", () => {
    expect(() => parseEnv({})).not.toThrow();
  });

  it.each(Object.keys(COMPLETE))("refuses to start production without %s", (name) => {
    expect(() => parseEnv({ ...COMPLETE, VERCEL_ENV: "production", [name]: undefined })).toThrow(
      name,
    );
  });

  it.each(["production", "preview", "development"])(
    "refuses fake services on a Vercel %s deployment",
    (VERCEL_ENV) => {
      expect(() => parseEnv({ ...COMPLETE, VERCEL_ENV, E2E_FAKES: "1" })).toThrow("E2E_FAKES");
    },
  );

  it("refuses a health secret too short to be safe", () => {
    expect(() => parseEnv({ HEALTH_SECRET: "short" })).toThrow("HEALTH_SECRET");
  });

  it("starts production before the health check is set up, since it needs a signed-in user", () => {
    expect(() => parseEnv({ ...COMPLETE, VERCEL_ENV: "production" })).not.toThrow();
  });

  it("allows fake services in local browser flows", () => {
    expect(parseEnv({ E2E_FAKES: "1" }).E2E_FAKES).toBe("1");
  });

  it("starts production with everything set", () => {
    expect(() => parseEnv({ ...COMPLETE, VERCEL_ENV: "production" })).not.toThrow();
  });
});
