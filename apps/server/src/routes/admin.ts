import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { performanceMonitor } from '../lib/monitoring/performanceMonitor.js';
import { featureFlagManager } from '../lib/infrastructure/featureFlags.js';
import { RealTimeRecommendationEngine } from '../lib/ai/realTimeRecommendationEngine.js';
import type { Bindings } from '../types.js';

const app = new Hono<{ Bindings: Bindings }>();

// Performance monitoring endpoints

/**
 * Get performance dashboard data
 */
app.get('/performance/dashboard', async (c) => {
  try {
    const dashboardData = performanceMonitor.getDashboardData();

    return c.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting performance dashboard:', error);
    return c.json({ error: 'Failed to get performance data' }, 500);
  }
});

/**
 * Get performance metrics in Prometheus format
 */
app.get('/performance/metrics', async (c) => {
  try {
    const metrics = performanceMonitor.exportPrometheusMetrics();

    c.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    return c.text(metrics);
  } catch (error) {
    console.error('Error exporting Prometheus metrics:', error);
    return c.text('# Error exporting metrics\n', 500);
  }
});

/**
 * Get performance statistics for specific metric
 */
app.get('/performance/stats/:metricName', async (c) => {
  try {
    const metricName = c.req.param('metricName');
    const stats = performanceMonitor.getStats(metricName);

    return c.json({
      success: true,
      data: {
        metricName,
        stats,
      },
    });
  } catch (error) {
    console.error('Error getting metric stats:', error);
    return c.json({ error: 'Failed to get metric statistics' }, 500);
  }
});

/**
 * Get active performance alerts
 */
app.get('/performance/alerts', async (c) => {
  try {
    const activeAlerts = performanceMonitor.getActiveAlerts();
    const allAlerts = performanceMonitor.getAllAlerts();

    return c.json({
      success: true,
      data: {
        active: activeAlerts,
        total: allAlerts.length,
        resolved: allAlerts.filter((a) => a.resolved).length,
      },
    });
  } catch (error) {
    console.error('Error getting performance alerts:', error);
    return c.json({ error: 'Failed to get performance alerts' }, 500);
  }
});

/**
 * Resolve a performance alert
 */
app.post('/performance/alerts/:alertId/resolve', async (c) => {
  try {
    const alertId = c.req.param('alertId');
    performanceMonitor.resolveAlert(alertId);

    return c.json({
      success: true,
      message: `Alert ${alertId} resolved`,
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    return c.json({ error: 'Failed to resolve alert' }, 500);
  }
});

// Feature flag management endpoints

/**
 * Get all feature flags
 */
app.get('/feature-flags', async (c) => {
  try {
    const flags = featureFlagManager.getAllFeatureFlags();

    return c.json({
      success: true,
      data: flags,
    });
  } catch (error) {
    console.error('Error getting feature flags:', error);
    return c.json({ error: 'Failed to get feature flags' }, 500);
  }
});

/**
 * Create or update feature flag
 */
const featureFlagSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
  rolloutPercentage: z.number().min(0).max(100),
  conditions: z
    .array(
      z.object({
        type: z.enum(['user_id', 'user_segment', 'time_range', 'custom']),
        operator: z.enum(['equals', 'contains', 'in', 'not_in', 'greater_than', 'less_than']),
        value: z.any(),
      }),
    )
    .optional(),
  metadata: z.record(z.any()).optional(),
});

app.post('/feature-flags', zValidator('json', featureFlagSchema), async (c) => {
  try {
    const flagData = c.req.valid('json');
    featureFlagManager.setFeatureFlag(flagData);

    return c.json({
      success: true,
      message: `Feature flag '${flagData.name}' updated`,
      data: featureFlagManager.getFeatureFlag(flagData.name),
    });
  } catch (error) {
    console.error('Error updating feature flag:', error);
    return c.json({ error: 'Failed to update feature flag' }, 500);
  }
});

/**
 * Get specific feature flag
 */
app.get('/feature-flags/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const flag = featureFlagManager.getFeatureFlag(name);

    if (!flag) {
      return c.json({ error: 'Feature flag not found' }, 404);
    }

    return c.json({
      success: true,
      data: flag,
    });
  } catch (error) {
    console.error('Error getting feature flag:', error);
    return c.json({ error: 'Failed to get feature flag' }, 500);
  }
});

/**
 * Delete feature flag
 */
app.delete('/feature-flags/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const deleted = featureFlagManager.removeFeatureFlag(name);

    if (!deleted) {
      return c.json({ error: 'Feature flag not found' }, 404);
    }

    return c.json({
      success: true,
      message: `Feature flag '${name}' deleted`,
    });
  } catch (error) {
    console.error('Error deleting feature flag:', error);
    return c.json({ error: 'Failed to delete feature flag' }, 500);
  }
});

// A/B Testing endpoints

/**
 * Get all A/B tests
 */
app.get('/ab-tests', async (c) => {
  try {
    const tests = featureFlagManager.getAllABTests();

    return c.json({
      success: true,
      data: tests,
    });
  } catch (error) {
    console.error('Error getting A/B tests:', error);
    return c.json({ error: 'Failed to get A/B tests' }, 500);
  }
});

/**
 * Create or update A/B test
 */
