import { extractLinkedIn } from "./linkedin";
import { extractYouTube } from "./youtube";

export type CapturedPlatform = "linkedin" | "youtube" | "web";

/** What a page gave us, ready to show in the panel for correction. */
export interface PageCapture {
  text: string;
  /** Who wrote it, when the page says. Becomes the capture's `sourceName`. */
  author: string | null;
  url: string;
  platform: CapturedPlatform;
}

/** What the extractors need to know about the tab. Passed in, so tests need no browser layout. */
export interface PageView {
  url: string;
  /** What the user has selected, possibly nothing. */
  selection: string;
  viewportHeight: number;
  measure(element: Element): { top: number; bottom: number };
}

export function platformOf(url: string): CapturedPlatform {
  const host = new URL(url).hostname.toLowerCase();

  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
    return "linkedin";
  }

  return host === "youtube.com" || host.endsWith(".youtube.com") ? "youtube" : "web";
}

/**
 * Selected text first, then the post nearest the middle of the screen, then the page's title.
 * Returns null rather than guess, so the panel asks the user to select the text instead.
 */
export function capturePage(doc: Document, view: PageView): PageCapture | null {
  const platform = platformOf(view.url);
  const selection = view.selection.trim();

  if (selection !== "") {
    return { text: selection, author: null, url: view.url, platform };
  }

  if (platform === "linkedin") {
    return extractLinkedIn(doc, view);
  }

  if (platform === "youtube") {
    return extractYouTube(doc, view);
  }

  const title = doc.title.replace(/\s+/g, " ").trim();
  return title === "" ? null : { text: title, author: null, url: view.url, platform };
}
