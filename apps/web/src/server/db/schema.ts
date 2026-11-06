import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { CapturePlatform } from "@scroll-spark/core/capture/schemas";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Buffer's account ID, the identity behind "Connect your Buffer account". */
  bufferAccountId: text("buffer_account_id").notNull().unique(),
  /** Two-letter country for Google Trends links. Null means the default, the US. */
  trendsGeo: text("trends_geo"),
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

/** A side panel's sign-in. It reaches this user's captures, and never Buffer directly. */
export const extensionTokens = pgTable(
  "extension_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 of the token, in hex. The token itself is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Null while the token works. Once set, it never works again. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("extension_tokens_user").on(table.userId)],
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
