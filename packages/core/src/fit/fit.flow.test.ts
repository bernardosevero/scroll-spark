import { describe, expect, it, vi } from "vitest";

import { AppError } from "../errors/app-error";
import { createBufferService } from "../buffer/buffer.service";
import type { BufferCache, QuotaStore } from "../buffer/buffer.service";
import type { BufferChannel, BufferIdea, BufferPost, QuotaWindow } from "../buffer/schemas";
import { MAX_POST_LENGTH, MIN_POST_LENGTH, cleanHistory, historyPostsOf } from "./clean-history";
import { describeChannelFit } from "./fit-copy";
import { createFitService } from "./fit.service";
import type { ChannelProfile, ProfileRepository } from "./fit.service";
import { llmFitAnswerSchema } from "./schemas";

const NOW = new Date("2026-11-06T12:00:00.000Z");
const DAY = 86_400_000;
const USER = "user-1";

function channel(id: string, name: string, extra: Partial<BufferChannel> = {}): BufferChannel {
  return { id, service: "linkedin", name, isLocked: false, isDisconnected: false, ...extra };
}

const LINKEDIN = channel("li", "LinkedIn");
const OLD_TIMES = channel("ot", "G(Old) Times", { service: "youtube" });

/** A post body long enough to count, whose topic is the text before the colon. */
function body(topic: string, n: number) {
  return `${topic}: note ${String(n)} from the studio about how this went and what we learned from it, step by step.`;
}

function sent(id: string, channelId: string, text: string, at: string): BufferPost {
  return { id, channelId, text, status: "sent", sentAt: at, dueAt: at };
}

function scheduled(id: string, channelId: string, text: string, at: string): BufferPost {
  return { id, channelId, text, status: "scheduled", sentAt: null, dueAt: at };
}

/** Five topics on LinkedIn. Three posts are about customers, the last on Sep 29. */
function linkedinPosts(): BufferPost[] {
  return [
    sent("li-c1", "li", body("customers", 1), "2026-09-29T14:00:00.000Z"),
    sent("li-c2", "li", body("customers", 2), "2026-08-12T14:00:00.000Z"),
    sent("li-c3", "li", body("customers", 3), "2026-06-03T14:00:00.000Z"),
    sent("li-a1", "li", body("ai tools", 1), "2026-10-20T14:00:00.000Z"),
    sent("li-a2", "li", body("ai tools", 2), "2026-10-02T14:00:00.000Z"),
    sent("li-h1", "li", body("hiring", 1), "2026-09-01T14:00:00.000Z"),
    sent("li-h2", "li", body("hiring", 2), "2026-07-01T14:00:00.000Z"),
    sent("li-l1", "li", body("launches", 1), "2026-05-01T14:00:00.000Z"),
    sent("li-l2", "li", body("launches", 2), "2026-04-01T14:00:00.000Z"),
    sent("li-o1", "li", body("travel", 1), "2026-03-01T14:00:00.000Z"),
  ];
}

/** Five topics about retro games, none about customers. */
function oldTimesPosts(): BufferPost[] {
  return ["cartridges", "consoles", "arcades", "handhelds", "magazines"].flatMap((topic, index) => [
    sent(`ot-${topic}-1`, "ot", body(topic, 1), `2026-10-${String(10 + index)}T10:00:00.000Z`),
    sent(`ot-${topic}-2`, "ot", body(topic, 2), `2026-09-${String(10 + index)}T10:00:00.000Z`),
  ]);
}

function window(used: number): QuotaWindow {
  return {
    windowSeconds: 900,
    quota: 100,
    remaining: 100 - used,
    resetsAt: new Date(NOW.getTime() + 3 * DAY).toISOString(),
  };
}

/** Groups posts by the text before the colon, which is how these tests say what a topic is. */
function topicProfile(input: { posts: { id: string; text: string }[] }) {
  const topics = new Map<string, string[]>();

  for (const post of input.posts) {
    const topic = post.text.split(":")[0] ?? "other";
    topics.set(topic, [...(topics.get(topic) ?? []), post.id]);
  }

  return {
    summaries: input.posts.map((post) => ({ postId: post.id, summary: `Summary of ${post.id}` })),
    clusters: [...topics].map(([name, postIds]) => ({ name, postIds })),
  };
}

