import { randomUUID } from "node:crypto";

import type { AccountRepository } from "@scroll-spark/core/account/account.service";
import type {
  AnalysisRepository,
  CaptureLookup,
  LlmGateway,
  UserSettings,
} from "@scroll-spark/core/analysis/analysis.service";
import type { Analysis } from "@scroll-spark/core/analysis/schemas";
import type { CaptureRepository, LinkReader } from "@scroll-spark/core/capture/capture.service";
import type { Capture } from "@scroll-spark/core/capture/schemas";
import { AppError } from "@scroll-spark/core/errors/app-error";
import type { ChannelProfile, ProfileRepository } from "@scroll-spark/core/fit/fit.service";
import type {
  ExtensionTokenRecord,
  ExtensionTokenRepository,
} from "@scroll-spark/core/extension-token/extension-token.service";

/** What a memory store does when its user deletes their data, like a cascade in the database. */
interface MemoryStore {
  forgetUser(userId: string): void;
}

/** Memory only. Nobody there has a Buffer grant, so none ever needs renewing. */
export function createMemoryAccountRepository(stores: MemoryStore[]): AccountRepository {
  return {
    deleteUser(userId) {
      stores.forEach((store) => store.forgetUser(userId));
      return Promise.resolve();
    },
    needsReconnect: () => Promise.resolve(false),
  };
}

/** Memory only. Used by browser flows, and where no database exists so nobody can sign in. */
export function createMemoryCaptureRepository(): MemoryStore & CaptureRepository & CaptureLookup {
  const rows: (Capture & { userId: string })[] = [];

  return {
    forgetUser(userId) {
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (rows[index]?.userId === userId) {
          rows.splice(index, 1);
        }
      }
    },
    insert(capture) {
      const row = { ...capture, id: randomUUID(), createdAt: new Date().toISOString() };
      rows.unshift(row);
      return Promise.resolve(row);
    },
    listNewest(userId, limit) {
      return Promise.resolve(rows.filter((row) => row.userId === userId).slice(0, limit));
    },
    findOwned(userId, captureId) {
      const row = rows.find((candidate) => candidate.id === captureId);
      return Promise.resolve(row?.userId === userId ? row : null);
    },
  };
}

export function createMemoryExtensionTokenRepository(): MemoryStore & ExtensionTokenRepository {
  let rows: ExtensionTokenRecord[] = [];

  return {
    forgetUser(userId) {
      rows = rows.filter((row) => row.userId !== userId);
    },
    insert(row) {
      const saved = { ...row, id: randomUUID(), revokedAt: null };
      rows.push(saved);
      return Promise.resolve({ ...saved });
    },
    findByHash: (tokenHash) =>
      Promise.resolve(rows.find((row) => row.tokenHash === tokenHash) ?? null),
    listForUser: (userId) => Promise.resolve(rows.filter((row) => row.userId === userId).reverse()),
    revoke(userId, tokenId, at) {
      const row = rows.find((candidate) => candidate.id === tokenId && candidate.userId === userId);
      if (row === undefined) {
        return Promise.resolve(false);
      }
      row.revokedAt ??= at;
      return Promise.resolve(true);
    },
  };
}

export function createMemoryAnalysisRepository(): MemoryStore & AnalysisRepository {
  const rows = new Map<string, Analysis & { userId: string }>();

  return {
    forgetUser(userId) {
      for (const [captureId, row] of rows) {
        if (row.userId === userId) {
          rows.delete(captureId);
        }
      }
    },
    find: (captureId) => Promise.resolve(rows.get(captureId) ?? null),
    countSince(userId, since) {
      const used = [...rows.values()].filter(
        (row) => row.userId === userId && new Date(row.createdAt) >= since,
      );
      return Promise.resolve(used.length);
    },
    save(userId, analysis) {
      rows.set(analysis.captureId, { ...analysis, userId });
      return Promise.resolve(analysis);
    },
  };
}

export function createMemoryUserSettings(): MemoryStore & UserSettings {
  const geos = new Map<string, string>();

  return {
    forgetUser: (userId) => void geos.delete(userId),
    getTrendsGeo: (userId) => Promise.resolve(geos.get(userId) ?? null),
    setTrendsGeo(userId, geo) {
      geos.set(userId, geo);
      return Promise.resolve();
    },
  };
}

/** Lets browser flows read links without leaving the machine. */
export const fakeLinkReader: LinkReader = {
  readYouTube: () =>
    Promise.resolve({
      title: "How I plan a month of posts in one afternoon",
      description: null,
      sourceName: "Example Channel",
    }),
  readPage: (url) =>
    Promise.resolve(
      url.includes("/article")
        ? { title: "A short article", description: "Its first line.", sourceName: "A Site" }
        : null,
    ),
};

/** Memory only. Holds each channel's profile for browser flows, per user. */
export function createMemoryProfileRepository(): MemoryStore & ProfileRepository {
  const rows = new Map<string, ChannelProfile>();
  const keyOf = (userId: string, channelId: string) => `${userId}|${channelId}`;

  return {
    forgetUser(userId) {
      for (const key of [...rows.keys()]) {
        if (key.startsWith(`${userId}|`)) {
          rows.delete(key);
        }
      }
    },
    find: (userId, channelId) => Promise.resolve(rows.get(keyOf(userId, channelId)) ?? null),
    save(userId, profile) {
      rows.set(keyOf(userId, profile.channelId), profile);
      return Promise.resolve();
    },
  };
}

const words = (text: string) => text.toLowerCase();

/**
 * Answers without spending anything. Text containing "[refuse]" plays a refusal.
 *
 * It groups a channel's posts by the topic written before the colon, and says a post matches when
 * its summary mentions customers, which is what the example captures are about.
 */
export const fakeLlm: LlmGateway = {
  model: "fake-model",

  analyze: ({ text, channels, ideas }) =>
    text.includes("[refuse]")
      ? Promise.reject(new AppError("LLM_REFUSED"))
      : Promise.resolve({
          summary: "Small fixes can matter more than big features.",
          topic: "Listening to customers",
          angle: "The quiet customer who changed what you built",
          trendPhrases: ["customer feedback", "product market fit"],
          channels: channels.map((channel) => {
            const matches = channel.posts.filter(({ summary }) =>
              words(summary).includes("customer"),
            );

            return {
              channelId: channel.channelId,
              matchingPostIds: matches.map(({ id }) => id),
              clusterId: matches[0]?.clusterId ?? null,
              newClusterName: matches.length === 0 ? "Customer stories" : null,
            };
          }),
          matchingIdeaIds: ideas
            .filter(({ text: idea }) => words(idea).includes("customer"))
            .map(({ id }) => id),
        }),

  profile({ posts }) {
    const topics = new Map<string, string[]>();

    for (const post of posts) {
      const topic = post.text.split(":")[0] ?? "Other";
      topics.set(topic, [...(topics.get(topic) ?? []), post.id]);
    }

    return Promise.resolve({
      summaries: posts.map(({ id, text }) => ({ postId: id, summary: text.slice(0, 90) })),
      clusters: [...topics].map(([name, postIds]) => ({ name, postIds })),
    });
  },
};
