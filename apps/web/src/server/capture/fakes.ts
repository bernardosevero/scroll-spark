import { randomUUID } from "node:crypto";

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
import type {
  ExtensionTokenRecord,
  ExtensionTokenRepository,
} from "@scroll-spark/core/extension-token/extension-token.service";

/** Memory only. Used by browser flows, and where no database exists so nobody can sign in. */
export function createMemoryCaptureRepository(): CaptureRepository & CaptureLookup {
  const rows: (Capture & { userId: string })[] = [];

  return {
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

export function createMemoryExtensionTokenRepository(): ExtensionTokenRepository {
  const rows: ExtensionTokenRecord[] = [];

  return {
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

export function createMemoryAnalysisRepository(): AnalysisRepository {
  const rows = new Map<string, Analysis & { userId: string }>();

  return {
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

export function createMemoryUserSettings(): UserSettings {
  const geos = new Map<string, string>();

  return {
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

/** Answers without spending anything. Text containing "[refuse]" plays a refusal. */
export const fakeLlm: LlmGateway = {
  model: "fake-model",
  analyze: ({ text }) =>
    text.includes("[refuse]")
      ? Promise.reject(new AppError("LLM_REFUSED"))
      : Promise.resolve({
          summary: "Small fixes can matter more than big features.",
          topic: "Listening to customers",
          angle: "The quiet customer who changed what you built",
          trendPhrases: ["customer feedback", "product market fit"],
        }),
};
