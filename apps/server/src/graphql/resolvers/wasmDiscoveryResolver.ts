/**
 * WASM-Enhanced Discovery Resolver
 *
 * Drop-in replacement for the existing discovery resolver that leverages
 * high-performance WASM vector operations while maintaining API compatibility.
 */

import {
  wasmRecommendationEngine,
  type RecommendationOptions,
} from '../../lib/ai/recommendationEngine.js';
import { RealTimeRecommendationEngine } from '../../lib/ai/realTimeRecommendationEngine.js';
import { WasmPerformanceMonitor } from '../../lib/wasm/wasmUtils.js';
import { cachingService } from '../../lib/cache/cachingService.js';
import { getUserContext } from '../../lib/monitoring/userContext.js';
import { qdrantClient } from '../../lib/infrastructure/qdrantClient.js';
import type { Bindings } from '../../types.js';

// Import database query functions
import {
  getSeenPostsForUser,
  getBlockedUsersForUser,
  getFollowingForUser,
  getFollowersForUser,
} from '../../db/queries/userInteractions.js';
import {
  filterPostsByPrivacyAndFollowing,
  getVisiblePostsForUser,
  canUserSeePost,
} from '../../db/queries/privacyFilters.js';

const performanceMonitor = WasmPerformanceMonitor.getInstance();

interface DiscoveryFeedArgs {
  limit?: number;
  cursor?: string;
  experimentalFeatures?: boolean;
  customWeights?: {
    relevance?: number;
    recency?: number;
    popularity?: number;
    diversity?: number;
  };
}

interface SimilarContentArgs {
  postId: string;
  limit?: number;
}

interface Context {
  user: {
    id: string;
    preferenceVector?: Float32Array;
  };
  bindings: Bindings;
}

/**
 * Enhanced Discovery Resolver with WASM acceleration
 */
