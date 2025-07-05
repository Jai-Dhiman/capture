/**
 * Cached Database Query Functions
 *
 * Wrapper functions that add caching layer to database queries
 */

import { createCachingService, CacheKeys, CacheTTL } from '../../lib/cache/cachingService.js';
import type { Bindings } from '../../types';
import {
  getSeenPostsForUser as _getSeenPostsForUser,
  getBlockedUsersForUser as _getBlockedUsersForUser,
  getUsersWhoBlockedUser as _getUsersWhoBlockedUser,
  getFollowingForUser as _getFollowingForUser,
  getFollowersForUser as _getFollowersForUser,
  batchGetUserInteractions as _batchGetUserInteractions,
} from './userInteractions.js';
import {
  filterPostsByPrivacyAndFollowing as _filterPostsByPrivacyAndFollowing,
  getVisiblePostsForUser as _getVisiblePostsForUser,
  canUserSeePost as _canUserSeePost,
  getPostPrivacyStats as _getPostPrivacyStats,
  batchCheckPostVisibility as _batchCheckPostVisibility,
} from './privacyFilters.js';

/**
 * Create cached versions of database query functions
 */
export function createCachedQueries(bindings: Bindings) {
  const cache = createCachingService(bindings);

  return {
    // User Interaction Queries (with caching)

    /**
     * Get seen posts for user with caching
     */
    async getSeenPostsForUser(userId: string): Promise<string[]> {
      const cacheKey = CacheKeys.seenPosts(userId);
      return cache.getOrSet(
        cacheKey,
        () => _getSeenPostsForUser(userId, bindings),
        CacheTTL.SEEN_POSTS,
      );
    },

    /**
     * Get blocked users for user with caching
     */
    async getBlockedUsersForUser(userId: string): Promise<string[]> {
      const cacheKey = CacheKeys.blockedUsers(userId);
      return cache.getOrSet(
        cacheKey,
        () => _getBlockedUsersForUser(userId, bindings),
        CacheTTL.BLOCKED_USERS,
      );
    },

    /**
     * Get users who blocked user with caching
     */
    async getUsersWhoBlockedUser(userId: string): Promise<string[]> {
      const cacheKey = `users_who_blocked:${userId}`;
      return cache.getOrSet(
        cacheKey,
        () => _getUsersWhoBlockedUser(userId, bindings),
        CacheTTL.BLOCKED_USERS,
      );
    },

    /**
     * Get following for user with caching
     */
    async getFollowingForUser(userId: string): Promise<string[]> {
      const cacheKey = `following:${userId}`;
      return cache.getOrSet(
        cacheKey,
        () => _getFollowingForUser(userId, bindings),
        CacheTTL.MEDIUM,
      );
    },

    /**
     * Get followers for user with caching
     */
    async getFollowersForUser(userId: string): Promise<string[]> {
      const cacheKey = `followers:${userId}`;
      return cache.getOrSet(
        cacheKey,
        () => _getFollowersForUser(userId, bindings),
        CacheTTL.MEDIUM,
      );
    },

    /**
     * Batch get user interactions with caching (limited caching due to complexity)
     */
    async batchGetUserInteractions(userIds: string[]): Promise<{
      [userId: string]: {
        seenPosts: string[];
        blockedUsers: string[];
        following: string[];
        followers: string[];
      };
    }> {
      // For batch operations, we use shorter cache or skip caching for frequently changing data
      const cacheKey = `batch_interactions:${userIds.sort().join(',')}`;
      return cache.getOrSet(
        cacheKey,
        () => _batchGetUserInteractions(userIds, bindings),
        CacheTTL.SHORT, // Shorter TTL for batch operations
      );
    },

    // Privacy Filter Queries (with caching)

    /**
     * Filter posts by privacy with caching
     */
    async filterPostsByPrivacyAndFollowing(
      posts: Array<{ id: string; userId: string }>,
      currentUserId: string,
      options: any = {},
    ): Promise<any[]> {
      // Create cache key based on post IDs and user ID
      const postIds = posts
        .map((p) => p.id)
        .sort()
        .join(',');
      const optionsKey = JSON.stringify(options);
      const cacheKey = `privacy_filter:${currentUserId}:${Buffer.from(postIds + optionsKey)
        .toString('base64')
        .slice(0, 32)}`;

      return cache.getOrSet(
        cacheKey,
        () => _filterPostsByPrivacyAndFollowing(posts, currentUserId, bindings, options),
        CacheTTL.SHORT, // Short TTL due to privacy changes
      );
    },

    /**
     * Get visible posts for user with caching
     */
    async getVisiblePostsForUser(currentUserId: string, options: any = {}): Promise<any[]> {
      // Create cache key based on user and options
      const optionsKey = JSON.stringify(options);
      const cacheKey = `visible_posts:${currentUserId}:${Buffer.from(optionsKey).toString('base64').slice(0, 32)}`;

      return cache.getOrSet(
        cacheKey,
        () => _getVisiblePostsForUser(currentUserId, bindings, options),
        CacheTTL.SHORT, // Short TTL for discovery feeds
      );
    },

    /**
     * Check if user can see post with caching
     */
    async canUserSeePost(postId: string, currentUserId: string): Promise<boolean> {
      const cacheKey = `can_see_post:${currentUserId}:${postId}`;
      return cache.getOrSet(
        cacheKey,
        () => _canUserSeePost(postId, currentUserId, bindings),
        CacheTTL.MEDIUM,
      );
    },

    /**
     * Get post privacy stats with caching
     */
    async getPostPrivacyStats(userId: string): Promise<{
      totalPosts: number;
      publicPosts: number;
      privatePosts: number;
      visibleToFollowers: number;
      userIsPrivate: boolean;
    }> {
      const cacheKey = `privacy_stats:${userId}`;
      return cache.getOrSet(
        cacheKey,
        () => _getPostPrivacyStats(userId, bindings),
        CacheTTL.LONG, // Longer TTL for stats
      );
    },

    /**
     * Batch check post visibility with caching
     */
    async batchCheckPostVisibility(
      postIds: string[],
      currentUserId: string,
    ): Promise<{ [postId: string]: boolean }> {
      const sortedPostIds = postIds.sort().join(',');
      const cacheKey = `batch_visibility:${currentUserId}:${Buffer.from(sortedPostIds).toString('base64').slice(0, 32)}`;

      return cache.getOrSet(
        cacheKey,
        () => _batchCheckPostVisibility(postIds, currentUserId, bindings),
        CacheTTL.SHORT,
      );
    },

    // Cache Management Functions

    /**
     * Invalidate user-related caches when user data changes
     */
    async invalidateUserCaches(userId: string): Promise<void> {
      await Promise.all([
        cache.invalidatePattern(CacheKeys.userPattern(userId)),
        cache.invalidatePattern(`following:${userId}`),
        cache.invalidatePattern(`followers:${userId}`),
        cache.invalidatePattern(`blocked_users:${userId}`),
        cache.invalidatePattern(`seen_posts:${userId}`),
        cache.invalidatePattern(`privacy_stats:${userId}`),
        cache.invalidatePattern(`visible_posts:${userId}:*`),
        cache.invalidatePattern(`can_see_post:${userId}:*`),
        cache.invalidatePattern(`batch_visibility:${userId}:*`),
      ]);
    },

    /**
     * Invalidate post-related caches when post data changes
     */
    async invalidatePostCaches(postId: string): Promise<void> {
      await Promise.all([
        cache.invalidatePattern(CacheKeys.postPattern(postId)),
        cache.invalidatePattern(`*${postId}*`), // Broad invalidation for post references
      ]);
    },

    /**
     * Invalidate discovery and recommendation caches
     */
    async invalidateDiscoveryCaches(userId: string): Promise<void> {
      await Promise.all([
        cache.invalidatePattern(CacheKeys.discoveryPattern(userId)),
        cache.invalidatePattern(CacheKeys.recommendationPattern(userId)),
        cache.invalidatePattern(`visible_posts:${userId}:*`),
      ]);
    },

    /**
     * Warm up caches for a user (preload frequently accessed data)
     */
    async warmUserCaches(userId: string): Promise<void> {
      try {
        // Preload user interaction data
        await Promise.all([
          this.getSeenPostsForUser(userId),
          this.getBlockedUsersForUser(userId),
          this.getFollowingForUser(userId),
          this.getFollowersForUser(userId),
          this.getPostPrivacyStats(userId),
        ]);
      } catch (error) {
        console.error('Error warming user caches:', error);
        // Don't throw - cache warming failures shouldn't break the app
      }
    },

    /**
     * Get cache statistics for monitoring
     */
    async getCacheStats(): Promise<{
      totalKeys: number;
      cacheSize: string;
      hitRate: number;
    }> {
      try {
        // This would need to be implemented based on your KV store capabilities
        // For now, return placeholder data
        return {
          totalKeys: 0,
          cacheSize: '0 MB',
          hitRate: 0.85, // 85% hit rate placeholder
        };
      } catch (error) {
        console.error('Error getting cache stats:', error);
        return {
          totalKeys: 0,
          cacheSize: 'unknown',
          hitRate: 0,
        };
      }
    },

    // Direct cache access for advanced use cases
    cache,
  };
}

