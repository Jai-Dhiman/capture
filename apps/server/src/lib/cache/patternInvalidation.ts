import type { Bindings } from '@/types';
import { createCachingService } from './cachingService';

export interface PatternInvalidationRule {
  pattern: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  conditions?: {
    userAction?: string[];
    contentType?: string[];
    timeRange?: {
      start: Date;
      end: Date;
    };
  };
}

export interface PatternInvalidationService {
  addRule: (rule: PatternInvalidationRule) => Promise<void>;
  removeRule: (pattern: string) => Promise<void>;
  invalidateByPattern: (pattern: string) => Promise<number>;
  invalidateByEvent: (event: InvalidationEvent) => Promise<void>;
  getActiveRules: () => Promise<PatternInvalidationRule[]>;
  validatePattern: (pattern: string) => boolean;
}

export interface InvalidationEvent {
  type: 'user_action' | 'content_update' | 'system_event';
  userId?: string;
  contentId?: string;
  contentType?: string;
  action?: string;
  metadata?: Record<string, any>;
}

export function createPatternInvalidationService(env: Bindings): PatternInvalidationService {
  const cachingService = createCachingService(env);
  const rulesKey = 'invalidation_rules';
  
  return {
    async addRule(rule: PatternInvalidationRule): Promise<void> {
      try {
        const rules = await this.getActiveRules();
        
        // Remove existing rule with same pattern
        const filteredRules = rules.filter(r => r.pattern !== rule.pattern);
        
        // Add new rule
        filteredRules.push(rule);
        
        await cachingService.set(rulesKey, filteredRules, 86400); // 24 hours
      } catch (error) {
        console.error('Failed to add invalidation rule:', error);
        throw error;
      }
    },

    async removeRule(pattern: string): Promise<void> {
      try {
        const rules = await this.getActiveRules();
        const filteredRules = rules.filter(r => r.pattern !== pattern);
        
        await cachingService.set(rulesKey, filteredRules, 86400);
      } catch (error) {
        console.error('Failed to remove invalidation rule:', error);
        throw error;
      }
    },

    async invalidateByPattern(pattern: string): Promise<number> {
      try {
        const kv = env.CACHE_KV;
        
        // Enhanced pattern matching with glob support
        const list = await kv.list();
        const regex = this.patternToRegex(pattern);
        
        const keysToDelete = list.keys
          .filter(item => regex.test(item.name))
          .map(item => item.name);
        
        // Delete in optimized batches
        const batchSize = 20;
        let deletedCount = 0;
        
        for (let i = 0; i < keysToDelete.length; i += batchSize) {
          const batch = keysToDelete.slice(i, i + batchSize);
          
          await Promise.allSettled(
            batch.map(async (key) => {
              try {
                await kv.delete(key);
                deletedCount++;
              } catch (error) {
                console.error(`Failed to delete cache key ${key}:`, error);
              }
            })
          );
        }
        
        console.log(`Invalidated ${deletedCount} cache entries for pattern: ${pattern}`);
        return deletedCount;
      } catch (error) {
        console.error('Pattern invalidation error:', error);
        throw error;
      }
    },

    async invalidateByEvent(event: InvalidationEvent): Promise<void> {
      try {
        const rules = await this.getActiveRules();
        const applicableRules = rules.filter(rule => this.eventMatchesRule(event, rule));
        
        // Sort by priority (high -> medium -> low)
        applicableRules.sort((a, b) => {
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
        
        // Execute invalidations
        for (const rule of applicableRules) {
          const expandedPattern = this.expandPattern(rule.pattern, event);
          await this.invalidateByPattern(expandedPattern);
        }
      } catch (error) {
        console.error('Event-based invalidation error:', error);
        throw error;
      }
    },

    async getActiveRules(): Promise<PatternInvalidationRule[]> {
      try {
        const rules = await cachingService.get<PatternInvalidationRule[]>(rulesKey);
        return rules || this.getDefaultRules();
      } catch (error) {
        console.error('Failed to get invalidation rules:', error);
        return this.getDefaultRules();
      }
    },

    validatePattern(pattern: string): boolean {
      try {
        this.patternToRegex(pattern);
        return true;
      } catch {
        return false;
      }
    },

    // Helper methods
    patternToRegex(pattern: string): RegExp {
      // Enhanced glob pattern support
      const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
        .replace(/\*/g, '.*') // Convert * to .*
        .replace(/\?/g, '.') // Convert ? to .
        .replace(/\{([^}]+)\}/g, '($1)'); // Convert {a,b} to (a|b)
      
      return new RegExp(`^${escaped}$`);
    },

    eventMatchesRule(event: InvalidationEvent, rule: PatternInvalidationRule): boolean {
      if (!rule.conditions) return true;
      
      const { conditions } = rule;
      
      // Check user actions
      if (conditions.userAction && event.action) {
        if (!conditions.userAction.includes(event.action)) {
          return false;
        }
      }
      
      // Check content types
      if (conditions.contentType && event.contentType) {
        if (!conditions.contentType.includes(event.contentType)) {
          return false;
        }
      }
      
      // Check time range
      if (conditions.timeRange) {
        const now = new Date();
        if (now < conditions.timeRange.start || now > conditions.timeRange.end) {
          return false;
        }
      }
      
      return true;
    },

    expandPattern(pattern: string, event: InvalidationEvent): string {
      return pattern
        .replace(/\{userId\}/g, event.userId || '*')
        .replace(/\{contentId\}/g, event.contentId || '*')
        .replace(/\{contentType\}/g, event.contentType || '*');
    },

    getDefaultRules(): PatternInvalidationRule[] {
      return [
        {
          pattern: 'user_*:{userId}:*',
          description: 'Invalidate all user-specific cache when user data changes',
          priority: 'high',
          conditions: {
            userAction: ['profile_update', 'settings_change', 'preference_update'],
          },
        },
        {
          pattern: 'post:{contentId}:*',
          description: 'Invalidate post-specific cache when post is updated',
          priority: 'high',
          conditions: {
            userAction: ['post_update', 'post_delete'],
            contentType: ['post'],
          },
        },
        {
          pattern: 'feed:*:{userId}:*',
          description: 'Invalidate user feeds when following/unfollowing',
          priority: 'medium',
          conditions: {
            userAction: ['follow', 'unfollow', 'block', 'unblock'],
          },
        },
        {
          pattern: 'discovery_feed:{userId}:*',
          description: 'Invalidate discovery feeds when user interactions change',
          priority: 'medium',
          conditions: {
            userAction: ['like', 'unlike', 'save', 'unsave', 'comment'],
          },
        },
        {
          pattern: 'rec_*:{userId}:*',
          description: 'Invalidate recommendation cache when user behavior changes',
          priority: 'medium',
          conditions: {
            userAction: ['like', 'unlike', 'save', 'unsave', 'comment', 'share'],
          },
        },
        {
          pattern: 'media:{contentId}:*',
          description: 'Invalidate media cache when media is updated',
          priority: 'low',
          conditions: {
            userAction: ['media_update', 'media_delete'],
            contentType: ['media'],
          },
        },
        {
          pattern: 'clip_*_embedding:*',
          description: 'Invalidate CLIP embeddings cache periodically',
          priority: 'low',
        },
        {
          pattern: 'voyage_*_embedding:*',
          description: 'Invalidate Voyage embeddings cache periodically',
          priority: 'low',
        },
      ];
    },
  };
}

// Pre-defined invalidation patterns for common scenarios
export const InvalidationPatterns = {
  // User-centric patterns
  user: {
    all: (userId: string) => `*${userId}*`,
    profile: (userId: string) => `profile:${userId}`,
    feed: (userId: string) => `feed:${userId}:*`,
    discovery: (userId: string) => `discovery_feed:${userId}:*`,
    recommendations: (userId: string) => `rec_*:${userId}:*`,
    drafts: (userId: string) => `draft:${userId}:*`,
    vectors: (userId: string) => `user_vector:${userId}`,
  },
  
  // Content-centric patterns
  content: {
    post: (postId: string) => `post:${postId}*`,
    media: (mediaId: string) => `media:${mediaId}*`,
    comment: (commentId: string) => `comment:${commentId}*`,
    hashtag: (hashtagId: string) => `hashtag:${hashtagId}*`,
  },
  
  // System-wide patterns
  system: {
    embeddings: (model: string) => `*_embedding:${model}:*`,
    recommendations: () => `rec_*`,
    feeds: () => `*_feed:*`,
    vectors: () => `*_vector:*`,
  },
  
  // Time-based patterns
  time: {
    recent: (hours: number) => `*:${new Date(Date.now() - hours * 60 * 60 * 1000).toISOString().split('T')[0]}*`,
    today: () => `*:${new Date().toISOString().split('T')[0]}*`,
  },
} as const;

// Event-based invalidation triggers
export const InvalidationTriggers = {
  // User actions
  userActions: {
    profileUpdate: (userId: string): InvalidationEvent => ({
      type: 'user_action',
      userId,
      action: 'profile_update',
      contentType: 'profile',
    }),
    
    postCreate: (userId: string, postId: string): InvalidationEvent => ({
      type: 'content_update',
      userId,
      contentId: postId,
      contentType: 'post',
      action: 'post_create',
    }),
    
    postUpdate: (userId: string, postId: string): InvalidationEvent => ({
      type: 'content_update',
      userId,
      contentId: postId,
      contentType: 'post',
      action: 'post_update',
    }),
    
    postDelete: (userId: string, postId: string): InvalidationEvent => ({
      type: 'content_update',
      userId,
      contentId: postId,
      contentType: 'post',
      action: 'post_delete',
    }),
    
    userInteraction: (userId: string, action: string, targetId?: string): InvalidationEvent => ({
      type: 'user_action',
      userId,
      action,
      contentId: targetId,
      metadata: { interactionType: action },
    }),
  },
  
  // System events
  systemEvents: {
    modelUpdate: (model: string): InvalidationEvent => ({
      type: 'system_event',
      action: 'model_update',
      metadata: { model },
    }),
    
    cacheExpiry: (pattern: string): InvalidationEvent => ({
      type: 'system_event',
      action: 'cache_expiry',
      metadata: { pattern },
    }),
  },
} as const;