interface SetupOptions {
  channels?: BufferChannel[];
  posts?: Record<string, BufferPost[]>;
  ideas?: BufferIdea[];
  startingQuota?: QuotaWindow[];
  defaultChannelIds?: string[];
  organizationId?: string | null;
}

function setup({
  channels = [LINKEDIN, OLD_TIMES],
  posts = { li: linkedinPosts(), ot: oldTimesPosts() },
  ideas = [],
  startingQuota = [],
  defaultChannelIds = [],
  organizationId = "org-1",
}: SetupOptions = {}) {
  let now = NOW;
  let quotaWindows = startingQuota;
  const entries = new Map<string, { body: unknown; fetchedAt: Date }>();
  const cache: BufferCache = {
    get: (userId, key) => Promise.resolve(entries.get(`${userId}|${key}`) ?? null),
    set(userId, key, value, fetchedAt) {
      entries.set(`${userId}|${key}`, { body: value, fetchedAt });
      return Promise.resolve();
    },
    clearPrefix: () => Promise.resolve(),
  };
  const quota: QuotaStore = {
    read: () => Promise.resolve(quotaWindows),
    record(next) {
      quotaWindows = next;
      return Promise.resolve();
    },
  };
  const gateway = {
    account: vi.fn(),
    channels: vi.fn(),
    posts: vi.fn((_token: string, query: { channelIds?: string[] }) =>
      Promise.resolve({
        data: {
          posts: posts[query.channelIds?.[0] ?? ""] ?? [],
          endCursor: null,
          hasNextPage: false,
        },
        quota: [window(1)],
      }),
    ),
    ideas: vi.fn(() => Promise.resolve({ data: ideas, quota: [window(1)] })),
    createIdea: vi.fn(),
    createPost: vi.fn(),
  };
  const buffer = createBufferService({
    gateway,
    auth: { getAccessToken: () => Promise.resolve("token") },
    cache,
    quota,
    clock: { now: () => now },
  });
  const stored = new Map<string, ChannelProfile>();
  const profiles: ProfileRepository = {
    find: (userId, channelId) => Promise.resolve(stored.get(`${userId}|${channelId}`) ?? null),
    save(userId, profile) {
      stored.set(`${userId}|${profile.channelId}`, profile);
      return Promise.resolve();
    },
  };
  const llm = {
    profile: vi.fn((input: { posts: { id: string; text: string }[] }) =>
      Promise.resolve(topicProfile(input)),
    ),
  };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const service = createFitService({
    buffer,
    channels: {
      historyChannels: () => Promise.resolve({ organizationId, channels, defaultChannelIds }),
    },
    profiles,
    llm,
    clock: { now: () => now },
    logger,
  });

  return {
    service,
    gateway,
    llm,
    logger,
    stored,
    setQuota: (next: QuotaWindow[]) => void (quotaWindows = next),
    advance: (ms: number) => void (now = new Date(now.getTime() + ms)),
  };
}

/** What a model might say. It's parsed the way the analysis service parses it. */
function modelSays(answer: unknown) {
  return llmFitAnswerSchema.parse(answer);
}

function match(channelId: string, extra: Record<string, unknown> = {}) {
  return { channelId, clusterId: null, newClusterName: null, matchingPostIds: [], ...extra };
}

