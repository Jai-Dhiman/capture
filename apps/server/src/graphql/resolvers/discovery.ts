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
import { discoveryLogger } from '../../lib/logging/discoveryLogger.js';
import {
  AutoInitializingWasmUtils,
  OptimizedVectorOps,
  type PrivacyFilterOptions,
  type ScoringWeights,
} from '../../lib/wasm/wasmUtils.js';
import { createD1Client } from '../../db/index.js';
import * as schema from '../../db/schema.js';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { loadDevaluationConfig, type DevaluationConfig } from '../../lib/discovery/devaluationConfig.js';

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

export interface ViewQualityMetrics {
  dwellTime?: number; // milliseconds spent viewing
  scrollVelocity?: number; // pixels per second
  interactionType?: 'quick_scroll' | 'engaged_view' | 'partial_interaction';
  engagementActions?: string[]; // ['like', 'save', 'comment']
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
  sessionId?: string;
  isNewSession?: boolean;
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
    likeCount: number;
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
  likeCount?: number;
  viewCount?: number;
  seenAt?: string;
  isSeen?: boolean;
  viewQuality?: ViewQualityMetrics;
  contentType?: string;
  isViral?: boolean;
  recentEngagementVelocity?: number;
}

export class UnifiedDiscoveryResolver {
  private wasmUtils: AutoInitializingWasmUtils;
  private embeddingService: EmbeddingService;
  private qdrantClient: QdrantClient;
  private cachingService: ReturnType<typeof createCachingService>;
  private devaluationConfig: DevaluationConfig;

  constructor(private bindings: Bindings) {
    this.wasmUtils = new AutoInitializingWasmUtils();
    this.cachingService = createCachingService(bindings);
    this.embeddingService = new EmbeddingService(bindings.VOYAGE_API_KEY, this.cachingService);
    this.qdrantClient = new QdrantClient(bindings);
    this.devaluationConfig = loadDevaluationConfig(bindings);
  }

  /**
   * Main discovery method - routes to simple or full mode based on DISCOVERY_MODE
   */
  async discoverPosts(userId: string, options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
    // Check discovery mode - default to 'simple' for cost savings at launch
    const discoveryMode = this.bindings.DISCOVERY_MODE || 'simple';

    if (discoveryMode === 'simple') {
      return this.discoverPostsSimple(userId, options);
    }

    // Full mode: WASM + Qdrant + Voyage
    return this.discoverPostsFull(userId, options);
  }

  /**
   * Full discovery method - WASM-optimized with vector similarity
   * Used when DISCOVERY_MODE='full'
   */
  private async discoverPostsFull(userId: string, options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
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
      experimentalFeatures = false,
    } = options;

    // Start logging session
    const sessionId = discoveryLogger.startSession(userId, {
      limit,
      cursor,
      experimentalFeatures,
      adaptiveParameters,
    });

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
      const candidateStartTime = Date.now();
      const candidates = await this.getCandidatePosts(userId, limit * 3, cursor);
      const seenPosts = await this.getSeenPostsForLogging(userId);
      
      // Log candidate retrieval
      discoveryLogger.logCandidateRetrieval(
        userId, 
        sessionId,
        candidates,
        seenPosts,
        Date.now() - candidateStartTime
      );

      if (candidates.length === 0) {
        discoveryLogger.logResults(userId, sessionId, [], false, undefined, Date.now() - startTime);
        return {
          posts: [],
          hasMore: false,
          metrics: this.createMetrics(startTime, 0, []),
        };
      }

      // Process candidates through WASM pipeline
      const wasmStartTime = Date.now();
      const { processedCandidates, wasmOperations, fallbacks, devaluationStats } = await this.processCandidatesWasm(
        candidates,
        userId,
        finalWeights,
        diversityThreshold,
        temporalDecayRate,
        includePrivacyFilter,
        privacySettings,
        sessionId,
      );

      // Log WASM processing
      discoveryLogger.logWasmProcessing(
        userId,
        sessionId,
        processedCandidates,
        wasmOperations,
        fallbacks,
        Date.now() - wasmStartTime,
        devaluationStats
      );

      // Sort and limit results with deduplication
      const uniqueProcessedCandidates = new Map();
      for (const candidate of processedCandidates) {
        if (!uniqueProcessedCandidates.has(candidate.id)) {
          uniqueProcessedCandidates.set(candidate.id, candidate);
        }
      }
      
