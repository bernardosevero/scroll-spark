import { describe, expect, it, vi } from "vitest";

import { createAnthropicPing } from "./anthropic-ping";
import type { PingRequest } from "./anthropic-ping";

describe("the tiny Claude health call", () => {
  it("uses the cheapest model with a few tokens, no tools and no user data", async () => {
    const create = vi.fn<(request: PingRequest) => Promise<unknown>>(() => Promise.resolve({}));

    await createAnthropicPing({ create })();

    const request = create.mock.calls[0]?.[0];
    expect(request?.model).toBe("claude-haiku-5-5");
    expect(request?.max_tokens).toBeLessThanOrEqual(32);
    expect(request).not.toHaveProperty("tools");
    expect(request?.messages).toEqual([{ role: "user", content: "Reply with OK." }]);
  });

  it("passes a failure on for the health check to report", async () => {
    const create = vi.fn(() => Promise.reject(new Error("no credit")));

    await expect(createAnthropicPing({ create })()).rejects.toThrow("no credit");
  });
});
