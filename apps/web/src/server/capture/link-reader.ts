import { z } from "zod";

import type { LinkPreview, LinkReader } from "@scroll-spark/core/capture/capture.service";
import type { Logger } from "@scroll-spark/core/logging/logger";

import { parsePageMeta } from "./page-meta";
import type { SafeGet } from "./safe-get";

const oEmbedSchema = z.object({ title: z.string(), author_name: z.string().optional() });

/** Any failure reads as null, so a response can't reveal which internal hosts exist. */
export function createLinkReader({ get, logger }: { get: SafeGet; logger: Logger }): LinkReader {
  async function attempt(kind: string, read: () => Promise<LinkPreview>) {
    try {
      return await read();
    } catch (error) {
      // The URL stays out of logs, since it came from the user.
      logger.warn("capture.link_unreadable", {
        kind,
        reason: error instanceof Error ? error.name : "unknown",
      });
      return null;
    }
  }

  return {
    readYouTube: (url) =>
      attempt("youtube", async () => {
        const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
        const { body } = await get(endpoint, { accept: ["application/json"] });
        const { title, author_name } = oEmbedSchema.parse(JSON.parse(body));

        return { title, description: null, sourceName: author_name ?? null };
      }),

    readPage: (url) =>
      attempt("page", async () => {
        const { body } = await get(url, { accept: ["text/html", "application/xhtml+xml"] });

        return parsePageMeta(body);
      }),
  };
}
