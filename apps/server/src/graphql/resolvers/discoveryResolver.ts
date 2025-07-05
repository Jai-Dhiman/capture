/**
 * Discovery Feed GraphQL Resolver
 *
 * Integrates WASM recommendation engine with real-time database pipeline
 * for high-performance discovery feed functionality.
 */

import {
  ManagedDiscoveryScorer,
  scoreContentBatch,
  findSimilarContent,
  WasmPerformanceMonitor,
  type ContentItem,
  type ScoringWeights,
} from '../../lib/wasm/wasmUtils.js';

import { wasmRecommendationEngine } from '../../lib/ai/recommendationEngine.js';
import { RealTimeRecommendationEngine } from '../../lib/ai/realTimeRecommendationEngine.js';
import type { Bindings } from '../../types.js';

// Mock data structures - replace with your actual database types
interface User {
  id: string;
  preferenceVector: Float32Array;
  interactionHistory: string[];
}

interface Post {
  id: string;
  userId: string;
  content: string;
  embeddingVector: Float32Array;
  createdAt: Date;
  likes: number;
  views: number;
  hashtags: string[];
}

interface DiscoveryFeedArgs {
  userId: string;
  limit?: number;
  weights?: ScoringWeights;
  experimentalFeatures?: boolean;
  diversityBoost?: number;
  recencyBoost?: number;
}

interface SimilarContentArgs {
  postId: string;
  limit?: number;
  userId?: string;
}

const performanceMonitor = WasmPerformanceMonitor.getInstance();

/**
 * Discovery Feed Resolver with WASM Integration
 */