describe("cleaning a channel's history", () => {
  it("ignores short posts, merges cross-posts and cuts text at 500 characters", () => {
    const long = `${"a".repeat(MAX_POST_LENGTH)} and more words after the cut`;
    const cleaned = cleanHistory(
      historyPostsOf([
        sent("short", "li", "Too short to say anything", "2026-10-01T10:00:00.000Z"),
        sent("edge", "li", "x".repeat(MIN_POST_LENGTH), "2026-10-02T10:00:00.000Z"),
        sent("a", "li", body("customers", 1), "2026-09-01T10:00:00.000Z"),
        sent(
          "b",
          "x",
          `${body("customers", 1).toUpperCase()} https://example.com/a`,
          "2026-09-05T10:00:00.000Z",
        ),
        scheduled("c", "li", body("customers", 1), "2026-12-01T10:00:00.000Z"),
        sent("long", "li", long, "2026-10-03T10:00:00.000Z"),
      ]),
    );

    expect(cleaned.map(({ id }) => id)).toEqual(["c", "long", "edge"]);
    expect(cleaned.find(({ id }) => id === "long")?.text).toHaveLength(MAX_POST_LENGTH);
    expect(cleaned.find(({ id }) => id === "edge")?.text).toHaveLength(MIN_POST_LENGTH);
    expect(cleaned.find(({ id }) => id === "short")).toBeUndefined();
  });

  it("keeps the real dates of a merged cross-post", () => {
    const [merged, ...rest] = cleanHistory(
      historyPostsOf([
        sent("a", "li", body("customers", 1), "2026-09-01T10:00:00.000Z"),
        sent("b", "x", body("customers", 1), "2026-09-05T10:00:00.000Z"),
        scheduled("c", "li", body("customers", 1), "2026-12-01T10:00:00.000Z"),
      ]),
    );

    expect(rest).toEqual([]);
    expect(merged).toMatchObject({
      id: "c",
      lastSentAt: "2026-09-05T10:00:00.000Z",
      scheduledAt: "2026-12-01T10:00:00.000Z",
      mergedPostIds: ["b", "a"],
    });
  });

  it("leaves out drafts, errors and posts with no text or no date", () => {
    const text = body("customers", 1);

    expect(
      historyPostsOf([
        { id: "d", channelId: "li", text, status: "draft", dueAt: "2026-10-01T10:00:00.000Z" },
        { id: "e", channelId: "li", text, status: "error", sentAt: "2026-10-01T10:00:00.000Z" },
        {
          id: "n",
          channelId: "li",
          text: null,
          status: "sent",
          sentAt: "2026-10-01T10:00:00.000Z",
        },
        { id: "u", channelId: "li", text, status: "sent" },
        { id: "ok", channelId: "li", text, status: "sent", sentAt: "2026-10-01T10:00:00.000Z" },
      ]).map(({ id }) => id),
    ).toEqual(["ok"]);
  });

  it("gives the profile model only cleaned text, newest first", async () => {
    const posts = [
      sent("short", "li", "Too short", "2026-10-01T10:00:00.000Z"),
      ...linkedinPosts(),
      sent("dup", "li", body("customers", 1), "2026-10-25T10:00:00.000Z"),
      sent("long", "li", `${"b".repeat(900)}`, "2026-10-26T10:00:00.000Z"),
    ];
    const { service, llm } = setup({ channels: [LINKEDIN], posts: { li: posts } });

    await service.prepare(USER);

    const sentToModel = llm.profile.mock.calls[0]?.[0].posts ?? [];
    expect(sentToModel.map(({ id }) => id)).not.toContain("short");
    expect(sentToModel.map(({ id }) => id)).not.toContain("li-c1");
    expect(sentToModel.map(({ id }) => id).slice(0, 2)).toEqual(["long", "dup"]);
    expect(Math.max(...sentToModel.map(({ text }) => text.length))).toBe(MAX_POST_LENGTH);
  });
});

