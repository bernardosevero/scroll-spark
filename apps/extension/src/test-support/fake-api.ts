import { vi } from "vitest";

/** One call the panel made, in the order it made them. */
interface Call {
  procedure: string;
  authorization: string | null;
  input: unknown;
}

/** A result, a failure with its code, or a function of the call's input giving one. */
export type Answer = unknown;

const CAPTURE = {
  id: "capture-1",
  text: "Consistency beats talent.",
  sourceUrl: null,
  platform: "pasted",
  sourceName: null,
  createdAt: "2026-11-06T12:00:00.000Z",
};

export const ANALYSIS = {
  capture: CAPTURE,
  trendsGeo: "US",
  analysis: {
    captureId: "capture-1",
    model: "fake",
    createdAt: "2026-11-06T12:00:01.000Z",
    topic: "Habits",
    angle: "Show the boring week behind your last win",
    summary: "Small repeated work beats a burst of talent.",
    trendPhrases: ["habits"],
    channels: [
      {
        channelId: "li",
        channelName: "Example Studio",
        state: "fits",
        usablePosts: 8,
        readPosts: 9,
        clusterName: "Habits",
        matchingPosts: 3,
        lastPostedAt: "2026-10-02T09:00:00.000Z",
        nextScheduledAt: null,
      },
    ],
    duplicates: { ideas: 1, queuedPosts: 0 },
    trends: {
      links: [{ phrase: "habits", url: "https://trends.google.com/trends/explore?q=habits" }],
      compareUrl: null,
    },
  },
};

const CHANNELS = {
  organizationId: "org-1",
  defaultChannelIds: ["li"],
  channels: [
    {
      id: "li",
      service: "linkedin",
      name: "Example Studio",
      displayName: null,
      descriptor: null,
      avatar: null,
      timezone: null,
      isSupported: true,
      unsupportedReason: null,
    },
    {
      id: "ig",
      service: "instagram",
      name: "Studio on Instagram",
      displayName: null,
      descriptor: null,
      avatar: null,
      timezone: null,
      isSupported: false,
      unsupportedReason: "Needs an image or video.",
    },
  ],
};

export const CHANNELS_VIEW = CHANNELS;

export const DRAFT = {
  text: "One customer sent me a single sentence last month.",
  voice: { sampleCount: 8, isMatched: true },
  overlap: { isClose: false, share: 0 },
};

/** What the API says by default. A test overrides only the procedure it is about. */
const DEFAULT_ANSWERS: Record<string, Answer> = {
  "capture.create": (input: object) => ({ ...CAPTURE, ...input }),
  "capture.analyze": ANALYSIS,
  "capture.get": ANALYSIS,
  "capture.saveAsIdea": { ideaId: "idea-1", isNew: true },
  "buffer.channels": CHANNELS,
  "draft.create": DRAFT,
  "post.create": { postId: "post-1", kind: "draft", channelId: "li" },
  "settings.setTrendsGeo": null,
};

export function failure(appCode: string): { failWith: string } {
  return { failWith: appCode };
}

function isFailure(answer: Answer): answer is { failWith: string } {
  return typeof answer === "object" && answer !== null && "failWith" in answer;
}

function inputsOf(url: URL, body: unknown): Record<string, unknown> {
  const fromUrl = url.searchParams.get("input");

  if (fromUrl !== null) {
    return JSON.parse(fromUrl) as Record<string, unknown>;
  }

  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

/**
 * Stands in for the API on `fetch`, answering like the real one: a result, or an expected failure
 * with its code. Returns every call, so a test can see what was sent and with which token.
 */
export function stubApi(answers: Record<string, Answer> = {}) {
  const calls: Call[] = [];
  const all = { ...DEFAULT_ANSWERS, ...answers };

  vi.stubGlobal(
    "fetch",
    vi.fn((rawUrl: string, init?: RequestInit) => {
      const url = new URL(rawUrl);
      const procedures = decodeURIComponent(url.pathname.split("/api/trpc/")[1] ?? "").split(",");
      const authorization = new Headers(init?.headers).get("authorization");
      const body: unknown =
        typeof init?.body === "string" && init.body !== "" ? JSON.parse(init.body) : {};
      const inputs = inputsOf(url, body);
      let status = 200;

      const results = procedures.map((procedure, index) => {
        calls.push({ procedure, authorization, input: inputs[String(index)] });
        const given = all[procedure];
        const answer: Answer =
          typeof given === "function"
            ? (given as (input: unknown) => Answer)(inputs[String(index)])
            : given;

        if (isFailure(answer)) {
          status = 400;
          return {
            error: {
              message: answer.failWith,
              code: -32001,
              data: { code: "BAD_REQUEST", httpStatus: 400, appCode: answer.failWith },
            },
          };
        }

        return { result: { data: answer ?? null } };
      });

      return Promise.resolve(Response.json(results, { status }));
    }),
  );

  return {
    calls,
    called: (procedure: string) => calls.filter((call) => call.procedure === procedure),
  };
}
