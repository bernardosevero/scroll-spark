import { describe, expect, it } from "vitest";

import { allowedOrigin, corsHeaders } from "./cors";

const OURS = "chrome-extension://ours";
const OTHER = "chrome-extension://other";

describe("corsHeaders", () => {
  it("lets the panel send its bearer token, and never sends cookies across origins", () => {
    const headers = corsHeaders(OURS) as Record<string, string>;

    expect(headers["Access-Control-Allow-Origin"]).toBe(OURS);
    expect(headers["Access-Control-Allow-Headers"]).toContain("authorization");
    expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
  });

  it("says nothing to an origin that isn't allowed", () => {
    expect(corsHeaders(null)).toEqual({});
  });
});

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
