/**
 * Unified Discovery Resolver
 *
 * WASM-optimized discovery functionality with enhanced algorithms.
 * Integrates the UnifiedEmbeddingService with optimized discovery algorithms.
 */

import type { Bindings, ContextType } from '../../types/index.js';
import { EmbeddingService } from '../../lib/ai/embeddingService.js';
import { createCachingService } from '../../lib/cache/cachingService.js';
import { QdrantClient } from '../../lib/infrastructure/qdrantClient.js';
import {
  AutoInitializingWasmUtils,
  OptimizedVectorOps,
  type PrivacyFilterOptions,
  type ScoringWeights,
} from '../../lib/wasm/wasmUtils.js';
import { createD1Client } from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { desc, eq, inArray, sql } from 'drizzle-orm';

// Database imports
import {
  batchCheckPostVisibility,
  getVisiblePostsForUser,
} from '../../db/queries/privacyFilters.js';
import {
  batchGetUserInteractions,
  getBlockedUsersForUser,
  getFollowingForUser,
  getSeenPostsForUser,
} from '../../db/queries/userInteractions.js';

// Types and interfaces
export interface UserInteraction {
  id: string;
  userId: string;
  postId: string;
  type: 'view' | 'like' | 'save' | 'comment' | 'share';
  createdAt: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface DiscoveryOptions {
  limit?: number;
  cursor?: string;
  weights?: ScoringWeights;
  experimentalFeatures?: boolean;
  diversityThreshold?: number;
  temporalDecayRate?: number;
  includePrivacyFilter?: boolean;
  adaptiveParameters?: boolean;
  userEngagementHistory?: UserEngagementProfile;
}

export interface DiscoveryResult {
  posts: any[]; // Complete Post objects with user, media, hashtags, etc.
  hasMore: boolean;
  nextCursor?: string;
  metrics?: DiscoveryMetrics;
}

export interface DiscoveredPost {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  hashtags: string[];
  scores: {
    discovery: number;
    similarity: number;
    engagement: number;
    temporal: number;
    diversity: number;
    privacy: number;
    final: number;
  };
  metadata: {
    saveCount: number;
    commentCount: number;
    viewCount: number;
  };
}

export interface DiscoveryMetrics {
  processingTimeMs: number;
  candidatesEvaluated: number;
  wasmOperationsUsed: string[];
  fallbacksUsed: string[];
  cacheHitRate: number;
  algorithmVersion: string;
}

export interface UserPrivacySettings {
  allowDiscovery: boolean;
  blockSensitiveContent: boolean;
  requireFollowForPrivatePosts: boolean;
  contentFilters: string[];
  ageRestrictedContent: boolean;
  geographicRestrictions: string[];
}

export interface UserEngagementProfile {
  avgSessionDuration: number;
  preferredContentTypes: string[];
  engagementRate: number;
  diversityPreference: number;
  recencyPreference: number;
  personalizedWeights?: ScoringWeights;
  lastParameterUpdate?: string;
}

export interface AdaptiveParameters {
  diversityThreshold: number;
  temporalDecayRate: number;
  collaborativeWeight: number;
  contentBasedWeight: number;
  engagementBoost: number;
  adaptationConfidence: number;
}

interface CandidatePost {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  hashtags?: string[];
  embeddingVector?: Float32Array;
  isPrivate: boolean;
  saveCount?: number;
  commentCount?: number;
  viewCount?: number;
  seenAt?: string;
  isSeen?: boolean;
}

export class UnifiedDiscoveryResolver {
  private wasmUtils: AutoInitializingWasmUtils;
  private embeddingService: EmbeddingService;
  private qdrantClient: QdrantClient;
  private cachingService: ReturnType<typeof createCachingService>;

  constructor(private bindings: Bindings) {
    this.wasmUtils = new AutoInitializingWasmUtils();
    this.cachingService = createCachingService(bindings);
    this.embeddingService = new EmbeddingService(bindings.VOYAGE_API_KEY, this.cachingService);
    this.qdrantClient = new QdrantClient(bindings);
  }

