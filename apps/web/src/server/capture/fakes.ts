import { randomUUID } from "node:crypto";

import type { CaptureRepository, LinkReader } from "@scroll-spark/core/capture/capture.service";
import type { Capture } from "@scroll-spark/core/capture/schemas";

/** Memory only. Used by browser flows, and where no database exists so nobody can sign in. */
export function createMemoryCaptureRepository(): CaptureRepository {
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
