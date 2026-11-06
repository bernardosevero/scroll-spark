import { describe, expect, it } from "vitest";

import { tokenCrypto } from "./token-crypto";

describe("extension token crypto", () => {
  it("makes long, URL-safe tokens that never repeat", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => tokenCrypto.randomToken()));

    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(token).toMatch(/^ssx_[A-Za-z0-9_-]{43}$/);
    }
  });

  it("hashes with SHA-256, in hex", () => {
    expect(tokenCrypto.hash("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
