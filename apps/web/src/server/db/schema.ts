import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type { CapturePlatform } from "@scroll-spark/core/capture/schemas";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Buffer's account ID, the identity behind "Connect your Buffer account". */
  bufferAccountId: text("buffer_account_id").notNull().unique(),
  /** Two-letter country for Google Trends links. Null means the default, the US. */
  trendsGeo: text("trends_geo"),
  /** The Buffer organization the user works in. Null until chosen, or while they have only one. */
  organizationId: text("organization_id"),
  /** Channels to post to by default. Null means never chosen, and it resets with the organization. */
  defaultChannelIds: jsonb("default_channel_ids").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A user's Buffer OAuth grant. One row per user, so the row is the refresh lock. */
export const bufferGrants = pgTable("buffer_grants", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Encrypted by `createSealer` before it reaches this column. */
  sealedAccessToken: text("sealed_access_token").notNull(),
  /** Encrypted too. Single-use: reusing a spent one revokes the whole grant. */
  sealedRefreshToken: text("sealed_refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  /** Null when no refresh is in flight. Once past, that refresh's result is unknown. */
  refreshingUntil: timestamp("refreshing_until", { withTimezone: true }),
  needsReconnect: boolean("needs_reconnect").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Text a user chose to keep, waiting in their inbox. Nothing here is in Buffer yet. */
export const captures = pgTable(
  "captures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** At most about 1,000 characters. Plain text, never rendered as HTML. */
    text: text("text").notNull(),
    /** Where the text came from. Null when it was only pasted or is an example. */
    sourceUrl: text("source_url"),
    platform: text("platform").$type<CapturePlatform>().notNull(),
    /** Who it came from: a channel, a site or an author. Null when unknown. */
    sourceName: text("source_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("captures_user_newest").on(table.userId, table.createdAt.desc())],
);

/** What the AI returned for a capture. One per capture, so a second look spends nothing. */
export const analyses = pgTable(
  "analyses",
  {
    captureId: uuid("capture_id")
      .primaryKey()
      .references(() => captures.id, { onDelete: "cascade" }),
    /** Kept here too, so counting today's analyses for the daily limit needs no join. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    summary: text("summary").notNull(),
    topic: text("topic").notNull(),
    angle: text("angle").notNull(),
    trendPhrases: jsonb("trend_phrases").$type<string[]>().notNull(),
    model: text("model").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("analyses_user_recent").on(table.userId, table.createdAt)],
);

/** A saved Buffer read, so repeat visits spend none of the shared quota. Per user and key. */
export const bufferCache = pgTable(
  "buffer_cache",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Names the read, like `channels:<organization>`. Writes clear entries by prefix. */
    key: text("key").notNull(),
    /** Buffer's parsed answer. Read back through Zod, so an old shape counts as a miss. */
    body: jsonb("body").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })],
);

/**
 * The latest rate-limit window Buffer reported, one row per window length. Shared by every user,
 * because the app client's quota is, and kept here because serverless functions share no memory.
 */
export const bufferQuota = pgTable("buffer_quota", {
  /** The window's length. Windows are matched by this, since plan names change. */
  windowSeconds: integer("window_seconds").primaryKey(),
  quota: integer("quota").notNull(),
  remaining: integer("remaining").notNull(),
  resetsAt: timestamp("resets_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
