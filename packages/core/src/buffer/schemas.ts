import { z } from "zod";

// Field names come from developers.buffer.com/reference.html. Types the docs leave open (the
// nullable ones, `limits`) are read leniently until issue #2 records real responses.

const maybeNumber = z.number().nullable().optional();

export const bufferOrganizationSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  channelCount: z.number().int().nonnegative().nullable().optional(),
  limits: z
    .object({ ideas: maybeNumber, scheduledPosts: maybeNumber, tags: maybeNumber })
    .nullable()
    .optional(),
});

export const bufferAccountSchema = z.object({
  id: z.string().min(1),
  organizations: z.array(bufferOrganizationSchema),
});

export const bufferChannelSchema = z.object({
  id: z.string().min(1),
  /** Buffer's service name, like "linkedin". Kept as text because the enum isn't confirmed. */
  service: z.string().min(1),
  name: z.string(),
  displayName: z.string().nullable().optional(),
  descriptor: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
  isLocked: z.boolean(),
  isDisconnected: z.boolean(),
});

export const bufferChannelsSchema = z.array(bufferChannelSchema);

export const bufferPostSchema = z.object({
  id: z.string().min(1),
  channelId: z.string(),
  text: z.string().nullable().optional(),
  status: z.string(),
  dueAt: z.string().nullable().optional(),
  sentAt: z.string().nullable().optional(),
  ideaId: z.string().nullable().optional(),
});

export const bufferPostsPageSchema = z.object({
  posts: z.array(bufferPostSchema),
  endCursor: z.string().nullable(),
  hasNextPage: z.boolean(),
});

export const bufferIdeaSchema = z.object({
  id: z.string().min(1),
  title: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
});

export const bufferIdeasSchema = z.array(bufferIdeaSchema);

/** One rate-limit window as Buffer reports it. `windowSeconds` is the stable name for a window. */
export const quotaWindowSchema = z.object({
  windowSeconds: z.number().int().positive(),
  quota: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  resetsAt: z.iso.datetime(),
});

export const createIdeaInputSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().max(200).optional(),
  text: z.string().min(1),
});

export const createPostInputSchema = z.object({
  organizationId: z.string().min(1),
  channelId: z.string().min(1),
  text: z.string().min(1),
  ideaId: z.string().min(1).optional(),
  mode: z.enum(["addToQueue", "shareNext", "shareNow", "customScheduled"]),
  dueAt: z.iso.datetime().optional(),
  /** True saves to Buffer as a draft, so nothing publishes. */
  saveToDraft: z.boolean(),
});

export const organizationIdInputSchema = z.object({ organizationId: z.string().min(1) });
export const channelIdsInputSchema = z.object({ channelIds: z.array(z.string().min(1)).max(50) });

export const channelViewSchema = z.object({
  id: z.string(),
  service: z.string(),
  name: z.string(),
  displayName: z.string().nullable(),
  descriptor: z.string().nullable(),
  avatar: z.string().nullable(),
  timezone: z.string().nullable(),
  isSupported: z.boolean(),
  /** Why the channel can't be chosen. Null when it can. */
  unsupportedReason: z.string().nullable(),
});

export const accountViewSchema = z.object({
  organizations: z.array(z.object({ id: z.string(), name: z.string() })),
  /** The chosen organization, or the only one. Null while the user still has to pick. */
  organizationId: z.string().nullable(),
});

export const channelsViewSchema = z.object({
  organizationId: z.string().nullable(),
  channels: z.array(channelViewSchema),
  defaultChannelIds: z.array(z.string()),
});

export type BufferAccount = z.infer<typeof bufferAccountSchema>;
export type BufferChannel = z.infer<typeof bufferChannelSchema>;
export type BufferPost = z.infer<typeof bufferPostSchema>;
export type BufferPostsPage = z.infer<typeof bufferPostsPageSchema>;
export type BufferIdea = z.infer<typeof bufferIdeaSchema>;
export type QuotaWindow = z.infer<typeof quotaWindowSchema>;
export type CreateIdeaInput = z.infer<typeof createIdeaInputSchema>;
export type CreatePostInput = z.infer<typeof createPostInputSchema>;
export type OrganizationIdInput = z.infer<typeof organizationIdInputSchema>;
export type ChannelIdsInput = z.infer<typeof channelIdsInputSchema>;
export type ChannelView = z.infer<typeof channelViewSchema>;
export type AccountView = z.infer<typeof accountViewSchema>;
export type ChannelsView = z.infer<typeof channelsViewSchema>;
