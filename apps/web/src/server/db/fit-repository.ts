import { and, eq } from "drizzle-orm";

import type { ChannelProfile, ProfileRepository } from "@scroll-spark/core/fit/fit.service";

import type { Database } from "./grant-repository";
import { channelClusters, channelPosts, channelProfiles } from "./schema";

const iso = (date: Date | null) => (date === null ? null : date.toISOString());
const date = (value: string | null) => (value === null ? null : new Date(value));

export function createProfileRepository({ db }: { db: Database }): ProfileRepository {
  return {
    async find(userId, channelId) {
      const [profile] = await db
        .select()
        .from(channelProfiles)
        .where(and(eq(channelProfiles.userId, userId), eq(channelProfiles.channelId, channelId)));

      if (profile === undefined) {
        return null;
      }

      const [posts, clusters] = await Promise.all([
        db
          .select()
          .from(channelPosts)
          .where(and(eq(channelPosts.userId, userId), eq(channelPosts.channelId, channelId))),
        db
          .select()
          .from(channelClusters)
          .where(and(eq(channelClusters.userId, userId), eq(channelClusters.channelId, channelId))),
      ]);

      return {
        channelId,
        refreshedAt: profile.profileRefreshedAt.toISOString(),
        readPosts: profile.readPosts,
        clusters: clusters
          .map(({ clusterId, name }) => ({ id: clusterId, name }))
          .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true })),
        posts: posts
          .map((post) => ({
            id: post.postId,
            text: post.text,
            summary: post.summary,
            clusterId: post.clusterId,
            postedAt: post.postedAt.toISOString(),
            lastSentAt: iso(post.lastSentAt),
            scheduledAt: iso(post.scheduledAt),
          }))
          .sort((a, b) => b.postedAt.localeCompare(a.postedAt) || a.id.localeCompare(b.id)),
      } satisfies ChannelProfile;
    },

    /**
     * The database driver has no transactions, so the profile row goes first and last: removing it
     * means "no profile", and writing it is the final step. A save cut short is simply rebuilt.
     */
    async save(userId, profile) {
      const { channelId } = profile;

      await db
        .delete(channelProfiles)
        .where(and(eq(channelProfiles.userId, userId), eq(channelProfiles.channelId, channelId)));
      await db
        .delete(channelPosts)
        .where(and(eq(channelPosts.userId, userId), eq(channelPosts.channelId, channelId)));
      await db
        .delete(channelClusters)
        .where(and(eq(channelClusters.userId, userId), eq(channelClusters.channelId, channelId)));

      if (profile.clusters.length > 0) {
        await db
          .insert(channelClusters)
          .values(
            profile.clusters.map(({ id, name }) => ({ userId, channelId, clusterId: id, name })),
          );
      }

      if (profile.posts.length > 0) {
        await db.insert(channelPosts).values(
          profile.posts.map((post) => ({
            userId,
            channelId,
            postId: post.id,
            text: post.text,
            summary: post.summary,
            clusterId: post.clusterId,
            postedAt: new Date(post.postedAt),
            lastSentAt: date(post.lastSentAt),
            scheduledAt: date(post.scheduledAt),
          })),
        );
      }

      await db.insert(channelProfiles).values({
        userId,
        channelId,
        profileRefreshedAt: new Date(profile.refreshedAt),
        readPosts: profile.readPosts,
      });
    },
  };
}
