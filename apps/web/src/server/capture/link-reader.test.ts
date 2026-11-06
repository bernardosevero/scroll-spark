import { describe, expect, it, vi } from "vitest";

import { createLinkReader } from "./link-reader";
import type { SafeGet } from "./safe-get";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function readerWith(body: string | Error) {
  const get = vi.fn<SafeGet>(() =>
    body instanceof Error ? Promise.reject(body) : Promise.resolve({ body }),
  );
  return { reader: createLinkReader({ get, logger }), get };
}

describe("link reader", () => {
  it("asks YouTube's oEmbed for a video's title and channel", async () => {
    const video = "https://www.youtube.com/watch?v=a&b=c";
    const { reader, get } = readerWith(JSON.stringify({ title: "A video", author_name: "Maker" }));

    await expect(reader.readYouTube(video)).resolves.toEqual({
      title: "A video",
      description: null,
      sourceName: "Maker",
    });
    expect(get.mock.calls[0]?.[0]).toBe(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(video)}`,
    );
  });

  it.each([
    ["a refused request", new Error("refused")],
    ["a broken response", "not json"],
    ["an unexpected shape", JSON.stringify({ nope: true })],
  ])("reads %s from YouTube as nothing", async (_case, body) => {
    await expect(readerWith(body).reader.readYouTube("https://youtu.be/a")).resolves.toBeNull();
  });

  it("reads a page's meta tags, asking only for HTML", async () => {
    const { reader, get } = readerWith(`<meta property="og:title" content="A page">`);

    await expect(reader.readPage("https://example.org/")).resolves.toMatchObject({
      title: "A page",
    });
    expect(get.mock.calls[0]?.[1].accept).toContain("text/html");
  });

  it("reads a failed page as nothing, and keeps the URL out of logs", async () => {
    const url = "https://secret-host.example/private";
    const { reader } = readerWith(new Error("refused"));

    await expect(reader.readPage(url)).resolves.toBeNull();

    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("secret-host");
  });
});
