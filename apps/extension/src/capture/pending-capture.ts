import { platformOf } from "./page-capture";
import type { CapturedPlatform, PageCapture } from "./page-capture";

/**
 * What the background script leaves for the side panel after the user asks to capture. The panel
 * always shows it for correction, including when nothing was found.
 */
export type PendingCapture = { id: string } & (
  | { status: "found"; capture: PageCapture }
  /** The page was read but held no post or selection. The link is kept for saving. */
  | { status: "empty"; url: string | null; platform: CapturedPlatform | null }
  /** Chrome doesn't let extensions read this kind of page, like its own settings or the store. */
  | { status: "blocked" }
);

function isPageCapture(value: unknown): value is PageCapture {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const { text, author, url, platform } = value as Record<string, unknown>;

  return (
    typeof text === "string" &&
    text !== "" &&
    (author === null || typeof author === "string") &&
    typeof url === "string" &&
    (platform === "linkedin" || platform === "youtube" || platform === "web")
  );
}

const isWebUrl = (url: string | undefined): url is string => /^https?:\/\//i.test(url ?? "");

/** Turns what the page script returned, or why it couldn't run, into what the panel shows. */
export function pendingFrom({
  id,
  result,
  tabUrl,
  couldRead,
}: {
  id: string;
  result: unknown;
  tabUrl: string | undefined;
  couldRead: boolean;
}): PendingCapture {
  if (!couldRead) {
    return { id, status: "blocked" };
  }

  if (isPageCapture(result)) {
    return { id, status: "found", capture: result };
  }

  return isWebUrl(tabUrl)
    ? { id, status: "empty", url: tabUrl, platform: platformOf(tabUrl) }
    : { id, status: "empty", url: null, platform: null };
}
