import { describe, expect, it, vi } from "vitest";

import type { Capture } from "../capture/schemas";
import { AppError } from "../errors/app-error";
import { createFitService } from "../fit/fit.service";
import type { ChannelProfile, FitService } from "../fit/fit.service";
import { DAILY_ANALYSIS_LIMIT, createAnalysisService } from "./analysis.service";
import type { AnalysisRepository, LlmGateway } from "./analysis.service";
import type { Analysis } from "./schemas";

const NOW = new Date("2026-11-06T15:00:00.000Z");
const CAPTURE_ID = "00000000-0000-4000-8000-000000000001";

const CAPTURE: Capture = {
  id: CAPTURE_ID,
  text: "A post about finishing side projects.",
  sourceUrl: null,
  platform: "pasted",
  sourceName: null,
  createdAt: NOW.toISOString(),
};

const ANSWER = {
  summary: "Finishing beats starting.",
  topic: "Side projects",
  angle: "What your last unfinished project taught you",
  trendPhrases: ["side projects", "build in public"],
  channels: [],
  matchingIdeaIds: [],
};

/** A fit check that has nothing to check, for tests that are about something else. */
const NO_FIT: FitService = {
  prepare: () =>
    Promise.resolve({ assessments: null, ideas: null, prompt: { channels: [], ideas: [] } }),
  resolve: () => ({ channels: null, duplicates: null }),
};

function createAnalyses(existingToday = 0) {
  const rows = new Map<string, Analysis>();
  const analyses: AnalysisRepository = {
    find: (captureId) => Promise.resolve(rows.get(captureId) ?? null),
    countSince: () => Promise.resolve(existingToday + rows.size),
    save(_userId, analysis) {
      rows.set(analysis.captureId, analysis);
      return Promise.resolve(analysis);
    },
  };
  return { analyses, rows };
}

function setup({
  answer = ANSWER,
  existingToday = 0,
  capture = CAPTURE,
  now = NOW,
  fit = NO_FIT,
}: {
  answer?: unknown;
  existingToday?: number;
  capture?: Capture;
  now?: Date;
  fit?: FitService;
} = {}) {
  const { analyses, rows } = createAnalyses(existingToday);
  const llm: LlmGateway = {
    model: "test-model",
    analyze: vi.fn(() => Promise.resolve(answer)),
    profile: vi.fn(() => Promise.reject(new Error("Not under test"))),
  };
  const countSince = vi.spyOn(analyses, "countSince");
  const geos = new Map<string, string>();
  const service = createAnalysisService({
    llm,
    analyses,
    captures: {
      findOwned: (userId, id) =>
        Promise.resolve(userId === "user-1" && id === capture.id ? capture : null),
    },
    settings: {
      getTrendsGeo: (userId) => Promise.resolve(geos.get(userId) ?? null),
      setTrendsGeo(userId, geo) {
        geos.set(userId, geo);
        return Promise.resolve();
      },
    },
    fit,
    clock: { now: () => now },
  });

  return { service, llm, rows, countSince };
}

const input = { captureId: CAPTURE_ID };