/**
 * Cache invalidation helpers for common operations
 */
export const CacheInvalidation = {
  /**
   * When a user follows/unfollows someone
   */
  async onFollowshipChange(
    followerId: string,
    followedId: string,
    bindings: Bindings,
  ): Promise<void> {
    const cache = createCachingService(bindings);
    await Promise.all([
      cache.invalidatePattern(`following:${followerId}`),
      cache.invalidatePattern(`followers:${followedId}`),
      cache.invalidatePattern(`visible_posts:${followerId}:*`),
      cache.invalidatePattern(`privacy_filter:${followerId}:*`),
      cache.invalidatePattern(CacheKeys.discoveryPattern(followerId)),
    ]);
  },

  /**
   * When a user blocks/unblocks someone
   */
  async onBlockingChange(blockerId: string, blockedId: string, bindings: Bindings): Promise<void> {
    const cache = createCachingService(bindings);
    await Promise.all([
      cache.invalidatePattern(`blocked_users:${blockerId}`),
      cache.invalidatePattern(`users_who_blocked:${blockedId}`),
      cache.invalidatePattern(`visible_posts:${blockerId}:*`),
      cache.invalidatePattern(`visible_posts:${blockedId}:*`),
      cache.invalidatePattern(`privacy_filter:${blockerId}:*`),
      cache.invalidatePattern(`privacy_filter:${blockedId}:*`),
      cache.invalidatePattern(`can_see_post:${blockerId}:*`),
      cache.invalidatePattern(`can_see_post:${blockedId}:*`),
      cache.invalidatePattern(CacheKeys.discoveryPattern(blockerId)),
      cache.invalidatePattern(CacheKeys.discoveryPattern(blockedId)),
    ]);
  },

  /**
   * When a post is created, updated, or deleted
   */
  async onPostChange(postId: string, authorId: string, bindings: Bindings): Promise<void> {
    const cache = createCachingService(bindings);
    await Promise.all([
      cache.invalidatePattern(CacheKeys.postPattern(postId)),
      cache.invalidatePattern(`privacy_stats:${authorId}`),
      cache.invalidatePattern('visible_posts:*'), // Broad invalidation for feeds
      cache.invalidatePattern('privacy_filter:*'),
      cache.invalidatePattern('discovery_feed:*'),
    ]);
  },

  /**
   * When user privacy settings change
   */
  async onPrivacySettingChange(userId: string, bindings: Bindings): Promise<void> {
    const cache = createCachingService(bindings);
    await Promise.all([
      cache.invalidatePattern(`privacy_stats:${userId}`),
      cache.invalidatePattern('visible_posts:*'), // Broad invalidation
      cache.invalidatePattern('privacy_filter:*'),
      cache.invalidatePattern('can_see_post:*'),
      cache.invalidatePattern('discovery_feed:*'),
    ]);
  },
};
