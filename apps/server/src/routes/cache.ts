import type { Bindings, Variables } from '@/types';
import { Hono } from 'hono';
import { createCachingService, CacheKeys } from '../lib/cache/cachingService';
import {
  createCacheWarmingService,
  runRecommendationCacheWarming,
} from '../lib/cache/cacheWarming';
import {
  createAdvancedCachingService,
  runAdvancedCacheWarming,
} from '../lib/cache/advancedCachingService';
import { InvalidationTriggers } from '../lib/cache/patternInvalidation';
import { extractTransformationOptions } from '../lib/cache/edgeTransformations';
import {
  createRealTimeInvalidationService,
  startInvalidationQueueProcessor,
} from '../lib/cache/realTimeInvalidation';
import { createD1Client } from '@/db';
import * as schema from '@/db/schema';

const cacheRouter = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Warm cache endpoint (for cron jobs or manual triggers)
cacheRouter.post('/warm', async (c) => {
  const user = c.get('user');

  // Only allow admins or system calls to warm cache
  if (!user && c.req.header('Authorization') !== `Bearer ${c.env.SEED_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const warmingService = createCacheWarmingService(c.env);

    // Get active users for recommendation cache warming
    const db = createD1Client(c.env);
    const activeUsers = await db
      .select({ userId: schema.profile.userId })
      .from(schema.profile)
      .limit(50)
      .all();

    const activeUserIds = activeUsers.map((u) => u.userId);

    // Run both traditional and advanced cache warming
    await Promise.allSettled([
      warmingService.warmPopularPosts(),
      warmingService.warmRecentPosts(),
      warmingService.warmUserFeeds(activeUserIds),
      warmingService.warmDiscoveryFeeds(activeUserIds),
      runAdvancedCacheWarming(c.env, {
        includeTransformations: true,
        includePersonalization: false,
        maxItems: 50,
      }),
    ]);

    return c.json({ success: true, message: 'Cache warming completed' });
  } catch (error) {
    console.error('Cache warming error:', error);
    return c.json({ error: 'Cache warming failed' }, 500);
  }
});

// Warm recommendation cache for specific user
cacheRouter.post('/warm-recommendations/:userId', async (c) => {
  const user = c.get('user');
  const targetUserId = c.req.param('userId');

  // Only allow users to warm their own cache or admins to warm any cache
  if (!user && c.req.header('Authorization') !== `Bearer ${c.env.SEED_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (user && user.id !== targetUserId) {
    return c.json({ error: 'Can only warm your own recommendation cache' }, 403);
  }

  try {
    const warmingService = createCacheWarmingService(c.env);
    await warmingService.warmRecommendationData(targetUserId);

    return c.json({
      success: true,
      message: 'Recommendation cache warmed',
      userId: targetUserId,
    });
  } catch (error) {
    console.error('Recommendation cache warming error:', error);
    return c.json({ error: 'Recommendation cache warming failed' }, 500);
  }
});

// Clear discovery feed cache for user
cacheRouter.post('/clear-discovery/:userId', async (c) => {
  const user = c.get('user');
  const targetUserId = c.req.param('userId');

  // Only allow users to clear their own cache
  if (!user || user.id !== targetUserId) {
    return c.json({ error: 'Can only clear your own discovery cache' }, 403);
  }

  try {
    const cachingService = createCachingService(c.env);

    // Clear discovery feed cache patterns for this user
    await cachingService.invalidatePattern(CacheKeys.discoveryPattern(targetUserId));
    await cachingService.invalidatePattern(CacheKeys.recommendationPattern(targetUserId));

    return c.json({
      success: true,
      message: 'Discovery cache cleared',
      userId: targetUserId,
    });
  } catch (error) {
    console.error('Discovery cache clear error:', error);
    return c.json({ error: 'Failed to clear discovery cache' }, 500);
  }
});

// Invalidate specific cache patterns
cacheRouter.post('/invalidate', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { patterns } = body;

    if (!patterns || !Array.isArray(patterns)) {
      return c.json({ error: 'Patterns array is required' }, 400);
    }

    const cachingService = createCachingService(c.env);

    await Promise.all(patterns.map((pattern: string) => cachingService.invalidatePattern(pattern)));

    return c.json({
      success: true,
      message: `Invalidated ${patterns.length} cache patterns`,
      patterns,
    });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    return c.json({ error: 'Cache invalidation failed' }, 500);
  }
});