  /**
   * Main discovery method - WASM-optimized only
   */
  async discoverPosts(userId: string, options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const {
      limit = 20,
      cursor,
      weights = this.getDefaultWeights(),
      diversityThreshold = 0.7,
      temporalDecayRate = 0.1,
      includePrivacyFilter = true,
      adaptiveParameters = false,
      userEngagementHistory,
    } = options;

    try {
      // Ensure WASM is ready
      await this.wasmUtils.ensureInitialized();

      // Get user's engagement profile and privacy settings
      const [_userProfile, privacySettings] = await Promise.all([
        this.getUserEngagementProfile(userId),
        this.getUserPrivacySettings(userId),
      ]);

      // Apply adaptive parameters if enabled
      const finalWeights =
        adaptiveParameters && userEngagementHistory
          ? await this.computeAdaptiveWeights(userEngagementHistory, weights)
          : weights;

      // Get candidate posts
      const candidates = await this.getCandidatePosts(userId, limit * 3, cursor);

      if (candidates.length === 0) {
        return {
          posts: [],
          hasMore: false,
          metrics: this.createMetrics(startTime, 0, []),
        };
      }

      // Process candidates through WASM pipeline
      const processedCandidates = await this.processCandidatesWasm(
        candidates,
        userId,
        finalWeights,
        diversityThreshold,
        temporalDecayRate,
        includePrivacyFilter,
        privacySettings,
      );

      // Sort and limit results
      const sortedCandidates = processedCandidates
        .sort((a, b) => b.scores.final - a.scores.final)
        .slice(0, limit);

      // Convert to complete Post objects
      const completePosts = await this.convertToCompletePosts(sortedCandidates);

      const hasMore = candidates.length >= limit * 3;
      const nextCursor =
        hasMore && sortedCandidates.length > 0
          ? sortedCandidates[sortedCandidates.length - 1].id
          : undefined;

      return {
        posts: completePosts,
        hasMore,
        nextCursor,
        metrics: this.createMetrics(startTime, candidates.length, [
          'vectorNormalization',
          'similarityComputation',
          'diversityScoring',
        ]),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Discovery failed: ${errorMessage}`);
    }
  }

  /**
   * Process candidates using WASM-only operations
   */
  private async processCandidatesWasm(
    candidates: CandidatePost[],
    userId: string,
    weights: ScoringWeights,
    diversityThreshold: number,
    temporalDecayRate: number,
    includePrivacyFilter: boolean,
    privacySettings: UserPrivacySettings,
  ): Promise<DiscoveredPost[]> {
    // Get user embedding for similarity computation
    const userEmbedding = await this.getUserEmbedding(userId);

    // Extract and normalize embeddings
    const embeddings = await this.extractAndNormalizeEmbeddings(candidates);

    // Compute similarity scores using WASM
    const similarityScores = await this.computeSimilarityScoresWasm(userEmbedding, embeddings);

    // Apply temporal decay using WASM
    const temporalScores = await this.applyTemporalDecayWasm(candidates, temporalDecayRate);

    // Compute diversity scores using WASM
    const diversityScores = await this.computeDiversityScoresWasm(embeddings, diversityThreshold);

    // Apply privacy filter if enabled
    const privacyScores = includePrivacyFilter
      ? await this.applyPrivacyFilterWasm(candidates, userId, privacySettings)
      : candidates.map(() => 1.0);

    // Combine all scores
    const results: DiscoveredPost[] = [];
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const similarity = similarityScores[i] || 0;
      const temporal = temporalScores[i] || 0;
      const diversity = diversityScores[i] || 0;
      const privacy = privacyScores[i] || 0;

      // Compute engagement score
      const engagement = this.computeEngagementScore(candidate);

      // Compute final weighted score
      let finalScore =
        (similarity * weights.similarity +
          temporal * weights.temporal +
          diversity * weights.diversity +
          engagement * weights.engagement +
          privacy * weights.privacy) /
        5;

      // Apply devaluation for seen posts
      let devaluationScore = 1.0;
      if (candidate.isSeen && candidate.seenAt) {
        const daysSinceSeen = (Date.now() - new Date(candidate.seenAt).getTime()) / (24 * 60 * 60 * 1000);
        devaluationScore = this.calculateDevaluationMultiplier(daysSinceSeen);
        finalScore *= devaluationScore;
      }

      results.push({
        id: candidate.id,
        userId: candidate.userId,
        content: candidate.content,
        createdAt: candidate.createdAt,
        hashtags: candidate.hashtags || [],
        scores: {
          discovery: finalScore,
          similarity,
          engagement,
          temporal,
          diversity,
          privacy,
          final: finalScore,
        },
        metadata: {
          saveCount: candidate.saveCount || 0,
          commentCount: candidate.commentCount || 0,
          viewCount: candidate.viewCount || 0,
        },
      });
    }

    return results;
  }

  /**
   * Extract and normalize embeddings using WASM
   */
  private async extractAndNormalizeEmbeddings(
    candidates: CandidatePost[],
  ): Promise<Float32Array[]> {
    if (!this.wasmUtils.isReady()) {
      throw new Error('WASM not initialized for embedding normalization');
    }

    const embeddings: Float32Array[] = [];
    for (const candidate of candidates) {
      let embedding = candidate.embeddingVector;

      if (!embedding) {
        // Generate embedding if not cached
        const result = await this.embeddingService.generateTextEmbedding(candidate.content);
        embedding = new Float32Array(result.vector);
      }

      // Normalize using WASM
      const normalized = this.wasmUtils.normalizeVector(embedding);
      embeddings.push(normalized);
    }

    return embeddings;
  }

  /**
   * Compute similarity scores using WASM operations only
   */
  private async computeSimilarityScoresWasm(
    userEmbedding: Float32Array,
    candidateEmbeddings: Float32Array[],
  ): Promise<number[]> {
    if (!this.wasmUtils.isReady()) {
      throw new Error('WASM not initialized for similarity computation');
    }

    const normalizedUserEmbedding = this.wasmUtils.normalizeVector(userEmbedding);
    const scores: number[] = [];

    for (const candidateEmbedding of candidateEmbeddings) {
      const similarity = this.wasmUtils.cosineSimilarity(
        normalizedUserEmbedding,
        candidateEmbedding,
      );
      scores.push(Math.max(0, similarity)); // Ensure non-negative
    }

    return scores;
  }

  /**
   * Apply temporal decay using WASM operations only
   */
  private async applyTemporalDecayWasm(
    candidates: CandidatePost[],
    decayRate: number,
  ): Promise<number[]> {
    if (!this.wasmUtils.isReady()) {
      throw new Error('WASM not initialized for temporal decay');
    }

    const now = Date.now();
    const scores: number[] = [];

    for (const candidate of candidates) {
      const ageHours = (now - new Date(candidate.createdAt).getTime()) / (1000 * 60 * 60);
      const decayScore = this.wasmUtils.exponentialDecay(ageHours, decayRate);
      scores.push(decayScore);
    }

    return scores;
  }

  /**
   * Compute diversity scores using WASM operations only
   */
  private async computeDiversityScoresWasm(
    embeddings: Float32Array[],
    threshold: number,
  ): Promise<number[]> {
    if (!this.wasmUtils.isReady()) {
      throw new Error('WASM not initialized for diversity scoring');
    }

    const scores: number[] = [];

    for (let i = 0; i < embeddings.length; i++) {
      const currentEmbedding = embeddings[i];
      let diversityScore = 1.0;
      let similarCount = 0;

      // Compare with previous embeddings to measure diversity
      for (let j = 0; j < i; j++) {
        const similarity = this.wasmUtils.cosineSimilarity(currentEmbedding, embeddings[j]);

        if (similarity > threshold) {
          similarCount++;
        }
      }

      // Penalize similar content
      if (similarCount > 0) {
        diversityScore = 1.0 / (1.0 + similarCount * 0.5);
      }

      scores.push(diversityScore);
    }

    return scores;
  }

  /**
   * Apply privacy filter using WASM operations only
   */
  private async applyPrivacyFilterWasm(
    candidates: CandidatePost[],
    userId: string,
    settings: UserPrivacySettings,
  ): Promise<number[]> {
    if (!this.wasmUtils.isReady()) {
      throw new Error('WASM not initialized for privacy filtering');
    }

    const scores: number[] = [];
    const visibilityResults = await batchCheckPostVisibility(
      candidates.map((c) => c.id),
      userId,
      this.bindings,
    );

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const isVisible = visibilityResults[candidate.id];

      if (!isVisible) {
        scores.push(0);
        continue;
      }

      let privacyScore = 1.0;

      // Apply content filters
      if (settings.contentFilters.length > 0) {
        const hasFilteredContent = settings.contentFilters.some((filter) =>
          candidate.content.toLowerCase().includes(filter.toLowerCase()),
        );
        if (hasFilteredContent) {
          privacyScore *= 0.1;
        }
      }

      // Apply private post restrictions
      if (candidate.isPrivate && settings.requireFollowForPrivatePosts) {
        // Check if user follows the post author
        const following = await getFollowingForUser(userId, this.bindings);
        const isFollowing = following.some((followedUserId) => followedUserId === candidate.userId);
        if (!isFollowing) {
          privacyScore = 0;
        }
      }

      scores.push(privacyScore);
    }

    return scores;
  }

  /**
   * Compute adaptive weights based on user engagement history
   */
  private async computeAdaptiveWeights(
    history: UserEngagementProfile,
    baseWeights: ScoringWeights,
  ): Promise<ScoringWeights> {
    if (!this.wasmUtils.isReady()) {
      throw new Error('WASM not initialized for adaptive weight computation');
    }

    // Use WASM for adaptive parameter computation
    const adaptiveParams = this.wasmUtils.computeAdaptiveParameters({
      engagementRate: history.engagementRate,
      diversityPreference: history.diversityPreference,
      recencyPreference: history.recencyPreference,
      sessionDuration: history.avgSessionDuration,
    });

    return {
      similarity: baseWeights.similarity * adaptiveParams.contentBasedWeight,
      temporal: baseWeights.temporal * adaptiveParams.temporalWeight,
      diversity: baseWeights.diversity * adaptiveParams.diversityWeight,
      engagement: baseWeights.engagement * adaptiveParams.engagementBoost,
      privacy: baseWeights.privacy, // Keep privacy weight constant
    };
  }

  /**
   * Get candidate posts for discovery
   */
  private async getCandidatePosts(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<CandidatePost[]> {
    const cacheKey = `candidates:${userId}:${limit}:${cursor || 'initial'}`;

    // Try cache first
    const cached = await this.cachingService.get<CandidatePost[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get visible posts for user
    const posts = await getVisiblePostsForUser(userId, this.bindings, { limit });

    // Get seen posts with timestamps for devaluation
    const seenPostsData = await getSeenPostsForUser(userId, this.bindings);
    const seenPostMap = new Map(seenPostsData.map(seen => [seen.postId, seen.seenAt]));

    // Include all posts (seen and unseen) for graduated devaluation
    const allPosts = posts;

    // Convert to candidate format with seen metadata
    const candidates: CandidatePost[] = allPosts.map((post) => {
      const seenAt = seenPostMap.get(post.id);
      return {
        id: post.id,
        userId: post.userId,
        content: post.content,
        createdAt: post.createdAt,
        hashtags: [], // No hashtags in PostWithPrivacy interface - will need to be fetched separately if needed
        isPrivate: Boolean(post.authorIsPrivate),
        saveCount: post._saveCount || 0,
        commentCount: post._commentCount || 0,
        viewCount: 0, // No viewCount in PostWithPrivacy interface
        seenAt: seenAt,
        isSeen: !!seenAt,
      };
    });

    // Cache for 5 minutes
    await this.cachingService.set(cacheKey, candidates, 300);

    return candidates;
  }

  /**
   * Get user embedding vector
   */
  private async getUserEmbedding(userId: string): Promise<Float32Array> {
    const cacheKey = `user_embedding:${userId}`;

    // Try cache first
    const cached = await this.cachingService.get<Float32Array>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get user's recent posts to build profile
    const userPosts = await getVisiblePostsForUser(userId, this.bindings, { limit: 10 });
    if (userPosts.length === 0) {
      // Return zero vector for new users
      return new Float32Array(1024).fill(0);
    }

    // Combine user's content
    const combinedContent = userPosts.map((p) => p.content).join(' ');
    const embeddingResult = await this.embeddingService.generateTextEmbedding(combinedContent);
    const embedding = new Float32Array(embeddingResult.vector);

    // Cache for 1 hour
    await this.cachingService.set(cacheKey, embedding, 3600);

    return embedding;
  }

  /**
   * Get user engagement profile
   */
  private async getUserEngagementProfile(userId: string): Promise<UserEngagementProfile> {
    const cacheKey = `engagement_profile:${userId}`;

    // Try cache first
    const cached = await this.cachingService.get<UserEngagementProfile>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get user interactions - placeholder for production implementation
    // const interactions = await batchGetUserInteractions([userId], this.bindings);
    // const userInteractionData = interactions[userId] || {
    //   seenPosts: [],
    //   blockedUsers: [],
    //   following: [],
    //   followers: [],
    // };

    // Compute engagement metrics (simplified for beta)
    const profile: UserEngagementProfile = {
      avgSessionDuration: this.computeAvgSessionDuration([]),
      preferredContentTypes: this.extractPreferredContentTypes([]),
      engagementRate: this.computeEngagementRate([]),
      diversityPreference: this.computeDiversityPreference([]),
      recencyPreference: this.computeRecencyPreference([]),
    };

    // Cache for 1 hour
    await this.cachingService.set(cacheKey, profile, 3600);

    return profile;
  }

  /**
   * Get user privacy settings
   */
  private async getUserPrivacySettings(userId: string): Promise<UserPrivacySettings> {
    const cacheKey = `privacy_settings:${userId}`;

    // Try cache first
    const cached = await this.cachingService.get<UserPrivacySettings>(cacheKey);
    if (cached) {
      return cached;
    }

    // Default privacy settings
    const settings: UserPrivacySettings = {
      allowDiscovery: true,
      blockSensitiveContent: true,
      requireFollowForPrivatePosts: true,
      contentFilters: [],
      ageRestrictedContent: false,
      geographicRestrictions: [],
    };

    // Cache for 1 hour
    await this.cachingService.set(cacheKey, settings, 3600);

    return settings;
  }

  /**
   * Compute engagement score for a post
   */
  private computeEngagementScore(candidate: CandidatePost): number {
    const saveWeight = 0.4;
    const commentWeight = 0.4;
    const viewWeight = 0.2;

    const normalizedSaves = Math.min((candidate.saveCount || 0) / 100, 1);
    const normalizedComments = Math.min((candidate.commentCount || 0) / 50, 1);
    const normalizedViews = Math.min((candidate.viewCount || 0) / 1000, 1);

    return (
      normalizedSaves * saveWeight +
      normalizedComments * commentWeight +
      normalizedViews * viewWeight
    );
  }

  /**
   * Calculate devaluation multiplier for seen posts
   */
  private calculateDevaluationMultiplier(daysSinceSeen: number): number {
    // Base devaluation: 0.1 (90% reduction initially)
    const baseDevaluation = 0.1;
    
    // Recovery rate: 0.05 per day (5% recovery daily)
    const recoveryRate = 0.05;
    
    // Exponential recovery curve over ~18 days
    const recoveryDays = 18.0;
    const recoveryComponent = recoveryRate * daysSinceSeen;
    const decayComponent = Math.exp(-daysSinceSeen / recoveryDays) * baseDevaluation;
    
    // Calculate multiplier with minimum of 0.1 and maximum of 1.0
    const multiplier = decayComponent + recoveryComponent;
    return Math.max(0.1, Math.min(1.0, multiplier));
  }

  /**
   * Helper methods for user profile computation
   */
  private computeAvgSessionDuration(_interactions: UserInteraction[]): number {
    // Implement session duration computation
    return 300; // Default 5 minutes
  }

  private extractPreferredContentTypes(_interactions: UserInteraction[]): string[] {
    // Implement content type extraction
    return ['general'];
  }

  private computeEngagementRate(_interactions: UserInteraction[]): number {
    // Implement engagement rate computation
    return 0.1; // Default 10%
  }

  private computeDiversityPreference(_interactions: UserInteraction[]): number {
    // Implement diversity preference computation
    return 0.7; // Default moderate diversity
  }

  private computeRecencyPreference(_interactions: UserInteraction[]): number {
    // Implement recency preference computation
    return 0.5; // Default balanced recency
  }

  /**
   * Get default scoring weights
   */
  private getDefaultWeights(): ScoringWeights {
    return {
      similarity: 0.3,
      temporal: 0.2,
      diversity: 0.2,
      engagement: 0.2,
      privacy: 0.1,
    };
  }

  /**
   * Create metrics object
   */
  private createMetrics(
    startTime: number,
    candidatesEvaluated: number,
    operations: string[],
  ): DiscoveryMetrics {
    return {
      processingTimeMs: Date.now() - startTime,
      candidatesEvaluated,
      wasmOperationsUsed: operations,
      fallbacksUsed: [], // No fallbacks used
      cacheHitRate: 0.8, // Placeholder
      algorithmVersion: '2.0.0-wasm-only',
    };
  }

  /**
   * Convert discovered posts to complete Post objects with user, media, hashtags
   */
  private async convertToCompletePosts(discoveredPosts: DiscoveredPost[]): Promise<any[]> {
    if (discoveredPosts.length === 0) {
      return [];
    }

    const db = createD1Client(this.bindings);
    const postIds = discoveredPosts.map(p => p.id);

    // Batch query for posts, users, and media to eliminate N+1 queries
    const [posts, profiles, media, postHashtags] = await Promise.all([
      // Get all posts in one query
      db.select()
        .from(schema.post)
        .where(inArray(schema.post.id, postIds))
        .all(),
      
      // Get all users in one query by joining with posts
      db.select({
        userId: schema.profile.userId,
        id: schema.profile.id,
        username: schema.profile.username,
        profileImage: schema.profile.profileImage,
        bio: schema.profile.bio,
        verifiedType: schema.profile.verifiedType,
        isPrivate: schema.profile.isPrivate,
        createdAt: schema.profile.createdAt,
        updatedAt: schema.profile.updatedAt,
        postUserId: schema.post.userId
      })
        .from(schema.profile)
        .innerJoin(schema.post, eq(schema.profile.userId, schema.post.userId))
        .where(inArray(schema.post.id, postIds))
        .all(),
      
      // Get all media in one query
      db.select()
        .from(schema.media)
        .where(inArray(schema.media.postId, postIds))
        .all(),

      // Get hashtag associations
      db.select()
        .from(schema.postHashtag)
        .where(inArray(schema.postHashtag.postId, postIds))
        .all()
    ]);

    // Get hashtag details if we have associations
    let hashtags: any[] = [];
    if (postHashtags.length > 0) {
      const hashtagIds = postHashtags.map(ph => ph.hashtagId).filter(Boolean);
      const validHashtagIds = hashtagIds.filter((id): id is string => id !== null);
      
      if (validHashtagIds.length > 0) {
        hashtags = await db
          .select()
          .from(schema.hashtag)
          .where(inArray(schema.hashtag.id, validHashtagIds))
          .all();
      }
    }

    // Create lookup maps for O(1) access
    const postMap = new Map(posts.map(p => [p.id, p]));
    const userMap = new Map(profiles.map(p => [p.postUserId, p]));
    const mediaMap = new Map<string, typeof media>();
    const hashtagMap = new Map(hashtags.map(h => [h.id, h]));
    
    // Group media by post ID
    for (const m of media) {
      if (!mediaMap.has(m.postId!)) {
        mediaMap.set(m.postId!, []);
      }
      mediaMap.get(m.postId!)!.push(m);
    }

    // Group hashtags by post ID
    const postHashtagMap = new Map<string, any[]>();
    for (const ph of postHashtags) {
      if (!postHashtagMap.has(ph.postId!)) {
        postHashtagMap.set(ph.postId!, []);
      }
      const hashtag = hashtagMap.get(ph.hashtagId!);
      if (hashtag) {
        postHashtagMap.get(ph.postId!)!.push(hashtag);
      }
    }

    // Build final result maintaining order of discovered posts
    const completePosts = discoveredPosts
      .map((discoveredPost) => {
        const post = postMap.get(discoveredPost.id);
        if (!post) return null;

        const user = userMap.get(post.userId);
        const postMedia = mediaMap.get(post.id) || [];
        const postHashtagList = postHashtagMap.get(post.id) || [];

        return {
          ...post,
          user,
          media: postMedia,
          hashtags: postHashtagList,
          comments: [], // Empty for discovery feed
          savedBy: [], // Empty for discovery feed
          isSaved: false, // Default for discovery
          _commentCount: discoveredPost.metadata.commentCount,
          _saveCount: discoveredPost.metadata.saveCount,
        };
      })
      .filter(Boolean);

    return completePosts;
  }
}

/**
 * GraphQL resolver functions
 */
export const discoveryResolvers = {
  Query: {
    discoverFeed: async (
      _parent: unknown,
      args: {
        limit?: number;
        cursor?: string;
        experimentalFeatures?: boolean;
      },
      context: ContextType,
    ) => {
      if (!context?.user) {
        throw new Error('Authentication required');
      }
      
      const resolver = new UnifiedDiscoveryResolver(context.env);
      return resolver.discoverPosts(context.user.id, args);
    },
  },
  Mutation: {
    // Add mutations here if needed in the future
  },
};
