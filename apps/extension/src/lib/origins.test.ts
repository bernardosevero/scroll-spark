import { describe, expect, it } from "vitest";

import { LOCAL_ORIGIN, connectOrigins, webOriginFrom } from "./origins";

describe("web origin", () => {
  it.each([
    [undefined, LOCAL_ORIGIN],
    ["", LOCAL_ORIGIN],
    ["  ", LOCAL_ORIGIN],
    ["https://spark.example.org/", "https://spark.example.org"],
    ["https://spark.example.org", "https://spark.example.org"],
  ])("reads %j as %s", (value, expected) => {
    expect(webOriginFrom(value)).toBe(expected);
  });
});

describe("origins allowed to connect", () => {
  it("is the development site alone for a development build", () => {
    expect(connectOrigins(LOCAL_ORIGIN)).toEqual([LOCAL_ORIGIN]);
  });

  it("adds the production site for a store build", () => {
    expect(connectOrigins("https://spark.example.org")).toEqual([
      LOCAL_ORIGIN,
      "https://spark.example.org",
    ]);
  });

  it("never allows plain HTTP", () => {
    expect(connectOrigins("http://localhost:3000")).toEqual([LOCAL_ORIGIN]);
  });
});
