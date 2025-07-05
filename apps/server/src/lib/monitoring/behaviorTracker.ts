/**
 * User Behavior Tracking Service
 *
 * Tracks user interactions and behaviors to improve recommendation accuracy
 * and provide better discovery feed personalization.
 */

import type { Bindings } from '../types.js';
import { createCachingService, type CachingService } from './cachingService.js';
import { createVoyageService, type VoyageService } from './voyageService.js';
import { qdrantClient } from './qdrantClient.js';

export interface UserInteraction {
  userId: string;
  postId: string;
  interactionType: 'view' | 'save' | 'like' | 'share' | 'comment' | 'create';
  duration?: number; // Time spent viewing (in seconds)
  timestamp: Date;
  sessionId?: string;
  metadata?: {
    scrollDepth?: number;
    clickPosition?: { x: number; y: number };
    deviceType?: 'mobile' | 'desktop' | 'tablet';
    source?: 'feed' | 'search' | 'discovery' | 'profile';
  };
}

export interface UserBehaviorProfile {
  userId: string;
  preferences: {
    contentTypes: Record<string, number>; // Affinity scores for different content types
    topics: Record<string, number>; // Topic preferences based on hashtags
    engagementPatterns: {
      averageViewDuration: number;
      preferredTimeOfDay: number[]; // Hours when user is most active
      sessionLength: number;
      interactionVelocity: number; // Interactions per minute
    };
    socialPatterns: {
      followsUsers: string[];
      interactsWithUsers: Record<string, number>; // User ID to interaction frequency
      avoidsUsers: string[];
    };
  };
  recencyWeights: {
    recentViews: number;
    recentSaves: number;
    recentCreations: number;
  };
  diversityPreference: number; // 0-1 scale, higher means prefers diverse content
  lastUpdated: Date;
  totalInteractions: number;
}

export interface BehaviorInsight {
  type: 'content_type_shift' | 'topic_discovery' | 'engagement_pattern' | 'social_behavior';
  description: string;
  confidence: number;
  actionable: boolean;
  recommendations: string[];
}

export class BehaviorTracker {
  private cachingService: CachingService;
  private voyageService: VoyageService;
  private env: Bindings;
  private interactionBuffer: Map<string, UserInteraction[]> = new Map();
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds

