import type { Analysis } from "../analysis/schemas";
import { trendsLinks } from "../analysis/trends";
import type { AnalysisRepository, CaptureLookup, UserSettings } from "../analysis/analysis.service";
import type { BufferService } from "../buffer/buffer.service";
import type { ChannelSettingsService } from "../buffer/channel-settings.service";
import type { ChannelView } from "../buffer/schemas";
import type { Capture } from "../capture/schemas";
import { AppError } from "../errors/app-error";
import type { Clock } from "../time/clock";
import { characterLimitFor, countCharacters } from "./limits";
import { findOverlap } from "./overlap";
import { llmDraftSchema } from "./schemas";
import type {
  DraftInput,
  DraftResult,
  IdeaState,
  PostInput,
  PostResult,
  SavedIdea,
  ShipCaptureInput,
} from "./schemas";
import { MIN_VOICE_SAMPLES, pickVoiceSamples } from "./voice";

/** Keeps one user's draft spend small. Counted from our own rows, like the analysis limit. */
export const DAILY_DRAFT_LIMIT = 40;

const LANGUAGE_NAMES = {
  english: "English",
  portuguese: "Portuguese",
  spanish: "Spanish",
  french: "French",
  german: "German",
} as const;

/** Everything a draft is written from. The source text is deliberately not here. */
export interface DraftBrief {
  angle: string;
  summary: string;
  topic: string;
  /** Buffer's service name for the channel, like "linkedin". */
  service: string;
  characterLimit: number | null;
  /** Up to 8 of the channel's own posts, newest first. Empty when there are too few to match. */
  voiceSamples: string[];
  /** A language to write in, or null to follow the newest sample. */
  language: string | null;
}

export interface DraftWriter {
  readonly model: string;
  /**
   * Returns what the model said, unchecked, for the service to parse. Samples are untrusted
   * data, and the model gets no tools. Throws `LLM_REFUSED` or `LLM_FAILED`.
   */
  write(brief: DraftBrief): Promise<unknown>;
}

/** The one Buffer Idea a capture became. Buffer owns it from then on, with no sync back. */
export interface IdeaLinks {
  find(userId: string, captureId: string): Promise<string | null>;
  /** Returns the saved ID, which is the earlier one if two requests raced. */
  save(userId: string, captureId: string, ideaId: string): Promise<string>;
}

/** One row per draft requested, with no text, so the daily limit can be counted. */
export interface DraftRunLog {
  countSince(userId: string, since: Date): Promise<number>;
  record(userId: string, captureId: string, at: Date): Promise<void>;
}

