import { AppError } from "../errors/app-error";
import { serviceLabel } from "../buffer/service-name";
import type { Logger } from "../logging/logger";
import type { BufferService } from "../buffer/buffer.service";
import type { BufferChannel, BufferIdea } from "../buffer/schemas";
import type { Clock } from "../time/clock";
import { cleanHistory, historyPostsOf } from "./clean-history";
import type { CleanedPost } from "./clean-history";
import { llmProfileSchema } from "./schemas";
import type { ChannelFit, Duplicates, LlmFitAnswer } from "./schemas";

/** Below this many usable posts there is nothing to compare a capture with. */
export const MIN_POSTS_TO_COMPARE = 3;
/** One page of this many posts is read per channel, which is the whole Buffer cost of a profile. */
export const POSTS_PER_CHANNEL = 50;
/** The newest cleaned posts a profile keeps, which bounds what the model reads. */
export const MAX_PROFILE_POSTS = 40;
/** Each channel's profile costs one model call, so the channels checked at once are capped. */
export const MAX_FIT_CHANNELS = 6;
/**
 * The most clusters a profile may have. The prompt asks for five to eight on a long history, but a
 * short one may cover only one or two subjects, so any number from one up is accepted.
 */
export const MAX_CLUSTERS = 8;
/** A profile is rebuilt at most this often. */
export const PROFILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_IDEAS = 50;
const MAX_IDEA_TEXT = 200;
const MAX_SUMMARY = 160;
const MAX_CLUSTER_NAME = 60;

export interface ProfilePost {
  id: string;
  /** Cleaned, at most 500 characters. */
  text: string;
  /** One line. Null when the channel was too thin to be summarized. */
  summary: string | null;
  clusterId: string | null;
  postedAt: string;
  lastSentAt: string | null;
  scheduledAt: string | null;
}

export interface ProfileCluster {
  id: string;
  name: string;
}

/** A channel's cleaned posts, summaries and clusters, kept by us. */
export interface ChannelProfile {
  channelId: string;
  refreshedAt: string;
  /** Sent and scheduled posts read before cleaning. */
  readPosts: number;
  posts: ProfilePost[];
  clusters: ProfileCluster[];
}

export interface ProfileRepository {
  find(userId: string, channelId: string): Promise<ChannelProfile | null>;
  /** Replaces everything held for the channel. */
  save(userId: string, profile: ChannelProfile): Promise<void>;
}

export interface ProfileLlm {
  /**
   * Summarizes each post in a line and groups the posts into named clusters. Returns what the
   * model said, unchecked. The posts are untrusted data, and the model gets no tools.
   */
  profile(input: {
    channelName: string;
    service: string;
    posts: { id: string; text: string }[];
  }): Promise<unknown>;
}

export interface HistoryChannels {
  /** The chosen organization's channels, readable or not. The service picks the readable ones. */
  historyChannels(userId: string): Promise<{
    organizationId: string | null;
    channels: BufferChannel[];
    defaultChannelIds: string[];
  }>;
}

/** One channel as the analysis prompt sees it. */
export interface PromptChannel {
  channelId: string;
  name: string;
  clusters: ProfileCluster[];
  posts: { id: string; summary: string; clusterId: string | null }[];
}

export interface PromptIdea {
  id: string;
  text: string;
}

export interface ChannelAssessment {
  channelId: string;
  channelName: string;
  state: "ready" | "thin" | "unavailable";
  usablePosts: number;
  readPosts: number;
  profile: ChannelProfile | null;
}

/** What `prepare` found, for the prompt and for `resolve`. Held for one analysis, not saved. */
export interface FitContext {
  /** Null when the channel list couldn't be read. */
  assessments: ChannelAssessment[] | null;
  /** Null when Buffer's Ideas couldn't be read. */
  ideas: PromptIdea[] | null;
  prompt: { channels: PromptChannel[]; ideas: PromptIdea[] };
}

export interface FitResult {
  /** Null when there was nothing to check against, so the analysis has no fit yet. */
  channels: ChannelFit[] | null;
  duplicates: Duplicates | null;
}

export interface FitService {
  /** Builds or refreshes each channel's profile, at most daily. Spends nothing on a fresh one. */
  prepare(userId: string): Promise<FitContext>;
  /** Turns the model's IDs into facts. IDs we don't know are dropped, and numbers are ours. */
  resolve(context: FitContext, answer: LlmFitAnswer): FitResult;
}

function oneLine(text: string, max: number) {
  return [...text.replace(/\s+/g, " ").trim()].slice(0, max).join("").trimEnd();
}

function isReconnect(error: unknown) {
  return error instanceof AppError && error.code === "RECONNECT_REQUIRED";
}