const abTestSchema = z.object({
  name: z.string().min(1),
  enabled: z.boolean(),
  trafficAllocation: z.number().min(0).max(100),
  variants: z
    .array(
      z.object({
        name: z.string(),
        weight: z.number().min(0).max(100),
        config: z.record(z.any()),
      }),
    )
    .min(1),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

app.post('/ab-tests', zValidator('json', abTestSchema), async (c) => {
  try {
    const testData = c.req.valid('json');

    // Convert date strings to Date objects
    const test = {
      ...testData,
      startDate: testData.startDate ? new Date(testData.startDate) : undefined,
      endDate: testData.endDate ? new Date(testData.endDate) : undefined,
    };

    featureFlagManager.setABTest(test);

    return c.json({
      success: true,
      message: `A/B test '${test.name}' updated`,
      data: featureFlagManager.getABTest(test.name),
    });
  } catch (error) {
    console.error('Error updating A/B test:', error);
    return c.json({ error: 'Failed to update A/B test' }, 500);
  }
});

/**
 * Get specific A/B test
 */
app.get('/ab-tests/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const test = featureFlagManager.getABTest(name);

    if (!test) {
      return c.json({ error: 'A/B test not found' }, 404);
    }

    return c.json({
      success: true,
      data: test,
    });
  } catch (error) {
    console.error('Error getting A/B test:', error);
    return c.json({ error: 'Failed to get A/B test' }, 500);
  }
});

/**
 * Delete A/B test
 */
app.delete('/ab-tests/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const deleted = featureFlagManager.removeABTest(name);

    if (!deleted) {
      return c.json({ error: 'A/B test not found' }, 404);
    }

    return c.json({
      success: true,
      message: `A/B test '${name}' deleted`,
    });
  } catch (error) {
    console.error('Error deleting A/B test:', error);
    return c.json({ error: 'Failed to delete A/B test' }, 500);
  }
});

/**
 * Get user's feature flag and A/B test assignments
 */
app.get('/user/:userId/assignments', async (c) => {
  try {
    const userId = c.req.param('userId');
    const userContext = { userId }; // Could be expanded with more context

    // Get feature flag statuses
    const flags = featureFlagManager.getAllFeatureFlags();
    const flagStatuses = flags.reduce(
      (acc, flag) => {
        acc[flag.name] = featureFlagManager.isEnabled(flag.name, userContext);
        return acc;
      },
      {} as Record<string, boolean>,
    );

    // Get A/B test assignments
    const tests = featureFlagManager.getAllABTests();
    const testAssignments = tests.reduce(
      (acc, test) => {
        const result = featureFlagManager.getABTestVariant(test.name, userContext);
        acc[test.name] = result;
        return acc;
      },
      {} as Record<string, any>,
    );

    // Get recommendation configuration
    const recommendationConfig = featureFlagManager.getRecommendationConfig(userContext);

    return c.json({
      success: true,
      data: {
        userId,
        featureFlags: flagStatuses,
        abTests: testAssignments,
        recommendationConfig,
      },
    });
  } catch (error) {
    console.error('Error getting user assignments:', error);
    return c.json({ error: 'Failed to get user assignments' }, 500);
  }
});

// System administration endpoints

/**
 * Get system health status
 */
app.get('/health', async (c) => {
  try {
    const realtimeEngine = new RealTimeRecommendationEngine(c.env);
    const connectionStats = await realtimeEngine.getConnectionStats();
    const dashboardData = performanceMonitor.getDashboardData();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: connectionStats.activeConnections > 0 ? 'healthy' : 'degraded',
          activeConnections: connectionStats.activeConnections,
          queuedQueries: connectionStats.queuedQueries,
        },
        cache: {
          status: 'healthy', // Would check actual cache health
          hitRate: dashboardData.systemMetrics.cacheHitRate,
        },
        wasm: {
          status: 'healthy', // Would check WASM module health
          memoryUsage: dashboardData.systemMetrics.wasmMemoryUsage,
        },
        performanceMonitoring: {
          status: 'healthy',
          activeAlerts: dashboardData.activeAlerts.length,
          recentMetrics: dashboardData.recentMetrics.length,
        },
      },
      systemMetrics: dashboardData.systemMetrics,
    };

    // Check for critical alerts
    const criticalAlerts = dashboardData.activeAlerts.filter(
      (alert) => alert.severity === 'critical',
    );

    if (criticalAlerts.length > 0) {
      health.status = 'unhealthy';
      health.services.performanceMonitoring.status = 'unhealthy';
    }

    return c.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('Error getting system health:', error);
    return c.json(
      {
        success: false,
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message,
        },
      },
      500,
    );
  }
});

/**
 * Clear recommendation caches
 */
app.post('/cache/clear', async (c) => {
  try {
    const realtimeEngine = new RealTimeRecommendationEngine(c.env);
    await realtimeEngine.clearCaches();

    return c.json({
      success: true,
      message: 'Recommendation caches cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing caches:', error);
    return c.json({ error: 'Failed to clear caches' }, 500);
  }
});

/**
 * Trigger performance monitoring collection
 */
app.post('/performance/collect', async (c) => {
  try {
    // Force immediate metric collection
    performanceMonitor.startCollection();

    return c.json({
      success: true,
      message: 'Performance monitoring collection triggered',
    });
  } catch (error) {
    console.error('Error triggering performance collection:', error);
    return c.json({ error: 'Failed to trigger performance collection' }, 500);
  }
});

export default app;