export const discoveryResolvers = {
  Query: {
    /**
     * Get personalized discovery feed using WASM recommendation engine
     */
    discoveryFeed: async (
      parent: any,
      args: DiscoveryFeedArgs,
      context: { bindings: Bindings; user?: User },
    ) => {
      const {
        userId,
        limit = 20,
        weights,
        experimentalFeatures = false,
        diversityBoost = 0.1,
        recencyBoost = 0.2,
      } = args;

      return performanceMonitor.measureOperation('wasmDiscoveryFeed', async () => {
        try {
          // Use WASM recommendation engine for enhanced performance
          if (experimentalFeatures) {
            // Initialize WASM engine with bindings if not already done
            wasmRecommendationEngine.initialize(context.bindings);

            const recommendations = await wasmRecommendationEngine.generateDiscoveryFeed({
              userId,
              limit,
              customWeights: weights,
              diversityBoost,
              recencyBoost,
              experimentalFeatures: true,
            });

            return recommendations.map((rec) => ({
              id: rec.postId,
              userId: rec.userId,
              content: rec.content || '',
              createdAt: rec.createdAt.toISOString(),
              likes: rec.saveCount,
              views: rec.viewCount,
              hashtags: rec.hashtags,
              discoveryScore: rec.finalScore,
              similarityScore: rec.similarityScore,
              engagementScore: rec.engagementScore,
              temporalScore: rec.temporalScore,
              diversityScore: rec.diversityScore,
              contentTypeScore: rec.contentTypeScore,
            }));
          }

          // Use real-time recommendation engine with database integration
          const realtimeEngine = new RealTimeRecommendationEngine(context.bindings);
          const { posts, metrics } = await realtimeEngine.generateRecommendations(userId, limit, {
            diversityBoost,
            recencyBoost,
            engagementBoost: 0.2,
          });

          // Log performance metrics
          console.log('Recommendation metrics:', metrics);

          // Convert to GraphQL format
          return posts.map((post) => ({
            id: post.id,
            userId: post.userId,
            content: post.content,
            createdAt: post.createdAt.toISOString(),
            likes: post.saveCount,
            views: post.viewCount,
            hashtags: post.hashtags,
            discoveryScore: post.finalScore || 0,
            similarityScore: post.similarityScore || 0,
            engagementScore: post.engagementScore || 0,
            temporalScore: post.temporalScore || 0,
          }));
        } catch (error) {
          console.error('Error generating WASM discovery feed:', error);

          // Fallback to basic recommendation system
          console.warn('Falling back to basic recommendation system');
          return await getFallbackDiscoveryFeed(userId, limit, context.bindings);
        }
      });
    },

    /**
     * Find content similar to a specific post using WASM engine
     */
    similarContent: async (
      parent: any,
      args: SimilarContentArgs,
      context: { bindings: Bindings; user?: User },
    ) => {
      const { postId, limit = 10, userId } = args;
      const requestUserId = userId || context.user?.id;

      if (!requestUserId) {
        throw new Error('User ID required for similar content');
      }

      return performanceMonitor.measureOperation('wasmSimilarContent', async () => {
        try {
          // Initialize WASM engine with bindings if not already done
          wasmRecommendationEngine.initialize(context.bindings);

          // Use WASM recommendation engine for similarity search
          const similarPosts = await wasmRecommendationEngine.findSimilarPosts(
            postId,
            requestUserId,
            limit,
          );

          return similarPosts.map((post) => ({
            id: post.postId,
            userId: post.userId,
            content: post.content || '',
            createdAt: post.createdAt.toISOString(),
            likes: post.saveCount,
            views: post.viewCount,
            hashtags: post.hashtags,
            similarityScore: post.similarityScore,
            engagementScore: post.engagementScore,
            temporalScore: post.temporalScore,
            rank: post.rank,
          }));
        } catch (error) {
          console.error('Error finding similar content with WASM:', error);

          // Fallback to basic similarity search
          console.warn('Falling back to basic similarity search');
          const realtimeEngine = new RealTimeRecommendationEngine(context.bindings);

          // Get reference post embedding and find similar posts
          const referenceEmbedding = await realtimeEngine.getPostEmbedding(postId);
          if (!referenceEmbedding) {
            throw new Error('Reference post not found');
          }

          // For now, return empty array as fallback
          // Could implement basic similarity search here
          return [];
        }
      });
    },

    /**
     * Get performance metrics for WASM operations
     */
    wasmPerformanceMetrics: async () => {
      return performanceMonitor.getAllMetrics();
    },

    /**
     * Get recommendation explanations for debugging
     */
    recommendationExplanations: async (
      parent: any,
      args: { userId: string; postIds: string[] },
      context: { bindings: Bindings },
    ) => {
      const { userId, postIds } = args;

      try {
        // Get recommendations for the posts
        const realtimeEngine = new RealTimeRecommendationEngine(context.bindings);
        const { posts } = await realtimeEngine.generateRecommendations(userId, 50);

        const relevantPosts = posts.filter((post) => postIds.includes(post.id));

        // Generate explanations (simplified version)
        return relevantPosts.map((post) => ({
          postId: post.id,
          reasons: {
            similarity: {
              score: post.similarityScore || 0,
              explanation: `${((post.similarityScore || 0) * 100).toFixed(1)}% similar to your interests`,
            },
            engagement: {
              score: post.engagementScore || 0,
              explanation: `High engagement: ${post.saveCount} saves, ${post.commentCount} comments`,
            },
            recency: {
              score: post.temporalScore || 0,
              explanation: `Posted recently`,
            },
          },
          primaryReason: 'similarity',
        }));
      } catch (error) {
        console.error('Error generating explanations:', error);
        return [];
      }
    },
  },

  Mutation: {
    /**
     * Update user discovery preferences using WASM engine
     */
    updateDiscoveryPreferences: async (
      parent: any,
      args: { userId: string; interactionData: any },
      context: { bindings: Bindings; user?: User },
    ) => {
      const { userId, interactionData } = args;

      return performanceMonitor.measureOperation('wasmUpdatePreferences', async () => {
        try {
          // Use WASM recommendation engine for preference updates
          const updatedPreferences = await wasmRecommendationEngine.updateUserPreferences(userId, {
            postIds: interactionData.postIds,
            interactionTypes: interactionData.interactionTypes || ['save'],
            weights: interactionData.weights,
          });

          return {
            success: true,
            message: 'Preferences updated with WASM engine',
            preferencesUpdated: updatedPreferences.lastUpdated,
          };
        } catch (error) {
          console.error('Error updating preferences with WASM:', error);

          // Fallback to real-time engine
          try {
            const realtimeEngine = new RealTimeRecommendationEngine(context.bindings);
            await realtimeEngine.updateSeenPosts(userId, interactionData.postIds);

            return {
              success: true,
              message: 'Preferences updated with fallback system',
            };
          } catch (fallbackError) {
            console.error('Fallback preference update failed:', fallbackError);
            throw new Error('Failed to update discovery preferences');
          }
        }
      });
    },

    /**
     * Clear user's recommendation cache
     */
    clearRecommendationCache: async (
      parent: any,
      args: { userId: string },
      context: { bindings: Bindings },
    ) => {
      const { userId } = args;

      try {
        const realtimeEngine = new RealTimeRecommendationEngine(context.bindings);
        await realtimeEngine.clearCaches();

        return {
          success: true,
          message: 'Recommendation cache cleared successfully',
        };
      } catch (error) {
        console.error('Error clearing recommendation cache:', error);
        throw new Error('Failed to clear recommendation cache');
      }
    },
  },
};