// Clear user's cache
cacheRouter.post('/clear-user', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const cachingService = createCachingService(c.env);

    // Clear all cache entries related to this user
    await cachingService.invalidatePattern(CacheKeys.userPattern(user.id));

    return c.json({
      success: true,
      message: 'User cache cleared',
      userId: user.id,
    });
  } catch (error) {
    console.error('User cache clear error:', error);
    return c.json({ error: 'Failed to clear user cache' }, 500);
  }
});

// Cache statistics (if KV supports it)
cacheRouter.get('/stats', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const kv = c.env.CACHE_KV;

    // Get basic KV stats
    const list = await kv.list({ limit: 1000 });

    const stats = {
      totalKeys: list.keys.length,
      cacheHit: 'N/A', // KV doesn't provide hit/miss stats
      lastUpdated: new Date().toISOString(),
      keyPrefixes: {} as Record<string, number>,
    };

    // Analyze key patterns
    for (const key of list.keys) {
      const prefix = key.name.split(':')[0];
      stats.keyPrefixes[prefix] = (stats.keyPrefixes[prefix] || 0) + 1;
    }

    return c.json(stats);
  } catch (error) {
    console.error('Cache stats error:', error);
    return c.json({ error: 'Failed to get cache stats' }, 500);
  }
});

// Health check for cache service
cacheRouter.get('/health', async (c) => {
  try {
    const cachingService = createCachingService(c.env);

    // Test cache operations
    const testKey = 'health_check_test';
    const testValue = { timestamp: Date.now() };

    await cachingService.set(testKey, testValue, 60); // 1 minute TTL
    const retrieved = await cachingService.get(testKey);
    await cachingService.delete(testKey);

    const isHealthy =
      retrieved !== null && typeof retrieved === 'object' && 'timestamp' in retrieved;

    return c.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      operations: {
        set: 'ok',
        get: retrieved !== null ? 'ok' : 'failed',
        delete: 'ok',
      },
    });
  } catch (error) {
    console.error('Cache health check error:', error);
    return c.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      500,
    );
  }
});

// Advanced cache transformation endpoint
cacheRouter.post('/transform', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { key, value, transformations, ttl = 300 } = body;

    if (!key || !value) {
      return c.json({ error: 'Key and value are required' }, 400);
    }

    const advancedCachingService = createAdvancedCachingService(c.env);
    
    const result = await advancedCachingService.transformAndCache(
      key,
      value,
      transformations || {},
      ttl
    );

    return c.json({
      success: true,
      key,
      transformed: result,
      cacheKey: advancedCachingService.getCacheKey(key, { transformation: transformations }),
    });
  } catch (error) {
    console.error('Cache transformation error:', error);
    return c.json({ error: 'Cache transformation failed' }, 500);
  }
});

// Advanced cache performance report
cacheRouter.get('/performance', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const hours = parseInt(c.req.query('hours') || '24');
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

    const advancedCachingService = createAdvancedCachingService(c.env);
    
    const [report, anomalies] = await Promise.all([
      advancedCachingService.getPerformanceReport({ start: startTime, end: endTime }),
      advancedCachingService.detectAnomalies(),
    ]);

    return c.json({
      report,
      anomalies,
      timeRange: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        hours,
      },
    });
  } catch (error) {
    console.error('Performance report error:', error);
    return c.json({ error: 'Failed to generate performance report' }, 500);
  }
});

