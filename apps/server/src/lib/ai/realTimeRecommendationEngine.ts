import { eq, desc, and, inArray, gt, sql } from 'drizzle-orm';
import { post, profile, savedPost, postLike, seenPostLog } from '../db/schema';
import { createD1Client } from '../db/index';
import { createCachedQueries } from '../db/queries/cached';
import { createMonitoredQueries } from '../db/queries/monitoring';
import { qdrantClient } from '../infrastructure/qdrantClient';
import type { Bindings } from '../types';

export interface PostEmbedding {
  postId: string;
  vector: Float32Array;
  metadata: {
    contentType: string;
    hashtags: string[];
    createdAt: Date;
  };
}

export interface CandidatePost {
  id: string;
  userId: string;
  content: string;
  hashtags: string[];
  createdAt: Date;
  saveCount: number;
  commentCount: number;
  viewCount: number;
  embeddingVector?: Float32Array;
  isPrivate: boolean;
  authorUsername: string;
}

export interface RecommendationMetrics {
  postsProcessed: number;
  embeddingsRetrieved: number;
  cacheHits: number;
  processingTimeMs: number;
  qualityScore: number;
}

export class RealTimeRecommendationEngine {
  private db: any;
  private cache: any;
  private monitor: any;
  private bindings: Bindings;

  constructor(bindings: Bindings) {
    this.bindings = bindings;
    this.db = createD1Client(bindings);
    this.cache = createCachedQueries(bindings);
    this.monitor = createMonitoredQueries(bindings);
  }

  /**
   * Get candidate posts for recommendation with real-time filtering
   */
  async getCandidatePosts(
    userId: string,
    limit: number = 100,
    excludeSeenPosts: boolean = true,
  ): Promise<CandidatePost[]> {
    const startTime = Date.now();

    try {
      // Get user interaction data for filtering
      const [seenPosts, savedPosts, likedPosts] = await Promise.all([
        excludeSeenPosts ? this.cache.getSeenPostsForUser(userId) : [],
        this.cache.getUserSavedPosts ? this.cache.getUserSavedPosts(userId) : [],
        this.getLikedPostsForUser(userId),
      ]);

      // Build exclusion list
      const excludePostIds = new Set([...seenPosts, ...savedPosts, ...likedPosts]);

      // Query recent posts with engagement data
      const candidateQuery = this.db
        .select({
          id: post.id,
          userId: post.userId,
          content: post.content,
          createdAt: post.createdAt,
          saveCount: post._saveCount,
          commentCount: post._commentCount,
          isPrivate: profile.isPrivate,
          authorUsername: profile.username,
        })
        .from(post)
        .innerJoin(profile, eq(post.userId, profile.userId))
        .where(
          and(
            eq(post.isDraft, 0),
            gt(post.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()), // Last 7 days
            sql`${post.id} NOT IN (${Array.from(excludePostIds)
              .map((id) => `'${id}'`)
              .join(',')})`,
          ),
        )
        .orderBy(desc(post.createdAt))
        .limit(limit * 2); // Get extra for filtering

      const results = await candidateQuery;

      // Apply privacy filtering using cached queries
      const visiblePosts = await this.cache.filterPostsByPrivacyAndFollowing(
        results.map((p) => ({ id: p.id, userId: p.userId })),
        userId,
      );

      const visiblePostIds = new Set(visiblePosts.map((p) => p.id));
      const filteredResults = results.filter((p) => visiblePostIds.has(p.id));

      // Convert to CandidatePost format
      const candidatePosts: CandidatePost[] = filteredResults.map((p) => ({
        id: p.id,
        userId: p.userId,
        content: p.content,
        hashtags: [], // Would be populated from hashtag join
        createdAt: new Date(p.createdAt),
        saveCount: p.saveCount,
        commentCount: p.commentCount,
        viewCount: 0, // Would be from analytics
        isPrivate: p.isPrivate === 1,
        authorUsername: p.authorUsername,
      }));

      // Batch retrieve embeddings
      await this.batchRetrieveEmbeddings(candidatePosts);

      const processingTime = Date.now() - startTime;
      console.log(`Retrieved ${candidatePosts.length} candidate posts in ${processingTime}ms`);

      return candidatePosts.slice(0, limit);
    } catch (error) {
      console.error('Error getting candidate posts:', error);
      throw new Error('Failed to retrieve candidate posts');
    }
  }

