import { describe, expect, it } from "vitest";

import { parseRateLimit } from "./rate-limit-headers";

const NOW = new Date("2026-11-06T12:00:00.000Z");

// Shapes copied from issue #4. Replace with recorded headers once #2 has them.
const POLICY_15M = '"150-in-15min"; q=150; w=900';
const LIMIT_15M = '"150-in-15min"; r=98; t=897';

function headers(entries: Record<string, string>) {
  return new Headers(entries);
}

describe("RateLimit headers", () => {
  it("turns a RateLimit and its policy into a quota window", () => {
    expect(
      parseRateLimit(headers({ ratelimit: LIMIT_15M, "ratelimit-policy": POLICY_15M }), NOW),
    ).toEqual([
      {
        windowSeconds: 900,
        quota: 150,
        remaining: 98,
        resetsAt: "2026-11-06T12:14:57.000Z",
      },
    ]);
  });

  it("reads one window per header line, matching them by name", () => {
    const parsed = parseRateLimit(
      headers({
        ratelimit: `${LIMIT_15M}, "250-in-24h"; r=200; t=80000`,
        // Listed in a different order on purpose.
        "ratelimit-policy": '"250-in-24h"; q=250; w=86400, "150-in-15min"; q=150; w=900',
      }),
      NOW,
    );

    expect(
      parsed.map(({ windowSeconds, quota, remaining }) => [windowSeconds, quota, remaining]),
    ).toEqual([
      [900, 150, 98],
      [86_400, 250, 200],
    ]);
  });

  it.each([
    ["no headers", {}],
    ["no policy", { ratelimit: LIMIT_15M }],
    ["no limit", { "ratelimit-policy": POLICY_15M }],
    ["gibberish", { ratelimit: "nope", "ratelimit-policy": "nope" }],
    [
      "a window with no length",
      { ratelimit: LIMIT_15M, "ratelimit-policy": '"150-in-15min"; q=150' },
    ],
    ["a policy for another window", { ratelimit: LIMIT_15M, "ratelimit-policy": '"x"; q=1; w=60' }],
  ])("returns nothing for %s", (_name, entries) => {
    expect(parseRateLimit(headers(entries), NOW)).toEqual([]);
  });

  it("never reports more remaining than the quota", () => {
    const [window] = parseRateLimit(
      headers({ ratelimit: '"a"; r=500; t=10', "ratelimit-policy": '"a"; q=100; w=900' }),
      NOW,
    );

    expect(window?.remaining).toBe(100);
  });
});