export const wasmDiscoveryResolvers = {
  Query: {
    /**
     * Generate discovery feed using WASM vector operations
     * Drop-in replacement for existing discoverFeed resolver
     */
    discoverFeed: async (parent: any, args: DiscoveryFeedArgs, context: Context) => {
      const { limit = 20, cursor, experimentalFeatures = true, customWeights } = args;
      const userId = context.user.id;

      return performanceMonitor.measureOperation('wasm-discover-feed-resolver', async () => {
        try {
          // Check cache first (same as existing implementation)
          const cacheKey = `discovery-feed:${userId}:${limit}:${cursor || 'start'}`;
          const cached = await cachingService.get(cacheKey);

          if (cached && !experimentalFeatures) {
            console.log('Returning cached discovery feed');
            return JSON.parse(cached);
          }

          // Use integrated real-time recommendation engine with database
          const realtimeEngine = new RealTimeRecommendationEngine(context.bindings);

          // Convert weights to recommendation engine format
          const recommendationOptions = {
            diversityBoost: customWeights?.diversity || 0.1,
            recencyBoost: customWeights?.recency || 0.25,
            engagementBoost: customWeights?.popularity || 0.3,
          };

          const { posts: scoredPosts, metrics } = await realtimeEngine.generateRecommendations(
            userId,
            limit,
            recommendationOptions,
          );

          // Log performance metrics
          console.log('Real-time recommendation metrics:', {
            postsProcessed: metrics.postsProcessed,
            processingTimeMs: metrics.processingTimeMs,
            cacheHits: metrics.cacheHits,
            qualityScore: metrics.qualityScore,
          });

          if (scoredPosts.length === 0) {
            const emptyResult = { posts: [], hasMore: false, nextCursor: null };
            await cachingService.set(cacheKey, JSON.stringify(emptyResult), 300);
            return emptyResult;
          }

          // Convert to GraphQL response format (maintain existing API)
          const posts = scoredPosts.map((post) => ({
            id: post.id,
            userId: post.userId,
            content: post.content || '',
            createdAt: post.createdAt.toISOString(),
            hashtags: post.hashtags,
            _saveCount: post.saveCount,
            _commentCount: post.commentCount,
            // Add real-time engine scores for debugging/analytics
            ...(experimentalFeatures && {
              wasmScores: {
                discovery: post.finalScore || 0,
                similarity: post.similarityScore || 0,
                engagement: post.engagementScore || 0,
                temporal: post.temporalScore || 0,
                diversity: 0, // Not available in current implementation
                contentType: 0, // Not available in current implementation
                final: post.finalScore || 0,
              },
            }),
          }));

          // Implement cursor pagination (same as existing)
          const hasMore = scoredPosts.length >= limit;
          const nextCursor = hasMore ? posts[posts.length - 1]?.id : null;

          const result = {
            posts: posts.slice(0, limit),
            hasMore,
            nextCursor,
            // Add performance metrics for monitoring
            ...(experimentalFeatures && {
              wasmMetrics: {
                processingTime: metrics.processingTimeMs,
                candidateCount: metrics.postsProcessed,
                scoringMethod: 'realtime-engine',
              },
            }),
          };

          // Cache result (shorter TTL for experimental features)
          const ttl = experimentalFeatures ? 180 : 300; // 3-5 minutes
          await cachingService.set(cacheKey, JSON.stringify(result), ttl);

          return result;
        } catch (error) {
          console.error('Real-time discovery feed generation failed:', error);

          // Graceful fallback to basic discovery algorithm
          console.log('Falling back to basic discovery algorithm');
          return await fallbackToOriginalDiscovery(userId, limit, cursor, context.bindings);
        }
      });
    },

    /**
     * Find similar content using WASM vector operations
     * Enhanced version of existing similar content functionality
     */
    similarContent: async (parent: any, args: SimilarContentArgs, context: Context) => {
      const { postId, limit = 10 } = args;
      const userId = context.user.id;

      return performanceMonitor.measureOperation('wasm-similar-content-resolver', async () => {
        try {
          // Check cache
          const cacheKey = `similar-content:${postId}:${limit}`;
          const cached = await cachingService.get(cacheKey);

          if (cached) {
            return JSON.parse(cached);
          }

          // Use WASM engine for high-performance similarity search
          const similarPosts = await wasmRecommendationEngine.findSimilarPosts(
            postId,
            userId,
            limit,
          );

          // Convert to GraphQL response format
          const result = similarPosts.map((post, index) => ({
            id: post.postId,
            userId: post.userId,
            content: post.content || '',
            createdAt: post.createdAt.toISOString(),
            hashtags: post.hashtags,
            _saveCount: post.saveCount,
            _commentCount: post.commentCount,
            similarityScore: post.similarityScore,
            rank: index + 1,
          }));

          // Cache for 15 minutes
          await cachingService.set(cacheKey, JSON.stringify(result), 900);

          return result;
        } catch (error) {
          console.error('WASM similar content search failed:', error);
          throw new Error('Failed to find similar content');
        }
      });
    },

    /**
     * Get WASM performance metrics for monitoring
     */
    wasmPerformanceMetrics: async () => {
      const metrics = performanceMonitor.getAllMetrics();

      return Object.entries(metrics).map(([operation, data]) => ({
        operation,
        averageTime: data.avg,
        minTime: data.min,
        maxTime: data.max,
        sampleCount: data.count,
        throughput: data.count > 0 ? 1000 / data.avg : 0, // operations per second
      }));
    },

    /**
     * Compare WASM vs original algorithm performance
     */
    algorithmComparison: async (
      parent: any,
      args: { userId: string; sampleSize?: number },
      context: Context,
    ) => {
      const { userId, sampleSize = 20 } = args;

      return performanceMonitor.measureOperation('algorithm-comparison', async () => {
        try {
          // Run both algorithms and compare
          const startTime = performance.now();

          // WASM algorithm
          const wasmStartTime = performance.now();
          const wasmResults = await wasmRecommendationEngine.generateDiscoveryFeed({
            userId,
            limit: sampleSize,
            experimentalFeatures: true,
          });
          const wasmTime = performance.now() - wasmStartTime;

          // Original algorithm (fallback)
          const originalStartTime = performance.now();
          const originalResults = await fallbackToOriginalDiscovery(
            userId,
            sampleSize,
            undefined,
            context.bindings,
          );
          const originalTime = performance.now() - originalStartTime;

          const totalTime = performance.now() - startTime;

          return {
            wasm: {
              executionTime: wasmTime,
              resultCount: wasmResults.length,
              throughput: (wasmResults.length / wasmTime) * 1000,
            },
            original: {
              executionTime: originalTime,
              resultCount: originalResults.posts?.length || 0,
              throughput: ((originalResults.posts?.length || 0) / originalTime) * 1000,
            },
            comparison: {
              speedupFactor: originalTime / wasmTime,
              wasmFaster: wasmTime < originalTime,
              totalTime,
            },
          };
        } catch (error) {
          console.error('Algorithm comparison failed:', error);
          throw new Error('Failed to compare algorithms');
        }
      });
    },
  },

  Mutation: {
    /**
     * Update user preferences using WASM-accelerated learning
     */
    updateUserPreferences: async (
      parent: any,
      args: {
        interactionData: {
          postIds: string[];
          interactionTypes: string[];
          weights?: number[];
        };
      },
      context: Context,
    ) => {
      const userId = context.user.id;
      const { interactionData } = args;

      return performanceMonitor.measureOperation('wasm-preference-update', async () => {
        try {
          const updatedPreferences = await wasmRecommendationEngine.updateUserPreferences(userId, {
            postIds: interactionData.postIds,
            interactionTypes: interactionData.interactionTypes as any[],
            weights: interactionData.weights,
          });

          return {
            success: true,
            message: 'User preferences updated successfully',
            preferencesUpdated: updatedPreferences.lastUpdated.toISOString(),
            vectorDimensions: updatedPreferences.vector.length,
            contentTypeAffinities: updatedPreferences.contentTypeAffinities,
          };
        } catch (error) {
          console.error('WASM preference update failed:', error);
          return {
            success: false,
            message: 'Failed to update user preferences',
            error: error.message,
          };
        }
      });
    },

    /**
     * Batch process discovery feeds for multiple users
     */
    batchGenerateDiscoveryFeeds: async (
      parent: any,
      args: {
        userIds: string[];
        limit?: number;
        customWeights?: any;
      },
      context: Context,
    ) => {
      const { userIds, limit = 20, customWeights } = args;

      return performanceMonitor.measureOperation('wasm-batch-discovery', async () => {
        try {
          const results = await wasmRecommendationEngine.batchGenerateDiscoveryFeeds(userIds, {
            limit,
            customWeights,
            experimentalFeatures: true,
          });

          const processedResults = Array.from(results.entries()).map(([userId, posts]) => ({
            userId,
            postCount: posts.length,
            posts: posts.slice(0, limit).map((post) => ({
              id: post.postId,
              finalScore: post.finalScore,
              discoveryScore: post.discoveryScore,
            })),
          }));

          return {
            success: true,
            processedCount: processedResults.length,
            results: processedResults,
            totalProcessingTime: performanceMonitor.getMetrics('wasm-batch-discovery').avg,
          };
        } catch (error) {
          console.error('Batch discovery generation failed:', error);
          return {
            success: false,
            message: 'Failed to batch generate discovery feeds',
            error: error.message,
          };
        }
      });
    },
  },
};

