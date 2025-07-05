/**
 * Database Query Monitoring and Error Reporting
 *
 * Provides performance monitoring, error tracking, and alerting for database queries
 */

import type { Bindings } from '../../types';

export interface QueryMetrics {
  queryName: string;
  executionTime: number;
  success: boolean;
  error?: string;
  timestamp: number;
  userId?: string;
  params?: Record<string, any>;
  resultCount?: number;
  cacheHit?: boolean;
}

export interface PerformanceStats {
  totalQueries: number;
  averageExecutionTime: number;
  slowQueries: number;
  errorRate: number;
  cacheHitRate: number;
  queriesPerSecond: number;
}

/**
 * Query performance monitor
 */
export class QueryMonitor {
  private metrics: QueryMetrics[] = [];
  private readonly maxMetricsHistory = 10000;
  private readonly slowQueryThreshold = 1000; // 1 second

  constructor(private bindings?: Bindings) {}

  /**
   * Record a query execution
   */
  recordQuery(metrics: QueryMetrics): void {
    this.metrics.push(metrics);

    // Keep only recent metrics to prevent memory issues
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Log slow queries
    if (metrics.executionTime > this.slowQueryThreshold) {
      console.warn(`[SLOW QUERY] ${metrics.queryName} took ${metrics.executionTime}ms`, {
        queryName: metrics.queryName,
        executionTime: metrics.executionTime,
        userId: metrics.userId,
        params: metrics.params,
        resultCount: metrics.resultCount,
      });
    }

    // Log errors
    if (!metrics.success && metrics.error) {
      console.error(`[QUERY ERROR] ${metrics.queryName} failed:`, {
        queryName: metrics.queryName,
        error: metrics.error,
        userId: metrics.userId,
        params: metrics.params,
        executionTime: metrics.executionTime,
      });
    }

    // Send to analytics service if available
    this.sendToAnalytics(metrics);
  }

  /**
   * Get performance statistics
   */
  getStats(timeWindowMs = 300000): PerformanceStats {
    const cutoff = Date.now() - timeWindowMs;
    const recentMetrics = this.metrics.filter((m) => m.timestamp > cutoff);

    if (recentMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageExecutionTime: 0,
        slowQueries: 0,
        errorRate: 0,
        cacheHitRate: 0,
        queriesPerSecond: 0,
      };
    }

    const totalQueries = recentMetrics.length;
    const successfulQueries = recentMetrics.filter((m) => m.success);
    const slowQueries = recentMetrics.filter((m) => m.executionTime > this.slowQueryThreshold);
    const cacheHits = recentMetrics.filter((m) => m.cacheHit === true);

    const averageExecutionTime =
      recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries;
    const errorRate = (totalQueries - successfulQueries.length) / totalQueries;
    const cacheHitRate = cacheHits.length / totalQueries;
    const queriesPerSecond = totalQueries / (timeWindowMs / 1000);

    return {
      totalQueries,
      averageExecutionTime,
      slowQueries: slowQueries.length,
      errorRate,
      cacheHitRate,
      queriesPerSecond,
    };
  }

  /**
   * Get slow queries for analysis
   */
  getSlowQueries(limit = 10): QueryMetrics[] {
    return this.metrics
      .filter((m) => m.executionTime > this.slowQueryThreshold)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  }

  /**
   * Get error queries for debugging
   */
  getErrorQueries(limit = 10): QueryMetrics[] {
    return this.metrics
      .filter((m) => !m.success)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get query performance by type
   */
  getQueryPerformanceByType(): Record<string, PerformanceStats> {
    const grouped = this.metrics.reduce(
      (acc, metric) => {
        if (!acc[metric.queryName]) {
          acc[metric.queryName] = [];
        }
        acc[metric.queryName].push(metric);
        return acc;
      },
      {} as Record<string, QueryMetrics[]>,
    );

    const result: Record<string, PerformanceStats> = {};

    for (const [queryName, metrics] of Object.entries(grouped)) {
      const totalQueries = metrics.length;
      const successfulQueries = metrics.filter((m) => m.success);
      const slowQueries = metrics.filter((m) => m.executionTime > this.slowQueryThreshold);
      const cacheHits = metrics.filter((m) => m.cacheHit === true);

      result[queryName] = {
        totalQueries,
        averageExecutionTime: metrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries,
        slowQueries: slowQueries.length,
        errorRate: (totalQueries - successfulQueries.length) / totalQueries,
        cacheHitRate: cacheHits.length / totalQueries,
        queriesPerSecond: 0, // Would need time window calculation
      };
    }

    return result;
  }

  /**
   * Clear metrics history
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Send metrics to analytics service
   */
  private sendToAnalytics(metrics: QueryMetrics): void {
    try {
      // In a real implementation, this would send to your analytics service
      // For now, we'll just structure the data for potential transmission

      // if (this.bindings?.ANALYTICS_ENDPOINT) {
      //   const analyticsData = {
      //     event: 'database_query',
      //     timestamp: metrics.timestamp,
      //     properties: {
      //       query_name: metrics.queryName,
      //       execution_time: metrics.executionTime,
      //       success: metrics.success,
      //       error: metrics.error,
      //       user_id: metrics.userId,
      //       result_count: metrics.resultCount,
      //       cache_hit: metrics.cacheHit,
      //     },
      //   };

        // Send to analytics endpoint (implementation would depend on service)
        // fetch(this.bindings.ANALYTICS_ENDPOINT, { ... })
      }
    } catch (error) {
      // Don't let analytics failures break the app
      console.error('Failed to send analytics:', error);
    }
  }