function reasonOf(error: unknown) {
  return error instanceof AppError ? error.code : error instanceof Error ? error.name : "unknown";
}

/** Defaults first, then the rest in Buffer's order, and no more than the cap. */
function channelsToCheck(channels: BufferChannel[], defaultChannelIds: string[]) {
  const readable = channels.filter((channel) => !channel.isLocked && !channel.isDisconnected);
  const preferred = readable.filter(({ id }) => defaultChannelIds.includes(id));
  const others = readable.filter(({ id }) => !defaultChannelIds.includes(id));

  return [...preferred, ...others].slice(0, MAX_FIT_CHANNELS);
}

function labelOf(channel: BufferChannel) {
  return channel.displayName?.trim() || channel.name;
}

/** Each channel's label, with its service added where two channels would read the same. */
function labelsFor(channels: BufferChannel[]) {
  const counts = new Map<string, number>();

  for (const channel of channels) {
    counts.set(labelOf(channel), (counts.get(labelOf(channel)) ?? 0) + 1);
  }

  return new Map(
    channels.map((channel) => {
      const label = labelOf(channel);

      return [
        channel.id,
        (counts.get(label) ?? 0) > 1 ? `${label} (${serviceLabel(channel.service)})` : label,
      ];
    }),
  );
}

/**
 * Checks what the model sent against the rule that it only names things we know: one to
 * `MAX_CLUSTERS` clusters, each holding posts that exist. Anything else is `LLM_FAILED`.
 */
function profileFrom(
  answer: unknown,
  kept: CleanedPost[],
  readPosts: number,
  refreshedAt: string,
  channelId: string,
): ChannelProfile {
  const parsed = llmProfileSchema.safeParse(answer);

  if (!parsed.success) {
    throw new AppError("LLM_FAILED");
  }

  const known = new Map(kept.map((post) => [post.id, post]));
  const summaries = new Map<string, string>();

  for (const { postId, summary } of parsed.data.summaries) {
    const line = oneLine(summary, MAX_SUMMARY);

    if (known.has(postId) && line !== "" && !summaries.has(postId)) {
      summaries.set(postId, line);
    }
  }

  const clusters: ProfileCluster[] = [];
  const clusterOf = new Map<string, string>();

  for (const { name, postIds } of parsed.data.clusters) {
    const clean = oneLine(name, MAX_CLUSTER_NAME);
    const members = [...new Set(postIds)].filter((id) => known.has(id) && !clusterOf.has(id));

    if (clean !== "" && members.length > 0) {
      const id = `c${String(clusters.length + 1)}`;
      clusters.push({ id, name: clean });
      members.forEach((member) => clusterOf.set(member, id));
    }
  }

  if (clusters.length === 0 || clusters.length > MAX_CLUSTERS) {
    throw new AppError("LLM_FAILED");
  }

  return {
    channelId,
    refreshedAt,
    readPosts,
    clusters,
    posts: kept.map((post) => ({
      id: post.id,
      text: post.text,
      // The channel's own words stand in for a summary the model skipped.
      summary: summaries.get(post.id) ?? oneLine(post.text, 100),
      clusterId: clusterOf.get(post.id) ?? null,
      postedAt: post.postedAt,
      lastSentAt: post.lastSentAt,
      scheduledAt: post.scheduledAt,
    })),
  };
}

function profileWithoutModel(
  kept: CleanedPost[],
  readPosts: number,
  refreshedAt: string,
  channelId: string,
): ChannelProfile {
  return {
    channelId,
    refreshedAt,
    readPosts,
    clusters: [],
    posts: kept.map((post) => ({
      id: post.id,
      text: post.text,
      summary: null,
      clusterId: null,
      postedAt: post.postedAt,
      lastSentAt: post.lastSentAt,
      scheduledAt: post.scheduledAt,
    })),
  };
}

function isUsable(profile: ChannelProfile) {
  return profile.posts.length >= MIN_POSTS_TO_COMPARE && profile.clusters.length > 0;
}

function assessmentOf(
  channel: BufferChannel,
  channelName: string,
  profile: ChannelProfile,
): ChannelAssessment {
  return {
    channelId: channel.id,
    channelName,
    state: isUsable(profile) ? "ready" : "thin",
    usablePosts: profile.posts.length,
    readPosts: profile.readPosts,
    profile,
  };
}

function promptChannelOf({ channelId, channelName, profile }: ChannelAssessment): PromptChannel {
  return {
    channelId,
    name: channelName,
    clusters: profile?.clusters ?? [],
    posts: (profile?.posts ?? []).map((post) => ({
      id: post.id,
      summary: post.summary ?? "",
      clusterId: post.clusterId,
    })),
  };
}

