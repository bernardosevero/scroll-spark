import type { CapturePlatform } from "@scroll-spark/api/client";

import type { PendingCapture } from "../capture/pending-capture";

export interface Source {
  url: string;
  platform: CapturePlatform;
  name: string | null;
}

const NOTICES = {
  empty:
    "We couldn't find a post here. Select the text you want and capture again, or paste it below.",
  blocked: "Chrome doesn't let extensions read this page. Paste the text below instead.",
} as const;

/** What the review form starts with for each way a capture can come back. */
export function startOf(pending: PendingCapture): {
  text: string;
  source: Source | null;
  notice: string;
} {
  if (pending.status === "found") {
    const { text, url, platform, author } = pending.capture;
    return { text, source: { url, platform, name: author }, notice: "" };
  }

  if (pending.status === "empty") {
    const source =
      pending.url === null || pending.platform === null
        ? null
        : { url: pending.url, platform: pending.platform, name: null };
    return { text: "", source, notice: NOTICES.empty };
  }

  return { text: "", source: null, notice: NOTICES.blocked };
}

export const sourceLabel = ({ url, name }: Source) =>
  name ?? new URL(url).hostname.replace(/^www\./, "");
