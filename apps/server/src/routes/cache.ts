import type { Bindings, Variables } from '@/types';
import { Hono } from 'hono';
import { createCachingService, CacheKeys } from '../lib/cachingService';
import { createCacheWarmingService, runRecommendationCacheWarming } from '../lib/cacheWarming';
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

    // Run cache warming including recommendation system
    await Promise.allSettled([
      warmingService.warmPopularPosts(),
      warmingService.warmRecentPosts(),
      warmingService.warmUserFeeds(activeUserIds),
      warmingService.warmDiscoveryFeeds(activeUserIds),
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

export default cacheRouter;