describe("building channel profiles", () => {
  it("refreshes a profile at most once a day, and a second request spends nothing", async () => {
    const { service, gateway, llm, advance } = setup();

    await service.prepare(USER);
    expect(gateway.posts).toHaveBeenCalledTimes(2);
    expect(llm.profile).toHaveBeenCalledTimes(2);

    advance(23 * 60 * 60 * 1000);
    await service.prepare(USER);

    expect(gateway.posts).toHaveBeenCalledTimes(2);
    expect(llm.profile).toHaveBeenCalledTimes(2);

    advance(2 * 60 * 60 * 1000);
    await service.prepare(USER);

    expect(gateway.posts).toHaveBeenCalledTimes(4);
  });

  it("keeps the model's summaries when a refresh finds the same posts", async () => {
    const { service, llm, advance } = setup({ channels: [LINKEDIN] });
    await service.prepare(USER);

    advance(25 * 60 * 60 * 1000);
    await service.prepare(USER);

    expect(llm.profile).toHaveBeenCalledTimes(1);
  });

  it("asks the model again when a refresh finds a new post", async () => {
    const posts = { li: linkedinPosts() };
    const { service, llm, advance, gateway } = setup({ channels: [LINKEDIN], posts });
    await service.prepare(USER);

    posts.li = [sent("li-new", "li", body("ai tools", 3), "2026-11-05T09:00:00.000Z"), ...posts.li];
    gateway.posts.mockClear();
    advance(25 * 60 * 60 * 1000);
    await service.prepare(USER);

    expect(llm.profile).toHaveBeenCalledTimes(2);
  });

  it("asks Buffer for one bounded page of one channel at a time", async () => {
    const { service, gateway } = setup();

    await service.prepare(USER);

    expect(gateway.posts).toHaveBeenCalledWith("token", {
      organizationId: "org-1",
      channelIds: ["li"],
      first: 50,
    });
  });

  it("reads history from every channel it can read, and puts default channels first", async () => {
    const locked = channel("lk", "Locked", { isLocked: true });
    const gone = channel("gn", "Gone", { isDisconnected: true });
    const instagram = channel("ig", "Studio on Instagram", { service: "instagram" });
    const { service, gateway } = setup({
      channels: [LINKEDIN, locked, gone, instagram, OLD_TIMES],
      posts: { li: linkedinPosts(), ig: [], ot: oldTimesPosts() },
      defaultChannelIds: ["ot"],
    });

    const context = await service.prepare(USER);

    expect(gateway.posts.mock.calls.map(([, query]) => query.channelIds)).toEqual([
      ["ot"],
      ["li"],
      ["ig"],
    ]);
    expect(context.assessments?.map(({ channelId }) => channelId)).toEqual(["ot", "li", "ig"]);
  });

  it.each([
    ["too few", [{ name: "One", postIds: ["li-c1", "li-c2", "li-c3", "li-a1", "li-a2"] }]],
    [
      "too many",
      Array.from({ length: 9 }, (_, index) => ({
        name: `Group ${String(index)}`,
        postIds: [linkedinPosts()[index]?.id ?? ""],
      })),
    ],
  ])("fails cleanly when the model sends %s clusters", async (_label, clusters) => {
    const { service, llm, logger } = setup({ channels: [LINKEDIN] });
    llm.profile.mockResolvedValue({ summaries: [], clusters });

    const context = await service.prepare(USER);

    expect(context.assessments?.[0]).toMatchObject({ channelId: "li", state: "unavailable" });
    expect(context.prompt.channels).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith("fit.profile_failed", expect.any(Object));
  });

  it("accepts anything from five to eight clusters", async () => {
    const { service } = setup({ channels: [LINKEDIN] });

    const context = await service.prepare(USER);

    expect(context.prompt.channels[0]?.clusters).toHaveLength(5);
  });

  it("does not save a profile it could not build, so the next request tries again", async () => {
    const { service, llm, stored } = setup({ channels: [LINKEDIN] });
    llm.profile.mockRejectedValueOnce(new AppError("LLM_FAILED"));

    await service.prepare(USER);
    expect(stored.size).toBe(0);

    const second = await service.prepare(USER);

    expect(second.assessments?.[0]?.state).toBe("ready");
  });

  it("leaves out clusters and summaries for posts the model made up", async () => {
    const { service, llm } = setup({ channels: [LINKEDIN] });
    const real = topicProfile({
      posts: linkedinPosts().map(({ id, text }) => ({ id, text: text ?? "" })),
    });
    llm.profile.mockResolvedValue({
      summaries: [...real.summaries, { postId: "ghost", summary: "Invented" }],
      clusters: [...real.clusters, { name: "Ghosts", postIds: ["ghost"] }],
    });

    const context = await service.prepare(USER);

    expect(context.prompt.channels[0]?.clusters.map(({ name }) => name)).not.toContain("Ghosts");
    expect(context.prompt.channels[0]?.posts.map(({ id }) => id)).not.toContain("ghost");
  });

  it("uses the channel's own words for a post the model skipped", async () => {
    const { service, llm } = setup({ channels: [LINKEDIN] });
    const real = topicProfile({
      posts: linkedinPosts().map(({ id, text }) => ({ id, text: text ?? "" })),
    });
    llm.profile.mockResolvedValue({ ...real, summaries: real.summaries.slice(1) });

    const context = await service.prepare(USER);

    const post = context.prompt.channels[0]?.posts.find(({ id }) => id === "li-a1");
    expect(post?.summary.length).toBeGreaterThan(0);
  });

  it("sends the model history as data, inside nothing it can be talked out of", async () => {
    const { service, llm } = setup({ channels: [LINKEDIN] });
    await service.prepare(USER);

    expect(Object.keys(llm.profile.mock.calls[0]?.[0] ?? {}).sort()).toEqual([
      "channelName",
      "posts",
      "service",
    ]);
  });
});

