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

  return {
    text,
    author: authorOf(post),
    url: `https://www.linkedin.com/feed/update/${urn}/`,
    platform: "linkedin",
  };
}
