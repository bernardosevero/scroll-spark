import { describe, expect, it } from "vitest";

import { version } from "./package.json";

describe("the package sent to the Chrome Web Store", () => {
  // WXT copies this into the manifest, and with none it writes 0.0.0, which Chrome rejects.
  it("has a version Chrome accepts: one to four numbers, not all zero", () => {
    expect(version).toMatch(/^\d+(\.\d+){0,3}$/);
    expect(version.split(".").some((part) => Number(part) > 0)).toBe(true);
  });
});
