import type { PageCapture, PageView } from "./page-capture";
import { readText } from "./read-text";

const WATCH_PATH = /^\/(watch|shorts\/)/;

function metaContent(doc: Document, selector: string) {
  return doc.querySelector(selector)?.getAttribute("content")?.trim() ?? "";
}

function titleOf(doc: Document) {
  return (
    metaContent(doc, 'meta[property="og:title"]') || doc.title.replace(/\s*-\s*YouTube$/, "").trim()
  );
}

/** The expanded description when the page has it, otherwise the short one in the meta tags. */
function descriptionOf(doc: Document) {
  const expanded = doc.querySelector(
    "ytd-watch-metadata #description-inline-expander #attributed-snippet-text, ytd-watch-metadata #description-inline-expander #snippet-text",
  );

  return (
    (expanded === null ? "" : readText(expanded)) ||
    metaContent(doc, 'meta[name="description"]') ||
    metaContent(doc, 'meta[property="og:description"]')
  );
}

function authorOf(doc: Document) {
  const owner = doc.querySelector('[itemprop="author"] [itemprop="name"]');
  const name =
    owner?.getAttribute("content")?.trim() ||
    (doc.querySelector("#owner ytd-channel-name a")?.textContent ?? "").trim();

  return name === "" ? null : name;
}

/**
 * A video's title and description. Never the transcript: it is long, it is not the creator's own
 * summary, and reading it would mean opening a panel the user didn't ask for.
 */
export function extractYouTube(doc: Document, view: PageView): PageCapture | null {
  if (!WATCH_PATH.test(new URL(view.url).pathname)) {
    return null;
  }

  const title = titleOf(doc);

  if (title === "") {
    return null;
  }

  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href");

  return {
    text: [title, descriptionOf(doc)].filter(Boolean).join("\n\n"),
    author: authorOf(doc),
    url: canonical ?? view.url,
    platform: "youtube",
  };
}