describe("finding the spark", () => {
  it("analyzes a capture, saves the result and links Google Trends", async () => {
    const { service, llm, rows } = setup();

    const { analysis } = await service.analyze("user-1", input);

    expect(analysis).toMatchObject({
      captureId: CAPTURE_ID,
      topic: "Side projects",
      model: "test-model",
      createdAt: NOW.toISOString(),
    });
    expect(analysis?.trends.links.map(({ phrase }) => phrase)).toEqual([
      "side projects",
      "build in public",
    ]);
    expect(analysis?.trends.compareUrl).toContain("q=side%20projects,build%20in%20public");
    expect(rows.has(CAPTURE_ID)).toBe(true);
    expect(llm.analyze).toHaveBeenCalledWith({
      text: CAPTURE.text,
      platform: "pasted",
      sourceName: null,
      channels: [],
      ideas: [],
    });
  });

  it("spends nothing the second time", async () => {
    const { service, llm } = setup();

    const first = await service.analyze("user-1", input);
    const second = await service.analyze("user-1", input);

    expect(second).toEqual(first);
    expect(llm.analyze).toHaveBeenCalledTimes(1);
  });

  it("keeps the capture and saves nothing when the model refuses", async () => {
    const { service, llm, rows } = setup();
    vi.mocked(llm.analyze).mockRejectedValue(new AppError("LLM_REFUSED"));

    await expect(service.analyze("user-1", input)).rejects.toMatchObject({ code: "LLM_REFUSED" });

    expect(rows.size).toBe(0);
    await expect(service.get("user-1", input)).resolves.toMatchObject({
      capture: { id: CAPTURE_ID },
      analysis: null,
    });
  });

  it.each([
    ["a missing field", { topic: "x" }],
    ["an empty topic", { ...ANSWER, topic: "  " }],
    ["no phrases", { ...ANSWER, trendPhrases: [] }],
    ["too many phrases", { ...ANSWER, trendPhrases: ["a", "b", "c", "d"] }],
    ["no channels", { ...ANSWER, channels: undefined }],
    ["something else entirely", "Sure! Here you go."],
  ])("saves nothing when the model returns %s", async (_case, answer) => {
    const { service, rows } = setup({ answer });

    await expect(service.analyze("user-1", input)).rejects.toMatchObject({ code: "LLM_FAILED" });

    expect(rows.size).toBe(0);
  });

  it.each([
    ["analyze", "analyze"],
    ["get", "get"],
  ] as const)("treats someone else's capture as missing on %s", async (_name, method) => {
    const { service, llm } = setup();

    await expect(service[method]("user-2", input)).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(llm.analyze).not.toHaveBeenCalled();
  });

  it("stops at 10 analyses a day, before spending", async () => {
    const { service, llm } = setup({ existingToday: 10 });

    await expect(service.analyze("user-1", input)).rejects.toMatchObject({
      code: "ANALYSIS_LIMIT_REACHED",
    });

    expect(llm.analyze).not.toHaveBeenCalled();
  });

  it("allows the last analysis of the day", async () => {
    const { service } = setup({ existingToday: 9 });

    await expect(service.analyze("user-1", input)).resolves.toBeTruthy();
  });

  it("counts the day from midnight UTC", async () => {
    const { service, countSince } = setup();

    await service.analyze("user-1", input);

    expect(countSince).toHaveBeenCalledWith("user-1", new Date("2026-11-06T00:00:00.000Z"));
  });

  it("still returns a saved analysis once the limit is reached", async () => {
    const { service, rows } = setup({ existingToday: DAILY_ANALYSIS_LIMIT });
    rows.set(CAPTURE_ID, {
      ...ANSWER,
      captureId: CAPTURE_ID,
      model: "test-model",
      createdAt: NOW.toISOString(),
      channels: null,
      duplicates: null,
    });

    await expect(service.analyze("user-1", input)).resolves.toMatchObject({
      analysis: { topic: "Side projects" },
    });
  });
});

