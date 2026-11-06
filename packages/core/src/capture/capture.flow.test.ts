import { describe, expect, it, vi } from "vitest";

import { createCaptureService } from "./capture.service";
import type { CaptureRepository, LinkPreview, LinkReader, NewCapture } from "./capture.service";
import { MAX_CAPTURE_LENGTH } from "./limits";
import type { Capture } from "./schemas";

function createCaptures(): CaptureRepository {
  const rows: (Capture & { userId: string })[] = [];

  return {
    insert(capture: NewCapture) {
      const row = {
        ...capture,
        id: `capture-${rows.length + 1}`,
        createdAt: new Date(Date.UTC(2026, 10, 6, 12, rows.length)).toISOString(),
      };
      rows.push(row);
      return Promise.resolve(row);
    },
    listNewest(userId, limit) {
      const own = rows.filter((row) => row.userId === userId);
      return Promise.resolve(own.reverse().slice(0, limit));
    },
  };
}

function setup(preview: LinkPreview | null = null) {
  const linkReader: LinkReader = {
    readYouTube: vi.fn(() => Promise.resolve(preview)),
    readPage: vi.fn(() => Promise.resolve(preview)),
  };
  return { service: createCaptureService({ captures: createCaptures(), linkReader }), linkReader };
}

const pasted = { sourceUrl: null, platform: "pasted", sourceName: null } as const;

describe("keeping a post in the inbox", () => {
  it("saves pasted text, tidied, as this user's newest capture", async () => {
    const { service } = setup();

    await service.create("user-1", { ...pasted, text: "  A first post.  " });
    await service.create("user-1", { ...pasted, text: "A second post." });

    const inbox = await service.listInbox("user-1");
    expect(inbox.map((capture) => capture.text)).toEqual(["A second post.", "A first post."]);
    expect(inbox[0]?.platform).toBe("pasted");
  });

  it("keeps one user's captures away from another", async () => {
    const { service } = setup();

    await service.create("user-1", { ...pasted, text: "Mine." });

    await expect(service.listInbox("user-2")).resolves.toEqual([]);
  });

  it("stores no more than the limit, without splitting an emoji", async () => {
    const { service } = setup();
    const text = `${"a".repeat(MAX_CAPTURE_LENGTH - 1)}🙂🙂🙂`;

    const capture = await service.create("user-1", { ...pasted, text });

    expect(capture.text).toBe(`${"a".repeat(MAX_CAPTURE_LENGTH - 1)}🙂`);
    expect(Array.from(capture.text)).toHaveLength(MAX_CAPTURE_LENGTH);
  });

  it("shows the 50 newest captures", async () => {
    const { service } = setup();

    for (let index = 0; index < 51; index += 1) {
      await service.create("user-1", { ...pasted, text: `Post ${index}` });
    }

    const inbox = await service.listInbox("user-1");
    expect(inbox).toHaveLength(50);
    expect(inbox[0]?.text).toBe("Post 50");
  });
});

describe("reading a link", () => {
  it.each([
    "https://www.youtube.com/watch?v=abc",
    "https://youtube.com/watch?v=abc",
    "https://m.youtube.com/watch?v=abc",
    "https://youtu.be/abc",
  ])("reads the title and channel of %s from YouTube", async (url) => {
    const { service, linkReader } = setup({
      title: "Plan a month of posts",
      description: null,
      sourceName: "A Channel",
    });

    await expect(service.readLink({ url })).resolves.toEqual({
      status: "found",
      url,
      platform: "youtube",
      text: "Plan a month of posts",
      sourceName: "A Channel",
    });
    expect(linkReader.readPage).not.toHaveBeenCalled();
  });

  it.each([
    "https://www.linkedin.com/posts/someone-123",
    "https://linkedin.com/feed/update/1",
    "https://lnkd.in/abc",
  ])("asks for pasted text for %s without fetching it", async (url) => {
    const { service, linkReader } = setup();

    await expect(service.readLink({ url })).resolves.toEqual({
      status: "paste_needed",
      url,
      platform: "linkedin",
    });
    expect(linkReader.readPage).not.toHaveBeenCalled();
    expect(linkReader.readYouTube).not.toHaveBeenCalled();
  });

  it("isn't fooled by a host that only looks like LinkedIn", async () => {
    const { service, linkReader } = setup();

    await service.readLink({ url: "https://linkedin.com.example.org/post" });

    expect(linkReader.readPage).toHaveBeenCalled();
  });

  it("joins a page's title and description", async () => {
    const url = "https://example.org/article";
    const { service } = setup({ title: "A title", description: "A line.", sourceName: "A Site" });

    await expect(service.readLink({ url })).resolves.toEqual({
      status: "found",
      url,
      platform: "web",
      text: "A title\n\nA line.",
      sourceName: "A Site",
    });
  });

  it.each([
    ["can't be read", null],
    ["has nothing useful", { title: " ", description: null, sourceName: "A Site" }],
  ])("asks for pasted text when a page %s, keeping the link", async (_case, preview) => {
    const url = "https://example.org/article";
    const { service } = setup(preview);

    await expect(service.readLink({ url })).resolves.toEqual({
      status: "paste_needed",
      url,
      platform: "web",
    });
  });
});
