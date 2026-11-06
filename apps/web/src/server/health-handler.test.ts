import { describe, expect, it, vi } from "vitest";

import { handleDeepHealth } from "./health-handler";

const SECRET = "a-long-random-secret";

function setup(isHealthy = true) {
  const check = vi.fn(() =>
    Promise.resolve({
      isHealthy,
      checks: { database: "ok", ai: "ok", buffer: isHealthy ? "ok" : "error" } as const,
    }),
  );
  return { check, health: { check } };
}

const request = (secret?: string) =>
  new Request("https://app.example/api/health/deep", {
    headers: secret === undefined ? {} : { "x-health-secret": secret },
  });

describe("the deep health endpoint", () => {
  it("answers 200 with each check for the right secret", async () => {
    const { health } = setup();

    const response = await handleDeepHealth(request(SECRET), { secret: SECRET, health });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      checks: { database: "ok", ai: "ok", buffer: "ok" },
    });
  });

  it("answers 503 when a check fails, so the daily job fails and emails", async () => {
    const { health } = setup(false);

    const response = await handleDeepHealth(request(SECRET), { secret: SECRET, health });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "error",
      checks: { buffer: "error" },
    });
  });

  it.each([
    ["a wrong secret", "wrong"],
    ["a secret of another length", `${SECRET}-and-more`],
    ["no secret", undefined],
  ])("refuses %s without spending anything", async (_case, sent) => {
    const { health, check } = setup();

    const response = await handleDeepHealth(request(sent), { secret: SECRET, health });

    expect(response.status).toBe(401);
    expect(check).not.toHaveBeenCalled();
  });

  it("doesn't exist until a secret is configured", async () => {
    const { health, check } = setup();

    const response = await handleDeepHealth(request("anything"), { secret: undefined, health });

    expect(response.status).toBe(404);
    expect(check).not.toHaveBeenCalled();
  });
});