function ideaOf(idea: BufferIdea): PromptIdea {
  const title = idea.title?.trim() ?? "";
  const text = idea.text?.trim() ?? "";

  return {
    id: idea.id,
    text: oneLine(title !== "" && text !== "" ? `${title}: ${text}` : title || text, MAX_IDEA_TEXT),
  };
}

export function createFitService({
  buffer,
  channels: source,
  profiles,
  llm,
  clock,
  logger,
}: {
  buffer: Pick<BufferService, "posts" | "ideas">;
  channels: HistoryChannels;
  profiles: ProfileRepository;
  llm: ProfileLlm;
  clock: Clock;
  logger?: Logger;
}): FitService {
  /** The saved profile if it's fresh, else one built from Buffer's posts and the model. */
  async function profileOf(userId: string, organizationId: string, channel: BufferChannel) {
    const saved = await profiles.find(userId, channel.id);
    const now = clock.now();

    if (saved && now.getTime() - new Date(saved.refreshedAt).getTime() < PROFILE_MAX_AGE_MS) {
      return saved;
    }

    try {
      // Always through the cached service, which falls back to what it has near the quota.
      const page = await buffer.posts(userId, {
        organizationId,
        channelIds: [channel.id],
        first: POSTS_PER_CHANNEL,
      });
      const history = historyPostsOf(page.posts.filter((post) => post.channelId === channel.id));
      const kept = cleanHistory(history).slice(0, MAX_PROFILE_POSTS);
      const refreshedAt = now.toISOString();
      const readPosts = history.length;

      const profile = await buildProfile({ channel, saved, kept, readPosts, refreshedAt });

      await profiles.save(userId, profile);

      return profile;
    } catch (error) {
      if (isReconnect(error)) {
        throw error;
      }

      // An older profile still tells the truth about older posts, so it beats showing nothing.
      if (saved) {
        logger?.warn("fit.profile_stale", { channelId: channel.id, reason: reasonOf(error) });
        return saved;
      }

      throw error;
    }
  }

  async function buildProfile({
    channel,
    saved,
    kept,
    readPosts,
    refreshedAt,
  }: {
    channel: BufferChannel;
    saved: ChannelProfile | null;
    kept: CleanedPost[];
    readPosts: number;
    refreshedAt: string;
  }) {
    if (kept.length < MIN_POSTS_TO_COMPARE) {
      return profileWithoutModel(kept, readPosts, refreshedAt, channel.id);
    }

    const savedIds = new Set(saved?.posts.map(({ id }) => id));

    if (
      saved !== null &&
      isUsable(saved) &&
      saved.posts.length === kept.length &&
      kept.every(({ id }) => savedIds.has(id))
    ) {
      // Nothing new to summarize, so only the dates and statuses are brought up to date.
      const byId = new Map(kept.map((post) => [post.id, post]));

      return {
        ...saved,
        refreshedAt,
        readPosts,
        posts: saved.posts.map((post) => {
          const fresh = byId.get(post.id);

          return fresh
            ? {
                ...post,
                postedAt: fresh.postedAt,
                lastSentAt: fresh.lastSentAt,
                scheduledAt: fresh.scheduledAt,
              }
            : post;
        }),
      };
    }

    const startedAt = Date.now();
    const answer = await llm.profile({
      channelName: labelOf(channel),
      service: channel.service,
      posts: kept.map(({ id, text }) => ({ id, text })),
    });
    const profile = profileFrom(answer, kept, readPosts, refreshedAt, channel.id);

    logger?.info("fit.profile_built", {
      channelId: channel.id,
      posts: profile.posts.length,
      clusters: profile.clusters.length,
      ms: Date.now() - startedAt,
    });

    return profile;
  }

  async function assess(
    userId: string,
    organizationId: string,
    channel: BufferChannel,
    channelName: string,
  ): Promise<ChannelAssessment> {
    try {
      return assessmentOf(channel, channelName, await profileOf(userId, organizationId, channel));
    } catch (error) {
      if (isReconnect(error)) {
        throw error;
      }

      logger?.warn("fit.profile_failed", { channelId: channel.id, reason: reasonOf(error) });

      return {
        channelId: channel.id,
        channelName,
        state: "unavailable" as const,
        usablePosts: 0,
        readPosts: 0,
        profile: null,
      };
    }
  }

  async function readIdeas(userId: string, organizationId: string) {
    try {
      return (await buffer.ideas(userId, organizationId)).slice(0, MAX_IDEAS).map(ideaOf);
    } catch (error) {
      if (isReconnect(error)) {
        throw error;
      }

      logger?.warn("fit.ideas_unavailable", { reason: reasonOf(error) });

      return null;
    }
  }

  return {
    async prepare(userId) {
      const none: FitContext = {
        assessments: null,
        ideas: null,
        prompt: { channels: [], ideas: [] },
      };
      let history: Awaited<ReturnType<HistoryChannels["historyChannels"]>>;

      try {
        history = await source.historyChannels(userId);
      } catch (error) {
        if (isReconnect(error)) {
          throw error;
        }

        logger?.warn("fit.channels_unavailable", { reason: reasonOf(error) });

        return none;
      }

      const { organizationId } = history;

      if (organizationId === null) {
        return none;
      }

      // Every profile is allowed to finish, and so to be saved, before an expired grant is reported.
      const labels = labelsFor(history.channels);
      const [ideas, results] = await Promise.all([
        readIdeas(userId, organizationId),
        Promise.allSettled(
          channelsToCheck(history.channels, history.defaultChannelIds).map((channel) =>
            assess(userId, organizationId, channel, labels.get(channel.id) ?? labelOf(channel)),
          ),
        ),
      ]);
      const assessments: ChannelAssessment[] = [];

      for (const result of results) {
        if (result.status === "rejected") {
          // `assess` only lets an expired grant through.
          throw result.reason;
        }

        assessments.push(result.value);
      }

      return {
        assessments,
        ideas,
        prompt: {
          channels: assessments.filter(({ state }) => state === "ready").map(promptChannelOf),
          ideas: ideas ?? [],
        },
      };
    },

    resolve(context, answer) {
      const { assessments, ideas } = context;

      if (assessments === null || assessments.length === 0) {
        return { channels: null, duplicates: null };
      }

      const now = clock.now().getTime();
      const queued = new Set<string>();

      const channels = assessments.map((assessment): ChannelFit => {
        const base = {
          channelId: assessment.channelId,
          channelName: assessment.channelName,
          usablePosts: assessment.usablePosts,
          readPosts: assessment.readPosts,
          clusterName: null,
          matchingPosts: 0,
          lastPostedAt: null,
          nextScheduledAt: null,
        };
        const { profile } = assessment;

        if (assessment.state !== "ready" || profile === null) {
          return { ...base, state: assessment.state === "thin" ? "thin" : "unavailable" };
        }

        // A channel the model didn't mention gets no verdict, since "new" would be a claim.
        const said = answer.channels.find(({ channelId }) => channelId === assessment.channelId);

        if (said === undefined) {
          return { ...base, state: "unavailable" };
        }

        const posts = new Map(profile.posts.map((post) => [post.id, post]));
        const matches = [...new Set(said.matchingPostIds)].flatMap((id) => posts.get(id) ?? []);

        if (matches.length === 0) {
          return {
            ...base,
            state: "new",
            clusterName: oneLine(said.newClusterName ?? "", MAX_CLUSTER_NAME) || null,
          };
        }

        const clusterName = clusterNameOf(profile, said.clusterId, matches);
        const sentDates = matches.flatMap((post) => post.lastSentAt ?? []);
        const upcoming = matches.flatMap((post) =>
          post.scheduledAt !== null && Date.parse(post.scheduledAt) >= now
            ? [post.scheduledAt]
            : [],
        );

        matches.filter((post) => post.scheduledAt !== null).forEach((post) => queued.add(post.id));

        return {
          ...base,
          state: "fits",
          clusterName,
          matchingPosts: matches.length,
          lastPostedAt: sentDates.sort().at(-1) ?? null,
          nextScheduledAt: upcoming.sort()[0] ?? null,
        };
      });

      const knownIdeas = new Set(ideas?.map(({ id }) => id));

      return {
        channels,
        duplicates: {
          ideas:
            ideas === null
              ? null
              : new Set(answer.matchingIdeaIds.filter((id) => knownIdeas.has(id))).size,
          queuedPosts: queued.size,
        },
      };
    },
  };
}

/** The cluster the model named if it's one of this channel's, else the one most matches sit in. */
function clusterNameOf(profile: ChannelProfile, clusterId: string | null, matches: ProfilePost[]) {
  const names = new Map(profile.clusters.map(({ id, name }) => [id, name]));
  const named = clusterId === null ? undefined : names.get(clusterId);

  if (named !== undefined) {
    return named;
  }

  const tally = new Map<string, number>();

  for (const { clusterId: id } of matches) {
    if (id !== null) {
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
  }

  const [best] = [...tally].sort((a, b) => b[1] - a[1]);

  return best === undefined ? null : (names.get(best[0]) ?? null);
}