  /**
   * Get post embeddings from vector database with caching
   */
  async getPostEmbedding(postId: string): Promise<PostEmbedding | null> {
    const cacheKey = `embedding:${postId}`;

    try {
      // Check cache first
      const cached = await this.cache.cache.get<PostEmbedding>(cacheKey);
      if (cached) {
        return cached;
      }

      // Query from Qdrant
      const searchResult = await qdrantClient.scroll({
        collection_name: 'posts',
        filter: {
          must: [{ key: 'post_id', match: { value: postId } }],
        },
        limit: 1,
        with_vector: true,
      });

      if (!searchResult.points || searchResult.points.length === 0) {
        return null;
      }

      const point = searchResult.points[0];
      const embedding: PostEmbedding = {
        postId,
        vector: new Float32Array(point.vector as number[]),
        metadata: {
          contentType: (point.payload?.content_type as string) || 'text',
          hashtags: (point.payload?.hashtags as string[]) || [],
          createdAt: new Date(point.payload?.created_at as string),
        },
      };

      // Cache for 1 hour
      await this.cache.cache.set(cacheKey, embedding, 3600);

      return embedding;
    } catch (error) {
      console.error(`Error getting embedding for post ${postId}:`, error);
      return null;
    }
  }

  /**
   * Batch retrieve embeddings for multiple posts
   */
  async batchRetrieveEmbeddings(posts: CandidatePost[]): Promise<void> {
    const batchSize = 50;
    const batches = [];

    for (let i = 0; i < posts.length; i += batchSize) {
      batches.push(posts.slice(i, i + batchSize));
    }

    await Promise.all(
      batches.map(async (batch) => {
        const postIds = batch.map((p) => p.id);

        try {
          // Query Qdrant for batch of embeddings
          const searchResult = await qdrantClient.scroll({
            collection_name: 'posts',
            filter: {
              must: [{ key: 'post_id', match: { any: postIds } }],
            },
            limit: postIds.length,
            with_vector: true,
          });

          if (searchResult.points) {
            // Map embeddings back to posts
            const embeddingMap = new Map();
            searchResult.points.forEach((point) => {
              const postId = point.payload?.post_id as string;
              embeddingMap.set(postId, new Float32Array(point.vector as number[]));
            });

            // Assign embeddings to posts
            batch.forEach((post) => {
              const embedding = embeddingMap.get(post.id);
              if (embedding) {
                post.embeddingVector = embedding;
              }
            });
          }
        } catch (error) {
          console.error('Error in batch embedding retrieval:', error);
          // Continue without embeddings for this batch
        }
      }),
    );
  }

  /**
   * Get user's saved posts
   */
  async getUserSavedPosts(userId: string): Promise<string[]> {
    try {
      const savedPosts = await this.db
        .select({ postId: savedPost.postId })
        .from(savedPost)
        .where(eq(savedPost.userId, userId))
        .orderBy(desc(savedPost.createdAt))
        .limit(1000);

      return savedPosts.map((sp) => sp.postId);
    } catch (error) {
      console.error('Error getting saved posts:', error);
      return [];
    }
  }

  /**
   * Get user's liked posts for filtering
   */
  async getLikedPostsForUser(userId: string): Promise<string[]> {
    try {
      const likedPosts = await this.db
        .select({ postId: postLike.postId })
        .from(postLike)
        .where(eq(postLike.userId, userId))
        .orderBy(desc(postLike.createdAt))
        .limit(1000);

      return likedPosts.map((lp) => lp.postId);
    } catch (error) {
      console.error('Error getting liked posts:', error);
      return [];
    }
  }

  /**
   * Update user's seen posts log
   */
  async updateSeenPosts(userId: string, postIds: string[]): Promise<void> {
    if (postIds.length === 0) return;

    try {
      const seenEntries = postIds.map((postId) => ({
        userId,
        postId,
        seenAt: new Date().toISOString(),
      }));

      await this.db.insert(seenPostLog).values(seenEntries).onConflictDoNothing();

      // Invalidate cache
      await this.cache.cache.delete(`seen_posts:${userId}`);
    } catch (error) {
      console.error('Error updating seen posts:', error);
    }
  }

  /**
   * Get user preference vector from interactions
   */
  async getUserPreferenceVector(userId: string): Promise<Float32Array | null> {
    const cacheKey = `user_preferences:${userId}`;

    try {
      // Check cache first
      const cached = await this.cache.cache.get<Float32Array>(cacheKey);
      if (cached) {
        return cached;
      }

      // Get user's interaction history
      const [savedPosts, likedPosts] = await Promise.all([
        this.getUserSavedPosts(userId),
        this.getLikedPostsForUser(userId),
      ]);

      const interactionPostIds = [...new Set([...savedPosts, ...likedPosts])];

      if (interactionPostIds.length === 0) {
        return null;
      }

      // Get embeddings for interacted posts
      const embeddings: Float32Array[] = [];

      for (const postId of interactionPostIds.slice(0, 100)) {
        // Limit for performance
        const embedding = await this.getPostEmbedding(postId);
        if (embedding) {
          embeddings.push(embedding.vector);
        }
      }

      if (embeddings.length === 0) {
        return null;
      }

      // Compute centroid (simple average)
      const dimension = embeddings[0].length;
      const centroid = new Float32Array(dimension);

      for (const embedding of embeddings) {
        for (let i = 0; i < dimension; i++) {
          centroid[i] += embedding[i];
        }
      }

      for (let i = 0; i < dimension; i++) {
        centroid[i] /= embeddings.length;
      }

      // Cache for 30 minutes
      await this.cache.cache.set(cacheKey, centroid, 1800);

      return centroid;
    } catch (error) {
      console.error('Error computing user preference vector:', error);
      return null;
    }
  }