describe("the fit check inside an analysis", () => {
  const LINKEDIN = {
    id: "li",
    service: "linkedin",
    name: "LinkedIn",
    isLocked: false,
    isDisconnected: false,
  };
  const topics = ["customers", "ai tools", "hiring", "launches", "travel"];
  const history = topics.flatMap((topic, topicIndex) =>
    [1, 2].map((n) => ({
      id: `li-${topic.replace(" ", "-")}-${String(n)}`,
      channelId: "li",
      text: `${topic}: note ${String(n)} from the studio about how this went and what we learned, step by step.`,
      status: "sent",
      sentAt: `2026-0${String(topicIndex + 3)}-1${String(n)}T10:00:00.000Z`,
      dueAt: null,
    })),
  );

  function withFit({ analyzeAnswer = {}, failProfile = false } = {}) {
    const stored = new Map<string, ChannelProfile>();
    const profile = vi.fn((input: { posts: { id: string; text: string }[] }) =>
      failProfile
        ? Promise.reject(new AppError("LLM_FAILED"))
        : Promise.resolve({
            summaries: input.posts.map(({ id, text }) => ({
              postId: id,
              summary: `About ${text.split(":")[0] ?? ""}`,
            })),
            clusters: topics.map((name) => ({
              name,
              postIds: input.posts.filter(({ text }) => text.startsWith(name)).map(({ id }) => id),
            })),
          }),
    );
    const fit = createFitService({
      buffer: {
        posts: () => Promise.resolve({ posts: history, endCursor: null, hasNextPage: false }),
        ideas: () => Promise.resolve([{ id: "idea-1", text: "Customer notes" }]),
      },
      channels: {
        historyChannels: () =>
          Promise.resolve({ organizationId: "org-1", channels: [LINKEDIN], defaultChannelIds: [] }),
      },
      profiles: {
        find: (_userId, channelId) => Promise.resolve(stored.get(channelId) ?? null),
        save(_userId, saved) {
          stored.set(saved.channelId, saved);
          return Promise.resolve();
        },
      },
      llm: { profile },
      clock: { now: () => NOW },
    });
    const base = setup({ fit });
    vi.mocked(base.llm.analyze).mockImplementation((request) => {
      const customers =
        request.channels[0]?.posts.filter(({ summary }) => summary.includes("customers")) ?? [];

      return Promise.resolve({
        ...ANSWER,
        channels: [
          {
            channelId: "li",
            clusterId: null,
            newClusterName: null,
            matchingPostIds: customers.map(({ id }) => id),
          },
        ],
        matchingIdeaIds: ["idea-1"],
        ...analyzeAnswer,
      });
    });

    return { ...base, profile };
  }

  it("shows counts and dates from our rows, saved with the analysis", async () => {
    const { service, rows } = withFit();

    const { analysis } = await service.analyze("user-1", input);

    expect(analysis?.channels).toEqual([
      expect.objectContaining({
        channelId: "li",
        state: "fits",
        matchingPosts: 2,
        clusterName: "customers",
        lastPostedAt: "2026-03-12T10:00:00.000Z",
      }),
    ]);
    expect(analysis?.duplicates).toEqual({ ideas: 1, queuedPosts: 0 });
    expect(rows.get(CAPTURE_ID)?.channels).toEqual(analysis?.channels);
  });

  it("gives the model summaries and cluster names, never dates or counts", async () => {
    const { service, llm } = withFit();

    await service.analyze("user-1", input);

    const request = vi.mocked(llm.analyze).mock.calls[0]?.[0];
    expect(request?.channels[0]?.clusters).toContainEqual({ id: "c1", name: "customers" });
    expect(JSON.stringify(request?.channels)).not.toMatch(/2026|count/i);
    expect(request?.ideas).toEqual([{ id: "idea-1", text: "Customer notes" }]);
  });

  it("cannot be made to show a number the model invented", async () => {
    const { service } = withFit({
      analyzeAnswer: {
        channels: [
          {
            channelId: "li",
            clusterId: "c99",
            newClusterName: null,
            matchingPostIds: ["li-customers-1", "made-up-1", "made-up-2", "made-up-3"],
            matchingCount: 4,
            lastPostedAt: "2026-11-05T00:00:00.000Z",
          },
        ],
        matchingIdeaIds: ["idea-1", "made-up-idea"],
      },
    });

    const { analysis } = await service.analyze("user-1", input);

    expect(analysis?.channels?.[0]).toMatchObject({
      matchingPosts: 1,
      lastPostedAt: "2026-03-11T10:00:00.000Z",
    });
    expect(JSON.stringify(analysis)).not.toContain("2026-11-05");
    expect(analysis?.duplicates?.ideas).toBe(1);
  });

  it("spends nothing the second time, and builds a profile only once", async () => {
    const { service, llm, profile } = withFit();

    await service.analyze("user-1", input);
    await service.analyze("user-1", input);

    expect(llm.analyze).toHaveBeenCalledTimes(1);
    expect(profile).toHaveBeenCalledTimes(1);
  });

  it("still gives the analysis when a profile can't be built", async () => {
    const { service } = withFit({ failProfile: true });

    const { analysis } = await service.analyze("user-1", input);

    expect(analysis?.topic).toBe("Side projects");
    expect(analysis?.channels).toEqual([expect.objectContaining({ state: "unavailable" })]);
  });

  it("reads an analysis saved before the fit check as having no fit yet", async () => {
    const { service, rows } = setup();
    rows.set(CAPTURE_ID, {
      summary: ANSWER.summary,
      topic: ANSWER.topic,
      angle: ANSWER.angle,
      trendPhrases: ANSWER.trendPhrases,
      captureId: CAPTURE_ID,
      model: "test-model",
      createdAt: NOW.toISOString(),
      channels: null,
      duplicates: null,
    });

    const { analysis } = await service.get("user-1", input);

    expect(analysis).toMatchObject({ topic: "Side projects", channels: null, duplicates: null });
  });

  it("stops before asking the model when Buffer needs reconnecting", async () => {
    const reconnect: FitService = {
      ...NO_FIT,
      prepare: () => Promise.reject(new AppError("RECONNECT_REQUIRED")),
    };
    const { service, llm, rows } = setup({ fit: reconnect });

    await expect(service.analyze("user-1", input)).rejects.toMatchObject({
      code: "RECONNECT_REQUIRED",
    });

    expect(llm.analyze).not.toHaveBeenCalled();
    expect(rows.size).toBe(0);
  });
});

describe("the country for Trends", () => {
  it("defaults to the US, and follows the user's choice", async () => {
    const { service } = setup();
    const before = await service.analyze("user-1", input);

    expect(before.trendsGeo).toBe("US");
    expect(before.analysis?.trends.links[0]?.url).toContain("&geo=US");

    await service.setTrendsGeo("user-1", { geo: "BR" });
    const after = await service.get("user-1", input);

    expect(after.trendsGeo).toBe("BR");
    expect(after.analysis?.trends.links[0]?.url).toContain("&geo=BR");
  });

  it("searches YouTube for a YouTube capture", async () => {
    const { service } = setup({
      capture: { ...CAPTURE, platform: "youtube", sourceUrl: "https://youtu.be/a" },
    });

    const { analysis } = await service.analyze("user-1", input);

    expect(analysis?.trends.links[0]?.url).toContain("&gprop=youtube");
  });
});
