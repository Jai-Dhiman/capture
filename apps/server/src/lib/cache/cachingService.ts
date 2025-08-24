import type { Bindings } from '@/types';

export interface CachingService {
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T, ttl?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
  invalidatePattern: (pattern: string) => Promise<void>;
  getOrSet: <T>(key: string, fetcher: () => Promise<T>, ttl?: number) => Promise<T>;
}

export interface CacheEntry<T = any> {
  data: T;
  expires: number;
  metadata: {
    createdAt: number;
    lastAccessed: number;
    hitCount: number;
  };
}

export class cachingService implements CachingService {
  private kv: KVNamespace;
  private defaultTtl = 300; // 5 minutes
  private enableMetrics = true;

  constructor(kvNamespace: KVNamespace, options: {
    defaultTtl?: number;
    enableMetrics?: boolean;
  } = {}) {
    this.kv = kvNamespace;
    this.defaultTtl = options.defaultTtl || this.defaultTtl;
    this.enableMetrics = options.enableMetrics !== false;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.kv.get(key, 'json');

      if (cached && typeof cached === 'object' && 'data' in cached && 'expires' in cached) {
        const entry = cached as CacheEntry<T>;

        if (Date.now() < entry.expires) {
          // Update access metrics
          if (this.enableMetrics) {
            entry.metadata.lastAccessed = Date.now();
            entry.metadata.hitCount++;
            
            // Background update of metadata
            this.updateEntryMetadata(key, entry).catch(console.error);
          }

          return entry.data;
        } 
          await this.kv.delete(key);
          return null;
      }
      return cached as T | null;
    } catch (error) {
      console.error(`[CACHE] Get error for ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number = this.defaultTtl): Promise<void> {
    try {
      const expires = Date.now() + ttl * 1000;
      const entry: CacheEntry<T> = {
        data: value,
        expires,
        metadata: {
          createdAt: Date.now(),
          lastAccessed: Date.now(),
          hitCount: 0,
        }
      };

      // Use KV with TTL for automatic expiration
      await this.kv.put(key, JSON.stringify(entry), {
        expirationTtl: ttl,
      });
    } catch (error) {
      console.error(`[CACHE] Set error for ${key}:`, error);
      // Don't throw - caching failures shouldn't break the app
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
    } catch (error) {
      console.error(`[CACHE] Delete error for ${key}:`, error);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      if (pattern.includes('*')) {
        // Get list of keys and filter by pattern
        const list = await this.kv.list();
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));

        const keysToDelete = list.keys
          .filter((item) => regex.test(item.name))
          .map((item) => item.name);

        // Delete in batches to avoid rate limits
        const batchSize = 10;
        for (let i = 0; i < keysToDelete.length; i += batchSize) {
          const batch = keysToDelete.slice(i, i + batchSize);
          await Promise.all(batch.map((key) => this.kv.delete(key)));
        }
      } else {
        // Direct key deletion
        await this.kv.delete(pattern);
      }
    } catch (error) {
      console.error(`[CACHE] Invalidate pattern error for ${pattern}:`, error);
    }
  }

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.defaultTtl,
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    try {
      const fresh = await fetcher();

      // Cache the result (fire and forget)
      this.set(key, fresh, ttl).catch((error) => {
        console.error(`[CACHE] Background cache set failed for ${key}:`, error);
      });

      return fresh;
    } catch (error) {
      console.error(`[CACHE] Fetcher error for ${key}:`, error);
      throw error;
    }
  }

  // Helper method to warm cache for frequently accessed items
  async warmCache(patterns: string[]): Promise<void> {
    try {
      for (const pattern of patterns) {
        const list = await this.kv.list();
        const matchingKeys = list.keys
          .filter(item => new RegExp(pattern.replace(/\*/g, '.*')).test(item.name))
          .map(item => item.name);

        // Check and refresh items that are about to expire
        for (const key of matchingKeys.slice(0, 100)) { // Limit to 100 to avoid overwhelming
          const cached = await this.kv.get(key, 'json');
          if (cached && typeof cached === 'object' && 'expires' in cached) {
            const entry = cached as CacheEntry;
            const timeToExpiry = entry.expires - Date.now();
            const originalTtl = entry.expires - entry.metadata.createdAt;
            
            // If expires within 10% of original TTL, it's a candidate for warming
            if (timeToExpiry < originalTtl * 0.1) {
              console.log(`[CACHE] Key ${key} is about to expire, consider refreshing`);
            }
          }
        }
      }
    } catch (error) {
      console.error('[CACHE] Cache warming error:', error);
    }
  }

  // Clear all cache entries
  async flush(): Promise<void> {
    try {
      const list = await this.kv.list();
      const keys = list.keys.map(item => item.name);
      
      // Delete in batches
      const batchSize = 10;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        await Promise.all(batch.map(key => this.kv.delete(key)));
      }
    } catch (error) {
      console.error('[CACHE] Flush error:', error);
    }
  }

  // Private helper method
  private async updateEntryMetadata<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      // Get remaining TTL
      const metadata = await this.kv.getWithMetadata(key);
      if (metadata.metadata) {
        // Calculate remaining TTL and update entry
        const remainingTtl = Math.max(0, Math.floor((entry.expires - Date.now()) / 1000));
        if (remainingTtl > 0) {
          await this.kv.put(key, JSON.stringify(entry), {
            expirationTtl: remainingTtl,
          });
        }
      }
    } catch (error) {
      console.error(`[CACHE] Metadata update error for ${key}:`, error);
    }
  }
}

// Factory function to create the service
export function createCachingService(env: Bindings): CachingService {
  const kvNamespace = env.CACHE_KV; // Cloudflare KV namespace for caching
  
  if (!kvNamespace) {
    console.warn('[CACHE] No KV namespace provided, caching will be disabled');
    
    // Return a no-op implementation
    return {
      async get<T>(): Promise<T | null> { return null; },
      async set(): Promise<void> { },
      async delete(): Promise<void> { },
      async invalidatePattern(): Promise<void> { },
      async getOrSet<T>(_key: string, fetcher: () => Promise<T>): Promise<T> {
        return fetcher();
      }
    };
  }

  return new cachingService(kvNamespace);
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
  metadata: (imageId: string) => `metadata:${imageId}`,
  mediaUrl: (storageKey: string, variant?: string, format?: string) => 
    `media_url:${storageKey}${variant ? `:${variant}` : ''}${format ? `:${format}` : ''}`,
  cdnUrl: (mediaId: string, variant?: string, format?: string) =>
    `cdn_url:${mediaId}${variant ? `:${variant}` : ''}${format ? `:${format}` : ''}`,
  feedPage: (userId: string, cursor?: string) => `feed:${userId}:${cursor || 'start'}`,
  followingFeed: (userId: string, limit: number, cursor?: string) => `following_feed:${userId}:${limit}:${cursor || 'start'}`,
  hashtag: (hashtagId: string) => `hashtag:${hashtagId}`,
  comment: (commentId: string) => `comment:${commentId}`,
  postComments: (postId: string) => `post_comments:${postId}`,
  notification: (userId: string) => `notifications:${userId}`,

  // Recommendation system cache keys
  userVector: (userId: string) => `user_vector:${userId}`,
  userContext: (userId: string) => `user_context:${userId}`,
  discoveryFeed: (userId: string, cursor?: string) =>
    `discovery_feed:${userId}:${cursor || 'start'}`,
  recommendationScores: (userId: string, postIds: string) => `rec_scores:${userId}:${postIds}`,
  seenPosts: (userId: string) => `seen_posts:${userId}`,
  blockedUsers: (userId: string) => `blocked_users:${userId}`,

  // Feedback system cache keys
  feedbackCategories: () => `feedback_categories`,
  feedbackTicket: (ticketId: string) => `feedback_ticket:${ticketId}`,
  userTickets: (userId: string) => `user_tickets:${userId}`,
  adminTickets: (filters?: string) => `admin_tickets${filters ? `:${filters}` : ''}`,

  // CLIP embedding cache keys
  clipTextEmbedding: (textHash: string, model: string, dimensions: number) =>
    `clip_text_embedding:${model}:${dimensions}:${textHash}`,
  clipImageEmbedding: (imageHash: string, model: string, dimensions: number) =>
    `clip_image_embedding:${model}:${dimensions}:${imageHash}`,

  // Voyage embedding cache keys
  voyageTextEmbedding: (textHash: string, model: string, dimensions: number) =>
    `voyage_text_embedding:${model}:${dimensions}:${textHash}`,
  voyageImageEmbedding: (imageHash: string, model: string, dimensions: number) =>
    `voyage_image_embedding:${model}:${dimensions}:${imageHash}`,
  voyageMultimodalEmbedding: (inputHash: string, model: string, dimensions: number) =>
    `voyage_multimodal_embedding:${model}:${dimensions}:${inputHash}`,

  // Image transformation cache keys
  transformedImage: (imageId: string, transformations: any) => 
    `transformed_image:${imageId}:${JSON.stringify(transformations)}`,
  
  // Pattern helpers for invalidation
  userPattern: (userId: string) => `*${userId}*`,
  postPattern: (postId: string) => `*post*${postId}*`,
  mediaPattern: (mediaId: string) => `*${mediaId}*`,
  mediaUrlPattern: (storageKey: string) => `media_url:${storageKey}*`,
  cdnUrlPattern: (mediaId: string) => `cdn_url:${mediaId}*`,
  transformedImagePattern: (imageId: string) => `transformed_image:${imageId}:*`,
  recommendationPattern: (userId: string) => `*rec*${userId}*`,
  discoveryPattern: (userId: string) => `discovery_feed:${userId}:*`,
  clipEmbeddingPattern: (model: string) => `clip_*_embedding:${model}:*`,
  voyageEmbeddingPattern: (model: string) => `voyage_*_embedding:${model}:*`,
} as const;

// Cache TTL constants (in seconds)
export const CacheTTL = {
  SHORT: 60, // 1 minute - for frequently changing data
  MEDIUM: 300, // 5 minutes - for moderately changing data
  LONG: 1800, // 30 minutes - for rarely changing data
  VERY_LONG: 3600, // 1 hour - for static-ish data
  FEED: 120, // 2 minutes - for feeds
  PROFILE: 600, // 10 minutes - for profiles
  MEDIA: 3600, // 1 hour - for media metadata
  METADATA: 3600, // 1 hour - for image metadata

  // Recommendation system TTLs
  USER_VECTOR: 1800, // 30 minutes - user interest vectors
  USER_CONTEXT: 600, // 10 minutes - user context and preferences
  DISCOVERY_FEED: 300, // 5 minutes - discovery feed results
  RECOMMENDATION_SCORES: 180, // 3 minutes - computed recommendation scores
  SEEN_POSTS: 3600, // 1 hour - seen posts cache
  BLOCKED_USERS: 1800, // 30 minutes - blocked users list

  // CLIP embedding TTLs
  CLIP_TEXT_EMBEDDING: 7200, // 2 hours - text embeddings (static for same text)
  CLIP_IMAGE_EMBEDDING: 7200, // 2 hours - image embeddings (static for same image)
  CLIP_MULTIMODAL_EMBEDDING: 3600, // 1 hour - multimodal embeddings (may change with context)
} as const;