/**
 * Decorator function to monitor database query performance
 */
export function monitorQuery(queryName: string, monitor: QueryMonitor) {
  return <T extends any[], R>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>,
  ) => {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (...args: T): Promise<R> {
      const startTime = performance.now();
      const timestamp = Date.now();
      let success = true;
      let error: string | undefined;
      let result: R;
      let resultCount: number | undefined;

      try {
        result = await originalMethod.apply(this, args);

        // Try to determine result count
        if (Array.isArray(result)) {
          resultCount = result.length;
        } else if (result && typeof result === 'object' && 'length' in result) {
          resultCount = (result as any).length;
        }

        return result;
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        const executionTime = performance.now() - startTime;

        monitor.recordQuery({
          queryName,
          executionTime,
          success,
          error,
          timestamp,
          resultCount,
          params: args.length > 0 ? { argCount: args.length } : undefined,
        });
      }
    };

    return descriptor;
  };
}

/**
 * Monitored wrapper for query functions
 */
export function createMonitoredQueries(bindings: Bindings) {
  const monitor = new QueryMonitor(bindings);

  /**
   * Wrap a query function with monitoring
   */
  const wrapQuery = <T extends any[], R>(
    queryName: string,
    queryFn: (...args: T) => Promise<R>,
  ) => {
    return async (...args: T): Promise<R> => {
      const startTime = performance.now();
      const timestamp = Date.now();
      let success = true;
      let error: string | undefined;
      let result: R;
      let resultCount: number | undefined;
      const cacheHit = false;

      try {
        result = await queryFn(...args);

        // Try to determine result count
        if (Array.isArray(result)) {
          resultCount = result.length;
        } else if (result && typeof result === 'object' && 'length' in result) {
          resultCount = (result as any).length;
        }

        return result;
      } catch (err) {
        success = false;
        error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        const executionTime = performance.now() - startTime;

        monitor.recordQuery({
          queryName,
          executionTime,
          success,
          error,
          timestamp,
          resultCount,
          cacheHit,
          params: args.length > 0 ? { argCount: args.length } : undefined,
        });
      }
    };
  };

  return {
    monitor,
    wrapQuery,
  };
}

/**
 * Alert system for monitoring thresholds
 */
export class QueryAlertSystem {
  private alerts: Array<{
    id: string;
    condition: (stats: PerformanceStats) => boolean;
    message: string;
    lastTriggered?: number;
    cooldownMs: number;
  }> = [];

  constructor(private monitor: QueryMonitor) {
    this.setupDefaultAlerts();
  }

  /**
   * Add a custom alert condition
   */
  addAlert(
    id: string,
    condition: (stats: PerformanceStats) => boolean,
    message: string,
    cooldownMs = 300000, // 5 minutes default cooldown
  ): void {
    this.alerts.push({
      id,
      condition,
      message,
      cooldownMs,
    });
  }

  /**
   * Check all alert conditions
   */
  checkAlerts(): void {
    const stats = this.monitor.getStats();
    const now = Date.now();

    for (const alert of this.alerts) {
      // Check cooldown period
      if (alert.lastTriggered && now - alert.lastTriggered < alert.cooldownMs) {
        continue;
      }

      // Check condition
      if (alert.condition(stats)) {
        this.triggerAlert(alert, stats);
        alert.lastTriggered = now;
      }
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(alert: { id: string; message: string }, stats: PerformanceStats): void {
    console.error(`[QUERY ALERT] ${alert.id}: ${alert.message}`, {
      alertId: alert.id,
      stats,
      timestamp: new Date().toISOString(),
    });

    // In a real implementation, you would send this to your alerting system
    // (Slack, PagerDuty, email, etc.)
  }

  /**
   * Setup default alert conditions
   */
  private setupDefaultAlerts(): void {
    // High error rate alert
    this.addAlert(
      'high_error_rate',
      (stats) => stats.errorRate > 0.05, // 5% error rate
      'Database query error rate is above 5%',
    );

    // Slow query rate alert
    this.addAlert(
      'high_slow_query_rate',
      (stats) => stats.slowQueries / stats.totalQueries > 0.1, // 10% slow queries
      'More than 10% of queries are slow',
    );

    // Low cache hit rate alert
    this.addAlert(
      'low_cache_hit_rate',
      (stats) => stats.cacheHitRate < 0.5, // Less than 50% cache hit rate
      'Cache hit rate is below 50%',
    );

    // High average execution time alert
    this.addAlert(
      'high_avg_execution_time',
      (stats) => stats.averageExecutionTime > 500, // 500ms average
      'Average query execution time is above 500ms',
    );
  }

  /**
   * Start periodic alert checking
   */
  startMonitoring(intervalMs = 60000): void {
    setInterval(() => {
      this.checkAlerts();
    }, intervalMs);
  }
}

// Global monitor instance (singleton)
let globalMonitor: QueryMonitor | null = null;

export function getGlobalMonitor(bindings?: Bindings): QueryMonitor {
  if (!globalMonitor) {
    globalMonitor = new QueryMonitor(bindings);
  }
  return globalMonitor;
}

export function resetGlobalMonitor(): void {
  globalMonitor = null;
}
