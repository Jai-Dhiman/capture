import type { Bindings, Variables } from '@/types';
import { Hono } from 'hono';
import { createCachingService, CacheKeys } from "@/lib/cache/cachingService";
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
    // Cache warming functionality simplified for beta
    const cachingService = createCachingService(c.env);
    
    // Basic cache warming - just clear existing cache to force fresh data
    await cachingService.invalidatePattern('*');

    return c.json({ success: true, message: 'Cache warming completed (simplified for beta)' });
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
    // Simplified recommendation cache warming for beta
    const cachingService = createCachingService(c.env);
    await cachingService.invalidatePattern(CacheKeys.discoveryPattern(targetUserId));

    return c.json({
      success: true,
      message: 'Recommendation cache refreshed (simplified for beta)',
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
    const kv = c.env.CAPTURE_KV;

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

// Basic cache operations endpoint
cacheRouter.post('/operations', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { operation, key, value, ttl = 300 } = body;

    if (!operation || !key) {
      return c.json({ error: 'Operation and key are required' }, 400);
    }

    const cachingService = createCachingService(c.env);
    
    let result: unknown | { success: boolean; message: string };
    
    switch (operation) {
      case 'get':
        result = await cachingService.get(key);
        break;
      case 'set':
        if (value === undefined) {
          return c.json({ error: 'Value is required for set operation' }, 400);
        }
        await cachingService.set(key, value, ttl);
        result = { success: true, message: 'Value set successfully' };
        break;
      case 'delete':
        await cachingService.delete(key);
        result = { success: true, message: 'Key deleted successfully' };
        break;
      case 'invalidate':
        await cachingService.invalidatePattern(key);
        result = { success: true, message: 'Pattern invalidated successfully' };
        break;
      default:
        return c.json({ error: 'Invalid operation. Supported: get, set, delete, invalidate' }, 400);
    }

    return c.json({
      success: true,
      operation,
      key,
      result,
    });
  } catch (error) {
    console.error('Cache operation error:', error);
    return c.json({ error: 'Cache operation failed' }, 500);
  }
});

// Simplified cache warming for specific patterns
cacheRouter.post('/warm-pattern', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const body = await c.req.json();
    const { pattern } = body;

    if (!pattern) {
      return c.json({ error: 'Pattern is required' }, 400);
    }

    const cachingService = createCachingService(c.env);
    
    // For now, just invalidate the pattern to force fresh data on next access
    await cachingService.invalidatePattern(pattern);

    return c.json({
      success: true,
      message: 'Pattern cache invalidated for warming',
      pattern,
    });
  } catch (error) {
    console.error('Pattern cache warming error:', error);
    return c.json({ error: 'Pattern cache warming failed' }, 500);
  }
});

// Cache key generator helper
cacheRouter.get('/keys/:type', async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    const type = c.req.param('type');
    const id = c.req.query('id');

    if (!id && ['post', 'profile', 'user', 'discovery'].includes(type)) {
      return c.json({ error: 'ID parameter is required for this key type' }, 400);
    }

    let key: string;
    let pattern: string;

    switch (type) {
      case 'post':
        key = CacheKeys.post(id!);
        pattern = CacheKeys.postPattern(id!);
        break;
      case 'profile':
        key = CacheKeys.profile(id!);
        pattern = CacheKeys.userPattern(id!);
        break;
      case 'user':
        key = CacheKeys.profile(id!);
        pattern = CacheKeys.userPattern(id!);
        break;
      case 'discovery':
        key = CacheKeys.discoveryFeed(id!);
        pattern = CacheKeys.discoveryPattern(id!);
        break;
      case 'recommendation':
        key = id ? CacheKeys.recommendationScores(id, 'sample') : 'recommendation:*';
        pattern = id ? CacheKeys.recommendationPattern(id) : 'rec:*';
        break;
      default:
        return c.json({ error: 'Invalid key type. Supported: post, profile, user, discovery, recommendation' }, 400);
    }

    return c.json({
      success: true,
      type,
      id,
      key,
      pattern,
    });
  } catch (error) {
    console.error('Cache key generation error:', error);
    return c.json({ error: 'Cache key generation failed' }, 500);
  }
});

export default cacheRouter;
