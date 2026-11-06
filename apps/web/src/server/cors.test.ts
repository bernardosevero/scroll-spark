import { describe, expect, it } from "vitest";

import { allowedOrigin } from "./cors";

const OURS = "chrome-extension://ours";
const OTHER = "chrome-extension://other";

describe("allowedOrigin", () => {
  it.each([
    { origin: null, extensionOrigin: OURS, isDevelopment: false, expected: null },
    { origin: OURS, extensionOrigin: OURS, isDevelopment: false, expected: OURS },
    { origin: OTHER, extensionOrigin: OURS, isDevelopment: false, expected: null },
    { origin: OTHER, extensionOrigin: undefined, isDevelopment: true, expected: OTHER },
    { origin: "https://evil.example", extensionOrigin: OURS, isDevelopment: true, expected: null },
  ])("origin $origin, development $isDevelopment gives $expected", ({ expected, ...input }) => {
    expect(allowedOrigin(input)).toBe(expected);
  });
});