describe("checking fit", () => {
  type Context = Awaited<ReturnType<ReturnType<typeof setup>["service"]["prepare"]>>;

  /** Cluster IDs are the service's to hand out, so a test reads them from what the model was sent. */
  function clusterIdOf(context: Context, channelId: string, name: string) {
    return context.prompt.channels
      .find((item) => item.channelId === channelId)
      ?.clusters.find((cluster) => cluster.name === name)?.id;
  }

  function fitsLinkedinNewOnOldTimes(context: Context) {
    return modelSays({
      channels: [
        match("li", {
          clusterId: clusterIdOf(context, "li", "customers"),
          matchingPostIds: ["li-c1", "li-c2", "li-c3"],
        }),
        match("ot", { newClusterName: "Customer stories" }),
      ],
      matchingIdeaIds: [],
    });
  }

  it("counts matching posts and finds the last date from our own rows", async () => {
    const { service } = setup();
    const context = await service.prepare(USER);

    const { channels } = service.resolve(context, fitsLinkedinNewOnOldTimes(context));

    expect(channels?.find(({ channelId }) => channelId === "li")).toMatchObject({
      state: "fits",
      clusterName: "customers",
      matchingPosts: 3,
      lastPostedAt: "2026-09-29T14:00:00.000Z",
      usablePosts: 10,
    });
  });

  it("ignores a count or date the model claims", async () => {
    const { service } = setup();
    const context = await service.prepare(USER);
    const lying = modelSays({
      channels: [
        match("li", {
          clusterId: clusterIdOf(context, "li", "customers"),
          matchingPostIds: ["li-c1", "li-c2"],
          matchingCount: 12,
          count: 12,
          lastPostedAt: "2026-11-05T00:00:00.000Z",
          lastDate: "2026-11-05",
        }),
      ],
      matchingIdeaIds: [],
      ideaCount: 40,
    });

    const { channels } = service.resolve(context, lying);

    const fit = channels?.find(({ channelId }) => channelId === "li");
    expect(fit?.matchingPosts).toBe(2);
    expect(fit?.lastPostedAt).toBe("2026-09-29T14:00:00.000Z");
    expect(JSON.stringify(channels)).not.toContain("2026-11-05");
  });

  it("drops post, cluster and channel IDs it does not know", async () => {
    const { service } = setup();
    const context = await service.prepare(USER);

    const { channels } = service.resolve(
      context,
      modelSays({
        channels: [
          match("li", {
            clusterId: "c99",
            matchingPostIds: ["li-c1", "invented-post", "li-c1", "ot-cartridges-1"],
          }),
          match("ghost-channel", { matchingPostIds: ["li-c1"] }),
        ],
        matchingIdeaIds: [],
      }),
    );

    expect(channels?.map(({ channelId }) => channelId)).toEqual(["li", "ot"]);
    expect(channels?.[0]).toMatchObject({
      state: "fits",
      matchingPosts: 1,
      lastPostedAt: "2026-09-29T14:00:00.000Z",
      clusterName: "customers",
    });
  });

  it("does not let a cluster alone make a fit", async () => {
    const { service } = setup();
    const context = await service.prepare(USER);

    const { channels } = service.resolve(
      context,
      modelSays({
        channels: [match("li", { clusterId: clusterIdOf(context, "li", "customers") })],
        matchingIdeaIds: [],
      }),
    );

    expect(channels?.[0]).toMatchObject({ state: "new", matchingPosts: 0 });
  });

  it("reads a new topic as new, with a suggested cluster name", async () => {
    const { service } = setup();
    const context = await service.prepare(USER);

    const { channels } = service.resolve(context, fitsLinkedinNewOnOldTimes(context));

    expect(channels?.find(({ channelId }) => channelId === "ot")).toMatchObject({
      state: "new",
      clusterName: "Customer stories",
      matchingPosts: 0,
      lastPostedAt: null,
      usablePosts: 10,
    });
  });

  it("judges channels separately: it fits one and is new on another", async () => {
    const { service } = setup();
    const context = await service.prepare(USER);

    const { channels } = service.resolve(context, fitsLinkedinNewOnOldTimes(context));

    expect(channels?.map(({ channelId, state }) => [channelId, state])).toEqual([
      ["li", "fits"],
      ["ot", "new"],
    ]);
  });

  it("says so honestly with fewer than 3 usable posts, and does not call the model", async () => {
    const { service, llm } = setup({
      channels: [LINKEDIN],
      posts: {
        li: [
          sent("a", "li", body("customers", 1), "2026-10-01T10:00:00.000Z"),
          sent("b", "li", body("customers", 2), "2026-10-02T10:00:00.000Z"),
          sent("short", "li", "Hi there", "2026-10-03T10:00:00.000Z"),
        ],
      },
    });

    const context = await service.prepare(USER);
    const { channels } = service.resolve(context, modelSays({ channels: [], matchingIdeaIds: [] }));

    expect(llm.profile).not.toHaveBeenCalled();
    expect(context.prompt.channels).toEqual([]);
    expect(channels?.[0]).toMatchObject({ state: "thin", usablePosts: 2, readPosts: 3 });
  });

  it("counts an idea as a duplicate only when it is one of the user's Ideas", async () => {
    const ideas: BufferIdea[] = [
      { id: "idea-1", title: "Customer stories", text: "What customers taught us" },
      { id: "idea-2", text: "Another one about customers" },
      { id: "idea-3", text: "Unrelated" },
    ];
    const { service } = setup({
      ideas,
      posts: {
        li: [
          ...linkedinPosts(),
          scheduled("li-q1", "li", body("customers", 9), "2026-11-20T14:00:00.000Z"),
        ],
        ot: oldTimesPosts(),
      },
    });
    const context = await service.prepare(USER);

    const { duplicates } = service.resolve(
      context,
      modelSays({
        channels: [match("li", { matchingPostIds: ["li-c1", "li-q1", "li-q1", "invented"] })],
        matchingIdeaIds: ["idea-1", "idea-2", "idea-2", "idea-404"],
      }),
    );

    expect(duplicates).toEqual({ ideas: 2, queuedPosts: 1 });
  });

  it("shows the next scheduled date from our rows, never one in the past", async () => {
    const { service } = setup({
      posts: {
        li: [
          ...linkedinPosts(),
          scheduled("li-q1", "li", body("customers", 9), "2026-11-20T14:00:00.000Z"),
          scheduled("li-q2", "li", body("customers", 8), "2026-10-01T14:00:00.000Z"),
        ],
        ot: [],
      },
    });
    const context = await service.prepare(USER);

    const { channels } = service.resolve(
      context,
      modelSays({
        channels: [match("li", { matchingPostIds: ["li-c1", "li-q1", "li-q2"] })],
        matchingIdeaIds: [],
      }),
    );

    expect(channels?.[0]).toMatchObject({
      matchingPosts: 3,
      lastPostedAt: "2026-09-29T14:00:00.000Z",
      nextScheduledAt: "2026-11-20T14:00:00.000Z",
    });
  });

  it("gives no verdict for a channel the model skipped", async () => {
    const { service } = setup();
    const context = await service.prepare(USER);

    const { channels } = service.resolve(
      context,
      modelSays({ channels: [match("li", { matchingPostIds: ["li-c1"] })], matchingIdeaIds: [] }),
    );

    expect(channels?.find(({ channelId }) => channelId === "ot")).toMatchObject({
      state: "unavailable",
    });
  });

  it("skips Ideas it could not read, and says the count is unknown", async () => {
    const { service, gateway } = setup();
    gateway.ideas.mockRejectedValue(new AppError("BUFFER_FAILED"));
    const context = await service.prepare(USER);

    const { duplicates } = service.resolve(
      context,
      modelSays({
        channels: [match("li", { matchingPostIds: ["li-c1"] })],
        matchingIdeaIds: ["idea-1"],
      }),
    );

    expect(duplicates).toEqual({ ideas: null, queuedPosts: 0 });
  });
});

