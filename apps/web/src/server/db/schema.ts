import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Buffer's account ID, the identity behind "Connect your Buffer account". */
  bufferAccountId: text("buffer_account_id").notNull().unique(),
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
