/**
 * Advanced WASM-Based Recommendation Engine
 *
 * This module provides a high-performance replacement for the existing
 * TypeScript recommendation system, leveraging WebAssembly for vector
 * operations while maintaining compatibility with the existing architecture.
 */

import {
  ManagedBatchProcessor,
  computeUserPreferenceCentroid,
  WasmPerformanceMonitor,
  type ContentItem,
  type ScoringWeights,
} from '../wasm/wasmUtils.js';

import { QdrantClient } from '../infrastructure/qdrantClient.js';
import { createCachingService } from '../cache/cachingService.js';
import { buildUserContext } from '../monitoring/userContext.js';
import { createVoyageService, type VoyageService } from './voyageService.js';
import type { Bindings } from '@/types';

// Enhanced interfaces for the WASM recommendation engine
export interface AdvancedContentItem extends ContentItem {
  postId: string;
  userId: string;
  contentType: 'text' | 'image' | 'video' | 'mixed';
  hashtags: string[];
  createdAt: Date;
  saveCount: number;
  commentCount: number;
  viewCount: number;
  isPrivate: boolean;
}

export interface EnhancedScoredContent extends AdvancedContentItem {
  discoveryScore: number;
  similarityScore: number;
  engagementScore: number;
  temporalScore: number;
  diversityScore: number;
  contentTypeScore: number;
  finalScore: number;
}

export interface RecommendationOptions {
  userId: string;
  limit: number;
  includeExplanations?: boolean;
  experimentalFeatures?: boolean;
  customWeights?: ScoringWeights;
  diversityBoost?: number;
  recencyBoost?: number;
}

export interface UserPreferences {
  vector: Float32Array;
  contentTypeAffinities: Record<string, number>;
  topicPreferences: Record<string, number>;
  engagementPatterns: {
    averageSessionLength: number;
    preferredContentTypes: string[];
    interactionVelocity: number;
  };
  lastUpdated: Date;
}

export interface RecommendationExplanation {
  postId: string;
  reasons: {
    similarity: { score: number; explanation: string };
    engagement: { score: number; explanation: string };
    recency: { score: number; explanation: string };
    diversity: { score: number; explanation: string };
    contentType: { score: number; explanation: string };
  };
  primaryReason: string;
}

const performanceMonitor = WasmPerformanceMonitor.getInstance();

/**
 * Advanced WASM-based recommendation engine
 */
export class WasmRecommendationEngine {
  private static instance: WasmRecommendationEngine;
  private batchProcessor: ManagedBatchProcessor;
  private voyageService: VoyageService | null = null;
  private cachingService: any = null;

  private constructor() {
    this.batchProcessor = new ManagedBatchProcessor(500); // Larger batch size for better performance
  }

  initialize(bindings: Bindings) {
    this.cachingService = createCachingService(bindings);
    this.voyageService = createVoyageService(bindings, this.cachingService);
  }

  static getInstance(): WasmRecommendationEngine {
    if (!WasmRecommendationEngine.instance) {
      WasmRecommendationEngine.instance = new WasmRecommendationEngine();
    }
    return WasmRecommendationEngine.instance;
  }

  /**
   * Generate discovery feed with advanced WASM-based scoring
   */
  async generateDiscoveryFeed(options: RecommendationOptions): Promise<EnhancedScoredContent[]> {
    return performanceMonitor.measureOperation('wasm-discovery-feed', async () => {
      try {
        // Get user preferences and context
        const [userPreferences, candidatePosts] = await Promise.all([
          this.getUserPreferences(options.userId),
          this.getCandidatePosts(options.userId, options.limit * 3), // Get more candidates for better selection
        ]);

        // For now, create a simple user context - would need DB integration for full buildUserContext
        const userContext = {
          recentTopics: [],
          userId: options.userId,
        };

        if (!userPreferences || candidatePosts.length === 0) {
          return [];
        }

        // Convert to format expected by WASM
        const contentItems = this.convertToContentItems(candidatePosts);

        // Enhanced scoring with Voyage AI similarity
        const scoredContent = await this.scorePostsWithVoyage(
          userPreferences,
          contentItems,
          userContext,
          options,
        );

        // Apply advanced ranking algorithms
        const rankedContent = await this.applyAdvancedRanking(scoredContent, userContext, options);

        // Apply diversity and exploration
        const diversifiedContent = this.applyDiversification(
          rankedContent,
          options.diversityBoost || 0.1,
        );

        return diversifiedContent.slice(0, options.limit);
      } catch (error) {
        console.error('WASM discovery feed generation failed:', error);
        throw new Error('Failed to generate discovery feed');
      }
    });
  }

