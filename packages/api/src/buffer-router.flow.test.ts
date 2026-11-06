import { describe, expect, it, vi } from "vitest";

import type { AnalysisService } from "@scroll-spark/core/analysis/analysis.service";
import type { ChannelSettingsService } from "@scroll-spark/core/buffer/channel-settings.service";
import type { CaptureService } from "@scroll-spark/core/capture/capture.service";

import { appRouter } from "./router";

const ACCOUNT_VIEW = { organizations: [{ id: "org-1", name: "Studio" }], organizationId: "org-1" };
const CHANNELS_VIEW = { organizationId: "org-1", channels: [], defaultChannelIds: [] };

function setup(userId: string | null) {
  const channels: ChannelSettingsService = {
    account: vi.fn(() => Promise.resolve(ACCOUNT_VIEW)),
    channels: vi.fn(() => Promise.resolve(CHANNELS_VIEW)),
    setOrganization: vi.fn(() => Promise.resolve()),
    setDefaultChannels: vi.fn(() => Promise.resolve()),
  };
  const caller = appRouter.createCaller({
    userId,
    services: {
      ping: { ping: () => ({ message: "", answeredAt: "" }) },
      capture: {} as CaptureService,
      analysis: {} as AnalysisService,
      channels,
    },
  });

  return { caller, channels };
}

type Caller = ReturnType<typeof setup>["caller"];

describe("Buffer settings API", () => {
  it.each([
    ["buffer.account", (caller: Caller) => caller.buffer.account()],
    ["buffer.channels", (caller: Caller) => caller.buffer.channels()],
    [
      "buffer.setOrganization",
      (caller: Caller) => caller.buffer.setOrganization({ organizationId: "org-1" }),
    ],
    [
      "buffer.setDefaultChannels",
      (caller: Caller) => caller.buffer.setDefaultChannels({ channelIds: ["ch-1"] }),
    ],
  ])("refuses %s when signed out", async (_name, call) => {
    const { caller, channels } = setup(null);

    await expect(call(caller)).rejects.toMatchObject({ message: "NOT_SIGNED_IN" });
    expect(channels.account).not.toHaveBeenCalled();
    expect(channels.setOrganization).not.toHaveBeenCalled();
    expect(channels.setDefaultChannels).not.toHaveBeenCalled();
  });

  it("passes the signed-in user to the service", async () => {
    const { caller, channels } = setup("user-1");

    await expect(caller.buffer.account()).resolves.toEqual(ACCOUNT_VIEW);
    await expect(caller.buffer.channels()).resolves.toEqual(CHANNELS_VIEW);
    await caller.buffer.setOrganization({ organizationId: "org-1" });
    await caller.buffer.setDefaultChannels({ channelIds: ["ch-1"] });

    expect(channels.setOrganization).toHaveBeenCalledWith("user-1", { organizationId: "org-1" });
    expect(channels.setDefaultChannels).toHaveBeenCalledWith("user-1", { channelIds: ["ch-1"] });
  });

  it("refuses a blank organization", async () => {
    const { caller, channels } = setup("user-1");

    await expect(caller.buffer.setOrganization({ organizationId: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(channels.setOrganization).not.toHaveBeenCalled();
  });
});
