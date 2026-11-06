import { describe, expect, it } from "vitest";

import { createSealer } from "./seal";

const secretKey = Buffer.alloc(32, 7).toString("base64");

describe("createSealer", () => {
  it("opens what it sealed, without the plaintext showing", () => {
    const sealer = createSealer({ secretKey, purpose: "tokens" });

    const sealed = sealer.seal("refresh-token");

    expect(sealed).not.toContain("refresh-token");
    expect(sealer.open(sealed)).toBe("refresh-token");
  });

  it("gives a different result each time", () => {
    const sealer = createSealer({ secretKey, purpose: "tokens" });

    expect(sealer.seal("x")).not.toBe(sealer.seal("x"));
  });

  it("refuses a value sealed for another purpose", () => {
    const sealed = createSealer({ secretKey, purpose: "session" }).seal("user-1");

    expect(createSealer({ secretKey, purpose: "tokens" }).open(sealed)).toBeNull();
  });

  it.each(["", "not-sealed", "AAAA"])("refuses a damaged value: %j", (value) => {
    expect(createSealer({ secretKey, purpose: "tokens" }).open(value)).toBeNull();
  });

  it("refuses a tampered value", () => {
    const sealer = createSealer({ secretKey, purpose: "tokens" });
    const sealed = sealer.seal("user-1");
    const tampered = `${sealed.slice(0, -2)}${sealed.endsWith("AA") ? "BB" : "AA"}`;

    expect(sealer.open(tampered)).toBeNull();
  });
});