      const sortedCandidates = Array.from(uniqueProcessedCandidates.values())
        .sort((a, b) => b.scores.final - a.scores.final)
        .slice(0, limit);

      // Convert to complete Post objects
      const completePosts = await this.convertToCompletePosts(sortedCandidates);

      const hasMore = candidates.length >= limit * 3;
      const nextCursor =
        hasMore && sortedCandidates.length > 0
          ? sortedCandidates[sortedCandidates.length - 1].createdAt
          : undefined;

      // Log final results
      discoveryLogger.logResults(
        userId,
        sessionId,
        completePosts,
        hasMore,
        nextCursor,
        Date.now() - startTime
      );

      return {
        posts: completePosts,
        hasMore,
        nextCursor,
        metrics: this.createMetrics(startTime, candidates.length, wasmOperations || [
          'vectorNormalization',
          'similarityComputation',
          'diversityScoring',
        ]),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      discoveryLogger.logError(userId, sessionId, error as Error, 'discovery_pipeline');
      throw new Error(`Discovery failed: ${errorMessage}`);
    }
  }

  /**
   * Simple discovery method - no vector similarity, just recency + engagement
   * Used when DISCOVERY_MODE='simple' to avoid Qdrant/Voyage costs
   */
  async discoverPostsSimple(userId: string, options: DiscoveryOptions = {}): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const {
      limit = 20,
      cursor,
    } = options;

    const sessionId = discoveryLogger.startSession(userId, {
      limit,
      cursor,
      experimentalFeatures: false,
      adaptiveParameters: false,
    });

    try {
      // Get candidate posts (reuses existing method, but we won't use embeddings)
      const candidateStartTime = Date.now();
      const candidates = await this.getCandidatePostsSimple(userId, limit * 3, cursor);
      const seenPosts = await this.getSeenPostsForLogging(userId);

      discoveryLogger.logCandidateRetrieval(
        userId,
        sessionId,
        candidates,
        seenPosts,
        Date.now() - candidateStartTime
      );

      if (candidates.length === 0) {
        discoveryLogger.logResults(userId, sessionId, [], false, undefined, Date.now() - startTime);
        return {
          posts: [],
          hasMore: false,
          metrics: this.createMetrics(startTime, 0, ['simple_mode']),
        };
      }

      // Process with simple scoring (no WASM, no vectors)
      const processedCandidates = this.scoreCandidatesSimple(candidates, sessionId);

      // Sort and limit results with deduplication
      const uniqueProcessed = new Map<string, DiscoveredPost>();
      for (const candidate of processedCandidates) {
        if (!uniqueProcessed.has(candidate.id)) {
          uniqueProcessed.set(candidate.id, candidate);
        }
      }

      const sortedCandidates = Array.from(uniqueProcessed.values())
        .sort((a, b) => b.scores.final - a.scores.final)
        .slice(0, limit);

      // Convert to complete Post objects
      const completePosts = await this.convertToCompletePosts(sortedCandidates);

      const hasMore = candidates.length >= limit * 3;
      const nextCursor =
        hasMore && sortedCandidates.length > 0
          ? sortedCandidates[sortedCandidates.length - 1].createdAt
          : undefined;

      discoveryLogger.logResults(
        userId,
        sessionId,
        completePosts,
        hasMore,
        nextCursor,
        Date.now() - startTime
      );

      return {
        posts: completePosts,
        hasMore,
        nextCursor,
        metrics: this.createMetrics(startTime, candidates.length, ['simple_mode', 'recency', 'engagement', 'diversity']),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      discoveryLogger.logError(userId, sessionId, error as Error, 'simple_discovery_pipeline');
      throw new Error(`Simple discovery failed: ${errorMessage}`);
    }
  }

  /**
   * Get candidate posts for simple discovery (no embedding vectors needed)
   */
  private async getCandidatePostsSimple(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<CandidatePost[]> {
    const cacheKey = `candidates_simple:${userId}:${limit}:${cursor || 'initial'}`;

    const cached = await this.cachingService.get<CandidatePost[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get visible posts for user with cursor-based pagination
    const posts = await getVisiblePostsForUser(userId, this.bindings, {
      limit,
      maxCreatedAt: cursor,
    });

    // Get seen posts (returns string[] of post IDs)
    const seenPostIds = await getSeenPostsForUser(userId, this.bindings);
    const seenPostSet = new Set(seenPostIds);

    // Convert to candidate format (no embedding vectors)
    const candidateMap = new Map<string, CandidatePost>();

    for (const post of posts) {
      if (!candidateMap.has(post.id)) {
        const isSeen = seenPostSet.has(post.id);

        const candidate: CandidatePost = {
          id: post.id,
          userId: post.userId,
          content: post.content,
          createdAt: post.createdAt,
          hashtags: [],
          isPrivate: Boolean(post.authorIsPrivate),
          saveCount: post._saveCount || 0,
          commentCount: post._commentCount || 0,
          likeCount: 0, // Not available in PostWithPrivacy
          viewCount: 0,
          isSeen,
          // No embedding vector or seenAt timestamp in simple mode
        };

        // Add engagement velocity for ranking
        candidate.recentEngagementVelocity = this.calculateEngagementVelocity(candidate);
        candidate.contentType = this.inferContentType(candidate);
        candidate.isViral = candidate.recentEngagementVelocity > this.devaluationConfig.viralVelocityThreshold;

        candidateMap.set(post.id, candidate);
      }
    }

    const candidates = Array.from(candidateMap.values());

    // Cache for 2 minutes (shorter than full mode since it's cheaper to recompute)
    await this.cachingService.set(cacheKey, candidates, 120);

    return candidates;
  }

  /**
   * Simple scoring: recency (40%) + engagement (40%) + diversity (20%)
   * No vector similarity - just basic signals
   */
  private scoreCandidatesSimple(
    candidates: CandidatePost[],
    sessionId: string,
  ): DiscoveredPost[] {
    const results: DiscoveredPost[] = [];
    const userPostCounts = new Map<string, number>();

    for (const candidate of candidates) {
      // 1. Recency score (exponential decay over hours)
      const ageHours = (Date.now() - new Date(candidate.createdAt).getTime()) / (1000 * 60 * 60);
      const recencyScore = Math.exp(-0.02 * ageHours); // Slower decay than full mode

      // 2. Engagement score (reuse existing method)
      const engagementScore = this.computeEngagementScore(candidate);

      // 3. Diversity score (penalize multiple posts from same user)
      const userCount = userPostCounts.get(candidate.userId) || 0;
      userPostCounts.set(candidate.userId, userCount + 1);
      const diversityScore = 1.0 / (1.0 + userCount * 0.5); // Diminishing returns for same user

      // Weighted combination: recency 40%, engagement 40%, diversity 20%
      let finalScore = (
        recencyScore * 0.4 +
        engagementScore * 0.4 +
        diversityScore * 0.2
      );

      // Apply devaluation for seen posts (simple binary approach - no timestamp available)
      if (candidate.isSeen) {
        // In simple mode, we don't have seenAt timestamp, so use a fixed multiplier
        finalScore *= 0.5; // 50% reduction for seen posts
      }

      results.push({
        id: candidate.id,
        userId: candidate.userId,
        content: candidate.content,
        createdAt: candidate.createdAt,
        hashtags: candidate.hashtags || [],
        scores: {
          discovery: finalScore,
          similarity: 0, // Not computed in simple mode
          engagement: engagementScore,
          temporal: recencyScore,
          diversity: diversityScore,
          privacy: 1.0, // Privacy filtering done at query level
          final: finalScore,
        },
        metadata: {
          saveCount: candidate.saveCount || 0,
          commentCount: candidate.commentCount || 0,
          likeCount: candidate.likeCount || 0,
          viewCount: candidate.viewCount || 0,
        },
      });
    }

    return results;
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
    sessionId: string,
  ): Promise<{
    processedCandidates: DiscoveredPost[];
    wasmOperations: string[];
    fallbacks: string[];
    devaluationStats: {
      devaluedCount: number;
      averageMultiplier: number;
    };
  }> {
    const wasmOperations: string[] = [];
    const fallbacks: string[] = [];
    let devaluedCount = 0;
    let totalDevaluationMultiplier = 0;
    // Get user embedding for similarity computation
    const userEmbedding = await this.getUserEmbedding(userId);

    // Extract and normalize embeddings
    try {
      const embeddings = await this.extractAndNormalizeEmbeddings(candidates);
      wasmOperations.push('vectorNormalization');

      // Compute similarity scores using WASM
      const similarityScores = await this.computeSimilarityScoresWasm(userEmbedding, embeddings);
      wasmOperations.push('similarityComputation');

      // Apply temporal decay using WASM
      const temporalScores = await this.applyTemporalDecayWasm(candidates, temporalDecayRate);
      wasmOperations.push('temporalDecay');

      // Compute diversity scores using WASM
      const diversityScores = await this.computeDiversityScoresWasm(embeddings, diversityThreshold);
      wasmOperations.push('diversityScoring');

      // Apply privacy filter if enabled
      const privacyScores = includePrivacyFilter
        ? await this.applyPrivacyFilterWasm(candidates, userId, privacySettings)
        : candidates.map(() => 1.0);
      
      if (includePrivacyFilter) wasmOperations.push('privacyFiltering');

      // Combine all scores
      const results: DiscoveredPost[] = [];
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        const similarity = similarityScores[i] || 0;
        const temporal = temporalScores[i] || 0;
        const diversity = diversityScores[i] || 0;
        const privacy = privacyScores[i] || 0;

        // Compute engagement score (now includes likes!)
        const engagement = this.computeEngagementScore(candidate);

        // Compute final weighted score
        let finalScore =
          (similarity * weights.similarity +
            temporal * weights.temporal +
            diversity * weights.diversity +
            engagement * weights.engagement +
            privacy * weights.privacy) /
          5;

        // Apply context-aware devaluation for seen posts
        let devaluationScore = 1.0;
        if (candidate.isSeen) {
          devaluedCount++;
          if (candidate.seenAt) {
            // Time-based devaluation when we have the timestamp
            const daysSinceSeen = (Date.now() - new Date(candidate.seenAt).getTime()) / (24 * 60 * 60 * 1000);
            devaluationScore = this.calculateContextAwareDevaluationMultiplier(
              candidate,
              daysSinceSeen,
              sessionId
            );
          } else {
            // Simple fixed multiplier when no timestamp available
            devaluationScore = 0.5;
          }
          totalDevaluationMultiplier += devaluationScore;
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
            likeCount: candidate.likeCount || 0,
            viewCount: candidate.viewCount || 0,
          },
        });
      }

      return {
        processedCandidates: results,
        wasmOperations,
        fallbacks,
        devaluationStats: {
          devaluedCount,
          averageMultiplier: devaluedCount > 0 ? totalDevaluationMultiplier / devaluedCount : 1,
        },
      };
    } catch (error) {
      fallbacks.push(`WASM processing failed: ${error}`);
      discoveryLogger.logWarning(userId, sessionId, `WASM processing failed, using fallback`, { error });
      
      // Fallback to simple processing
      return this.processCandidatesFallback(candidates, userId, weights, sessionId);
    }
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
   * Enhanced method to detect viral/trending content
   */
  private calculateEngagementVelocity(candidate: CandidatePost): number {
    const postAgeHours = Math.max((Date.now() - new Date(candidate.createdAt).getTime()) / (1000 * 60 * 60), 0.1);
    const totalEngagement = (candidate.likeCount || 0) + (candidate.saveCount || 0) + (candidate.commentCount || 0);
    return totalEngagement / postAgeHours;
  }
  
  /**
   * Determine content type based on post characteristics
   */
  private inferContentType(candidate: CandidatePost): string {
    const content = candidate.content.toLowerCase();
    
    // Simple keyword-based classification (can be enhanced with ML)
    if (content.includes('news') || content.includes('breaking') || content.includes('update')) {
      return 'news';
    }
    if (content.includes('learn') || content.includes('how to') || content.includes('tutorial')) {
      return 'educational';
    }
    if (content.includes('funny') || content.includes('lol') || content.includes('😂')) {
      return 'entertainment';
    }
    
    // Check if it's a personal post (low engagement, personal pronouns)
    const personalWords = ['my', 'me', 'i', 'personal', 'family'];
    const hasPersonalWords = personalWords.some(word => content.includes(word));
    if (hasPersonalWords && (candidate.likeCount || 0) < 10) {
      return 'personal';
    }
    
    return 'general';
  }
  
  /**
   * Get candidate posts for discovery with enhanced metadata
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

    // Get visible posts for user with cursor-based pagination
    const posts = await getVisiblePostsForUser(userId, this.bindings, { 
      limit,
      maxCreatedAt: cursor // Use cursor for pagination
    });

    // Get seen posts (returns string[] of post IDs - no timestamps available from this query)
    const seenPostIds = await getSeenPostsForUser(userId, this.bindings);
    const seenPostSet = new Set(seenPostIds);

    // Include all posts (seen and unseen) for graduated devaluation
    const allPosts = posts;

    // Convert to candidate format with enhanced metadata
    const candidateMap = new Map<string, CandidatePost>();

    for (const post of allPosts) {
      if (!candidateMap.has(post.id)) {
        const isSeen = seenPostSet.has(post.id);

        // Create enhanced candidate with context-aware metadata
        const candidate: CandidatePost = {
          id: post.id,
          userId: post.userId,
          content: post.content,
          createdAt: post.createdAt,
          hashtags: [], // No hashtags in PostWithPrivacy interface - will need to be fetched separately if needed
          isPrivate: Boolean(post.authorIsPrivate),
          saveCount: post._saveCount || 0,
          commentCount: post._commentCount || 0,
          likeCount: 0, // Not available in PostWithPrivacy interface
          viewCount: 0, // No viewCount in PostWithPrivacy interface
          isSeen,
        };
        
        // Enhance with context-aware metadata
        candidate.recentEngagementVelocity = this.calculateEngagementVelocity(candidate);
        candidate.contentType = this.inferContentType(candidate);
        candidate.isViral = candidate.recentEngagementVelocity > this.devaluationConfig.viralVelocityThreshold;
        
        // TODO: In production, fetch actual view quality from user interaction data
        // For now, we'll use placeholder logic
        if (isSeen) {
          candidate.viewQuality = {
            interactionType: this.inferViewQuality(candidate),
            dwellTime: Math.random() * 5000, // Placeholder
            scrollVelocity: Math.random() * 100 // Placeholder
          };
        }
        
        candidateMap.set(post.id, candidate);
      }
    }
    
    const candidates: CandidatePost[] = Array.from(candidateMap.values());

    // Cache for 5 minutes
    await this.cachingService.set(cacheKey, candidates, 300);

    return candidates;
  }
  
  /**
   * Infer view quality based on post characteristics and engagement
   * In production, this would use actual user interaction data
   */
  private inferViewQuality(candidate: CandidatePost): 'quick_scroll' | 'engaged_view' | 'partial_interaction' {
    const engagementRate = ((candidate.likeCount || 0) + (candidate.saveCount || 0) + (candidate.commentCount || 0)) / Math.max(candidate.viewCount || 1, 1);
    
    if (engagementRate > 0.1) {
      return 'engaged_view';
    } else if (engagementRate > 0.02) {
      return 'partial_interaction';
    } else {
      return 'quick_scroll';
    }
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
   * Compute engagement score for a post (now includes likes!)
   */
  private computeEngagementScore(candidate: CandidatePost): number {
    // Updated weights to include likes
    const likeWeight = 0.3;      // Likes are common, moderate weight
    const saveWeight = 0.35;     // Saves are strong engagement signal
    const commentWeight = 0.25;  // Comments are high-quality engagement
    const viewWeight = 0.1;      // Views are weak signal

    // Normalize engagement metrics with realistic thresholds
    const normalizedLikes = Math.min((candidate.likeCount || 0) / 200, 1);    // 200 likes = max score
    const normalizedSaves = Math.min((candidate.saveCount || 0) / 100, 1);   // 100 saves = max score  
    const normalizedComments = Math.min((candidate.commentCount || 0) / 50, 1); // 50 comments = max score
    const normalizedViews = Math.min((candidate.viewCount || 0) / 1000, 1);  // 1000 views = max score

    const engagementScore = (
      normalizedLikes * likeWeight +
      normalizedSaves * saveWeight +
      normalizedComments * commentWeight +
      normalizedViews * viewWeight
    );

    // Add engagement velocity bonus (engagement per hour since posting)
    const postAgeHours = Math.max((Date.now() - new Date(candidate.createdAt).getTime()) / (1000 * 60 * 60), 0.1);
    const totalEngagement = (candidate.likeCount || 0) + (candidate.saveCount || 0) + (candidate.commentCount || 0);
    const velocityBonus = Math.min(totalEngagement / postAgeHours / 10, 0.2); // Max 20% bonus

    return Math.min(engagementScore + velocityBonus, 1.0);
  }

  /**
   * Calculate context-aware devaluation multiplier for seen posts
   * Less aggressive and more intelligent than the previous approach
   */
  private calculateContextAwareDevaluationMultiplier(
    candidate: CandidatePost,
    daysSinceSeen: number,
    sessionId: string
  ): number {
    // Use configurable base devaluation
    let baseDevaluation = this.devaluationConfig.baseDevaluationMultiplier;
    
    // 1. Engagement-based adjustment
    const totalEngagement = (candidate.likeCount || 0) + (candidate.saveCount || 0) + (candidate.commentCount || 0);
    const engagementMultiplier = Math.min(totalEngagement / this.devaluationConfig.highEngagementThreshold, this.devaluationConfig.maxEngagementReduction);
    baseDevaluation = Math.max(this.devaluationConfig.minimumRetention, baseDevaluation - engagementMultiplier);
    
    // 2. View quality consideration
    if (candidate.viewQuality?.interactionType) {
      const qualityMultiplier = this.devaluationConfig.viewQualityMultipliers[candidate.viewQuality.interactionType];
      baseDevaluation *= qualityMultiplier;
    }
    
    // 3. Content type awareness
    const contentType = candidate.contentType || 'general';
    const contentMultiplier = this.devaluationConfig.contentTypeMultipliers[contentType as keyof typeof this.devaluationConfig.contentTypeMultipliers] || this.devaluationConfig.contentTypeMultipliers.general;
    baseDevaluation *= contentMultiplier;
    
    // 4. Viral/trending content override
    if (candidate.isViral || (candidate.recentEngagementVelocity || 0) > this.devaluationConfig.viralVelocityThreshold) {
      baseDevaluation = Math.max(this.devaluationConfig.viralMinimumRetention, baseDevaluation);
    }
    
    // 5. Session boundary consideration
    const isNewSession = this.isNewUserSession(sessionId);
    if (isNewSession) {
      baseDevaluation = Math.max(this.devaluationConfig.newSessionMinimumRetention, baseDevaluation);
    }
    
    // 6. Time-based recovery (configurable parameters)
    const recoveryRate = this.devaluationConfig.dailyRecoveryRate;
    const recoveryDays = this.devaluationConfig.recoveryTimelineDays;
    const recoveryComponent = recoveryRate * daysSinceSeen;
    const decayComponent = Math.exp(-daysSinceSeen / recoveryDays) * baseDevaluation;
    
    // Calculate final multiplier
    const multiplier = decayComponent + recoveryComponent;
    
    // Apply configurable bounds
    return Math.max(this.devaluationConfig.minimumRetention, Math.min(1.0, multiplier));
  }
  
  /**
   * Check if this is a new user session (simplified implementation)
   * In production, you'd want more sophisticated session tracking
   */
  private isNewUserSession(sessionId: string): boolean {
    // Simple heuristic: check if session is less than 30 minutes old
    // In a real implementation, you'd track session start times
    return Math.random() < 0.3; // Placeholder - 30% chance of "new session"
  }
  
  /**
   * Legacy method for backward compatibility
   * @deprecated Use calculateContextAwareDevaluationMultiplier instead
   */
  private calculateDevaluationMultiplier(daysSinceSeen: number): number {
    // Fallback to old logic if needed
    const baseDevaluation = 0.5; // Made less aggressive
    const recoveryRate = 0.08;
    const recoveryDays = 12.0;
    const recoveryComponent = recoveryRate * daysSinceSeen;
    const decayComponent = Math.exp(-daysSinceSeen / recoveryDays) * baseDevaluation;
    const multiplier = decayComponent + recoveryComponent;
    return Math.max(0.2, Math.min(1.0, multiplier));
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

  /**
   * Get seen posts for logging purposes
   */
  private async getSeenPostsForLogging(userId: string): Promise<any[]> {
    try {
      return await getSeenPostsForUser(userId, this.bindings);
    } catch (error) {
      console.warn('Failed to get seen posts for logging:', error);
      return [];
    }
  }

  /**
   * Fallback processing when WASM fails
   */
  private async processCandidatesFallback(
    candidates: CandidatePost[],
    userId: string,
    weights: ScoringWeights,
    sessionId: string
  ): Promise<{
    processedCandidates: DiscoveredPost[];
    wasmOperations: string[];
    fallbacks: string[];
    devaluationStats: {
      devaluedCount: number;
      averageMultiplier: number;
    };
  }> {
    const fallbacks = ['JavaScript fallback processing'];
    let devaluedCount = 0;
    let totalDevaluationMultiplier = 0;

    const results: DiscoveredPost[] = [];
    
    for (const candidate of candidates) {
      // Simple similarity based on content length and basic metrics
      const similarity = Math.random() * 0.5 + 0.25; // Random baseline similarity
      const temporal = Math.exp(-0.1 * (Date.now() - new Date(candidate.createdAt).getTime()) / (1000 * 60 * 60));
      const diversity = 0.7; // Default diversity score
      const privacy = 1.0; // Default privacy score
      const engagement = this.computeEngagementScore(candidate);

      let finalScore = (
        similarity * weights.similarity +
        temporal * weights.temporal +
        diversity * weights.diversity +
        engagement * weights.engagement +
        privacy * weights.privacy
      ) / 5;

      // Apply context-aware devaluation for seen posts (fallback)
      let devaluationScore = 1.0;
      if (candidate.isSeen) {
        devaluedCount++;
        if (candidate.seenAt) {
          const daysSinceSeen = (Date.now() - new Date(candidate.seenAt).getTime()) / (24 * 60 * 60 * 1000);
          // Use the less aggressive legacy method for fallback
          devaluationScore = this.calculateDevaluationMultiplier(daysSinceSeen);
        } else {
          // Simple fixed multiplier when no timestamp available
          devaluationScore = 0.5;
        }
        totalDevaluationMultiplier += devaluationScore;
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
          likeCount: candidate.likeCount || 0,
          viewCount: candidate.viewCount || 0,
        },
      });
    }

    discoveryLogger.logWarning(userId, sessionId, 'Using fallback processing - WASM failed');

    return {
      processedCandidates: results,
      wasmOperations: [],
      fallbacks,
      devaluationStats: {
        devaluedCount,
        averageMultiplier: devaluedCount > 0 ? totalDevaluationMultiplier / devaluedCount : 1,
      },
    };
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
        sessionId?: string;
        isNewSession?: boolean;
      },
      context: ContextType,
    ) => {
      if (!context?.user) {
        throw new Error('Authentication required');
      }
      
      const resolver = new UnifiedDiscoveryResolver(context.env);
      
      // Enhanced options with session context
      const options = {
        ...args,
        sessionId: args.sessionId || `session_${Date.now()}_${Math.random()}`,
        isNewSession: args.isNewSession ?? false,
      };
      
      return resolver.discoverPosts(context.user.id, options);
    },

    discoveryAnalytics: async (
      _parent: unknown,
      args: {
        userId?: string;
        limit?: number;
      },
      context: ContextType,
    ) => {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      const targetUserId = args.userId || context.user.id;
      const limit = args.limit || 10;

      const sessionLogs = discoveryLogger.getSessionAnalytics(targetUserId, limit);
      const seenPostsAnalytics = discoveryLogger.getSeenPostsAnalytics();

      return {
        sessionLogs: sessionLogs.map(log => ({
          userId: log.userId,
          sessionId: log.sessionId,
          timestamp: log.timestamp,
          phase: log.phase,
          processingTimeMs: log.metrics.processingTimeMs,
          candidatesFound: log.metrics.candidatesFound,
          candidatesProcessed: log.metrics.candidatesProcessed,
          finalResults: log.metrics.finalResults,
          averageScores: {
            similarity: log.metrics.averageSimilarityScore,
            engagement: log.metrics.averageEngagementScore,
            diversity: log.metrics.averageDiversityScore,
            temporal: log.metrics.averageTemporalScore,
            privacy: log.metrics.averagePrivacyScore,
            final: log.metrics.averageFinalScore,
          },
          qualityMetrics: {
            uniquenessRatio: log.metrics.uniquenessRatio,
            freshnessScore: log.metrics.freshnessScore,
            personalRelevanceScore: log.metrics.personalRelevanceScore,
          },
          devaluationStats: {
            devaluedCount: log.metrics.seenPostsDevalued,
            averageMultiplier: log.metrics.averageDevaluationMultiplier,
          },
          options: log.options,
        })),
        seenPostsAnalytics,
      };
    },

    discoveryPerformanceSummary: async (
      _parent: unknown,
      _args: any,
      context: ContextType,
    ) => {
      if (!context?.user) {
        throw new Error('Authentication required');
      }

      const summary = discoveryLogger.getPerformanceSummary();
      
      return {
        totalSessions: summary.totalSessions,
        averageProcessingTime: summary.averageProcessingTime,
        averageResults: summary.averageResults,
        errorRate: summary.errorRate,
        wasmUsageRate: summary.wasmUsageRate,
        averageQualityScores: summary.averageQualityScores,
      };
    },
  },
  Mutation: {
    // Add mutations here if needed in the future
  },
};
