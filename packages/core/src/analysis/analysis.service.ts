import type { Capture, CapturePlatform } from "../capture/schemas";
import { AppError } from "../errors/app-error";
import type { FitService, ProfileLlm, PromptChannel, PromptIdea } from "../fit/fit.service";
import type { Clock } from "../time/clock";
import { llmAnalysisSchema } from "./schemas";
import type {
  Analysis,
  AnalysisView,
  CaptureIdInput,
  CapturedAnalysis,
  SetTrendsGeoInput,
} from "./schemas";
import { trendsLinks } from "./trends";

/** Keeps one user's spend under about $2 a day. Counted from our own rows. */
export const DAILY_ANALYSIS_LIMIT = 30;

const DEFAULT_TRENDS_GEO = "US";

export interface LlmGateway extends ProfileLlm {
  readonly model: string;
  /**
   * Returns what the model said, unchecked, for the service to parse. The text, and the channel
   * history beside it, are untrusted data, and the model gets no tools. Throws `LLM_REFUSED` or
   * `LLM_FAILED`.
   */
  analyze(capture: {
    text: string;
    platform: CapturePlatform;
    sourceName: string | null;
    /** Each channel's clusters and one-line summaries. Empty when there's nothing to compare. */
    channels: PromptChannel[];
    /** The user's existing Buffer Ideas. */
    ideas: PromptIdea[];
  }): Promise<unknown>;
}

export interface AnalysisRepository {
  find(captureId: string): Promise<Analysis | null>;
  countSince(userId: string, since: Date): Promise<number>;
  /** Returns the saved row, which is the earlier one if two requests raced. */
  save(userId: string, analysis: Analysis): Promise<Analysis>;
}

export interface CaptureLookup {
  /** Null when it doesn't exist or belongs to someone else. */
  findOwned(userId: string, captureId: string): Promise<Capture | null>;
}

export interface UserSettings {
  getTrendsGeo(userId: string): Promise<string | null>;
  setTrendsGeo(userId: string, geo: string): Promise<void>;
}

export interface AnalysisService {
  analyze(userId: string, input: CaptureIdInput): Promise<CapturedAnalysis>;
  get(userId: string, input: CaptureIdInput): Promise<CapturedAnalysis>;
  setTrendsGeo(userId: string, input: SetTrendsGeoInput): Promise<void>;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function createAnalysisService({
  llm,
  analyses,
  captures,
  settings,
  fit,
  clock,
}: {
  llm: LlmGateway;
  analyses: AnalysisRepository;
  captures: CaptureLookup;
  settings: UserSettings;
  fit: FitService;
  clock: Clock;
}): AnalysisService {
  async function ownedCapture(userId: string, captureId: string) {
    const capture = await captures.findOwned(userId, captureId);

    if (capture === null) {
      throw new AppError("NOT_FOUND");
    }

    return capture;
  }

  async function viewOf(
    userId: string,
    capture: Capture,
    analysis: Analysis | null,
  ): Promise<CapturedAnalysis> {
    const trendsGeo = (await settings.getTrendsGeo(userId)) ?? DEFAULT_TRENDS_GEO;
    const view: AnalysisView | null = analysis && {
      ...analysis,
      trends: trendsLinks(analysis.trendPhrases, {
        geo: trendsGeo,
        isYouTube: capture.platform === "youtube",
      }),
    };

    return { capture, analysis: view, trendsGeo };
  }

  async function runAnalysis(userId: string, capture: Capture) {
    const usedToday = await analyses.countSince(userId, startOfUtcDay(clock.now()));

    if (usedToday >= DAILY_ANALYSIS_LIMIT) {
      throw new AppError("ANALYSIS_LIMIT_REACHED");
    }

    // Profiles come first. They're saved as they're built, so if the analysis then fails, trying
    // again finds them ready and spends nothing on them.
    const context = await fit.prepare(userId);

    const answer = llmAnalysisSchema.safeParse(
      await llm.analyze({
        text: capture.text,
        platform: capture.platform,
        sourceName: capture.sourceName,
        channels: context.prompt.channels,
        ideas: context.prompt.ideas,
      }),
    );

    if (!answer.success) {
      throw new AppError("LLM_FAILED");
    }

    const { channels, matchingIdeaIds, ...analysis } = answer.data;

    return analyses.save(userId, {
      ...analysis,
      ...fit.resolve(context, { channels, matchingIdeaIds }),
      captureId: capture.id,
      model: llm.model,
      createdAt: clock.now().toISOString(),
    });
  }

  return {
    async analyze(userId, { captureId }) {
      const capture = await ownedCapture(userId, captureId);
      const analysis = (await analyses.find(captureId)) ?? (await runAnalysis(userId, capture));

      return viewOf(userId, capture, analysis);
    },

    async get(userId, { captureId }) {
      const capture = await ownedCapture(userId, captureId);

      return viewOf(userId, capture, await analyses.find(captureId));
    },

    setTrendsGeo(userId, { geo }) {
      return settings.setTrendsGeo(userId, geo);
    },
  };
}
