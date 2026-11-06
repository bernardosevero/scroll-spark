import { describe, expect, it } from "vitest";

import { parsePageMeta } from "./page-meta";

describe("parsePageMeta", () => {
  it("reads Open Graph tags", () => {
    const html = `<head>
      <meta property="og:title" content="A title">
      <meta property="og:description" content="A line.">
      <meta property="og:site_name" content="A Site">
    </head>`;

    expect(parsePageMeta(html)).toEqual({
      title: "A title",
      description: "A line.",
      sourceName: "A Site",
    });
  });

  it("reads attributes in either order and either quote", () => {
    const html = `<META content='A title' property='og:title' />`;

    expect(parsePageMeta(html).title).toBe("A title");
  });

  it("falls back to the description tag and the page title", () => {
    const html = `<title>
      Plain title
    </title><meta name="description" content="Plain line.">`;

    expect(parsePageMeta(html)).toEqual({
      title: "Plain title",
      description: "Plain line.",
      sourceName: null,
    });
  });

  it("decodes entities", () => {
    const html = `<meta property="og:title" content="Fish &amp; chips &#8212; &#x2728; &quot;ok&quot;">`;

    expect(parsePageMeta(html).title).toBe('Fish & chips — ✨ "ok"');
  });

  it("leaves unknown or impossible entities alone", () => {
    const html = `<meta property="og:title" content="&nope; &#x110000;">`;

    expect(parsePageMeta(html).title).toBe("&nope; &#x110000;");
  });

  it("returns nothing for a page with nothing useful", () => {
    expect(parsePageMeta("<html><body>Hello</body></html>")).toEqual({
      title: null,
      description: null,
      sourceName: null,
    });
  });

  it("gets through a hostile page quickly", () => {
    const started = performance.now();

    parsePageMeta(`<meta `.repeat(80_000));
    parsePageMeta(`<title`.repeat(80_000));

    expect(performance.now() - started).toBeLessThan(2_000);
  });
});