describe("staying inside the Buffer quota", () => {
  it("uses cached posts and makes no new Buffer call near the quota", async () => {
    const { service, gateway, setQuota, advance, llm } = setup({ channels: [LINKEDIN] });
    await service.prepare(USER);
    expect(gateway.posts).toHaveBeenCalledTimes(1);

    advance(25 * 60 * 60 * 1000);
    setQuota([window(85)]);
    const context = await service.prepare(USER);

    expect(gateway.posts).toHaveBeenCalledTimes(1);
    expect(gateway.ideas).toHaveBeenCalledTimes(1);
    expect(llm.profile).toHaveBeenCalledTimes(1);
    expect(context.assessments?.[0]?.state).toBe("ready");
  });

  it("shows no fit for a channel when the quota is spent and nothing is cached", async () => {
    const { service, gateway } = setup({ startingQuota: [window(90)] });

    const context = await service.prepare(USER);

    expect(gateway.posts).not.toHaveBeenCalled();
    expect(context.assessments?.map(({ state }) => state)).toEqual(["unavailable", "unavailable"]);
  });

  it("keeps an older profile when a refresh cannot reach Buffer", async () => {
    const { service, gateway, advance } = setup({ channels: [LINKEDIN] });
    await service.prepare(USER);
    gateway.posts.mockRejectedValue(new AppError("BUFFER_FAILED"));

    advance(2 * DAY);
    const context = await service.prepare(USER);

    expect(context.assessments?.[0]).toMatchObject({ state: "ready", usablePosts: 10 });
  });

  it("lets one channel fail without losing the others", async () => {
    const { service, gateway } = setup();
    gateway.posts.mockImplementationOnce(() => Promise.reject(new AppError("BUFFER_FAILED")));

    const context = await service.prepare(USER);

    expect(context.assessments?.map(({ state }) => state).sort()).toEqual(["ready", "unavailable"]);
  });

  it("asks the user to reconnect instead of hiding an expired grant", async () => {
    const { service, gateway } = setup();
    gateway.posts.mockRejectedValue(new AppError("RECONNECT_REQUIRED"));

    await expect(service.prepare(USER)).rejects.toMatchObject({ code: "RECONNECT_REQUIRED" });
  });

  it("has nothing to check when no organization is chosen", async () => {
    const { service, gateway } = setup({ organizationId: null });

    const context = await service.prepare(USER);
    const result = service.resolve(context, modelSays({ channels: [], matchingIdeaIds: [] }));

    expect(gateway.posts).not.toHaveBeenCalled();
    expect(result).toEqual({ channels: null, duplicates: null });
  });
});

