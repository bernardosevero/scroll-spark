import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@scroll-spark/core/logging/logger";

import { createBufferGateway } from "./buffer-gateway";

// Every fixture is hand-written and unverified. See fixtures/README.md.
function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

const NOW = new Date("2026-11-06T12:00:00.000Z");
const TOKEN = "SECRET-ACCESS-TOKEN";
const RATE_HEADERS = {
  ratelimit: '"150-in-15min"; r=98; t=897',
  "ratelimit-policy": '"150-in-15min"; q=150; w=900',
};

function setup({
  body,
  status = 200,
  headers = RATE_HEADERS,
  failWith,
}: {
  body?: string;
  status?: number;
  headers?: Record<string, string>;
  failWith?: Error;
} = {}) {
  const send = vi.fn<typeof fetch>(() =>
    failWith
      ? Promise.reject(failWith)
      : Promise.resolve(new Response(body ?? "{}", { status, headers })),
  );
  const logs: string[] = [];
  const record = (event: string, fields?: Record<string, unknown>) => {
    logs.push(JSON.stringify({ event, ...fields }));
  };
  const logger: Logger = { info: record, warn: record, error: record };
  const gateway = createBufferGateway({ clock: { now: () => NOW }, logger, fetch: send });

  function sent() {
    const [url, init] = send.mock.calls[0] ?? [];
    return {
      url,
      init,
      body: JSON.parse(init?.body as string) as {
        query: string;
        variables: Record<string, unknown>;
      },
    };
  }

  return { gateway, send, sent, logs };
}

const POST_INPUT = {
  organizationId: "org_example_1",
  channelId: "ch_example_1",
  text: "SECRET-POST-TEXT",
  mode: "addToQueue",
  saveToDraft: true,
} as const;