  /**
   * Generate recommendations using WASM engine
   */
  async generateRecommendations(
    userId: string,
    limit: number = 20,
    options: {
      diversityBoost?: number;
      recencyBoost?: number;
      engagementBoost?: number;
    } = {},
  ): Promise<{ posts: CandidatePost[]; metrics: RecommendationMetrics }> {
    const startTime = Date.now();
    let metrics: RecommendationMetrics = {
      postsProcessed: 0,
      embeddingsRetrieved: 0,
      cacheHits: 0,
      processingTimeMs: 0,
      qualityScore: 0,
    };

    try {
      // Get candidate posts
      const candidatePosts = await this.getCandidatePosts(userId, limit * 3);
      metrics.postsProcessed = candidatePosts.length;

      // Get user preference vector
      const userVector = await this.getUserPreferenceVector(userId);

      if (!userVector || candidatePosts.length === 0) {
        // Fallback to recency-based ranking
        const sortedPosts = candidatePosts
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, limit);

        metrics.processingTimeMs = Date.now() - startTime;
        return { posts: sortedPosts, metrics };
      }

      // Score posts using similarity and engagement
      const scoredPosts = candidatePosts
        .filter((post) => post.embeddingVector) // Only posts with embeddings
        .map((post) => {
          const similarity = this.computeCosineSimilarity(userVector, post.embeddingVector!);
          const recencyScore = this.computeRecencyScore(post.createdAt);
          const engagementScore = this.computeEngagementScore(post.saveCount, post.commentCount);

          const finalScore =
            similarity * 0.6 +
            recencyScore * (options.recencyBoost || 0.2) +
            engagementScore * (options.engagementBoost || 0.2);

          return {
            ...post,
            similarityScore: similarity,
            recencyScore,
            engagementScore,
            finalScore,
          };
        })
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, limit);

      metrics.embeddingsRetrieved = scoredPosts.length;
      metrics.processingTimeMs = Date.now() - startTime;
      metrics.qualityScore =
        scoredPosts.length > 0
          ? scoredPosts.reduce((sum, p) => sum + p.finalScore, 0) / scoredPosts.length
          : 0;

      return { posts: scoredPosts, metrics };
    } catch (error) {
      console.error('Error generating recommendations:', error);
      metrics.processingTimeMs = Date.now() - startTime;

      // Return fallback recommendations
      const fallbackPosts = await this.getFallbackRecommendations(userId, limit);
      return { posts: fallbackPosts, metrics };
    }
  }

  /**
   * Get fallback recommendations (recency-based)
   */
  private async getFallbackRecommendations(
    userId: string,
    limit: number,
  ): Promise<CandidatePost[]> {
    try {
      const candidatePosts = await this.getCandidatePosts(userId, limit * 2, false);
      return candidatePosts
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting fallback recommendations:', error);
      return [];
    }
  }

  /**
   * Compute cosine similarity between vectors using WASM
   */
  private async computeCosineSimilarity(a: Float32Array, b: Float32Array): Promise<number> {
    try {
      // Try to use WASM for better performance
      const { wasmVectorService } = await import('../wasm/wasmVectorService');
      return wasmVectorService.computeCosineSimilarity(a, b);
    } catch (error) {
      console.warn('WASM cosine similarity failed, falling back to JS:', error);
      return this.fallbackCosineSimilarity(a, b);
    }
  }

  /**
   * JavaScript fallback for cosine similarity
   */
  private fallbackCosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Compute recency score (newer posts get higher scores)
   */
  private computeRecencyScore(createdAt: Date): number {
    const hoursSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    return Math.exp(-hoursSince / 24); // 24-hour half-life
  }

  /**
   * Compute engagement score based on saves and comments
   */
  private computeEngagementScore(saveCount: number, commentCount: number): number {
    const totalEngagement = saveCount * 2 + commentCount; // Weight saves more
    return Math.log(totalEngagement + 1) / Math.log(101); // Normalize to 0-1
  }

  /**
   * Get connection pool statistics
   */
  async getConnectionStats(): Promise<{
    activeConnections: number;
    queuedQueries: number;
    totalQueries: number;
    averageQueryTime: number;
  }> {
    // This would be implemented with actual connection pool
    return {
      activeConnections: 5,
      queuedQueries: 0,
      totalQueries: 1000,
      averageQueryTime: 45,
    };
  }

  /**
   * Clear all caches
   */
  async clearCaches(): Promise<void> {
    await Promise.all([
      this.cache.cache.invalidatePattern('embedding:*'),
      this.cache.cache.invalidatePattern('user_preferences:*'),
      this.cache.cache.invalidatePattern('seen_posts:*'),
    ]);
  }
}
