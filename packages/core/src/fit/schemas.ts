import { z } from "zod";

/**
 * What the model says about one channel. It names things by ID and nothing else: counts and dates
 * come from our own rows, so extra fields a model adds are dropped when this is parsed.
 */
export const llmChannelMatchSchema = z.object({
  channelId: z.string(),
  /** A cluster of this channel's posts that the capture belongs to, or null. */
  clusterId: z.string().nullable(),
  /** A name for a group the channel doesn't have yet, or null. */
  newClusterName: z.string().nullable(),
  matchingPostIds: z.array(z.string()),
});

/** The fit part of what the model returns for a capture. */
export const llmFitAnswerSchema = z.object({
  channels: z.array(llmChannelMatchSchema),
  /** Ideas already in the user's Buffer that cover the same thing. */
  matchingIdeaIds: z.array(z.string()),
});

/** What the model returns when a channel's profile is built. */
export const llmProfileSchema = z.object({
  summaries: z.array(z.object({ postId: z.string(), summary: z.string() })),
  clusters: z.array(z.object({ name: z.string(), postIds: z.array(z.string()) })),
});

/**
 * Why a channel has this fit state:
 * - `fits`: at least one of the channel's posts covers the topic
 * - `new`: none do
 * - `thin`: fewer than 3 usable posts, so nothing can be compared
 * - `unavailable`: its history couldn't be read or understood this time
 */
export const channelFitSchema = z.object({
  channelId: z.string(),
  channelName: z.string(),
  state: z.enum(["fits", "new", "thin", "unavailable"]),
  /** Posts that survive cleaning: long enough, cross-posts merged. */
  usablePosts: z.number().int().nonnegative(),
  /** Sent and scheduled posts we read before cleaning. */
  readPosts: z.number().int().nonnegative(),
  /** The cluster a fit belongs to, or a suggested name when it's new. Null when there's none. */
  clusterName: z.string().nullable(),
  /** Counted from our rows. Zero unless the state is `fits`. */
  matchingPosts: z.number().int().nonnegative(),
  /** The newest sent matching post, from our rows. Null when none was sent. */
  lastPostedAt: z.iso.datetime().nullable(),
  /** The soonest matching post still to go out. Null when none is scheduled ahead. */
  nextScheduledAt: z.iso.datetime().nullable(),
});

export const duplicatesSchema = z.object({
  /** Null when Buffer's Ideas couldn't be read, which isn't the same as none. */
  ideas: z.number().int().nonnegative().nullable(),
  queuedPosts: z.number().int().nonnegative(),
});

export type LlmChannelMatch = z.infer<typeof llmChannelMatchSchema>;
export type LlmFitAnswer = z.infer<typeof llmFitAnswerSchema>;
export type LlmProfile = z.infer<typeof llmProfileSchema>;
export type ChannelFit = z.infer<typeof channelFitSchema>;
export type Duplicates = z.infer<typeof duplicatesSchema>;
