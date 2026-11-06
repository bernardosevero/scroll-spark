import { describe, expect, it, vi } from "vitest";

import type { Capture } from "../capture/schemas";
import { AppError } from "../errors/app-error";
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
}: { answer?: unknown; existingToday?: number; capture?: Capture; now?: Date } = {}) {
  const { analyses, rows } = createAnalyses(existingToday);
  const llm: LlmGateway = {
    model: "test-model",
    analyze: vi.fn(() => Promise.resolve(answer)),
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

  it("stops at the daily limit, before spending", async () => {
    const { service, llm } = setup({ existingToday: DAILY_ANALYSIS_LIMIT });

    await expect(service.analyze("user-1", input)).rejects.toMatchObject({
      code: "ANALYSIS_LIMIT_REACHED",
    });

    expect(llm.analyze).not.toHaveBeenCalled();
  });

  it("allows the last analysis of the day", async () => {
    const { service } = setup({ existingToday: DAILY_ANALYSIS_LIMIT - 1 });

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
    });

    await expect(service.analyze("user-1", input)).resolves.toMatchObject({
      analysis: { topic: "Side projects" },
    });
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
