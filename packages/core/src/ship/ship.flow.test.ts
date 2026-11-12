import { describe, expect, it, vi } from "vitest";

import type { Analysis } from "../analysis/schemas";
import type { BufferService } from "../buffer/buffer.service";
import type { ChannelsView } from "../buffer/schemas";
import type { Capture } from "../capture/schemas";
import { AppError } from "../errors/app-error";
import { findOverlap } from "./overlap";
import { DAILY_DRAFT_LIMIT, createShipService } from "./ship.service";
import type { DraftWriter } from "./ship.service";

const NOW = new Date("2026-11-06T15:00:00.000Z");
const CAPTURE_ID = "00000000-0000-4000-8000-000000000001";
const USER = "user-1";

/** Distinctive on purpose, so a test can prove it never reaches the model. */
const SOURCE_TEXT =
  "Zanzibar quokkas negotiate marmalade contracts whenever lighthouse keepers yodel about turbines.";

const CAPTURE: Capture = {
  id: CAPTURE_ID,
  text: SOURCE_TEXT,
  sourceUrl: "https://example.com/article",
  platform: "web",
  sourceName: "A Site",
  createdAt: NOW.toISOString(),
};

const ANALYSIS: Analysis = {
  captureId: CAPTURE_ID,
  summary: "Small fixes can matter more than big features.",
  topic: "Listening to customers",
  angle: "The quiet customer who changed what you built",
  trendPhrases: ["customer feedback", "product market fit"],
  model: "test-model",
  channels: null,
  duplicates: null,
  createdAt: NOW.toISOString(),
};

function channel(
  id: string,
  service: string,
  extra: Partial<ChannelsView["channels"][number]> = {},
) {
  return {
    id,
    service,
    name: id,
    displayName: null,
    descriptor: null,
    avatar: null,
    timezone: null,
    isSupported: true,
    unsupportedReason: null,
    ...extra,
  };
}

const VIEW: ChannelsView = {
  organizationId: "org-1",
  defaultChannelIds: [],
  channels: [
    channel("ch-linkedin", "linkedin"),
    channel("ch-x", "twitter"),
    channel("ch-bluesky", "bluesky"),
    channel("ch-insta", "instagram", {
      isSupported: false,
      unsupportedReason: "Needs an image or video, which Scroll Spark doesn't add yet.",
    }),
  ],
};

function post(index: number, text: string, extra: Record<string, unknown> = {}) {
  return {
    id: `p-${String(index)}`,
    channelId: "ch-linkedin",
    text,
    status: "sent",
    sentAt: new Date(NOW.getTime() - index * 86_400_000).toISOString(),
    ...extra,
  };
}

const LONG = (label: string) =>
  `${label}: I spent a whole weekend rewriting onboarding and the only thing that moved the needle was a one line email that asked people what stopped them.`;

function setup({
  posts = Array.from({ length: 10 }, (_, index) => post(index, LONG(`Post ${String(index)}`))),
  view = VIEW,
  captureIsOwned = true,
  hasAnalysis = true,
  usedToday = 0,
  draftText = "Last month a customer replied with one sentence. It changed my roadmap.",
}: {
  posts?: ReturnType<typeof post>[];
  view?: ChannelsView;
  captureIsOwned?: boolean;
  hasAnalysis?: boolean;
  usedToday?: number;
  draftText?: string;
} = {}) {
  let savedIdea: string | null = null;
  let runs = usedToday;
  const buffer = {
    createIdea: vi.fn(() => Promise.resolve({ id: "idea-1" })),
    createPost: vi.fn((_userId: string, { channelId }: { channelId: string }) =>
      Promise.resolve({ id: "post-1", channelId, status: "draft" }),
    ),
    posts: vi.fn(() => Promise.resolve({ posts, endCursor: null, hasNextPage: false })),
  } satisfies Pick<BufferService, "createIdea" | "createPost" | "posts">;
  const writer: DraftWriter = {
    model: "test-writer",
    write: vi.fn(() => Promise.resolve({ text: draftText })),
  };
  const service = createShipService({
    captures: {
      findOwned: (userId, id) =>
        Promise.resolve(captureIsOwned && userId === USER && id === CAPTURE_ID ? CAPTURE : null),
    },
    analyses: { find: () => Promise.resolve(hasAnalysis ? ANALYSIS : null) },
    settings: { getTrendsGeo: () => Promise.resolve("BR") },
    ideas: {
      find: () => Promise.resolve(savedIdea),
      save(_userId, _captureId, ideaId) {
        savedIdea ??= ideaId;
        return Promise.resolve(savedIdea);
      },
    },
    runs: {
      countSince: () => Promise.resolve(runs),
      record() {
        runs += 1;
        return Promise.resolve();
      },
    },
    buffer,
    channels: { channels: () => Promise.resolve(view) },
    writer,
    clock: { now: () => NOW },
  });

  return { service, buffer, writer };
}

