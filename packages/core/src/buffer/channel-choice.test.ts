import { describe, expect, it } from "vitest";

import { chooseChannel } from "./channel-choice";
import type { ChannelView } from "./schemas";

function channel(id: string, isSupported = true): ChannelView {
  return {
    id,
    service: "linkedin",
    name: id,
    displayName: null,
    descriptor: null,
    avatar: null,
    timezone: null,
    isSupported,
    unsupportedReason: isSupported ? null : "Needs an image or video.",
  };
}

describe("which channel to write for", () => {
  const channels = [channel("a", false), channel("b"), channel("c")];

  it("honours the user's pick when it can be posted to", () => {
    expect(chooseChannel({ channels, defaultChannelIds: ["b"] }, "c")?.id).toBe("c");
  });

  it("falls back to the first default that can be posted to", () => {
    expect(chooseChannel({ channels, defaultChannelIds: ["a", "c"] }, null)?.id).toBe("c");
  });

  it("falls back to the first channel that can be posted to", () => {
    expect(chooseChannel({ channels, defaultChannelIds: [] }, null)?.id).toBe("b");
  });

  it("ignores a pick that can't be posted to", () => {
    expect(chooseChannel({ channels, defaultChannelIds: ["c"] }, "a")?.id).toBe("c");
  });

  it("is null when no channel can be posted to", () => {
    expect(
      chooseChannel({ channels: [channel("a", false)], defaultChannelIds: [] }, null),
    ).toBeNull();
  });
});
