import { AppError } from "../errors/app-error";
import type { BufferService } from "./buffer.service";
import type {
  AccountView,
  BufferChannel,
  ChannelIdsInput,
  ChannelView,
  ChannelsView,
  OrganizationIdInput,
} from "./schemas";

export interface BufferPreferences {
  get(
    userId: string,
  ): Promise<{ organizationId: string | null; defaultChannelIds: string[] | null }>;
  /** Also forgets the default channels, since they belong to the old organization. */
  setOrganization(userId: string, organizationId: string): Promise<void>;
  setDefaultChannels(userId: string, channelIds: string[]): Promise<void>;
}

export interface ChannelSettingsService {
  account(userId: string): Promise<AccountView>;
  channels(userId: string): Promise<ChannelsView>;
  setOrganization(userId: string, input: OrganizationIdInput): Promise<void>;
  setDefaultChannels(userId: string, input: ChannelIdsInput): Promise<void>;
}

/**
 * Services that can post text alone. Spelling is Buffer's `Service` values, which are unconfirmed
 * until #2 records a real `channels` response, so X is accepted under both names.
 */
const TEXT_ONLY_SERVICES = new Set(["linkedin", "twitter", "x", "threads", "bluesky", "mastodon"]);

function viewOf(channel: BufferChannel): ChannelView {
  return {
    id: channel.id,
    service: channel.service,
    name: channel.name,
    displayName: channel.displayName ?? null,
    descriptor: channel.descriptor ?? null,
    avatar: channel.avatar ?? null,
    timezone: channel.timezone ?? null,
    ...reasonFor(channel),
  };
}

function reasonFor(channel: BufferChannel) {
  let unsupportedReason: string | null = null;

  if (channel.isDisconnected) {
    unsupportedReason = "Reconnect this channel in Buffer to use it.";
  } else if (channel.isLocked) {
    unsupportedReason = "This channel is locked on your Buffer plan.";
  } else if (!TEXT_ONLY_SERVICES.has(channel.service.toLowerCase())) {
    unsupportedReason = "Needs an image or video, which Scroll Spark doesn't add yet.";
  }

  return { isSupported: unsupportedReason === null, unsupportedReason };
}

export function createChannelSettingsService({
  buffer,
  preferences,
}: {
  buffer: Pick<BufferService, "account" | "channels">;
  preferences: BufferPreferences;
}): ChannelSettingsService {
  /** The saved organization if it still exists, else the only one, else null. */
  async function chosenOrganization(userId: string) {
    const [account, saved] = await Promise.all([buffer.account(userId), preferences.get(userId)]);
    const ids = account.organizations.map(({ id }) => id);
    const organizationId =
      saved.organizationId !== null && ids.includes(saved.organizationId)
        ? saved.organizationId
        : ids.length === 1
          ? (ids[0] ?? null)
          : null;

    return { account, organizationId, saved };
  }

  async function organizationChannels(userId: string, organizationId: string) {
    return (await buffer.channels(userId, organizationId)).map(viewOf);
  }

  return {
    async account(userId) {
      const { account, organizationId } = await chosenOrganization(userId);

      return {
        organizations: account.organizations.map(({ id, name }) => ({ id, name })),
        organizationId,
      };
    },

    async channels(userId) {
      const { organizationId, saved } = await chosenOrganization(userId);

      if (organizationId === null) {
        return { organizationId: null, channels: [], defaultChannelIds: [] };
      }

      const channels = await organizationChannels(userId, organizationId);
      const choosable = new Set(channels.filter((view) => view.isSupported).map(({ id }) => id));

      return {
        organizationId,
        channels,
        defaultChannelIds: (saved.defaultChannelIds ?? []).filter((id) => choosable.has(id)),
      };
    },

    async setOrganization(userId, { organizationId }) {
      const account = await buffer.account(userId);

      if (!account.organizations.some(({ id }) => id === organizationId)) {
        throw new AppError("INVALID_INPUT");
      }

      await preferences.setOrganization(userId, organizationId);
    },

    async setDefaultChannels(userId, { channelIds }) {
      const { organizationId, saved } = await chosenOrganization(userId);

      if (organizationId === null) {
        throw new AppError("INVALID_INPUT");
      }

      const channels = await organizationChannels(userId, organizationId);
      const choosable = new Set(channels.filter((view) => view.isSupported).map(({ id }) => id));
      const unique = [...new Set(channelIds)];

      if (!unique.every((id) => choosable.has(id))) {
        throw new AppError("INVALID_INPUT");
      }

      // A user who never picked an organization because they have one still needs it saved, so
      // their defaults stay tied to it.
      if (saved.organizationId !== organizationId) {
        await preferences.setOrganization(userId, organizationId);
      }

      await preferences.setDefaultChannels(userId, unique);
    },
  };
}