const idea = { captureId: CAPTURE_ID };
const draftInput = { captureId: CAPTURE_ID, channelId: "ch-linkedin", language: "same" } as const;
const postInput = {
  captureId: CAPTURE_ID,
  channelId: "ch-linkedin",
  text: "A short post.",
  kind: "draft",
} as const;

describe("saving an idea", () => {
  it("creates one Idea with the topic, summary, angle and links, and no tags", async () => {
    const { service, buffer } = setup();

    await expect(service.saveAsIdea(USER, idea)).resolves.toEqual({
      ideaId: "idea-1",
      isNew: true,
    });

    expect(buffer.createIdea).toHaveBeenCalledTimes(1);
    const [userId, input] = buffer.createIdea.mock.calls[0] as unknown as [
      string,
      { organizationId: string; title?: string; text: string },
    ];
    expect(userId).toBe(USER);
    expect(input.organizationId).toBe("org-1");
    expect(input.title).toBe("Listening to customers");
    expect(input.text).toContain("Topic: Listening to customers");
    expect(input.text).toContain("Summary: Small fixes can matter more than big features.");
    expect(input.text).toContain("Angle: The quiet customer who changed what you built");
    expect(input.text).toContain("Source: https://example.com/article");
    expect(input.text).toContain("trends.google.com");
    expect(input.text).toContain("geo=BR");
    expect(input).not.toHaveProperty("tags");
  });

  it("makes no second idea when saving again", async () => {
    const { service, buffer } = setup();

    await service.saveAsIdea(USER, idea);
    await expect(service.saveAsIdea(USER, idea)).resolves.toEqual({
      ideaId: "idea-1",
      isNew: false,
    });

    expect(buffer.createIdea).toHaveBeenCalledTimes(1);
  });

  it("makes one idea when two clicks arrive together", async () => {
    const { service, buffer } = setup();

    const [first, second] = await Promise.all([
      service.saveAsIdea(USER, idea),
      service.saveAsIdea(USER, idea),
    ]);

    expect(first.ideaId).toBe(second.ideaId);
    expect(buffer.createIdea).toHaveBeenCalledTimes(1);
  });

  it("needs an analysis and a chosen organization first", async () => {
    await expect(
      setup({ hasAnalysis: false }).service.saveAsIdea(USER, idea),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(
      setup({ view: { ...VIEW, organizationId: null } }).service.saveAsIdea(USER, idea),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("treats someone else's capture as missing", async () => {
    const { service, buffer } = setup({ captureIsOwned: false });

    await expect(service.saveAsIdea(USER, idea)).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(buffer.createIdea).not.toHaveBeenCalled();
  });

  it("passes on a plan limit as BUFFER_LIMIT_REACHED, and saves nothing", async () => {
    const { service, buffer } = setup();
    buffer.createIdea.mockRejectedValueOnce(new AppError("BUFFER_LIMIT_REACHED"));

    await expect(service.saveAsIdea(USER, idea)).rejects.toMatchObject({
      code: "BUFFER_LIMIT_REACHED",
    });

    await expect(service.ideaOf(USER, idea)).resolves.toEqual({ ideaId: null });
  });
});

describe("drafting in your voice", () => {
  it("gives the model the angle, summary and voice samples, and never the source text", async () => {
    const { service, writer } = setup();

    await service.draft(USER, draftInput);

    const brief = vi.mocked(writer.write).mock.calls[0]?.[0];
    expect(brief).toMatchObject({
      angle: ANALYSIS.angle,
      summary: ANALYSIS.summary,
      topic: ANALYSIS.topic,
      service: "linkedin",
    });
    expect(brief?.voiceSamples.length).toBeGreaterThan(0);

    const everything = JSON.stringify(vi.mocked(writer.write).mock.calls);
    expect(everything).not.toContain("Zanzibar");
    expect(everything).not.toContain(SOURCE_TEXT);
    expect(everything).not.toContain("example.com");
  });

  it("uses at most 8 posts, newest first, ignoring short ones and cutting long ones", async () => {
    const posts = [
      post(0, "Too short to show a voice."),
      ...Array.from({ length: 12 }, (_, index) =>
        post(index + 1, LONG(`Post ${String(index + 1)}`)),
      ),
      post(20, "x".repeat(900)),
    ];
    const { service, writer } = setup({ posts: posts.reverse() });

    const result = await service.draft(USER, draftInput);

    const { voiceSamples } = vi.mocked(writer.write).mock.calls[0]?.[0] ?? { voiceSamples: [] };
    expect(voiceSamples).toHaveLength(8);
    expect(voiceSamples[0]).toContain("Post 1:");
    expect(voiceSamples.every((sample) => sample.length <= 500)).toBe(true);
    expect(voiceSamples).not.toContain("Too short to show a voice.");
    expect(result.voice).toEqual({ sampleCount: 8, isMatched: true });
  });

  it("says so, and sends no samples, when fewer than 3 posts are usable", async () => {
    const { service, writer } = setup({
      posts: [post(1, LONG("One")), post(2, LONG("Two")), post(3, "short")],
    });

    const result = await service.draft(USER, draftInput);

    expect(result.voice).toEqual({ sampleCount: 2, isMatched: false });
    expect(vi.mocked(writer.write).mock.calls[0]?.[0].voiceSamples).toEqual([]);
  });

  it("only counts sent posts as the user's voice", async () => {
    const { service } = setup({
      posts: Array.from({ length: 5 }, (_, index) =>
        post(index, LONG("Queued"), { status: "scheduled", sentAt: null }),
      ),
    });

    await expect(service.draft(USER, draftInput)).resolves.toMatchObject({
      voice: { sampleCount: 0, isMatched: false },
    });
  });

  it("defaults to the language of the channel's posts, and writes in another only when asked", async () => {
    const { service, writer } = setup();

    await service.draft(USER, draftInput);
    await service.draft(USER, { ...draftInput, language: "portuguese" });

    expect(vi.mocked(writer.write).mock.calls[0]?.[0].language).toBeNull();
    expect(vi.mocked(writer.write).mock.calls[1]?.[0].language).toBe("Portuguese");
  });

  it("warns when the draft closely overlaps the source, and not when it is original", async () => {
    const copied = setup({ draftText: `Honestly: ${SOURCE_TEXT.toLowerCase()}` });
    const original = setup();

    await expect(copied.service.draft(USER, draftInput)).resolves.toMatchObject({
      overlap: { isClose: true },
    });
    await expect(original.service.draft(USER, draftInput)).resolves.toMatchObject({
      overlap: { isClose: false },
    });
  });

  it("compares locally, so the overlap check needs nothing but the two texts", () => {
    expect(findOverlap(SOURCE_TEXT, SOURCE_TEXT).isClose).toBe(true);
    expect(
      findOverlap("Totally different words about gardens and slow mornings.", SOURCE_TEXT),
    ).toEqual({ isClose: false, share: 0 });
    expect(findOverlap("Too short", "Too short")).toEqual({ isClose: false, share: 0 });
  });

  it.each([
    ["an unsupported channel", "ch-insta", "CHANNEL_NOT_SUPPORTED"],
    ["an unknown channel", "ch-nope", "INVALID_INPUT"],
  ])("refuses %s before spending anything", async (_name, channelId, code) => {
    const { service, writer } = setup();

    await expect(service.draft(USER, { ...draftInput, channelId })).rejects.toMatchObject({ code });

    expect(writer.write).not.toHaveBeenCalled();
  });

  it("stops at the daily limit, before spending", async () => {
    const { service, writer } = setup({ usedToday: DAILY_DRAFT_LIMIT });

    await expect(service.draft(USER, draftInput)).rejects.toMatchObject({
      code: "DRAFT_LIMIT_REACHED",
    });

    expect(writer.write).not.toHaveBeenCalled();
  });

  it("keeps the capture when the model refuses, and counts the attempt", async () => {
    const { service, writer, buffer } = setup();
    vi.mocked(writer.write).mockRejectedValueOnce(new AppError("LLM_REFUSED"));

    await expect(service.draft(USER, draftInput)).rejects.toMatchObject({ code: "LLM_REFUSED" });

    expect(buffer.createPost).not.toHaveBeenCalled();
    await expect(service.ideaOf(USER, idea)).resolves.toEqual({ ideaId: null });
  });

  it.each([
    ["nothing", {}],
    ["empty text", { text: "   " }],
    ["a string", "Sure! Here you go."],
  ])("fails clearly when the model returns %s", async (_name, answer) => {
    const { service, writer } = setup();
    vi.mocked(writer.write).mockResolvedValueOnce(answer);

    await expect(service.draft(USER, draftInput)).rejects.toMatchObject({ code: "LLM_FAILED" });
  });
});

describe("writing it with your own assistant", () => {
  it("builds a prompt from the angle, summary and voice samples, and never the source text", async () => {
    const { service } = setup();

    const { prompt } = await service.assistantPrompt(USER, draftInput);

    expect(prompt).toContain(ANALYSIS.angle);
    expect(prompt).toContain(ANALYSIS.summary);
    expect(prompt).toContain("Post 0: I spent a whole weekend");
    expect(prompt).toContain("3,000 characters");
    expect(prompt).not.toContain(SOURCE_TEXT);
    expect(prompt).not.toContain("Zanzibar");
  });

  it("costs nothing: no model call, and it still works past the daily draft limit", async () => {
    const { service, writer } = setup({ usedToday: DAILY_DRAFT_LIMIT });

    await expect(service.assistantPrompt(USER, draftInput)).resolves.toHaveProperty("prompt");

    expect(writer.write).not.toHaveBeenCalled();
  });

  it("asks for a plain voice when there are too few posts to match", async () => {
    const { service } = setup({ posts: [post(0, LONG("Only one"))] });

    const { prompt } = await service.assistantPrompt(USER, draftInput);

    expect(prompt).toContain("plain, warm voice");
    expect(prompt).not.toContain("Only one");
  });

  it("writes in the language asked for", async () => {
    const { service } = setup();

    const { prompt } = await service.assistantPrompt(USER, {
      ...draftInput,
      language: "portuguese",
    });

    expect(prompt).toContain("Write it in Portuguese.");
  });

  it("treats someone else's capture as missing", async () => {
    const { service } = setup({ captureIsOwned: false });

    await expect(service.assistantPrompt(USER, draftInput)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("creating a post", () => {
  it("Save as draft passes saveToDraft and the idea's ID", async () => {
    const { service, buffer } = setup();
    await service.saveAsIdea(USER, idea);

    await expect(service.createPost(USER, postInput)).resolves.toMatchObject({
      postId: "post-1",
      kind: "draft",
    });

    expect(buffer.createPost).toHaveBeenCalledWith(USER, {
      organizationId: "org-1",
      channelId: "ch-linkedin",
      text: "A short post.",
      ideaId: "idea-1",
      mode: "addToQueue",
      saveToDraft: true,
    });
  });

  it("Add to queue passes addToQueue and the idea's ID, and does not save to draft", async () => {
    const { service, buffer } = setup();
    await service.saveAsIdea(USER, idea);

    await service.createPost(USER, { ...postInput, kind: "queue" });

    expect(buffer.createPost).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ mode: "addToQueue", ideaId: "idea-1", saveToDraft: false }),
    );
  });

  it("works without an idea, leaving the idea out", async () => {
    const { service, buffer } = setup();

    await service.createPost(USER, postInput);

    expect(buffer.createPost.mock.calls[0]?.[1]).not.toHaveProperty("ideaId");
  });

  it("never retries a failed post, and passes the failure on", async () => {
    const { service, buffer } = setup();
    buffer.createPost.mockRejectedValue(new AppError("BUFFER_FAILED"));

    await expect(service.createPost(USER, { ...postInput, kind: "queue" })).rejects.toMatchObject({
      code: "BUFFER_FAILED",
    });

    expect(buffer.createPost).toHaveBeenCalledTimes(1);
  });

  it("sends one post when the same request arrives twice together", async () => {
    const { service, buffer } = setup();

    await Promise.all([service.createPost(USER, postInput), service.createPost(USER, postInput)]);

    expect(buffer.createPost).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["linkedin", "ch-linkedin", 3000],
    ["X", "ch-x", 280],
    ["Bluesky", "ch-bluesky", 300],
  ])(
    "refuses text over %s's limit, and allows exactly the limit",
    async (_name, channelId, limit) => {
      const { service, buffer } = setup();

      await expect(
        service.createPost(USER, { ...postInput, channelId, text: "a".repeat(limit + 1) }),
      ).rejects.toMatchObject({ code: "POST_TOO_LONG" });
      expect(buffer.createPost).not.toHaveBeenCalled();

      await expect(
        service.createPost(USER, { ...postInput, channelId, text: "a".repeat(limit) }),
      ).resolves.toBeTruthy();
    },
  );

  it("counts an emoji as one character, as the platforms do", async () => {
    const { service } = setup();

    await expect(
      service.createPost(USER, { ...postInput, channelId: "ch-x", text: "👩‍👩‍👧‍👦".repeat(280) }),
    ).resolves.toBeTruthy();
  });

  it("refuses an unsupported channel, and a blank post", async () => {
    const { service, buffer } = setup();

    await expect(
      service.createPost(USER, { ...postInput, channelId: "ch-insta" }),
    ).rejects.toMatchObject({ code: "CHANNEL_NOT_SUPPORTED" });
    await expect(service.createPost(USER, { ...postInput, text: "   " })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });

    expect(buffer.createPost).not.toHaveBeenCalled();
  });

  it("passes on a plan limit as BUFFER_LIMIT_REACHED", async () => {
    const { service, buffer } = setup();
    buffer.createPost.mockRejectedValueOnce(new AppError("BUFFER_LIMIT_REACHED"));

    await expect(service.createPost(USER, postInput)).rejects.toMatchObject({
      code: "BUFFER_LIMIT_REACHED",
    });
  });

  it("treats someone else's capture as missing", async () => {
    const { service, buffer } = setup({ captureIsOwned: false });

    await expect(service.createPost(USER, postInput)).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(buffer.createPost).not.toHaveBeenCalled();
  });
});
