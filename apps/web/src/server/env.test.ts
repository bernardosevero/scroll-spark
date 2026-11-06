import { describe, expect, it } from "vitest";

import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("treats blank optional values as missing", () => {
    expect(parseEnv({ DATABASE_URL: "", EXTENSION_ORIGIN: "" })).toMatchObject({
      DATABASE_URL: undefined,
      EXTENSION_ORIGIN: undefined,
    });
  });

  it.each([{ DATABASE_URL: "not a url" }, { EXTENSION_ORIGIN: "https://example.com" }])(
    "rejects bad configuration: %j",
    (source) => {
      expect(() => parseEnv(source)).toThrow();
    },
  );
});
