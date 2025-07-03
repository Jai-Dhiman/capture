import type { Bindings } from '@/types';

export interface CachingService {
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
  invalidatePattern: (pattern: string) => Promise<void>;
  getOrSet: <T>(key: string, fetcher: () => Promise<T>, ttl?: number) => Promise<T>;
}

export function createCachingService(env: Bindings): CachingService {
  const kv = env.CACHE_KV; // Cloudflare KV namespace for caching
  const defaultTtl = 300; // 5 minutes default TTL

  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const cached = await kv.get(key, 'json');
        if (cached && typeof cached === 'object' && 'data' in cached && 'expires' in cached) {
          const { data, expires } = cached as { data: T; expires: number };
          
          if (Date.now() < expires) {
            return data;
          } 
            // Expired, delete it
            await kv.delete(key);
            return null;
        }
        return cached as T | null;
      } catch (error) {
        console.error('Cache get error:', error);
        return null;
      }
    },

    async set<T>(key: string, value: T, ttl: number = defaultTtl): Promise<void> {
      try {
        const expires = Date.now() + (ttl * 1000);
        const cacheData = {
          data: value,
          expires,
        };
        
        // Use KV with TTL for automatic expiration
        await kv.put(key, JSON.stringify(cacheData), {
          expirationTtl: ttl,
        });
      } catch (error) {
        console.error('Cache set error:', error);
        // Don't throw - caching failures shouldn't break the app
      }
    },

    async delete(key: string): Promise<void> {
      try {
        await kv.delete(key);
      } catch (error) {
        console.error('Cache delete error:', error);
      }
    },

    async invalidatePattern(pattern: string): Promise<void> {
      try {
        // KV doesn't support pattern deletion, so we'll need to track keys
        // For now, we'll implement basic pattern matching for common patterns
        
        if (pattern.includes('*')) {
          // Get list of keys and filter by pattern
          const list = await kv.list();
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          
          const keysToDelete = list.keys
            .filter(item => regex.test(item.name))
            .map(item => item.name);

          // Delete in batches to avoid rate limits
          const batchSize = 10;
          for (let i = 0; i < keysToDelete.length; i += batchSize) {
            const batch = keysToDelete.slice(i, i + batchSize);
            await Promise.all(batch.map(key => kv.delete(key)));
          }
        } else {
          // Direct key deletion
          await kv.delete(pattern);
        }
      } catch (error) {
        console.error('Cache invalidate pattern error:', error);
      }
    },

    async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl: number = defaultTtl): Promise<T> {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Fetch fresh data
      try {
        const fresh = await fetcher();
        
        // Cache the result (fire and forget)
        this.set(key, fresh, ttl).catch(error => {
          console.error('Background cache set failed:', error);
        });
        
        return fresh;
      } catch (error) {
        console.error('Fetcher error in getOrSet:', error);
        throw error;
      }
    },
  };
}

// Cache key generators for different data types
export const CacheKeys = {
  post: (postId: string) => `post:${postId}`,
  postVersions: (postId: string) => `post_versions:${postId}`,
  draftPost: (draftId: string) => `draft:${draftId}`,
  userDrafts: (userId: string) => `user_drafts:${userId}`,
  userPosts: (userId: string) => `user_posts:${userId}`,
  profile: (userId: string) => `profile:${userId}`,
  media: (mediaId: string) => `media:${mediaId}`,
  feedPage: (userId: string, cursor?: string) => `feed:${userId}:${cursor || 'start'}`,
  hashtag: (hashtagId: string) => `hashtag:${hashtagId}`,
  comment: (commentId: string) => `comment:${commentId}`,
  postComments: (postId: string) => `post_comments:${postId}`,
  notification: (userId: string) => `notifications:${userId}`,
  
  // Recommendation system cache keys
  userVector: (userId: string) => `user_vector:${userId}`,
  userContext: (userId: string) => `user_context:${userId}`,
  discoveryFeed: (userId: string, cursor?: string) => `discovery_feed:${userId}:${cursor || 'start'}`,
  recommendationScores: (userId: string, postIds: string) => `rec_scores:${userId}:${postIds}`,
  seenPosts: (userId: string) => `seen_posts:${userId}`,
  blockedUsers: (userId: string) => `blocked_users:${userId}`,
  
  // Pattern helpers for invalidation
  userPattern: (userId: string) => `*${userId}*`,
  postPattern: (postId: string) => `*post*${postId}*`,
  recommendationPattern: (userId: string) => `*rec*${userId}*`,
  discoveryPattern: (userId: string) => `discovery_feed:${userId}:*`,
} as const;

// Cache TTL constants (in seconds)
export const CacheTTL = {
  SHORT: 60,        // 1 minute - for frequently changing data
  MEDIUM: 300,      // 5 minutes - for moderately changing data
  LONG: 1800,       // 30 minutes - for rarely changing data
  VERY_LONG: 3600,  // 1 hour - for static-ish data
  FEED: 120,        // 2 minutes - for feeds
  PROFILE: 600,     // 10 minutes - for profiles
  MEDIA: 3600,      // 1 hour - for media metadata
  
  // Recommendation system TTLs
  USER_VECTOR: 1800,      // 30 minutes - user interest vectors
  USER_CONTEXT: 600,      // 10 minutes - user context and preferences
  DISCOVERY_FEED: 300,    // 5 minutes - discovery feed results
  RECOMMENDATION_SCORES: 180, // 3 minutes - computed recommendation scores
  SEEN_POSTS: 3600,       // 1 hour - seen posts cache
  BLOCKED_USERS: 1800,    // 30 minutes - blocked users list
} as const;