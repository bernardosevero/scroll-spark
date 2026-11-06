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