describe("the words of a fit", () => {
  const BASE = {
    channelId: "li",
    channelName: "LinkedIn",
    usablePosts: 10,
    readPosts: 10,
    clusterName: "AI tools",
    matchingPosts: 3,
    lastPostedAt: "2026-09-29T14:00:00.000Z",
    nextScheduledAt: null,
  } as const;
  const options = { now: NOW, timeZone: "UTC" };

  it.each([
    [
      { ...BASE, state: "fits" as const },
      { verdict: "fits", detail: "AI tools, 3 posts, last posted Sep 29" },
    ],
    [
      {
        ...BASE,
        state: "fits" as const,
        matchingPosts: 1,
        clusterName: null,
        nextScheduledAt: "2026-11-20T14:00:00.000Z",
      },
      { verdict: "fits", detail: "1 post, last posted Sep 29, next scheduled Nov 20" },
    ],
    [
      { ...BASE, state: "fits" as const, lastPostedAt: "2023-02-03T14:00:00.000Z" },
      { verdict: "fits", detail: "AI tools, 3 posts, last posted Feb 3, 2023" },
    ],
    [
      { ...BASE, state: "new" as const, matchingPosts: 0, lastPostedAt: null },
      { verdict: "new", detail: "None of your 10 posts here cover this. New group idea: AI tools" },
    ],
    [
      { ...BASE, state: "thin" as const, usablePosts: 2, readPosts: 2 },
      {
        verdict: "unclear",
        detail: "Only 2 posts on this channel so far, so we can't compare yet.",
      },
    ],
    [
      { ...BASE, state: "thin" as const, usablePosts: 0, readPosts: 0 },
      { verdict: "unclear", detail: "No posts on this channel yet, so we can't compare." },
    ],
    [
      { ...BASE, state: "unavailable" as const },
      {
        verdict: "unclear",
        detail: "We couldn't check this channel this time, so there's no fit for it yet.",
      },
    ],
  ])("words %#", (fit, expected) => {
    expect(describeChannelFit(fit, options)).toEqual({ channel: "LinkedIn", ...expected });
  });

  it("never predicts success", () => {
    const all = [
      { ...BASE, state: "fits" as const },
      { ...BASE, state: "new" as const, matchingPosts: 0, lastPostedAt: null },
      { ...BASE, state: "thin" as const },
      { ...BASE, state: "unavailable" as const },
    ].map((fit) => JSON.stringify(describeChannelFit(fit, options)));

    for (const words of all) {
      expect(words).not.toMatch(/will perform|likely|score|perform well|engagement/i);
    }
  });
});