// Helper functions

/**
 * Get candidate posts using real database filtering logic
 */
async function getCandidatePostsForUser(
  userId: string,
  limit: number,
  bindings: any,
): Promise<any[]> {
  try {
    // Get user interaction data in parallel for efficient filtering
    const [seenPosts, blockedUsers, userContext] = await Promise.all([
      getSeenPostsForUser(userId, bindings),
      getBlockedUsersForUser(userId, bindings),
      getUserContext({ userId }),
    ]);

    // Use the new privacy filter function to get visible posts
    const visiblePosts = await getVisiblePostsForUser(userId, bindings, {
      limit: limit * 2, // Get extra for additional filtering
      orderBy: 'newest',
      includeOwnPosts: false,
      excludeSeenPosts: seenPosts,
      excludeUserIds: blockedUsers,
      contentTypes: ['post', 'text', 'image'], // Filter content types as needed
      minCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
    });

    // Convert to format expected by WASM recommendation engine
    return visiblePosts.map((post) => ({
      id: post.id,
      userId: post.userId,
      content: post.content,
      createdAt: new Date(post.createdAt),
      hashtags: [], // Would need to fetch hashtags separately if needed
      embeddingVector: new Float32Array(768), // Would need to fetch from vector DB
      _saveCount: post._saveCount,
      _commentCount: post._commentCount,
      contentType: post.type,
      isPrivate: post.authorIsPrivate === 1,
      authorUsername: post.authorUsername,
      authorVerifiedType: post.authorVerifiedType,
      authorProfileImage: post.authorProfileImage,
    }));
  } catch (error) {
    console.error('Failed to get candidate posts:', error);
    return [];
  }
}

/**
 * Fallback to original discovery algorithm
 */
