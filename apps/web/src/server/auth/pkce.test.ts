import { describe, expect, it } from "vitest";

import { pkceCrypto } from "./pkce";

describe("pkceCrypto", () => {
  it("matches the worked example in RFC 7636", async () => {
    await expect(
      pkceCrypto.challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
    ).resolves.toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("makes URL-safe random tokens of a valid PKCE length", () => {
    const token = pkceCrypto.randomToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(token).not.toBe(pkceCrypto.randomToken());
  });
});
