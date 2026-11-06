import { describe, expect, it } from "vitest";

import article from "./fixtures/article.html?raw";
import linkedInChanged from "./fixtures/linkedin-changed-markup.html?raw";
import linkedInFeed from "./fixtures/linkedin-feed.html?raw";
import linkedInReshare from "./fixtures/linkedin-reshare-only.html?raw";
import youTubeChanged from "./fixtures/youtube-changed-markup.html?raw";
import youTubeWatch from "./fixtures/youtube-watch.html?raw";
import { capturePage } from "./page-capture";

const VIEWPORT = 800;

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

/** jsdom has no layout, so each post's place on screen is given by its `data-urn`. */
function viewOf(
  url: string,
  options: { selection?: string; tops?: Record<string, [number, number]> } = {},
) {
  return {
    url,
    selection: options.selection ?? "",
    viewportHeight: VIEWPORT,
    measure(element: Element) {
      const [top = 0, bottom = 0] = options.tops?.[element.getAttribute("data-urn") ?? ""] ?? [];
      return { top, bottom };
    },
  };
}

const FEED = "https://www.linkedin.com/feed/";
const FIRST = "urn:li:activity:7000000000000000001";
const SECOND = "urn:li:activity:7000000000000000002";
const THIRD = "urn:li:share:7000000000000000003";

describe("LinkedIn", () => {
  it("chooses the post nearest the middle, with its text, author and link", () => {
    const view = viewOf(FEED, {
      tops: { [FIRST]: [-300, 40], [SECOND]: [100, 700], [THIRD]: [720, 1200] },
    });

    const captured = capturePage(parse(linkedInFeed), view);

    expect(captured).toEqual({
      text: [
        "Consistency beats talent when you post every week.",
        "",
        "Here is what I changed in my routine:",
        "1. Batch the ideas on Sunday.",
        "2. Write one post a day. #creators",
      ].join("\n"),
      author: "Sam Sample",
      url: `https://www.linkedin.com/feed/update/${SECOND}/`,
      platform: "linkedin",
    });
  });

  it("follows the scroll: the post that is now in the middle wins", () => {
    const view = viewOf(FEED, {
      tops: { [FIRST]: [-900, -560], [SECOND]: [-500, 100], [THIRD]: [200, 800] },
    });

    expect(capturePage(parse(linkedInFeed), view)).toMatchObject({
      text: "The bottom post, still below the fold.",
      author: "Acme Example",
      url: `https://www.linkedin.com/feed/update/${THIRD}/`,
    });
  });

  it("breaks a tie by the nearer centre", () => {
    const view = viewOf(FEED, {
      tops: { [FIRST]: [0, 790], [SECOND]: [350, 450], [THIRD]: [900, 1000] },
    });

    expect(capturePage(parse(linkedInFeed), view)?.author).toBe("Sam Sample");
  });

  it("returns nothing when no post is on screen", () => {
    const view = viewOf(FEED, {
      tops: { [FIRST]: [-900, -500], [SECOND]: [-400, -10], [THIRD]: [900, 1300] },
    });

    expect(capturePage(parse(linkedInFeed), view)).toBeNull();
  });

  it("returns nothing when the markup has changed, rather than a wrong post", () => {
    expect(capturePage(parse(linkedInChanged), viewOf(FEED))).toBeNull();
  });

  it("never passes off a reshared post's words as the sharer's", () => {
    const view = viewOf(FEED, { tops: { "urn:li:activity:7000000000000000004": [0, 800] } });

    expect(capturePage(parse(linkedInReshare), view)).toBeNull();
  });
});

describe("YouTube", () => {
  const WATCH = "https://www.youtube.com/watch?v=exampleid01";

  it("reads the title and description, with the channel", () => {
    expect(capturePage(parse(youTubeWatch), viewOf(WATCH))).toEqual({
      text: [
        "How I plan a month of posts in one afternoon",
        "",
        "In this video I batch a month of posts.",
        "Chapters, templates and the exact routine I use every Sunday.",
      ].join("\n"),
      author: "Example Channel",
      url: "https://www.youtube.com/watch?v=exampleid01",
      platform: "youtube",
    });
  });

  it("never includes the transcript", () => {
    const captured = capturePage(parse(youTubeWatch), viewOf(WATCH));

    expect(captured?.text).not.toContain("TRANSCRIPT");
    expect(captured?.text).not.toContain("welcome back");
  });

  it("falls back to the short description when the page hides the long one", () => {
    const html = youTubeWatch.replace(
      /<ytd-text-inline-expander[\s\S]*<\/ytd-text-inline-expander>/,
      "",
    );

    expect(capturePage(parse(html), viewOf(WATCH))?.text).toBe(
      "How I plan a month of posts in one afternoon\n\nA short version of the description, cut off by",
    );
  });

  it("returns nothing when the markup has changed", () => {
    expect(capturePage(parse(youTubeChanged), viewOf(WATCH))).toBeNull();
  });

  it("returns nothing away from a video, like the home page", () => {
    expect(capturePage(parse(youTubeWatch), viewOf("https://www.youtube.com/"))).toBeNull();
  });
});

describe("selected text", () => {
  it.each([
    ["LinkedIn", FEED, linkedInFeed, "linkedin"],
    ["YouTube", "https://www.youtube.com/watch?v=exampleid01", youTubeWatch, "youtube"],
    ["an article", "https://example.org/article", article, "web"],
    ["a changed page", FEED, linkedInChanged, "linkedin"],
  ])("wins over everything on %s", (_name, url, html, platform) => {
    const view = viewOf(url, { selection: "  Words the user chose.  " });

    expect(capturePage(parse(html), view)).toEqual({
      text: "Words the user chose.",
      author: null,
      url,
      platform,
    });
  });

  it("is ignored when it is only whitespace", () => {
    const view = viewOf("https://example.org/article", { selection: " \n " });

    expect(capturePage(parse(article), view)?.text).toBe("A short article about posting weekly");
  });
});

describe("an unknown page", () => {
  it("falls back to its title and address", () => {
    const url = "https://example.org/article";

    expect(capturePage(parse(article), viewOf(url))).toEqual({
      text: "A short article about posting weekly",
      author: null,
      url,
      platform: "web",
    });
  });

  it("returns nothing when the page has no title", () => {
    expect(
      capturePage(parse("<html><body>Hi</body></html>"), viewOf("https://example.org/")),
    ).toBeNull();
  });
});
