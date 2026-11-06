import { describe, expect, it } from "vitest";

import { isExpired, parseConnectMessage } from "./connect-message";

const GOOD = {
  type: "scroll-spark.connect",
  token: "ssx_abc",
  expiresAt: "2026-12-06T12:00:00.000Z",
};

describe("connect message", () => {
  it("keeps the token and its expiry", () => {
    expect(parseConnectMessage(GOOD)).toEqual({
      value: "ssx_abc",
      expiresAt: "2026-12-06T12:00:00.000Z",
    });
  });

  it.each([
    null,
    "ssx_abc",
    {},
    { ...GOOD, type: "something-else" },
    { ...GOOD, token: "" },
    { ...GOOD, token: 5 },
    { ...GOOD, expiresAt: "soon" },
  ])("refuses %j", (message) => {
    expect(parseConnectMessage(message)).toBeNull();
  });
});

describe("expiry", () => {
  const token = { value: "x", expiresAt: "2026-12-06T12:00:00.000Z" };

  it("runs out at the expiry time", () => {
    expect(isExpired(token, new Date("2026-12-06T11:59:59.999Z"))).toBe(false);
    expect(isExpired(token, new Date("2026-12-06T12:00:00.000Z"))).toBe(true);
  });
});