describe("Buffer gateway: success responses", () => {
  it("reads the account, and the quota from the headers", async () => {
    const { gateway, sent } = setup({ body: fixture("account.success.json") });

    const result = await gateway.account(TOKEN);

    expect(result.data).toMatchObject({
      id: "acct_example_1",
      organizations: [{ id: "org_example_1", name: "Example Studio" }],
    });
    expect(result.quota).toEqual([
      { windowSeconds: 900, quota: 150, remaining: 98, resetsAt: "2026-11-06T12:14:57.000Z" },
    ]);
    expect(sent().url).toBe("https://api.buffer.com");
    expect(sent().init?.method).toBe("POST");
    expect(new Headers(sent().init?.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
  });

  it("reads channels for an organization", async () => {
    const { gateway, sent } = setup({ body: fixture("channels.success.json") });

    const { data } = await gateway.channels(TOKEN, "org_example_1");

    expect(data.map(({ id, service }) => [id, service])).toEqual([
      ["ch_example_1", "linkedin"],
      ["ch_example_2", "instagram"],
    ]);
    expect(sent().body.variables).toEqual({ input: { organizationId: "org_example_1" } });
  });

  it("reads a page of posts, never asking for metrics", async () => {
    const { gateway, sent } = setup({ body: fixture("posts.success.json") });

    const { data } = await gateway.posts(TOKEN, {
      organizationId: "org_example_1",
      channelIds: ["ch_example_1"],
      first: 20,
    });

    expect(data).toMatchObject({
      posts: [{ id: "post_example_1", channelId: "ch_example_1", status: "sent" }],
      endCursor: "cursor_1",
      hasNextPage: true,
    });
    expect(sent().body.variables).toMatchObject({
      first: 20,
      input: {
        organizationId: "org_example_1",
        filter: { channelIds: ["ch_example_1"] },
        sort: [{ field: "dueAt", direction: "desc" }],
      },
    });
    expect(sent().body.query).not.toMatch(/metric|statistic|analytic/i);
  });

  it("reads ideas", async () => {
    const { gateway } = setup({ body: fixture("ideas.success.json") });

    await expect(gateway.ideas(TOKEN, "org_example_1")).resolves.toMatchObject({
      data: [{ id: "idea_example_1", title: "An example idea", text: "What the idea says." }],
    });
  });

  it("creates an idea with an explicit empty tags list, and never creates a tag", async () => {
    const { gateway, sent } = setup({ body: fixture("create-idea.success.json") });

    const { data } = await gateway.createIdea(TOKEN, {
      organizationId: "org_example_1",
      title: "An example idea",
      text: "What the idea says.",
    });

    expect(data.id).toBe("idea_example_2");
    expect(sent().body.variables).toEqual({
      input: {
        organizationId: "org_example_1",
        content: { title: "An example idea", text: "What the idea says.", tags: [] },
      },
    });
    expect(sent().body.query).not.toMatch(/createTag/);
  });

  it("creates a post with every required field", async () => {
    const { gateway, sent } = setup({ body: fixture("create-post.success.json") });

    const { data } = await gateway.createPost(TOKEN, { ...POST_INPUT, ideaId: "idea_example_2" });

    expect(data).toMatchObject({ id: "post_example_2", status: "draft" });
    expect(sent().body.variables.input).toEqual({
      channelId: "ch_example_1",
      text: "SECRET-POST-TEXT",
      ideaId: "idea_example_2",
      mode: "addToQueue",
      schedulingType: "automatic",
      needsApproval: false,
      assets: {},
      saveToDraft: true,
    });
  });
});

describe("Buffer gateway: errors", () => {
  it("turns a LimitReachedError inside HTTP 200 into BUFFER_LIMIT_REACHED", async () => {
    const { gateway } = setup({ body: fixture("create-post.limit-reached.json") });

    await expect(gateway.createPost(TOKEN, POST_INPUT)).rejects.toMatchObject({
      code: "BUFFER_LIMIT_REACHED",
    });
  });

  it.each([
    ["InvalidInputError", "INVALID_INPUT"],
    ["DuplicateError", "INVALID_INPUT"],
    ["NotFoundError", "NOT_FOUND"],
    ["UnauthorizedError", "RECONNECT_REQUIRED"],
    ["UnexpectedError", "BUFFER_FAILED"],
    ["SomethingNewError", "BUFFER_FAILED"],
  ])("turns %s inside HTTP 200 into %s", async (typename, code) => {
    const { gateway } = setup({
      body: JSON.stringify({ data: { createPost: { __typename: typename, message: "x" } } }),
    });

    await expect(gateway.createPost(TOKEN, POST_INPUT)).rejects.toMatchObject({ code });
  });

  it("keeps tokens and post text out of the logs", async () => {
    const { gateway, logs } = setup({ body: fixture("create-post.invalid-input.json") });

    await expect(gateway.createPost(TOKEN, POST_INPUT)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });

    expect(logs.length).toBeGreaterThan(0);
    expect(logs.join("\n")).not.toContain("SECRET");
  });

  it("turns a 429 into BUFFER_RATE_LIMITED with Retry-After, after one call", async () => {
    const { gateway, send } = setup({
      status: 429,
      body: fixture("rate-limited.429.json"),
      headers: { "retry-after": "42" },
    });

    const error = await gateway.account(TOKEN).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "BUFFER_RATE_LIMITED", retryAfterSeconds: 42 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("turns a rate limit error inside HTTP 200 into BUFFER_RATE_LIMITED", async () => {
    const { gateway } = setup({ body: fixture("rate-limited.429.json") });

    await expect(gateway.account(TOKEN)).rejects.toMatchObject({ code: "BUFFER_RATE_LIMITED" });
  });

  it("tolerates a 429 with no Retry-After", async () => {
    const { gateway } = setup({ status: 429, body: "not json", headers: {} });

    await expect(gateway.account(TOKEN)).rejects.toMatchObject({
      code: "BUFFER_RATE_LIMITED",
      retryAfterSeconds: null,
    });
  });

  it("turns a 401 into RECONNECT_REQUIRED", async () => {
    const { gateway } = setup({ status: 401, body: "{}" });

    await expect(gateway.account(TOKEN)).rejects.toMatchObject({ code: "RECONNECT_REQUIRED" });
  });

  it.each([500, 502, 503])("turns a %i into a clear failure", async (status) => {
    const { gateway } = setup({ status, body: "<html>oops</html>" });

    await expect(gateway.account(TOKEN)).rejects.toMatchObject({ code: "BUFFER_FAILED" });
  });

  it("turns a timeout into a clear failure", async () => {
    const { gateway } = setup({ failWith: new DOMException("timed out", "TimeoutError") });

    await expect(gateway.account(TOKEN)).rejects.toMatchObject({ code: "BUFFER_FAILED" });
  });

  it("turns a response of the wrong shape into a clear failure", async () => {
    const { gateway } = setup({ body: JSON.stringify({ data: { account: { id: 7 } } }) });

    await expect(gateway.account(TOKEN)).rejects.toMatchObject({ code: "BUFFER_FAILED" });
  });

  it("turns a GraphQL error into a clear failure without logging its message", async () => {
    const { gateway, logs } = setup({
      body: JSON.stringify({
        errors: [{ message: "SECRET-DETAIL", extensions: { code: "INTERNAL" } }],
      }),
    });

    await expect(gateway.account(TOKEN)).rejects.toMatchObject({ code: "BUFFER_FAILED" });
    expect(logs.join("\n")).not.toContain("SECRET");
  });

  it("never retries a failed write", async () => {
    const { gateway, send } = setup({ status: 503, body: "" });

    await expect(gateway.createPost(TOKEN, POST_INPUT)).rejects.toMatchObject({
      code: "BUFFER_FAILED",
    });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