  constructor(bindings: Bindings) {
    this.env = bindings;
    this.cachingService = createCachingService(bindings);
    this.voyageService = createVoyageService(bindings, this.cachingService);

    // Periodic flush of interaction buffer
    setInterval(() => {
      this.flushInteractionBuffer();
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Track a user interaction
   */
  async trackInteraction(interaction: UserInteraction): Promise<void> {
    try {
      // Add to buffer for batch processing
      const userInteractions = this.interactionBuffer.get(interaction.userId) || [];
      userInteractions.push(interaction);
      this.interactionBuffer.set(interaction.userId, userInteractions);

      // Flush if buffer is full
      if (userInteractions.length >= this.BUFFER_SIZE) {
        await this.flushUserInteractions(interaction.userId);
      }

      // Update real-time behavior indicators
      await this.updateRealtimeBehavior(interaction);
    } catch (error) {
      console.error('Failed to track user interaction:', error);
    }
  }

  /**
   * Get user behavior profile
   */
  async getUserBehaviorProfile(userId: string): Promise<UserBehaviorProfile | null> {
    try {
      const cacheKey = `behavior-profile:${userId}`;

      // Try cache first
      const cached = await this.cachingService.get<UserBehaviorProfile>(cacheKey);
      if (cached) {
        return cached;
      }

      // Compute from interactions
      const profile = await this.computeBehaviorProfile(userId);

      // Cache for 1 hour
      if (profile) {
        await this.cachingService.set(cacheKey, profile, 3600);
      }

      return profile;
    } catch (error) {
      console.error('Failed to get user behavior profile:', error);
      return null;
    }
  }

  /**
   * Generate behavior insights for a user
   */
  async generateBehaviorInsights(userId: string): Promise<BehaviorInsight[]> {
    try {
      const profile = await this.getUserBehaviorProfile(userId);
      if (!profile) {
        return [];
      }

      const insights: BehaviorInsight[] = [];

      // Content type insights
      const contentTypeInsight = this.analyzeContentTypePreferences(profile);
      if (contentTypeInsight) {
        insights.push(contentTypeInsight);
      }

      // Engagement pattern insights
      const engagementInsight = this.analyzeEngagementPatterns(profile);
      if (engagementInsight) {
        insights.push(engagementInsight);
      }

      // Social behavior insights
      const socialInsight = this.analyzeSocialBehavior(profile);
      if (socialInsight) {
        insights.push(socialInsight);
      }

      return insights;
    } catch (error) {
      console.error('Failed to generate behavior insights:', error);
      return [];
    }
  }

  /**
   * Update user preferences based on recent interactions
   */
  async updateUserPreferences(userId: string, interactions: UserInteraction[]): Promise<void> {
    try {
      const profile =
        (await this.getUserBehaviorProfile(userId)) || this.createEmptyProfile(userId);

      // Update content type preferences
      for (const interaction of interactions) {
        const post = await this.getPostMetadata(interaction.postId);
        if (post) {
          // Update content type affinity
          const contentType = post.contentType || 'text';
          const weight = this.getInteractionWeight(interaction.interactionType);

          profile.preferences.contentTypes[contentType] =
            (profile.preferences.contentTypes[contentType] || 0.5) * 0.9 + weight * 0.1;

          // Update topic preferences
          for (const hashtag of post.hashtags || []) {
            profile.preferences.topics[hashtag] =
              (profile.preferences.topics[hashtag] || 0.5) * 0.9 + weight * 0.1;
          }

          // Update engagement patterns
          if (interaction.duration) {
            profile.preferences.engagementPatterns.averageViewDuration =
              profile.preferences.engagementPatterns.averageViewDuration * 0.95 +
              interaction.duration * 0.05;
          }
        }
      }

      // Update recency weights
      this.updateRecencyWeights(profile, interactions);

      // Update diversity preference based on interaction patterns
      profile.diversityPreference = this.calculateDiversityPreference(interactions);

      profile.lastUpdated = new Date();
      profile.totalInteractions += interactions.length;

      // Cache updated profile
      const cacheKey = `behavior-profile:${userId}`;
      await this.cachingService.set(cacheKey, profile, 3600);
    } catch (error) {
      console.error('Failed to update user preferences:', error);
    }
  }

  /**
   * Get personalized content recommendations based on behavior
   */
  async getPersonalizedRecommendations(
    userId: string,
    candidatePosts: any[],
    limit: number = 20,
  ): Promise<any[]> {
    try {
      const profile = await this.getUserBehaviorProfile(userId);
      if (!profile) {
        return candidatePosts.slice(0, limit);
      }

      // Score posts based on behavior profile
      const scoredPosts = await Promise.all(
        candidatePosts.map(async (post) => {
          const behaviorScore = await this.calculateBehaviorScore(post, profile);
          return {
            ...post,
            behaviorScore,
            finalScore: (post.finalScore || 0) * 0.7 + behaviorScore * 0.3,
          };
        }),
      );

      // Sort by final score and apply diversity
      const sortedPosts = scoredPosts.sort((a, b) => b.finalScore - a.finalScore);

      // Apply diversity filtering based on user preference
      const diversifiedPosts = this.applyDiversityFiltering(
        sortedPosts,
        profile.diversityPreference,
      );

      return diversifiedPosts.slice(0, limit);
    } catch (error) {
      console.error('Failed to get personalized recommendations:', error);
      return candidatePosts.slice(0, limit);
    }
  }

  // Private methods

  private async flushInteractionBuffer(): Promise<void> {
    for (const userId of this.interactionBuffer.keys()) {
      await this.flushUserInteractions(userId);
    }
  }

  private async flushUserInteractions(userId: string): Promise<void> {
    const interactions = this.interactionBuffer.get(userId);
    if (!interactions || interactions.length === 0) {
      return;
    }

    try {
      // Update user preferences based on interactions
      await this.updateUserPreferences(userId, interactions);

      // Clear buffer for this user
      this.interactionBuffer.set(userId, []);
    } catch (error) {
      console.error(`Failed to flush interactions for user ${userId}:`, error);
    }
  }

  private async updateRealtimeBehavior(interaction: UserInteraction): Promise<void> {
    // Update session-based metrics in cache
    const sessionKey = `session:${interaction.userId}:${interaction.sessionId || 'default'}`;

    try {
      const sessionData = (await this.cachingService.get<any>(sessionKey)) || {
        startTime: Date.now(),
        interactions: [],
        currentStreak: 0,
      };

      sessionData.interactions.push(interaction);
      sessionData.lastActivity = Date.now();

      // Calculate interaction velocity
      const sessionDuration = (Date.now() - sessionData.startTime) / 1000 / 60; // minutes
      sessionData.interactionVelocity =
        sessionData.interactions.length / Math.max(sessionDuration, 0.1);

      await this.cachingService.set(sessionKey, sessionData, 1800); // 30 minutes
    } catch (error) {
      console.error('Failed to update realtime behavior:', error);
    }
  }

  private async computeBehaviorProfile(userId: string): Promise<UserBehaviorProfile | null> {
    try {
      // Get recent interactions for the user
      const recentInteractions = await this.getRecentInteractions(userId, 1000);

      if (recentInteractions.length === 0) {
        return null;
      }

      const profile = this.createEmptyProfile(userId);

      // Analyze interactions to build profile
      for (const interaction of recentInteractions) {
        const post = await this.getPostMetadata(interaction.postId);
        if (post) {
          const weight = this.getInteractionWeight(interaction.interactionType);

          // Content type preferences
          const contentType = post.contentType || 'text';
          profile.preferences.contentTypes[contentType] =
            (profile.preferences.contentTypes[contentType] || 0.5) + weight * 0.1;

          // Topic preferences
          for (const hashtag of post.hashtags || []) {
            profile.preferences.topics[hashtag] =
              (profile.preferences.topics[hashtag] || 0.5) + weight * 0.1;
          }
        }
      }

      // Calculate engagement patterns
      profile.preferences.engagementPatterns = this.calculateEngagementPatterns(recentInteractions);

      // Calculate diversity preference
      profile.diversityPreference = this.calculateDiversityPreference(recentInteractions);

      profile.totalInteractions = recentInteractions.length;
      profile.lastUpdated = new Date();

      return profile;
    } catch (error) {
      console.error('Failed to compute behavior profile:', error);
      return null;
    }
  }

  private createEmptyProfile(userId: string): UserBehaviorProfile {
    return {
      userId,
      preferences: {
        contentTypes: {},
        topics: {},
        engagementPatterns: {
          averageViewDuration: 0,
          preferredTimeOfDay: [],
          sessionLength: 0,
          interactionVelocity: 0,
        },
        socialPatterns: {
          followsUsers: [],
          interactsWithUsers: {},
          avoidsUsers: [],
        },
      },
      recencyWeights: {
        recentViews: 1.0,
        recentSaves: 1.0,
        recentCreations: 1.0,
      },
      diversityPreference: 0.5,
      lastUpdated: new Date(),
      totalInteractions: 0,
    };
  }

  private getInteractionWeight(type: UserInteraction['interactionType']): number {
    const weights = {
      view: 0.1,
      like: 0.3,
      save: 0.8,
      share: 0.6,
      comment: 0.7,
      create: 1.0,
    };
    return weights[type] || 0.1;
  }

  private calculateEngagementPatterns(
    interactions: UserInteraction[],
  ): UserBehaviorProfile['preferences']['engagementPatterns'] {
    const viewDurations = interactions.filter((i) => i.duration).map((i) => i.duration!);

    const averageViewDuration =
      viewDurations.length > 0
        ? viewDurations.reduce((sum, d) => sum + d, 0) / viewDurations.length
        : 0;

    // Calculate preferred times of day
    const hourCounts = new Array(24).fill(0);
    interactions.forEach((interaction) => {
      const hour = new Date(interaction.timestamp).getHours();
      hourCounts[hour]++;
    });

    const preferredTimeOfDay = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((item) => item.hour);

    return {
      averageViewDuration,
      preferredTimeOfDay,
      sessionLength: 0, // Would be calculated from session data
      interactionVelocity: 0, // Would be calculated from session data
    };
  }

  private calculateDiversityPreference(interactions: UserInteraction[]): number {
    // Analyze how diverse the user's interactions are
    // Higher diversity preference means user likes varied content

    // Simple implementation: look at unique content types and topics
    const contentTypes = new Set<string>();
    const topics = new Set<string>();

    interactions.forEach(async (interaction) => {
      const post = await this.getPostMetadata(interaction.postId);
      if (post) {
        contentTypes.add(post.contentType || 'text');
        post.hashtags?.forEach((tag: string) => topics.add(tag));
      }
    });

    // Normalize based on interaction count
    const diversityScore = Math.min(
      (contentTypes.size * 0.3 + topics.size * 0.1) / Math.max(interactions.length * 0.1, 1),
      1.0,
    );

    return diversityScore;
  }

  private updateRecencyWeights(
    profile: UserBehaviorProfile,
    interactions: UserInteraction[],
  ): void {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    let recentViews = 0;
    let recentSaves = 0;
    let recentCreations = 0;

    interactions.forEach((interaction) => {
      const age = now - interaction.timestamp.getTime();
      const recencyFactor = Math.exp(-age / oneDay); // Exponential decay

      switch (interaction.interactionType) {
        case 'view':
          recentViews += recencyFactor;
          break;
        case 'save':
          recentSaves += recencyFactor;
          break;
        case 'create':
          recentCreations += recencyFactor;
          break;
      }
    });

    profile.recencyWeights = {
      recentViews: Math.min(recentViews, 2.0),
      recentSaves: Math.min(recentSaves, 2.0),
      recentCreations: Math.min(recentCreations, 2.0),
    };
  }

  private async calculateBehaviorScore(post: any, profile: UserBehaviorProfile): Promise<number> {
    let score = 0.5; // Base score

    // Content type affinity
    const contentTypeAffinity = profile.preferences.contentTypes[post.contentType || 'text'] || 0.5;
    score += contentTypeAffinity * 0.3;

    // Topic affinity
    let topicScore = 0;
    const hashtags = post.hashtags || [];
    for (const hashtag of hashtags) {
      topicScore += profile.preferences.topics[hashtag] || 0.5;
    }
    if (hashtags.length > 0) {
      score += (topicScore / hashtags.length) * 0.3;
    }

    // Social signals
    if (profile.preferences.socialPatterns.followsUsers.includes(post.userId)) {
      score += 0.2;
    }

    const interactionFreq = profile.preferences.socialPatterns.interactsWithUsers[post.userId] || 0;
    score += Math.min(interactionFreq * 0.1, 0.2);

    return Math.min(Math.max(score, 0), 1);
  }

  private applyDiversityFiltering(posts: any[], diversityPreference: number): any[] {
    if (diversityPreference < 0.3) {
      return posts; // Low diversity preference, return as-is
    }

    // High diversity preference: ensure variety in content types and topics
    const diversified: any[] = [];
    const seenContentTypes = new Set<string>();
    const seenTopics = new Set<string>();
    const maxPerType = Math.max(Math.floor(posts.length * 0.4), 2);

    // First pass: ensure diversity
    for (const post of posts) {
      const contentType = post.contentType || 'text';
      const typeCount = Array.from(seenContentTypes).filter((t) => t === contentType).length;

      if (typeCount < maxPerType) {
        diversified.push(post);
        seenContentTypes.add(contentType);
        post.hashtags?.forEach((tag: string) => seenTopics.add(tag));
      }
    }

    // Second pass: fill remaining slots
    for (const post of posts) {
      if (diversified.length >= posts.length * 0.8) break;
      if (!diversified.includes(post)) {
        diversified.push(post);
      }
    }

    return diversified;
  }

  private async getRecentInteractions(userId: string, limit: number): Promise<UserInteraction[]> {
    try {
      // For now, we'll use seenPostLog as a proxy for view interactions
      // In a full implementation, you'd have a proper interactions table
      const { getSeenPostsForUser } = await import('../db/queries/userInteractions.js');

      const seenPostIds = await getSeenPostsForUser(userId, this.env);

      // Convert seen posts to interactions (with mock timestamps)
      const interactions: UserInteraction[] = seenPostIds.slice(0, limit).map((postId, index) => ({
        userId,
        postId,
        interactionType: 'view' as const,
        timestamp: new Date(Date.now() - index * 60000), // Mock recent timestamps
        duration: Math.random() * 30 + 5, // Mock view duration 5-35 seconds
      }));

      return interactions;
    } catch (error) {
      console.error('Failed to get recent interactions:', error);
      return [];
    }
  }

  private async getPostMetadata(postId: string): Promise<any> {
    try {
      // Get post metadata from Qdrant
      const results = await qdrantClient.searchByMetadata({
        filter: { postId },
        limit: 1,
        includeEmbedding: false,
      });

      return results.length > 0 ? results[0].metadata : null;
    } catch (error) {
      console.error(`Failed to get post metadata for ${postId}:`, error);
      return null;
    }
  }

  // Insight analysis methods

  private analyzeContentTypePreferences(profile: UserBehaviorProfile): BehaviorInsight | null {
    const contentTypes = Object.entries(profile.preferences.contentTypes);
    if (contentTypes.length === 0) return null;

    const dominant = contentTypes.reduce((max, current) => (current[1] > max[1] ? current : max));

    if (dominant[1] > 0.7) {
      return {
        type: 'content_type_shift',
        description: `Strong preference for ${dominant[0]} content (${(dominant[1] * 100).toFixed(0)}% affinity)`,
        confidence: dominant[1],
        actionable: true,
        recommendations: [
          `Surface more ${dominant[0]} content in discovery feed`,
          `Consider promoting ${dominant[0]} creators`,
        ],
      };
    }

    return null;
  }

  private analyzeEngagementPatterns(profile: UserBehaviorProfile): BehaviorInsight | null {
    const patterns = profile.preferences.engagementPatterns;

    if (patterns.averageViewDuration > 30) {
      // High engagement
      return {
        type: 'engagement_pattern',
        description: `High engagement user (avg ${patterns.averageViewDuration.toFixed(0)}s view time)`,
        confidence: 0.8,
        actionable: true,
        recommendations: [
          'Prioritize longer-form content',
          'Surface detailed, comprehensive posts',
        ],
      };
    } else if (patterns.averageViewDuration < 10) {
      // Low engagement
      return {
        type: 'engagement_pattern',
        description: `Quick browser (avg ${patterns.averageViewDuration.toFixed(0)}s view time)`,
        confidence: 0.8,
        actionable: true,
        recommendations: [
          'Prioritize concise, easily digestible content',
          'Surface visually striking posts',
        ],
      };
    }

    return null;
  }

  private analyzeSocialBehavior(profile: UserBehaviorProfile): BehaviorInsight | null {
    const social = profile.preferences.socialPatterns;
    const totalFollows = social.followsUsers.length;
    const totalInteractions = Object.values(social.interactsWithUsers).reduce(
      (sum, count) => sum + count,
      0,
    );

    if (totalFollows > 100 && totalInteractions > 500) {
      return {
        type: 'social_behavior',
        description: 'Highly social user with strong community engagement',
        confidence: 0.9,
        actionable: true,
        recommendations: [
          'Surface content from followed users',
          'Promote community discussions and comments',
          'Highlight trending topics in their network',
        ],
      };
    }

    return null;
  }

  dispose(): void {
    // Clean up resources
    this.flushInteractionBuffer();
  }
}

// Export factory function
export function createBehaviorTracker(bindings: Bindings): BehaviorTracker {
  return new BehaviorTracker(bindings);
}