// Cache metadata search
cacheRouter.get('/metadata/search', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const tag = c.req.query('tag');
    const pattern = c.req.query('pattern');

    if (!tag && !pattern) {
      return c.json({ error: 'Either tag or pattern parameter is required' }, 400);
    }

    const advancedCachingService = createAdvancedCachingService(c.env);
    
    let results = [];
    if (tag) {
      results = await advancedCachingService.findByTag(tag);
    } else if (pattern) {
      results = await advancedCachingService.findByPattern(pattern);
    }

    return c.json({
      results,
      count: results.length,
      searchCriteria: { tag, pattern },
    });
  } catch (error) {
    console.error('Metadata search error:', error);
    return c.json({ error: 'Metadata search failed' }, 500);
  }
});

// Cache optimization endpoint
cacheRouter.post('/optimize', async (c) => {
  const user = c.get('user');

  // Only allow admins or system calls
  if (!user && c.req.header('Authorization') !== `Bearer ${c.env.SEED_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const advancedCachingService = createAdvancedCachingService(c.env);
    const result = await advancedCachingService.optimizeCache();

    return c.json({
      success: true,
      message: 'Cache optimization completed',
      cleaned: result.cleaned,
      optimized: result.optimized,
    });
  } catch (error) {
    console.error('Cache optimization error:', error);
    return c.json({ error: 'Cache optimization failed' }, 500);
  }
});

// Trigger content invalidation by event
cacheRouter.post('/invalidate/event', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { eventType, userId, contentId, action } = body;

    if (!eventType || !action) {
      return c.json({ error: 'eventType and action are required' }, 400);
    }

    const advancedCachingService = createAdvancedCachingService(c.env);
    
    // Create invalidation event based on type
    let invalidationEvent;
    
    switch (eventType) {
      case 'post_update':
        invalidationEvent = InvalidationTriggers.userActions.postUpdate(
          userId || user.id,
          contentId
        );
        break;
      case 'post_create':
        invalidationEvent = InvalidationTriggers.userActions.postCreate(
          userId || user.id,
          contentId
        );
        break;
      case 'post_delete':
        invalidationEvent = InvalidationTriggers.userActions.postDelete(
          userId || user.id,
          contentId
        );
        break;
      case 'profile_update':
        invalidationEvent = InvalidationTriggers.userActions.profileUpdate(
          userId || user.id
        );
        break;
      default:
        invalidationEvent = InvalidationTriggers.userActions.userInteraction(
          userId || user.id,
          action,
          contentId
        );
    }

    await advancedCachingService.invalidateByEvent(invalidationEvent);

    return c.json({
      success: true,
      message: 'Event-based invalidation completed',
      event: invalidationEvent,
    });
  } catch (error) {
    console.error('Event invalidation error:', error);
    return c.json({ error: 'Event invalidation failed' }, 500);
  }
});

// Real-time invalidation queue management
cacheRouter.get('/queue/status', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const realTimeService = createRealTimeInvalidationService(c.env);
    const status = await realTimeService.getQueueStatus();

    return c.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Queue status error:', error);
    return c.json({ error: 'Failed to get queue status' }, 500);
  }
});

// Enqueue invalidation for later processing
cacheRouter.post('/queue/enqueue', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { pattern, priority = 'medium', delay = 0 } = body;

    if (!pattern) {
      return c.json({ error: 'Pattern is required' }, 400);
    }

    const realTimeService = createRealTimeInvalidationService(c.env);
    const itemId = await realTimeService.enqueueInvalidation(pattern, priority, delay);

    return c.json({
      success: true,
      itemId,
      pattern,
      priority,
      delay,
      scheduledFor: delay > 0 ? new Date(Date.now() + delay).toISOString() : new Date().toISOString(),
    });
  } catch (error) {
    console.error('Enqueue invalidation error:', error);
    return c.json({ error: 'Failed to enqueue invalidation' }, 500);
  }
});

// Process invalidation queue manually
cacheRouter.post('/queue/process', async (c) => {
  const user = c.get('user');

  // Only allow admins or system calls
  if (!user && c.req.header('Authorization') !== `Bearer ${c.env.SEED_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const realTimeService = createRealTimeInvalidationService(c.env);
    await realTimeService.processQueue();

    const status = await realTimeService.getQueueStatus();

    return c.json({
      success: true,
      message: 'Queue processed successfully',
      status,
    });
  } catch (error) {
    console.error('Queue processing error:', error);
    return c.json({ error: 'Failed to process queue' }, 500);
  }
});

// Retry failed invalidation items
cacheRouter.post('/queue/retry', async (c) => {
  const user = c.get('user');

  // Only allow admins or system calls
  if (!user && c.req.header('Authorization') !== `Bearer ${c.env.SEED_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const maxAge = parseInt(c.req.query('maxAge') || '3600000'); // 1 hour default
    
    const realTimeService = createRealTimeInvalidationService(c.env);
    const retriedCount = await realTimeService.retryFailedItems(maxAge);

    return c.json({
      success: true,
      message: `Retried ${retriedCount} failed items`,
      retriedCount,
    });
  } catch (error) {
    console.error('Retry failed items error:', error);
    return c.json({ error: 'Failed to retry items' }, 500);
  }
});

// Schedule invalidation for future execution
cacheRouter.post('/schedule', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { pattern, scheduledFor, priority = 'medium' } = body;

    if (!pattern || !scheduledFor) {
      return c.json({ error: 'Pattern and scheduledFor are required' }, 400);
    }

    const scheduledDate = new Date(scheduledFor);
    if (scheduledDate <= new Date()) {
      return c.json({ error: 'Scheduled time must be in the future' }, 400);
    }

    const realTimeService = createRealTimeInvalidationService(c.env);
    const itemId = await realTimeService.scheduleInvalidation(pattern, scheduledDate, priority);

    return c.json({
      success: true,
      itemId,
      pattern,
      scheduledFor: scheduledDate.toISOString(),
      priority,
    });
  } catch (error) {
    console.error('Schedule invalidation error:', error);
    return c.json({ error: 'Failed to schedule invalidation' }, 500);
  }
});

// Broadcast invalidation to real-time channels
cacheRouter.post('/broadcast', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { pattern, channels } = body;

    if (!pattern) {
      return c.json({ error: 'Pattern is required' }, 400);
    }

    const realTimeService = createRealTimeInvalidationService(c.env);
    await realTimeService.broadcastInvalidation(pattern, channels);

    return c.json({
      success: true,
      message: 'Invalidation broadcast sent',
      pattern,
      channels: channels || 'default',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Broadcast invalidation error:', error);
    return c.json({ error: 'Failed to broadcast invalidation' }, 500);
  }
});

// Real-time invalidation configuration
cacheRouter.get('/realtime/config', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const realTimeService = createRealTimeInvalidationService(c.env);
    const config = await realTimeService.getConfig();

    return c.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Get real-time config error:', error);
    return c.json({ error: 'Failed to get configuration' }, 500);
  }
});

cacheRouter.post('/realtime/config', async (c) => {
  const user = c.get('user');

  // Only allow admins
  if (!user && c.req.header('Authorization') !== `Bearer ${c.env.SEED_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const body = await c.req.json();
    
    const realTimeService = createRealTimeInvalidationService(c.env);
    await realTimeService.updateConfig(body);

    return c.json({
      success: true,
      message: 'Real-time invalidation configuration updated',
    });
  } catch (error) {
    console.error('Update real-time config error:', error);
    return c.json({ error: 'Failed to update configuration' }, 500);
  }
});

// Start queue processor (would typically be called during server startup)
cacheRouter.post('/queue/start-processor', async (c) => {
  // Only allow system calls
  if (c.req.header('Authorization') !== `Bearer ${c.env.SEED_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    await startInvalidationQueueProcessor(c.env);

    return c.json({
      success: true,
      message: 'Invalidation queue processor started',
    });
  } catch (error) {
    console.error('Start queue processor error:', error);
    return c.json({ error: 'Failed to start queue processor' }, 500);
  }
});

export default cacheRouter;
