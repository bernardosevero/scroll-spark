import type {
  BufferCache,
  BufferGateway,
  QuotaStore,
} from "@scroll-spark/core/buffer/buffer.service";
import type { BufferPreferences } from "@scroll-spark/core/buffer/channel-settings.service";
import type { BufferChannel, QuotaWindow } from "@scroll-spark/core/buffer/schemas";

/** Memory only. Used by browser flows, and where no database exists so nobody can sign in. */
export function createMemoryBufferCache(): BufferCache {
  const entries = new Map<string, { body: unknown; fetchedAt: Date }>();
  const keyOf = (userId: string, key: string) => `${userId}|${key}`;

  return {
    get: (userId, key) => Promise.resolve(entries.get(keyOf(userId, key)) ?? null),
    set(userId, key, body, fetchedAt) {
      entries.set(keyOf(userId, key), { body, fetchedAt });
      return Promise.resolve();
    },
    clearPrefix(userId, prefix) {
      for (const key of [...entries.keys()]) {
        if (key.startsWith(keyOf(userId, prefix))) {
          entries.delete(key);
        }
      }
      return Promise.resolve();
    },
  };
}

export function createMemoryQuotaStore(): QuotaStore {
  let windows: QuotaWindow[] = [];

  return {
    read: () => Promise.resolve(windows),
    record(next) {
      windows = next;
      return Promise.resolve();
    },
  };
}

export function createMemoryBufferPreferences(): BufferPreferences {
  const rows = new Map<
    string,
    { organizationId: string | null; defaultChannelIds: string[] | null }
  >();
  const empty = { organizationId: null, defaultChannelIds: null };

  return {
    get: (userId) => Promise.resolve(rows.get(userId) ?? empty),
    setOrganization(userId, organizationId) {
      rows.set(userId, { organizationId, defaultChannelIds: null });
      return Promise.resolve();
    },
    setDefaultChannels(userId, defaultChannelIds) {
      rows.set(userId, { ...(rows.get(userId) ?? empty), defaultChannelIds });
      return Promise.resolve();
    },
  };
}

/** A user with this ID has a single organization. Everyone else has two. */
export const SOLO_ORGANIZATION_USER_ID = "00000000-0000-4000-8000-000000000001";

const TOKEN_PREFIX = "fake-token:";

/** The fake sign-in's token carries the user, so the fake gateway can answer per user. */
export const fakeTokenAuth = {
  getAccessToken: (userId: string) => Promise.resolve(`${TOKEN_PREFIX}${userId}`),
};

function channel(
  id: string,
  service: string,
  name: string,
  extra: Partial<BufferChannel> = {},
): BufferChannel {
  return { id, service, name, isLocked: false, isDisconnected: false, ...extra };
}

const CHANNELS: Record<string, BufferChannel[]> = {
  "org-studio": [
    channel("ch-linkedin", "linkedin", "example-studio", { displayName: "Example Studio" }),
    channel("ch-x", "twitter", "examplestudio", { displayName: "@examplestudio" }),
    channel("ch-bluesky", "bluesky", "studio.example.com"),
    channel("ch-instagram", "instagram", "examplestudio", { displayName: "Studio on Instagram" }),
    channel("ch-threads", "threads", "examplestudio", { isLocked: true }),
    channel("ch-mastodon", "mastodon", "studio@example.social", { isDisconnected: true }),
  ],
  "org-side": [channel("ch-side-linkedin", "linkedin", "side-project")],
};

/** Answers without calling Buffer. Used by browser flows. */
export const fakeBufferGateway: BufferGateway = {
  account(token) {
    const isSolo = token === `${TOKEN_PREFIX}${SOLO_ORGANIZATION_USER_ID}`;
    const organizations = [
      { id: "org-studio", name: "Example Studio" },
      ...(isSolo ? [] : [{ id: "org-side", name: "Side Projects" }]),
    ];

    return Promise.resolve({ data: { id: "acct-fake", organizations }, quota: [] });
  },
  channels: (_token, organizationId) =>
    Promise.resolve({ data: CHANNELS[organizationId] ?? [], quota: [] }),
  posts: () =>
    Promise.resolve({ data: { posts: [], endCursor: null, hasNextPage: false }, quota: [] }),
  ideas: () => Promise.resolve({ data: [], quota: [] }),
  createIdea: () => Promise.resolve({ data: { id: "idea-fake" }, quota: [] }),
  createPost: (_token, { channelId }) =>
    Promise.resolve({ data: { id: "post-fake", channelId, status: "draft" }, quota: [] }),
};