  /**
   * Find similar posts using Voyage AI multimodal embeddings
   */
  async findSimilarPosts(
    postId: string,
    userId: string,
    limit = 10,
  ): Promise<EnhancedScoredContent[]> {
    return performanceMonitor.measureOperation('voyage-similar-posts', async () => {
      try {
        // Get the reference post embedding from Qdrant/Voyage
        const referencePost = await this.getPostEmbedding(postId);
        if (!referencePost) {
          throw new Error('Reference post not found');
        }

        // Use Qdrant's vector search for similarity (more efficient than manual comparison)
        const similarPosts = await QdrantClient.searchSimilar(
          referencePost.embeddingVector,
          limit,
          {
            excludeUserId: userId, // Don't include user's own posts
            minScore: 0.7, // Only include reasonably similar posts
          },
        );

        // Convert to enhanced format with additional scoring
        const enhancedPosts: EnhancedScoredContent[] = similarPosts.map((result, rank) => {
          const post = result.metadata;
          const engagementScore = this.calculateEngagementScore(post);
          const temporalScore = this.calculateTemporalScore(new Date(post.createdAt));
          const diversityScore = 0; // Could be enhanced with topic analysis
          const contentTypeScore = 0.8; // Default content type affinity

          return {
            id: post.postId,
            postId: post.postId,
            userId: post.userId,
            embeddingVector: new Float32Array(result.vector),
            recencyScore: temporalScore,
            popularityScore: engagementScore,
            contentType: post.contentType || 'text',
            hashtags: post.hashtags || [],
            createdAt: new Date(post.createdAt),
            saveCount: post.saveCount || 0,
            commentCount: post.commentCount || 0,
            viewCount: post.viewCount || 0,
            isPrivate: false,
            content: post.content || '',
            discoveryScore: result.score,
            similarityScore: result.score,
            engagementScore,
            temporalScore,
            diversityScore,
            contentTypeScore,
            finalScore: result.score * 0.7 + engagementScore * 0.2 + temporalScore * 0.1,
            rank: rank + 1,
          } as EnhancedScoredContent;
        });

        return enhancedPosts;
      } catch (error) {
        console.error('Voyage similar posts search failed:', error);
        throw new Error('Failed to find similar posts');
      }
    });
  }

  /**
   * Update user preferences with new interaction data
   */
  async updateUserPreferences(
    userId: string,
    interactionData: {
      postIds: string[];
      interactionTypes: ('save' | 'create' | 'like' | 'share')[];
      weights?: number[];
    },
  ): Promise<UserPreferences> {
    return performanceMonitor.measureOperation('wasm-preference-update', async () => {
      try {
        // Get current user preferences
        const currentPreferences = await this.getUserPreferences(userId);

        // Get embeddings for interacted posts
        const postEmbeddings = await Promise.all(
          interactionData.postIds.map((postId) => this.getPostEmbedding(postId)),
        );

        const validEmbeddings = postEmbeddings
          .filter((embedding) => embedding !== null)
          .map((embedding) => embedding!.embeddingVector);

        if (validEmbeddings.length === 0) {
          throw new Error('No valid embeddings found for interaction data');
        }

        // Calculate new preference vector using WASM
        const newPreferenceVector = await this.computeWeightedCentroid(
          currentPreferences?.vector || new Float32Array(1024),
          validEmbeddings,
          interactionData.weights || Array(validEmbeddings.length).fill(1.0),
          0.1, // Learning rate
        );

        // Update content type affinities
        const contentTypeAffinities = await this.updateContentTypeAffinities(
          userId,
          interactionData.postIds,
        );

        // Build updated preferences
        const updatedPreferences: UserPreferences = {
          vector: newPreferenceVector,
          contentTypeAffinities,
          topicPreferences: {}, // Would be populated from hashtag analysis
          engagementPatterns: {
            averageSessionLength: 0, // Would be calculated from interaction history
            preferredContentTypes: Object.keys(contentTypeAffinities),
            interactionVelocity: 0, // Would be calculated from interaction frequency
          },
          lastUpdated: new Date(),
        };

        // Cache the updated preferences
        await this.cacheUserPreferences(userId, updatedPreferences);

        return updatedPreferences;
      } catch (error) {
        console.error('WASM preference update failed:', error);
        throw new Error('Failed to update user preferences');
      }
    });
  }

