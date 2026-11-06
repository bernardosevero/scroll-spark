import { describe, expect, it } from "vitest";

import { pendingFrom } from "./pending-capture";

const CAPTURE = {
  text: "A post.",
  author: "Sam Sample",
  url: "https://www.linkedin.com/feed/update/urn:li:activity:1/",
  platform: "linkedin",
} as const;

const base = { id: "one", tabUrl: "https://www.youtube.com/", couldRead: true };

describe("what the panel is left with", () => {
  it("keeps what the page script found", () => {
    expect(pendingFrom({ ...base, result: CAPTURE })).toEqual({
      id: "one",
      status: "found",
      capture: CAPTURE,
    });
  });

  it.each([null, undefined, "text", {}, { ...CAPTURE, text: "" }, { ...CAPTURE, platform: "x" }])(
    "asks for the text when the page script returned %j, keeping the link",
    (result) => {
      expect(pendingFrom({ ...base, result })).toEqual({
        id: "one",
        status: "empty",
        url: "https://www.youtube.com/",
        platform: "youtube",
      });
    },
  );

  it("drops the link of a page that isn't on the web", () => {
    expect(pendingFrom({ ...base, result: null, tabUrl: "chrome://extensions" })).toEqual({
      id: "one",
      status: "empty",
      url: null,
      platform: null,
    });
  });

  it("says so when Chrome won't let the page be read", () => {
    expect(pendingFrom({ ...base, result: undefined, couldRead: false })).toEqual({
      id: "one",
      status: "blocked",
    });
  });
});
