import { nearestMiddle } from "./nearest-middle";
import type { PageCapture, PageView } from "./page-capture";
import { readText } from "./read-text";

// Prefer attributes LinkedIn uses to identify things over the generated class names around them.
const POST = [
  '[data-urn^="urn:li:activity:"]',
  '[data-urn^="urn:li:share:"]',
  '[data-urn^="urn:li:ugcPost:"]',
].join(",");

const COMMENTARY = [
  '[data-view-name="feed-commentary"]',
  '[data-test-id="main-feed-activity-card__commentary"]',
  ".update-components-text",
  ".feed-shared-update-v2__description",
].join(",");

const AUTHOR = [
  '[data-view-name="feed-actor-name"]',
  '[data-test-id="main-feed-activity-card__entity-lockup"] a',
  ".update-components-actor__title",
  ".update-components-actor__name",
].join(",");

const IMAGE = [
  '[data-view-name="feed-update-image"] img',
  ".update-components-image img",
  "img.update-components-image__image",
].join(",");

/** LinkedIn's alt text when the author wrote none, which says nothing about the image. */
const NO_DESCRIPTION = /^no alternative text description/i;
const MAX_DESCRIBED_IMAGES = 4;
const MAX_DESCRIPTION = 200;

/** The post's own images, in order, never a reshared post's. */
function imagesOf(post: Element) {
  return [...new Set(post.querySelectorAll(IMAGE))].filter((image) => image.closest(POST) === post);
}

/**
 * Lines that tell the analysis what the post's images show, from their alt text, since a post's
 * point is often in a chart or a slide. The user sees and can edit them like the rest of the text.
 */
function imageNotes(post: Element) {
  const images = imagesOf(post);
  const described = images
    .map((image) => (image.getAttribute("alt") ?? "").replace(/\s+/g, " ").trim())
    .filter((alt) => alt !== "" && !NO_DESCRIPTION.test(alt))
    .slice(0, MAX_DESCRIBED_IMAGES);
  const rest = images.length - described.length;
  const plural = (count: number) => (count === 1 ? "image" : "images");
  const lines = described.map((alt) => `[Image: ${alt.slice(0, MAX_DESCRIPTION)}]`);

  if (rest > 0) {
    lines.push(
      described.length === 0
        ? `[This post has ${String(rest)} ${plural(rest)}, with no description]`
        : `[${String(rest)} more ${plural(rest)} with no description]`,
    );
  }

  return lines.join("\n");
}

/** The first match that belongs to this post, not to a post it reshares. */
function ownMatch(post: Element, selector: string) {
  return [...post.querySelectorAll(selector)].find((match) => match.closest(POST) === post) ?? null;
}

function authorOf(post: Element) {
  const element = ownMatch(post, AUTHOR);
  // LinkedIn repeats a name in a hidden span for screen readers, so read the visible one.
  const visible = element?.querySelector('span[aria-hidden="true"]') ?? element;
  const name = visible === null || visible === undefined ? "" : readText(visible);

  return name === "" ? null : name;
}

/** The post nearest the middle of the screen. Null when it can't be read, never another post. */
export function extractLinkedIn(doc: Document, view: PageView): PageCapture | null {
  const posts = [...doc.querySelectorAll(POST)].filter(
    (post) => post.parentElement?.closest(POST) == null,
  );
  const post = nearestMiddle(posts, view);

  if (post === null) {
    return null;
  }

  const commentary = ownMatch(post, COMMENTARY);
  const text = commentary === null ? "" : readText(commentary);
  const urn = post.getAttribute("data-urn");

  if (text === "" || urn === null) {
    return null;
  }

  const notes = imageNotes(post);

  return {
    text: notes === "" ? text : `${text}\n\n${notes}`,
    author: authorOf(post),
    url: `https://www.linkedin.com/feed/update/${urn}/`,
    platform: "linkedin",
  };
}