  /**
   * Batch process multiple users' discovery feeds
   */
  async batchGenerateDiscoveryFeeds(
    userIds: string[],
    options: Omit<RecommendationOptions, 'userId'>,
  ): Promise<Map<string, EnhancedScoredContent[]>> {
    return performanceMonitor.measureOperation('wasm-batch-discovery', async () => {
      const results = new Map<string, EnhancedScoredContent[]>();

      // Process in batches of 10 for optimal performance
      const batchSize = 10;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);

        const batchPromises = batch.map(async (userId) => {
          try {
            const feed = await this.generateDiscoveryFeed({ ...options, userId });
            return { userId, feed };
          } catch (error) {
            console.error(`Failed to generate feed for user ${userId}:`, error);
            return { userId, feed: [] };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(({ userId, feed }) => {
          results.set(userId, feed);
        });
      }

      return results;
    });
  }

  /**
   * Generate recommendation explanations for debugging/transparency
   */
  async generateExplanations(
    userId: string,
    scoredContent: EnhancedScoredContent[],
  ): Promise<RecommendationExplanation[]> {
    return scoredContent.map((content) => {
      const reasons = {
        similarity: {
          score: content.similarityScore,
          explanation: `${(content.similarityScore * 100).toFixed(1)}% similar to your interests`,
        },
        engagement: {
          score: content.engagementScore,
          explanation: `High engagement rate: ${content.saveCount} saves, ${content.commentCount} comments`,
        },
        recency: {
          score: content.temporalScore,
          explanation: `Posted ${this.formatTimeAgo(content.createdAt)}`,
        },
        diversity: {
          score: content.diversityScore,
          explanation:
            content.diversityScore > 0 ? 'Explores new topics' : 'Similar to recent content',
        },
        contentType: {
          score: content.contentTypeScore,
          explanation: `Matches your ${content.contentType} preference`,
        },
      };

      // Determine primary reason
      const scores = [
        { type: 'similarity', score: content.similarityScore },
        { type: 'engagement', score: content.engagementScore },
        { type: 'recency', score: content.temporalScore },
        { type: 'diversity', score: content.diversityScore },
        { type: 'contentType', score: content.contentTypeScore },
      ];

      const primaryReason = scores.reduce((max, current) =>
        current.score > max.score ? current : max,
      ).type;

      return {
        postId: content.postId,
        reasons,
        primaryReason,
      };
    });
  }

  // Private helper methods

  private async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    const cacheKey = `user-preferences:${userId}`;

    try {
      // Try cache first
      if (this.cachingService) {
        const cached = await this.cachingService.get<UserPreferences>(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Fallback to computing from interactions
      return await this.computeUserPreferences(userId);
    } catch (error) {
      console.error('Failed to get user preferences:', error);
      return null;
    }
  }

  private async computeUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      // Get user's saved posts, created posts, and hashtag interactions
      const [savedPosts, createdPosts, hashtagInteractions] = await Promise.all([
        this.getUserSavedPosts(userId),
        this.getUserCreatedPosts(userId),
        this.getUserHashtagInteractions(userId),
      ]);

      // Get embeddings for all interacted content
      const allInteractions = [
        ...savedPosts.map((post) => ({ ...post, weight: 2.0 })), // Saved posts have higher weight
        ...createdPosts.map((post) => ({ ...post, weight: 1.5 })), // Created posts have medium weight
        // Hashtag interactions would be processed separately
      ];

      if (allInteractions.length === 0) {
        return null;
      }

      const embeddings = await Promise.all(
        allInteractions.map((interaction) => this.getPostEmbedding(interaction.postId)),
      );

      const validEmbeddings = embeddings
        .filter((embedding, index) => embedding !== null)
        .map((embedding, index) => ({
          vector: embedding!.embeddingVector,
          weight: allInteractions[index].weight,
        }));

      if (validEmbeddings.length === 0) {
        return null;
      }

      // Use WASM to compute weighted centroid
      const preferenceVector = await computeUserPreferenceCentroid(
        validEmbeddings.map((e) => e.vector),
      );

      // Ensure we have the correct dimensions for Voyage AI (1024)
      const normalizedVector = new Float32Array(1024);
      for (let i = 0; i < Math.min(preferenceVector.length, 1024); i++) {
        normalizedVector[i] = preferenceVector[i];
      }

      return {
        vector: normalizedVector,
        contentTypeAffinities: {}, // Would be computed from interaction data
        topicPreferences: {}, // Would be computed from hashtag data
        engagementPatterns: {
          averageSessionLength: 0,
          preferredContentTypes: [],
          interactionVelocity: 0,
        },
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error('Failed to compute user preferences:', error);
      return null;
    }
  }

  private async scorePostsWithVoyage(
    userPreferences: UserPreferences,
    contentItems: AdvancedContentItem[],
    userContext: any,
    options: RecommendationOptions,
  ): Promise<EnhancedScoredContent[]> {
    // Calculate cosine similarity between user preferences and each post
    const scoredItems: EnhancedScoredContent[] = [];

    for (const item of contentItems) {
      // Calculate similarity score using dot product (cosine similarity for normalized vectors)
      const similarityScore = this.calculateCosineSimilarity(
        userPreferences.vector,
        item.embeddingVector,
      );

      const engagementScore = this.calculateEngagementScore(item);
      const temporalScore = this.calculateTemporalScore(item.createdAt);
      const diversityScore = this.calculateDiversityScore(item, userContext);
      const contentTypeScore = this.calculateContentTypeScore(item, userPreferences);

      const finalScore = this.calculateFinalScore(
        {
          similarity: similarityScore,
          engagement: engagementScore,
          temporal: temporalScore,
          diversity: diversityScore,
          contentType: contentTypeScore,
        },
        options,
      );

      scoredItems.push({
        ...item,
        discoveryScore: similarityScore,
        similarityScore,
        engagementScore,
        temporalScore,
        diversityScore,
        contentTypeScore,
        finalScore,
      } as EnhancedScoredContent);
    }

    return scoredItems;
  }

  private calculateCosineSimilarity(vectorA: Float32Array, vectorB: Float32Array): number {
    if (vectorA.length !== vectorB.length) {
      console.warn('Vector dimension mismatch in similarity calculation');
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private calculateEngagementScore(post: AdvancedContentItem): number {
    const hoursOld = (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60);
    const totalEngagements = post.saveCount + post.commentCount;

    if (hoursOld <= 0 || totalEngagements === 0) return 0;

    // Engagement rate per hour with logarithmic normalization
    const engagementRate = totalEngagements / Math.max(hoursOld, 1);
    return Math.min(Math.log10(engagementRate + 1) / 2, 1);
  }

  private calculateTemporalScore(createdAt: Date): number {
    const hoursOld = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    // Exponential decay with 48-hour half-life
    return Math.exp(-hoursOld / 48);
  }

  private calculateDiversityScore(post: AdvancedContentItem, userContext: any): number {
    // Simplified diversity calculation - would use more sophisticated algorithms
    const recentTopics = userContext.recentTopics || [];
    const postTopics = post.hashtags;

    const topicOverlap =
      postTopics.filter((topic) => recentTopics.includes(topic)).length /
      Math.max(postTopics.length, 1);

    // Higher score for posts with less topic overlap (more diverse)
    return 1 - topicOverlap;
  }

  private calculateContentTypeScore(
    post: AdvancedContentItem,
    preferences: UserPreferences,
  ): number {
    const affinity = preferences.contentTypeAffinities[post.contentType] || 0.5;
    return affinity;
  }

  private calculateFinalScore(
    scores: {
      similarity: number;
      engagement: number;
      temporal: number;
      diversity: number;
      contentType: number;
    },
    options: RecommendationOptions,
  ): number {
    const weights = options.customWeights || {
      relevance: 0.5,
      recency: 0.025,
      popularity: 0.35,
      diversity: 0.025,
    };

    return (
      scores.similarity * weights.relevance +
      scores.engagement * weights.popularity +
      scores.temporal * weights.recency +
      scores.diversity * weights.diversity +
      scores.contentType * 0.1
    );
  }

  private applyAdvancedRanking(
    scoredContent: EnhancedScoredContent[],
    userContext: any,
    options: RecommendationOptions,
  ): EnhancedScoredContent[] {
    // Sort by final score
    return scoredContent.sort((a, b) => b.finalScore - a.finalScore);
  }

  private applyDiversification(
    rankedContent: EnhancedScoredContent[],
    diversityBoost: number,
  ): EnhancedScoredContent[] {
    // Implement MMR (Maximal Marginal Relevance) or similar diversification
    // For now, simple implementation that boosts posts with high diversity scores
    return rankedContent
      .map((content) => ({
        ...content,
        finalScore: content.finalScore + content.diversityScore * diversityBoost,
      }))
      .sort((a, b) => b.finalScore - a.finalScore);
  }

  private convertToContentItems(posts: any[]): AdvancedContentItem[] {
    return posts.map((post) => ({
      id: post.id,
      postId: post.id,
      userId: post.userId,
      embeddingVector: new Float32Array(post.embeddingVector || Array(768).fill(0)),
      recencyScore: this.calculateTemporalScore(new Date(post.createdAt)),
      popularityScore: this.calculateEngagementScore(post),
      contentType: post.contentType || 'text',
      hashtags: post.hashtags || [],
      createdAt: new Date(post.createdAt),
      saveCount: post._saveCount || 0,
      commentCount: post._commentCount || 0,
      viewCount: post.viewCount || 0,
      isPrivate: post.isPrivate || false,
    }));
  }

  // Database integration methods
  private async getCandidatePosts(userId: string, limit: number): Promise<any[]> {
    try {
      // Get posts excluding user's own posts and blocked/private content
      const { posts } = await qdrantClient.searchPosts({
        excludeUserId: userId,
        limit: limit * 3, // Get more candidates for better filtering
        includeEmbedding: true,
        includeMetadata: true,
      });

      return posts.filter((post) => !post.isPrivate && post.userId !== userId);
    } catch (error) {
      console.error('Failed to get candidate posts:', error);
      return [];
    }
  }

  private async getPostEmbedding(
    postId: string,
  ): Promise<{ embeddingVector: Float32Array } | null> {
    try {
      // Get post embedding from Qdrant
      const results = await qdrantClient.searchSimilar(
        new Float32Array(1024), // Dummy vector just to get the post
        1,
        { postId },
      );

      if (results.length > 0 && results[0].metadata?.postId === postId) {
        return {
          embeddingVector: new Float32Array(results[0].vector),
        };
      }

      return null;
    } catch (error) {
      console.error(`Failed to get embedding for post ${postId}:`, error);
      return null;
    }
  }

  private async getUserSavedPosts(userId: string): Promise<any[]> {
    try {
      // Get user's saved posts from Qdrant metadata search
      const results = await qdrantClient.searchByMetadata({
        filter: {
          savedByUsers: { any: [userId] },
        },
        limit: 100,
        includeEmbedding: true,
      });

      return results.map((result) => ({
        postId: result.metadata.postId,
        embeddingVector: result.vector,
        createdAt: result.metadata.createdAt,
        saveCount: result.metadata.saveCount || 0,
        commentCount: result.metadata.commentCount || 0,
        hashtags: result.metadata.hashtags || [],
      }));
    } catch (error) {
      console.error('Failed to get user saved posts:', error);
      return [];
    }
  }

  private async getUserCreatedPosts(userId: string): Promise<any[]> {
    try {
      // Get user's created posts
      const results = await qdrantClient.searchByMetadata({
        filter: {
          userId: userId,
        },
        limit: 50,
        includeEmbedding: true,
      });

      return results.map((result) => ({
        postId: result.metadata.postId,
        embeddingVector: result.vector,
        createdAt: result.metadata.createdAt,
        saveCount: result.metadata.saveCount || 0,
        commentCount: result.metadata.commentCount || 0,
        hashtags: result.metadata.hashtags || [],
      }));
    } catch (error) {
      console.error('Failed to get user created posts:', error);
      return [];
    }
  }

  private async getUserHashtagInteractions(userId: string): Promise<any[]> {
    try {
      // Get posts with hashtags user has interacted with
      // This is a simplified version - would need more sophisticated tracking
      const userPosts = await this.getUserCreatedPosts(userId);
      const savedPosts = await this.getUserSavedPosts(userId);

      const allHashtags = [...userPosts, ...savedPosts]
        .flatMap((post) => post.hashtags || [])
        .filter((hashtag, index, arr) => arr.indexOf(hashtag) === index); // Unique hashtags

      return allHashtags.map((hashtag) => ({ hashtag, weight: 1.0 }));
    } catch (error) {
      console.error('Failed to get user hashtag interactions:', error);
      return [];
    }
  }

  private async computeWeightedCentroid(
    currentVector: Float32Array,
    newVectors: Float32Array[],
    weights: number[],
    learningRate: number,
  ): Promise<Float32Array> {
    // Use WASM for efficient computation
    const centroid = await computeUserPreferenceCentroid(newVectors);

    // Interpolate between current and new preferences (1024 dimensions for Voyage)
    const result = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      result[i] = currentVector[i] * (1 - learningRate) + centroid[i] * learningRate;
    }

    return result;
  }

  private async updateContentTypeAffinities(
    userId: string,
    postIds: string[],
  ): Promise<Record<string, number>> {
    // Would analyze content types from recent interactions
    return {
      text: 0.6,
      image: 0.3,
      video: 0.8,
      mixed: 0.5,
    };
  }

  private async cacheUserPreferences(userId: string, preferences: UserPreferences): Promise<void> {
    if (this.cachingService) {
      const cacheKey = `user-preferences:${userId}`;
      await this.cachingService.set(cacheKey, preferences, 3600); // 1 hour TTL
    }
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  dispose(): void {
    this.batchProcessor.dispose();
  }
}

// Singleton instance
export const wasmRecommendationEngine = WasmRecommendationEngine.getInstance();
