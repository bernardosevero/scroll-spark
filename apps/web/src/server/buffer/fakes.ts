import type {
  BufferCache,
  BufferGateway,
  QuotaStore,
} from "@scroll-spark/core/buffer/buffer.service";
import type { BufferPreferences } from "@scroll-spark/core/buffer/channel-settings.service";
import type {
  BufferChannel,
  BufferIdea,
  BufferPost,
  QuotaWindow,
} from "@scroll-spark/core/buffer/schemas";
import { AppError } from "@scroll-spark/core/errors/app-error";

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

const SOLO_ORGANIZATION_USER_PREFIX = "00000000-0000-4000-8000-";

/** A user with an ID from here has a single organization. Everyone else has two. A new user each
 * time, so one flow's analyses don't count towards another's daily limit. */
export function newSoloOrganizationUserId() {
  return `${SOLO_ORGANIZATION_USER_PREFIX}${crypto.randomUUID().slice(-12)}`;
}

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

const DAY_MS = 86_400_000;

/** Long enough to count, with the topic before the colon, which is how the fake model groups. */
function note(topic: string, n: number) {
  return `${topic}: note ${String(n)} on how this went for the studio and what we learned from it, step by step.`;
}

function sent(id: string, channelId: string, text: string, at: string): BufferPost {
  return { id, channelId, text, status: "sent", sentAt: at, dueAt: at };
}

function scheduled(id: string, channelId: string, text: string, at: Date): BufferPost {
  return { id, channelId, text, status: "scheduled", sentAt: null, dueAt: at.toISOString() };
}

/**
 * Post history for browser flows. Dates are fixed at midday UTC, except the scheduled one, which
 * is always ahead of today. LinkedIn has three posts on customers, the last on Sep 29. X is too
 * thin to compare. Bluesky only writes about retro games. Instagram is a channel we can't post
 * to, with one customer post sent and one scheduled.
 */
function postsFor(channelId: string, now: Date): BufferPost[] {
  const inDays = (days: number) => new Date(now.getTime() + days * DAY_MS);

  switch (channelId) {
    case "ch-linkedin":
      return [
        sent("li-c1", channelId, note("Customer stories", 1), "2026-09-29T12:00:00.000Z"),
        sent("li-c2", channelId, note("Customer stories", 2), "2026-08-12T12:00:00.000Z"),
        sent("li-c3", channelId, note("Customer stories", 3), "2026-06-03T12:00:00.000Z"),
        sent("li-a1", channelId, note("AI tools", 1), "2026-10-20T12:00:00.000Z"),
        sent("li-a2", channelId, note("AI tools", 2), "2026-10-02T12:00:00.000Z"),
        sent("li-h1", channelId, note("Hiring", 1), "2026-09-01T12:00:00.000Z"),
        sent("li-h2", channelId, note("Hiring", 2), "2026-07-01T12:00:00.000Z"),
        sent("li-l1", channelId, note("Launches", 1), "2026-05-01T12:00:00.000Z"),
        sent("li-l2", channelId, note("Launches", 2), "2026-04-01T12:00:00.000Z"),
        sent("li-t1", channelId, note("Travel notes", 1), "2026-03-01T12:00:00.000Z"),
      ];
    case "ch-x":
      return [
        sent("x-1", channelId, note("Launches", 1), "2026-10-01T12:00:00.000Z"),
        sent("x-2", channelId, note("Hiring", 1), "2026-09-01T12:00:00.000Z"),
        sent("x-3", channelId, "Shipped it.", "2026-08-01T12:00:00.000Z"),
        sent("x-4", channelId, "Coffee first.", "2026-07-01T12:00:00.000Z"),
      ];
    case "ch-bluesky":
      return ["Cartridges", "Consoles", "Arcades", "Handhelds", "Magazines"].flatMap(
        (topic, index) => [
          sent(
            `bs-${topic}-1`,
            channelId,
            note(topic, 1),
            `2026-10-1${String(index)}T12:00:00.000Z`,
          ),
          sent(
            `bs-${topic}-2`,
            channelId,
            note(topic, 2),
            `2026-09-1${String(index)}T12:00:00.000Z`,
          ),
        ],
      );
    case "ch-instagram":
      return [
        sent("ig-c1", channelId, note("Customer stories", 1), "2026-08-01T12:00:00.000Z"),
        scheduled("ig-c2", channelId, note("Customer stories", 2), inDays(6)),
        sent("ig-a1", channelId, note("AI tools", 1), "2026-07-01T12:00:00.000Z"),
        sent("ig-h1", channelId, note("Hiring", 1), "2026-06-01T12:00:00.000Z"),
        sent("ig-l1", channelId, note("Launches", 1), "2026-05-01T12:00:00.000Z"),
        sent("ig-t1", channelId, note("Travel notes", 1), "2026-04-01T12:00:00.000Z"),
      ];
    default:
      return [];
  }
}

const IDEAS: BufferIdea[] = [
  { id: "idea-1", title: "Customer stories", text: "What a customer taught me" },
  { id: "idea-2", text: "Customers asked for this" },
  { id: "idea-3", text: "Thread on keyboard shortcuts" },
];

let ideaCount = 0;

/** Answers without calling Buffer. Used by browser flows. Text containing "[limit]" plays a plan limit. */
export const fakeBufferGateway: BufferGateway = {
  account(token) {
    const isSolo = token.startsWith(`${TOKEN_PREFIX}${SOLO_ORGANIZATION_USER_PREFIX}`);
    const organizations = [
      { id: "org-studio", name: "Example Studio" },
      ...(isSolo ? [] : [{ id: "org-side", name: "Side Projects" }]),
    ];

    return Promise.resolve({ data: { id: "acct-fake", organizations }, quota: [] });
  },
  channels: (_token, organizationId) =>
    Promise.resolve({ data: CHANNELS[organizationId] ?? [], quota: [] }),
  posts: (_token, { channelIds }) =>
    Promise.resolve({
      data: {
        posts: postsFor(channelIds?.[0] ?? "", new Date()),
        endCursor: null,
        hasNextPage: false,
      },
      quota: [],
    }),
  ideas: (_token, organizationId) =>
    Promise.resolve({ data: organizationId === "org-studio" ? IDEAS : [], quota: [] }),
  createIdea() {
    ideaCount += 1;
    return Promise.resolve({ data: { id: `idea-fake-${String(ideaCount)}` }, quota: [] });
  },
  createPost: (_token, { channelId, text, saveToDraft }) =>
    text.includes("[limit]")
      ? Promise.reject(new AppError("BUFFER_LIMIT_REACHED"))
      : Promise.resolve({
          data: { id: "post-fake", channelId, status: saveToDraft ? "draft" : "scheduled" },
          quota: [],
        }),
};
