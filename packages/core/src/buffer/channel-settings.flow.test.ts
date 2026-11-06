import { describe, expect, it } from "vitest";

import { createChannelSettingsService } from "./channel-settings.service";
import type { BufferPreferences } from "./channel-settings.service";
import type { BufferAccount, BufferChannel } from "./schemas";

function channel(id: string, service: string, extra: Partial<BufferChannel> = {}): BufferChannel {
  return { id, service, name: id, isLocked: false, isDisconnected: false, ...extra };
}

const CHANNELS: BufferChannel[] = [
  channel("li", "linkedin"),
  channel("x", "twitter"),
  channel("th", "threads"),
  channel("bs", "bluesky"),
  channel("ma", "mastodon"),
  channel("ig", "instagram"),
  channel("locked", "linkedin", { isLocked: true }),
  channel("gone", "bluesky", { isDisconnected: true }),
];

function setup({
  organizations = 1,
  stored = null as string | null,
  storedChannels = null as string[] | null,
} = {}) {
  const account: BufferAccount = {
    id: "acct-1",
    organizations: Array.from({ length: organizations }, (_, index) => ({
      id: `org-${String(index + 1)}`,
      name: `Org ${String(index + 1)}`,
    })),
  };
  let preferences = { organizationId: stored, defaultChannelIds: storedChannels };
  const store: BufferPreferences = {
    get: () => Promise.resolve(preferences),
    setOrganization(_userId, organizationId) {
      preferences = { organizationId, defaultChannelIds: null };
      return Promise.resolve();
    },
    setDefaultChannels(_userId, defaultChannelIds) {
      preferences = { ...preferences, defaultChannelIds };
      return Promise.resolve();
    },
  };
  const service = createChannelSettingsService({
    buffer: {
      account: () => Promise.resolve(account),
      channels: (_userId, organizationId) =>
        Promise.resolve(organizationId === "org-1" ? CHANNELS : []),
    },
    preferences: store,
  });

  return { service, preferences: () => preferences };
}

describe("choosing an organization", () => {
  it("skips the choice when there is only one", async () => {
    const { service } = setup({ organizations: 1 });

    await expect(service.account("user-1")).resolves.toMatchObject({ organizationId: "org-1" });
  });

  it("asks when there are several and none is chosen", async () => {
    const { service } = setup({ organizations: 2 });

    await expect(service.account("user-1")).resolves.toMatchObject({ organizationId: null });
    await expect(service.channels("user-1")).resolves.toEqual({
      organizationId: null,
      channels: [],
      defaultChannelIds: [],
    });
  });

  it("remembers the choice, and drops the old default channels with it", async () => {
    const { service, preferences } = setup({ organizations: 2 });
    await service.setOrganization("user-1", { organizationId: "org-1" });
    await service.setDefaultChannels("user-1", { channelIds: ["li"] });

    await service.setOrganization("user-1", { organizationId: "org-2" });

    expect(preferences()).toEqual({ organizationId: "org-2", defaultChannelIds: null });
    await expect(service.account("user-1")).resolves.toMatchObject({ organizationId: "org-2" });
  });

  it("refuses an organization that isn't the user's", async () => {
    const { service, preferences } = setup({ organizations: 2 });

    await expect(
      service.setOrganization("user-1", { organizationId: "org-9" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(preferences().organizationId).toBeNull();
  });

  it("asks again if the chosen organization is gone", async () => {
    const { service } = setup({ organizations: 2, stored: "org-9" });

    await expect(service.account("user-1")).resolves.toMatchObject({ organizationId: null });
  });
});

describe("choosing default channels", () => {
  it("lists channels with the reason each unsupported one can't be chosen", async () => {
    const { service } = setup();

    const { channels } = await service.channels("user-1");
    const byId = new Map(channels.map((view) => [view.id, view]));

    for (const id of ["li", "x", "th", "bs", "ma"]) {
      expect(byId.get(id)).toMatchObject({ isSupported: true, unsupportedReason: null });
    }
    expect(byId.get("ig")).toMatchObject({
      isSupported: false,
      unsupportedReason: expect.stringContaining("image or video") as string,
    });
    expect(byId.get("locked")).toMatchObject({
      isSupported: false,
      unsupportedReason: expect.stringContaining("locked") as string,
    });
    expect(byId.get("gone")).toMatchObject({
      isSupported: false,
      unsupportedReason: expect.stringContaining("Reconnect") as string,
    });
  });

  it("saves supported channels and shows them back", async () => {
    const { service } = setup();

    await service.setDefaultChannels("user-1", { channelIds: ["li", "bs"] });

    await expect(service.channels("user-1")).resolves.toMatchObject({
      organizationId: "org-1",
      defaultChannelIds: ["li", "bs"],
    });
  });

  it.each([
    ["an unsupported channel", ["ig"]],
    ["a locked channel", ["locked"]],
    ["a channel that isn't there", ["nope"]],
  ])("refuses %s", async (_name, channelIds) => {
    const { service, preferences } = setup();

    await expect(service.setDefaultChannels("user-1", { channelIds })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(preferences().defaultChannelIds).toBeNull();
  });

  it("needs an organization first", async () => {
    const { service } = setup({ organizations: 2 });

    await expect(
      service.setDefaultChannels("user-1", { channelIds: ["li"] }),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("drops saved channels that are no longer choosable", async () => {
    const { service: later } = setup({ storedChannels: ["li", "locked", "gone-for-good"] });

    const view = await later.channels("user-1");

    expect(view.defaultChannelIds).toEqual(["li"]);
  });
});
