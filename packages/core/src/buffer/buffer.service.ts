import type { z } from "zod";

import { AppError } from "../errors/app-error";
import type { Logger } from "../logging/logger";
import type { Clock } from "../time/clock";
import { isReadingPaused } from "./quota";
import {
  bufferAccountSchema,
  bufferChannelsSchema,
  bufferIdeasSchema,
  bufferPostsPageSchema,
} from "./schemas";
import type {
  BufferAccount,
  BufferChannel,
  BufferIdea,
  BufferPost,
  BufferPostsPage,
  CreateIdeaInput,
  CreatePostInput,
  QuotaWindow,
} from "./schemas";

/** What a Buffer call returns: the data, and the quota Buffer reported alongside it. */
export interface GatewayResult<T> {
  data: T;
  quota: QuotaWindow[];
}

export interface PostsQuery {
  organizationId: string;
  channelIds?: string[];
  after?: string;
  first?: number;
}

/**
 * The only way to reach Buffer. Implementations throw `AppError` for every expected failure, and
 * never retry: a retried write could post twice.
 */
export interface BufferGateway {
  account(accessToken: string): Promise<GatewayResult<BufferAccount>>;
  channels(accessToken: string, organizationId: string): Promise<GatewayResult<BufferChannel[]>>;
  posts(accessToken: string, query: PostsQuery): Promise<GatewayResult<BufferPostsPage>>;
  ideas(accessToken: string, organizationId: string): Promise<GatewayResult<BufferIdea[]>>;
  createIdea(accessToken: string, input: CreateIdeaInput): Promise<GatewayResult<BufferIdea>>;
  createPost(accessToken: string, input: CreatePostInput): Promise<GatewayResult<BufferPost>>;
}

export interface BufferCache {
  /** The body is whatever was saved, unchecked. A body that no longer parses counts as a miss. */
  get(userId: string, key: string): Promise<{ body: unknown; fetchedAt: Date } | null>;
  set(userId: string, key: string, body: unknown, fetchedAt: Date): Promise<void>;
  /** Removes this user's entries whose key starts with the prefix. */
  clearPrefix(userId: string, prefix: string): Promise<void>;
}

/** The latest quota Buffer reported. Shared by every user, because the app client's quota is. */
export interface QuotaStore {
  read(): Promise<QuotaWindow[]>;
  record(windows: QuotaWindow[]): Promise<void>;
}

export interface BufferService {
  account(userId: string): Promise<BufferAccount>;
  channels(userId: string, organizationId: string): Promise<BufferChannel[]>;
  posts(userId: string, query: PostsQuery): Promise<BufferPostsPage>;
  ideas(userId: string, organizationId: string): Promise<BufferIdea[]>;
  createIdea(userId: string, input: CreateIdeaInput): Promise<BufferIdea>;
  createPost(userId: string, input: CreatePostInput): Promise<BufferPost>;
}

const MINUTE_MS = 60_000;
const TTL = {
  account: 60 * MINUTE_MS,
  channels: 60 * MINUTE_MS,
  ideas: 15 * MINUTE_MS,
  posts: 24 * 60 * MINUTE_MS,
} as const;

const DEFAULT_POSTS_PAGE = 50;

export function createBufferService({
  gateway,
  auth,
  cache,
  quota,
  clock,
  logger,
}: {
  gateway: BufferGateway;
  auth: { getAccessToken(userId: string): Promise<string> };
  cache: BufferCache;
  quota: QuotaStore;
  clock: Clock;
  logger?: Logger;
}): BufferService {
  async function readCached<T>(
    userId: string,
    key: string,
    schema: z.ZodType<T>,
  ): Promise<{ value: T; fetchedAt: Date } | null> {
    const hit = await cache.get(userId, key);
    const parsed = hit && schema.safeParse(hit.body);

    return parsed?.success && hit ? { value: parsed.data, fetchedAt: hit.fetchedAt } : null;
  }

  /** Fresh cache first, then the network, unless the quota says to keep what's left for writes. */
  async function read<T>(
    userId: string,
    key: string,
    ttlMs: number,
    schema: z.ZodType<T>,
    call: (accessToken: string) => Promise<GatewayResult<T>>,
  ): Promise<T> {
    const cached = await readCached(userId, key, schema);
    const now = clock.now();

    if (cached && now.getTime() - cached.fetchedAt.getTime() < ttlMs) {
      return cached.value;
    }

    if (isReadingPaused(await quota.read(), now)) {
      logger?.warn("buffer.cache_only", {
        key: key.split(":")[0] ?? key,
        hasCache: cached !== null,
      });

      if (cached) {
        return cached.value;
      }

      throw new AppError("BUFFER_RATE_LIMITED");
    }

    const result = await call(await auth.getAccessToken(userId));
    await quota.record(result.quota);
    await cache.set(userId, key, result.data, clock.now());

    return result.data;
  }

  /** Never gated by the cache-only rule, never retried. The cache is cleared only on success. */
  async function write<T>(
    operation: "createIdea" | "createPost",
    userId: string,
    clearPrefixes: string[],
    call: (accessToken: string) => Promise<GatewayResult<T>>,
  ): Promise<T> {
    const result = await call(await auth.getAccessToken(userId));

    // Buffer has accepted the write. A failure in our own bookkeeping must not reach the user,
    // who would see an error and may try again, which would post twice.
    // Each step is tried on its own, so a stale cache is still cleared when the quota save fails.
    const steps = [
      () => quota.record(result.quota),
      ...clearPrefixes.map((prefix) => () => cache.clearPrefix(userId, prefix)),
    ];

    for (const step of steps) {
      try {
        await step();
      } catch {
        logger?.warn("buffer.write_bookkeeping_failed", { operation });
      }
    }

    return result.data;
  }

  return {
    account: (userId) =>
      read(userId, "account", TTL.account, bufferAccountSchema, (token) => gateway.account(token)),

    channels: (userId, organizationId) =>
      read(userId, `channels:${organizationId}`, TTL.channels, bufferChannelsSchema, (token) =>
        gateway.channels(token, organizationId),
      ),

    posts(userId, query) {
      const channels = [...(query.channelIds ?? [])].sort().join(",");
      const page = `${channels}:${query.after ?? ""}:${String(query.first ?? DEFAULT_POSTS_PAGE)}`;

      return read(
        userId,
        `posts:${query.organizationId}:${page}`,
        TTL.posts,
        bufferPostsPageSchema,
        (token) => gateway.posts(token, query),
      );
    },

    ideas: (userId, organizationId) =>
      read(userId, `ideas:${organizationId}`, TTL.ideas, bufferIdeasSchema, (token) =>
        gateway.ideas(token, organizationId),
      ),

    createIdea: (userId, input) =>
      write("createIdea", userId, [`ideas:${input.organizationId}`], (token) =>
        gateway.createIdea(token, input),
      ),

    createPost: (userId, input) =>
      write(
        "createPost",
        userId,
        [`posts:${input.organizationId}:`, `ideas:${input.organizationId}`],
        (token) => gateway.createPost(token, input),
      ),
  };
}