export interface ShipService {
  /** Creates the Buffer Idea once. Saving again returns the same one. */
  saveAsIdea(userId: string, input: ShipCaptureInput): Promise<SavedIdea>;
  ideaOf(userId: string, input: ShipCaptureInput): Promise<IdeaState>;
  draft(userId: string, input: DraftInput): Promise<DraftResult>;
  /** Never retried: a queued post may publish for real. */
  createPost(userId: string, input: PostInput): Promise<PostResult>;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** The Idea's text: topic first, then what the user will want when they come back to it. */
function ideaText(capture: Capture, analysis: Analysis, geo: string) {
  const { links, compareUrl } = trendsLinks(analysis.trendPhrases, {
    geo,
    isYouTube: capture.platform === "youtube",
  });

  return [
    `Topic: ${analysis.topic}`,
    `Summary: ${analysis.summary}`,
    `Angle: ${analysis.angle}`,
    ...(capture.sourceUrl === null ? [] : [`Source: ${capture.sourceUrl}`]),
    "Google Trends:",
    ...links.map(({ phrase, url }) => `- ${phrase}: ${url}`),
    ...(compareUrl === null ? [] : [`- Compare all: ${compareUrl}`]),
  ].join("\n");
}

export function createShipService({
  captures,
  analyses,
  settings,
  ideas,
  runs,
  buffer,
  channels,
  writer,
  clock,
}: {
  captures: CaptureLookup;
  analyses: Pick<AnalysisRepository, "find">;
  settings: Pick<UserSettings, "getTrendsGeo">;
  ideas: IdeaLinks;
  runs: DraftRunLog;
  buffer: Pick<BufferService, "createIdea" | "createPost" | "posts">;
  channels: Pick<ChannelSettingsService, "channels">;
  writer: DraftWriter;
  clock: Clock;
}): ShipService {
  // The same click twice in a row, while the first is still running, joins the first. This is
  // within one server, so the buttons also disable themselves while they work.
  const running = new Map<string, Promise<unknown>>();

  function once<T>(key: string, run: () => Promise<T>): Promise<T> {
    const existing = running.get(key) as Promise<T> | undefined;

    if (existing !== undefined) {
      return existing;
    }

    const started = run().finally(() => running.delete(key));
    running.set(key, started);

    return started;
  }

  async function ownedCapture(userId: string, captureId: string) {
    const capture = await captures.findOwned(userId, captureId);

    if (capture === null) {
      throw new AppError("NOT_FOUND");
    }

    return capture;
  }

  /** The user's chosen organization, and the channel if it can be posted to. */
  async function postableChannel(userId: string, channelId: string) {
    const view = await channels.channels(userId);
    const channel = view.channels.find(({ id }) => id === channelId);

    if (view.organizationId === null || channel === undefined) {
      throw new AppError("INVALID_INPUT");
    }

    if (!channel.isSupported) {
      throw new AppError("CHANNEL_NOT_SUPPORTED");
    }

    return { organizationId: view.organizationId, channel };
  }

  async function voiceFor(userId: string, organizationId: string, channel: ChannelView) {
    const page = await buffer.posts(userId, { organizationId, channelIds: [channel.id] });

    return pickVoiceSamples(page.posts);
  }

  async function saveIdea(userId: string, captureId: string): Promise<SavedIdea> {
    const capture = await ownedCapture(userId, captureId);
    const saved = await ideas.find(userId, captureId);

    if (saved !== null) {
      return { ideaId: saved, isNew: false };
    }

    const analysis = await analyses.find(captureId);
    const { organizationId } = await channels.channels(userId);

    if (analysis === null || organizationId === null) {
      throw new AppError("INVALID_INPUT");
    }

    const geo = (await settings.getTrendsGeo(userId)) ?? "US";
    const created = await buffer.createIdea(userId, {
      organizationId,
      title: analysis.topic.slice(0, 200),
      text: ideaText(capture, analysis, geo),
    });

    return { ideaId: await ideas.save(userId, captureId, created.id), isNew: true };
  }

  async function writeDraft(userId: string, input: DraftInput): Promise<DraftResult> {
    const capture = await ownedCapture(userId, input.captureId);
    const analysis = await analyses.find(input.captureId);

    if (analysis === null) {
      throw new AppError("INVALID_INPUT");
    }

    const { organizationId, channel } = await postableChannel(userId, input.channelId);
    const now = clock.now();

    if ((await runs.countSince(userId, startOfUtcDay(now))) >= DAILY_DRAFT_LIMIT) {
      throw new AppError("DRAFT_LIMIT_REACHED");
    }

    const samples = await voiceFor(userId, organizationId, channel);
    const isMatched = samples.length >= MIN_VOICE_SAMPLES;

    // Counted before the call, since a refused or failed draft may still cost money.
    await runs.record(userId, input.captureId, now);

    const answer = llmDraftSchema.safeParse(
      await writer.write({
        angle: analysis.angle,
        summary: analysis.summary,
        topic: analysis.topic,
        service: channel.service,
        characterLimit: characterLimitFor(channel.service),
        voiceSamples: isMatched ? samples : [],
        language: input.language === "same" ? null : LANGUAGE_NAMES[input.language],
      }),
    );

    if (!answer.success) {
      throw new AppError("LLM_FAILED");
    }

    return {
      text: answer.data.text,
      voice: { sampleCount: samples.length, isMatched },
      overlap: findOverlap(answer.data.text, capture.text),
    };
  }

  async function sendPost(userId: string, input: PostInput): Promise<PostResult> {
    await ownedCapture(userId, input.captureId);

    const text = input.text.trim();

    if (text === "") {
      throw new AppError("INVALID_INPUT");
    }

    const { organizationId, channel } = await postableChannel(userId, input.channelId);
    const limit = characterLimitFor(channel.service);

    if (limit !== null && countCharacters(text) > limit) {
      throw new AppError("POST_TOO_LONG");
    }

    const ideaId = await ideas.find(userId, input.captureId);

    // One attempt. Never catch and repeat this call: a queued post may publish for real.
    const post = await buffer.createPost(userId, {
      organizationId,
      channelId: channel.id,
      text,
      ...(ideaId === null ? {} : { ideaId }),
      mode: "addToQueue",
      saveToDraft: input.kind === "draft",
    });

    return { postId: post.id, kind: input.kind, channelId: channel.id };
  }

  return {
    saveAsIdea: (userId, { captureId }) =>
      once(`idea|${userId}|${captureId}`, () => saveIdea(userId, captureId)),

    async ideaOf(userId, { captureId }) {
      await ownedCapture(userId, captureId);

      return { ideaId: await ideas.find(userId, captureId) };
    },

    draft: (userId, input) => writeDraft(userId, input),

    createPost: (userId, input) =>
      once(`post|${userId}|${input.captureId}|${input.channelId}|${input.kind}|${input.text}`, () =>
        sendPost(userId, input),
      ),
  };
}