async function fallbackToOriginalDiscovery(
  userId: string,
  limit: number,
  cursor?: string,
  bindings?: any,
): Promise<any> {
  try {
    // Use the database-backed discovery as fallback
    console.log('Using fallback discovery algorithm');

    if (!bindings) {
      throw new Error('Bindings required for database fallback');
    }

    const fallbackPosts = await getVisiblePostsForUser(userId, bindings, {
      limit,
      orderBy: 'newest',
      includeOwnPosts: false,
    });

    const posts = fallbackPosts.map((post) => ({
      id: post.id,
      userId: post.userId,
      content: post.content,
      createdAt: post.createdAt,
      hashtags: [],
      _saveCount: post._saveCount,
      _commentCount: post._commentCount,
    }));

    return {
      posts,
      hasMore: posts.length >= limit,
      nextCursor: posts.length > 0 ? posts[posts.length - 1].id : null,
      fallbackUsed: true,
    };
  } catch (error) {
    console.error('Fallback discovery also failed:', error);
    return {
      posts: [],
      hasMore: false,
      nextCursor: null,
      error: 'Both WASM and fallback algorithms failed',
    };
  }
}

// GraphQL type definitions for the enhanced resolver
export const wasmDiscoveryTypeDefs = `
  extend type Query {
    discoverFeed(
      limit: Int
      cursor: String
      experimentalFeatures: Boolean
      customWeights: ScoringWeightsInput
    ): DiscoveryFeedResult!
    
    similarContent(postId: ID!, limit: Int): [SimilarPost!]!
    
    wasmPerformanceMetrics: [PerformanceMetric!]!
    
    algorithmComparison(userId: ID!, sampleSize: Int): AlgorithmComparisonResult!
  }

  extend type Mutation {
    updateUserPreferences(interactionData: InteractionDataInput!): PreferenceUpdateResult!
    
    batchGenerateDiscoveryFeeds(
      userIds: [ID!]!
      limit: Int
      customWeights: ScoringWeightsInput
    ): BatchDiscoveryResult!
  }

  input ScoringWeightsInput {
    relevance: Float
    recency: Float
    popularity: Float
    diversity: Float
  }

  input InteractionDataInput {
    postIds: [ID!]!
    interactionTypes: [String!]!
    weights: [Float!]
  }

  type DiscoveryFeedResult {
    posts: [DiscoveryPost!]!
    hasMore: Boolean!
    nextCursor: String
    wasmMetrics: WasmMetrics
  }

  type DiscoveryPost {
    id: ID!
    userId: ID!
    content: String!
    createdAt: String!
    hashtags: [String!]!
    _saveCount: Int!
    _commentCount: Int!
    wasmScores: WasmScores
  }

  type WasmScores {
    discovery: Float!
    similarity: Float!
    engagement: Float!
    temporal: Float!
    diversity: Float!
    contentType: Float!
    final: Float!
  }

  type WasmMetrics {
    processingTime: Float!
    candidateCount: Int!
    scoringMethod: String!
  }

  type SimilarPost {
    id: ID!
    userId: ID!
    content: String!
    createdAt: String!
    hashtags: [String!]!
    _saveCount: Int!
    _commentCount: Int!
    similarityScore: Float!
    rank: Int!
  }

  type PerformanceMetric {
    operation: String!
    averageTime: Float!
    minTime: Float!
    maxTime: Float!
    sampleCount: Int!
    throughput: Float!
  }

  type AlgorithmComparisonResult {
    wasm: AlgorithmMetrics!
    original: AlgorithmMetrics!
    comparison: ComparisonMetrics!
  }

  type AlgorithmMetrics {
    executionTime: Float!
    resultCount: Int!
    throughput: Float!
  }

  type ComparisonMetrics {
    speedupFactor: Float!
    wasmFaster: Boolean!
    totalTime: Float!
  }

  type PreferenceUpdateResult {
    success: Boolean!
    message: String!
    preferencesUpdated: String
    vectorDimensions: Int
    contentTypeAffinities: JSON
    error: String
  }

  type BatchDiscoveryResult {
    success: Boolean!
    processedCount: Int!
    results: [BatchDiscoveryUserResult!]!
    totalProcessingTime: Float!
    message: String
    error: String
  }

  type BatchDiscoveryUserResult {
    userId: ID!
    postCount: Int!
    posts: [BatchDiscoveryPost!]!
  }

  type BatchDiscoveryPost {
    id: ID!
    finalScore: Float!
    discoveryScore: Float!
  }
`;