// Fallback functions for error handling

/**
 * Fallback discovery feed using basic recommendation system
 */
async function getFallbackDiscoveryFeed(
  userId: string,
  limit: number,
  bindings: Bindings,
): Promise<any[]> {
  try {
    const realtimeEngine = new RealTimeRecommendationEngine(bindings);
    const { posts } = await realtimeEngine.generateRecommendations(userId, limit);

    return posts.map((post) => ({
      id: post.id,
      userId: post.userId,
      content: post.content,
      createdAt: post.createdAt.toISOString(),
      likes: post.saveCount,
      views: post.viewCount,
      hashtags: post.hashtags,
      discoveryScore: 0.5, // Default score
      similarityScore: 0,
      engagementScore: 0,
      temporalScore: 0,
    }));
  } catch (error) {
    console.error('Fallback discovery feed failed:', error);
    return [];
  }
}

// Enhanced Type definitions for GraphQL schema with WASM support
export const discoveryTypeDefs = `
  type Post {
    id: ID!
    userId: ID!
    content: String!
    createdAt: String!
    likes: Int!
    views: Int!
    hashtags: [String!]!
    discoveryScore: Float
    similarityScore: Float
    engagementScore: Float
    temporalScore: Float
    diversityScore: Float
    contentTypeScore: Float
    rank: Int
  }

  type PerformanceMetric {
    avg: Float!
    min: Float!
    max: Float!
    count: Int!
  }

  type RecommendationReason {
    score: Float!
    explanation: String!
  }

  type RecommendationExplanation {
    postId: ID!
    reasons: RecommendationReasons!
    primaryReason: String!
  }

  type RecommendationReasons {
    similarity: RecommendationReason!
    engagement: RecommendationReason!
    recency: RecommendationReason!
  }

  input ScoringWeights {
    relevance: Float!
    recency: Float!
    popularity: Float!
    diversity: Float!
  }

  input InteractionData {
    postIds: [ID!]!
    interactionTypes: [String!]
    weights: [Float!]
  }

  type UpdateResult {
    success: Boolean!
    message: String!
    preferencesUpdated: String
  }

  extend type Query {
    discoveryFeed(
      userId: ID!, 
      limit: Int, 
      weights: ScoringWeights,
      experimentalFeatures: Boolean,
      diversityBoost: Float,
      recencyBoost: Float
    ): [Post!]!
    
    similarContent(postId: ID!, limit: Int, userId: ID): [Post!]!
    
    wasmPerformanceMetrics: [PerformanceMetric!]!
    
    recommendationExplanations(userId: ID!, postIds: [ID!]!): [RecommendationExplanation!]!
  }

  extend type Mutation {
    updateDiscoveryPreferences(userId: ID!, interactionData: InteractionData!): UpdateResult!
    
    clearRecommendationCache(userId: ID!): UpdateResult!
  }
`;
