import { createD1Client } from '@/db';
import * as schema from '@/db/schema';
import type { Bindings } from '@/types';
import { createCachingService, CacheKeys, CacheTTL } from './cachingService';
import { buildUserContext } from './userContext';
import { eq, desc, and, gt } from 'drizzle-orm';

export interface CacheWarmingService {
  warmUserData: (userId: string) => Promise<void>;
  warmPopularPosts: () => Promise<void>;
  warmRecentPosts: () => Promise<void>;
  warmUserFeeds: (userIds: string[]) => Promise<void>;
  warmRecommendationData: (userId: string) => Promise<void>;
  warmDiscoveryFeeds: (userIds: string[]) => Promise<void>;
}

export function createCacheWarmingService(env: Bindings): CacheWarmingService {
  const db = createD1Client(env);
  const cachingService = createCachingService(env);

  return {
    async warmUserData(userId: string) {
      try {
        // Warm user profile
        const profileKey = CacheKeys.profile(userId);
        await cachingService.getOrSet(
          profileKey,
          async () => {
            return await db
              .select()
              .from(schema.profile)
              .where(eq(schema.profile.userId, userId))
              .get();
          },
          CacheTTL.PROFILE,
        );

        // Warm user's recent drafts
        const draftsKey = `${CacheKeys.userDrafts(userId)}:10:0`;
        await cachingService.getOrSet(
          draftsKey,
          async () => {
            return await db
              .select()
              .from(schema.draftPost)
              .where(eq(schema.draftPost.userId, userId))
              .orderBy(desc(schema.draftPost.updatedAt))
              .limit(10)
              .all();
          },
          CacheTTL.SHORT,
        );
      } catch (error) {
        console.error(`Cache warming failed for user ${userId}:`, error);
      }
    },

    async warmPopularPosts() {
      try {
        // Get posts with high engagement (simplified - in production you'd have better metrics)
        const popularPosts = await db
          .select()
          .from(schema.post)
          .where(eq(schema.post.isDraft, 0))
          .orderBy(desc(schema.post._saveCount), desc(schema.post._commentCount))
          .limit(20)
          .all();

        // Warm cache for each popular post
        await Promise.all(
          popularPosts.map(async (post) => {
            const cacheKey = CacheKeys.post(post.id);

            return cachingService.getOrSet(
              cacheKey,
              async () => {
                // Fetch full post data with relations
                const user = await db
                  .select()
                  .from(schema.profile)
                  .where(eq(schema.profile.userId, post.userId))
                  .get();

                const media = await db
                  .select()
                  .from(schema.media)
                  .where(eq(schema.media.postId, post.id))
                  .all();

                return {
                  ...post,
                  user,
                  media,
                  hashtags: [],
                  comments: [],
                  savedBy: [],
                  editingMetadata: post.editingMetadata ? JSON.parse(post.editingMetadata) : null,
                };
              },
              CacheTTL.LONG,
            );
          }),
        );
      } catch (error) {
        console.error('Popular posts cache warming failed:', error);
      }
    },

    async warmRecentPosts() {
      try {
        // Get recent posts
        const recentPosts = await db
          .select()
          .from(schema.post)
          .where(eq(schema.post.isDraft, 0))
          .orderBy(desc(schema.post.createdAt))
          .limit(50)
          .all();

        // Warm cache for recent posts with shorter TTL
        await Promise.all(
          recentPosts.map(async (post) => {
            const cacheKey = CacheKeys.post(post.id);

            return cachingService.getOrSet(
              cacheKey,
              async () => {
                const user = await db
                  .select()
                  .from(schema.profile)
                  .where(eq(schema.profile.userId, post.userId))
                  .get();

                const media = await db
                  .select()
                  .from(schema.media)
                  .where(eq(schema.media.postId, post.id))
                  .all();

                return {
                  ...post,
                  user,
                  media,
                  hashtags: [],
                  comments: [],
                  savedBy: [],
                  editingMetadata: post.editingMetadata ? JSON.parse(post.editingMetadata) : null,
                };
              },
              CacheTTL.MEDIUM,
            );
          }),
        );
      } catch (error) {
        console.error('Recent posts cache warming failed:', error);
      }
    },

    async warmUserFeeds(userIds: string[]) {
      try {
        // Note: Traditional social feeds are not implemented yet as this app focuses on discovery feeds
        // If you implement following/followers functionality, you would implement the chronological
        // feed algorithm here and warm those caches. For now, we skip this as discovery feeds
        // provide the main content discovery mechanism.

        console.log(
          `Skipped user feed warming - discovery feeds are the primary mechanism (${userIds.length} users)`,
        );
      } catch (error) {
        console.error('User feeds cache warming failed:', error);
      }
    },

    async warmRecommendationData(userId: string) {
      try {
        const { USER_VECTORS } = env;

        // Warm user vector cache
        const userVectorKey = CacheKeys.userVector(userId);
        await cachingService.getOrSet(
          userVectorKey,
          async () => {
            if (USER_VECTORS) {
              return await USER_VECTORS.get<number[]>(userId, { type: 'json' });
            }
            return null;
          },
          CacheTTL.USER_VECTOR,
        );

        // Warm user context cache
        const userContextKey = CacheKeys.userContext(userId);
        await cachingService.getOrSet(
          userContextKey,
          async () => {
            return await buildUserContext(userId, db);
          },
          CacheTTL.USER_CONTEXT,
        );

        // Warm seen posts cache
        const seenPostsKey = CacheKeys.seenPosts(userId);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        await cachingService.getOrSet(
          seenPostsKey,
          async () => {
            const seenPosts = await db
              .select({ postId: schema.seenPostLog.postId })
              .from(schema.seenPostLog)
              .where(
                and(
                  eq(schema.seenPostLog.userId, userId),
                  gt(schema.seenPostLog.seenAt, thirtyDaysAgo),
                ),
              )
              .then((rows) => rows.map((r) => r.postId));
            return seenPosts;
          },
          CacheTTL.SEEN_POSTS,
        );

        // Warm blocked users cache
        const blockedUsersKey = CacheKeys.blockedUsers(userId);
        await cachingService.getOrSet(
          blockedUsersKey,
          async () => {
            const blockedUsers = await db
              .select({ blockedId: schema.blockedUser.blockedId })
              .from(schema.blockedUser)
              .where(eq(schema.blockedUser.blockerId, userId))
              .then((rows) => rows.map((r) => r.blockedId));
            return blockedUsers;
          },
          CacheTTL.BLOCKED_USERS,
        );
      } catch (error) {
        console.error(`Recommendation cache warming failed for user ${userId}:`, error);
      }
    },

    async warmDiscoveryFeeds(userIds: string[]) {
      try {
        // Pre-warm discovery feeds for active users (first page only to avoid performance issues)
        const limitedUserIds = userIds.slice(0, 10); // Limit to 10 users for discovery feeds

        await Promise.allSettled(
          limitedUserIds.map(async (userId) => {
            // First warm the recommendation data
            await this.warmRecommendationData(userId);

            // Note: We don't pre-warm the full discovery feed as it's computationally expensive
            // Instead, we just warm the supporting data (user vectors, context, etc.)
            // The actual feed will be computed on first request and then cached
          }),
        );
      } catch (error) {
        console.error('Discovery feeds cache warming failed:', error);
      }
    },
  };
}

// Utility function to trigger cache warming (could be called from a cron job)
export async function runCacheWarming(env: Bindings) {
  const warmingService = createCacheWarmingService(env);
  const db = createD1Client(env);

  // Get active users for recommendation cache warming
  const activeUsers = await db
    .select({ userId: schema.profile.userId })
    .from(schema.profile)
    .limit(50) // Limit to prevent overloading
    .all();

  const activeUserIds = activeUsers.map((u) => u.userId);

  // Run cache warming operations in parallel
  await Promise.allSettled([
    warmingService.warmPopularPosts(),
    warmingService.warmRecentPosts(),
    warmingService.warmUserFeeds(activeUserIds),
    warmingService.warmDiscoveryFeeds(activeUserIds),
  ]);
}

// Utility function specifically for recommendation system cache warming
export async function runRecommendationCacheWarming(env: Bindings, userIds: string[]) {
  const warmingService = createCacheWarmingService(env);

  await Promise.allSettled(userIds.map((userId) => warmingService.warmRecommendationData(userId)));
}
