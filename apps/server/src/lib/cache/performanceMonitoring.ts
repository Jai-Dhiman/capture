import type { Bindings } from '@/types';

export interface PerformanceMetrics {
  timestamp: string;
  endpoint: string;
  method: string;
  responseTime: number;
  cacheHit: boolean;
  cacheKey?: string;
  transformationTime?: number;
  cdnHit?: boolean;
  edgeLocation?: string;
  userAgent?: string;
  geolocation?: {
    country: string;
    city: string;
    region: string;
  };
  contentSize: number;
  statusCode: number;
  error?: string;
}

export interface PerformanceReport {
  timeRange: {
    start: string;
    end: string;
  };
  totalRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  cdnHitRate: number;
  errorRate: number;
  slowestEndpoints: Array<{
    endpoint: string;
    averageTime: number;
    requestCount: number;
  }>;
  topGeolocation: Array<{
    location: string;
    requestCount: number;
    averageTime: number;
  }>;
  cacheEfficiency: {
    hitRate: number;
    missRate: number;
    mostMissedKeys: Array<{
      key: string;
      missCount: number;
    }>;
  };
  transformationMetrics: {
    totalTransformations: number;
    averageTransformationTime: number;
    topTransformations: Array<{
      type: string;
      count: number;
      averageTime: number;
    }>;
  };
}

export interface PerformanceMonitoringService {
  recordMetrics: (metrics: PerformanceMetrics) => Promise<void>;
  getReport: (timeRange: { start: Date; end: Date }) => Promise<PerformanceReport>;
  getRealtimeMetrics: () => Promise<PerformanceMetrics[]>;
  detectAnomalies: () => Promise<Array<{ type: string; severity: 'low' | 'medium' | 'high'; description: string }>>;
  getAlerts: () => Promise<Array<{ timestamp: string; level: string; message: string }>>;
  trackCachePerformance: (key: string, hit: boolean, responseTime: number) => Promise<void>;
  trackTransformationPerformance: (type: string, duration: number) => Promise<void>;
}

export function createPerformanceMonitoringService(env: Bindings): PerformanceMonitoringService {
  const metricsKey = 'performance_metrics';
  const alertsKey = 'performance_alerts';
  const realtimeKey = 'realtime_metrics';
  
  return {
    async recordMetrics(metrics: PerformanceMetrics): Promise<void> {
      try {
        // Store in realtime buffer
        await this.addToRealtimeBuffer(metrics);
        
        // Store in long-term storage
        await this.storeMetrics(metrics);
        
        // Check for anomalies
        await this.checkAnomalies(metrics);
      } catch (error) {
        console.error('Failed to record performance metrics:', error);
      }
    },

    async getReport(timeRange: { start: Date; end: Date }): Promise<PerformanceReport> {
      try {
        const metrics = await this.getMetricsInRange(timeRange);
        
        if (metrics.length === 0) {
          return this.getEmptyReport(timeRange);
        }
        
        return this.generateReport(metrics, timeRange);
      } catch (error) {
        console.error('Failed to generate performance report:', error);
        return this.getEmptyReport(timeRange);
      }
    },

    async getRealtimeMetrics(): Promise<PerformanceMetrics[]> {
      try {
        const realtimeMetrics = await env.CACHE_KV.get(realtimeKey, 'json');
        return (realtimeMetrics as PerformanceMetrics[]) || [];
      } catch (error) {
        console.error('Failed to get realtime metrics:', error);
        return [];
      }
    },

    async detectAnomalies(): Promise<Array<{ type: string; severity: 'low' | 'medium' | 'high'; description: string }>> {
      try {
        const realtimeMetrics = await this.getRealtimeMetrics();
        const anomalies = [];
        
        if (realtimeMetrics.length === 0) {
          return [];
        }
        
        // Calculate baseline metrics
        const totalRequests = realtimeMetrics.length;
        const averageResponseTime = realtimeMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
        const cacheHitRate = realtimeMetrics.filter(m => m.cacheHit).length / totalRequests;
        const errorRate = realtimeMetrics.filter(m => m.statusCode >= 400).length / totalRequests;
        
        // Detect high response time
        if (averageResponseTime > 1000) {
          anomalies.push({
            type: 'high_response_time',
            severity: averageResponseTime > 2000 ? 'high' : 'medium',
            description: `Average response time is ${averageResponseTime.toFixed(2)}ms`,
          });
        }
        
        // Detect low cache hit rate
        if (cacheHitRate < 0.5) {
          anomalies.push({
            type: 'low_cache_hit_rate',
            severity: cacheHitRate < 0.3 ? 'high' : 'medium',
            description: `Cache hit rate is only ${(cacheHitRate * 100).toFixed(1)}%`,
          });
        }
        
        // Detect high error rate
        if (errorRate > 0.05) {
          anomalies.push({
            type: 'high_error_rate',
            severity: errorRate > 0.1 ? 'high' : 'medium',
            description: `Error rate is ${(errorRate * 100).toFixed(1)}%`,
          });
        }
        
        return anomalies;
      } catch (error) {
        console.error('Failed to detect anomalies:', error);
        return [];
      }
    },

    async getAlerts(): Promise<Array<{ timestamp: string; level: string; message: string }>> {
      try {
        const alerts = await env.CACHE_KV.get(alertsKey, 'json');
        return (alerts as Array<{ timestamp: string; level: string; message: string }>) || [];
      } catch (error) {
        console.error('Failed to get alerts:', error);
        return [];
      }
    },

    async trackCachePerformance(key: string, hit: boolean, responseTime: number): Promise<void> {
      try {
        const cacheMetrics = await env.CACHE_KV.get('cache_perf_metrics', 'json') as any || {
          totalRequests: 0,
          totalHits: 0,
          totalResponseTime: 0,
          keyPerformance: {} as Record<string, { hits: number; misses: number; totalTime: number }>,
        };
        
        cacheMetrics.totalRequests++;
        cacheMetrics.totalResponseTime += responseTime;
        
        if (hit) {
          cacheMetrics.totalHits++;
        }
        
        if (!cacheMetrics.keyPerformance[key]) {
          cacheMetrics.keyPerformance[key] = { hits: 0, misses: 0, totalTime: 0 };
        }
        
        if (hit) {
          cacheMetrics.keyPerformance[key].hits++;
        } else {
          cacheMetrics.keyPerformance[key].misses++;
        }
        
        cacheMetrics.keyPerformance[key].totalTime += responseTime;
        
        await env.CACHE_KV.put('cache_perf_metrics', JSON.stringify(cacheMetrics), {
          expirationTtl: 86400, // 24 hours
        });
      } catch (error) {
        console.error('Failed to track cache performance:', error);
      }
    },

    async trackTransformationPerformance(type: string, duration: number): Promise<void> {
      try {
        const transformMetrics = await env.CACHE_KV.get('transform_perf_metrics', 'json') as any || {
          transformations: {} as Record<string, { count: number; totalTime: number; averageTime: number }>,
        };
        
        if (!transformMetrics.transformations[type]) {
          transformMetrics.transformations[type] = { count: 0, totalTime: 0, averageTime: 0 };
        }
        
        const typeMetrics = transformMetrics.transformations[type];
        typeMetrics.count++;
        typeMetrics.totalTime += duration;
        typeMetrics.averageTime = typeMetrics.totalTime / typeMetrics.count;
        
        await env.CACHE_KV.put('transform_perf_metrics', JSON.stringify(transformMetrics), {
          expirationTtl: 86400, // 24 hours
        });
      } catch (error) {
        console.error('Failed to track transformation performance:', error);
      }
    },

    // Helper methods
    async addToRealtimeBuffer(metrics: PerformanceMetrics): Promise<void> {
      try {
        const realtimeMetrics = await this.getRealtimeMetrics();
        realtimeMetrics.push(metrics);
        
        // Keep only last 100 metrics for realtime monitoring
        const trimmedMetrics = realtimeMetrics.slice(-100);
        
        await env.CACHE_KV.put(realtimeKey, JSON.stringify(trimmedMetrics), {
          expirationTtl: 3600, // 1 hour
        });
      } catch (error) {
        console.error('Failed to add to realtime buffer:', error);
      }
    },

    async storeMetrics(metrics: PerformanceMetrics): Promise<void> {
      try {
        const date = new Date(metrics.timestamp).toISOString().split('T')[0];
        const dailyKey = `${metricsKey}:${date}`;
        
        const dailyMetrics = await env.CACHE_KV.get(dailyKey, 'json') as PerformanceMetrics[] || [];
        dailyMetrics.push(metrics);
        
        await env.CACHE_KV.put(dailyKey, JSON.stringify(dailyMetrics), {
          expirationTtl: 86400 * 7, // 7 days
        });
      } catch (error) {
        console.error('Failed to store metrics:', error);
      }
    },

    async checkAnomalies(metrics: PerformanceMetrics): Promise<void> {
      try {
        const alerts = await this.getAlerts();
        
        // Check for slow responses
        if (metrics.responseTime > 2000) {
          alerts.push({
            timestamp: new Date().toISOString(),
            level: 'warning',
            message: `Slow response detected: ${metrics.endpoint} took ${metrics.responseTime}ms`,
          });
        }
        
        // Check for errors
        if (metrics.statusCode >= 500) {
          alerts.push({
            timestamp: new Date().toISOString(),
            level: 'error',
            message: `Server error: ${metrics.endpoint} returned ${metrics.statusCode}`,
          });
        }
        
        // Keep only last 50 alerts
        const trimmedAlerts = alerts.slice(-50);
        
        await env.CACHE_KV.put(alertsKey, JSON.stringify(trimmedAlerts), {
          expirationTtl: 86400, // 24 hours
        });
      } catch (error) {
        console.error('Failed to check anomalies:', error);
      }
    },

    async getMetricsInRange(timeRange: { start: Date; end: Date }): Promise<PerformanceMetrics[]> {
      try {
        const metrics: PerformanceMetrics[] = [];
        const startDate = new Date(timeRange.start);
        const endDate = new Date(timeRange.end);
        
        // Iterate through each day in the range
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
          const dateKey = date.toISOString().split('T')[0];
          const dailyKey = `${metricsKey}:${dateKey}`;
          
          const dailyMetrics = await env.CACHE_KV.get(dailyKey, 'json') as PerformanceMetrics[] || [];
          metrics.push(...dailyMetrics);
        }
        
        // Filter by exact time range
        return metrics.filter(m => {
          const metricTime = new Date(m.timestamp);
          return metricTime >= timeRange.start && metricTime <= timeRange.end;
        });
      } catch (error) {
        console.error('Failed to get metrics in range:', error);
        return [];
      }
    },

    generateReport(metrics: PerformanceMetrics[], timeRange: { start: Date; end: Date }): PerformanceReport {
      const totalRequests = metrics.length;
      const averageResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
      const cacheHitRate = metrics.filter(m => m.cacheHit).length / totalRequests;
      const cdnHitRate = metrics.filter(m => m.cdnHit).length / totalRequests;
      const errorRate = metrics.filter(m => m.statusCode >= 400).length / totalRequests;
      
      // Slowest endpoints
      const endpointTimes = metrics.reduce((acc, m) => {
        if (!acc[m.endpoint]) {
          acc[m.endpoint] = { totalTime: 0, count: 0 };
        }
        acc[m.endpoint].totalTime += m.responseTime;
        acc[m.endpoint].count++;
        return acc;
      }, {} as Record<string, { totalTime: number; count: number }>);
      
      const slowestEndpoints = Object.entries(endpointTimes)
        .map(([endpoint, data]) => ({
          endpoint,
          averageTime: data.totalTime / data.count,
          requestCount: data.count,
        }))
        .sort((a, b) => b.averageTime - a.averageTime)
        .slice(0, 10);
      
      // Top geolocation
      const locationCounts = metrics.reduce((acc, m) => {
        if (m.geolocation) {
          const location = `${m.geolocation.city}, ${m.geolocation.country}`;
          if (!acc[location]) {
            acc[location] = { count: 0, totalTime: 0 };
          }
          acc[location].count++;
          acc[location].totalTime += m.responseTime;
        }
        return acc;
      }, {} as Record<string, { count: number; totalTime: number }>);
      
      const topGeolocation = Object.entries(locationCounts)
        .map(([location, data]) => ({
          location,
          requestCount: data.count,
          averageTime: data.totalTime / data.count,
        }))
        .sort((a, b) => b.requestCount - a.requestCount)
        .slice(0, 10);
      
      // Cache efficiency
      const cacheMisses = metrics.filter(m => !m.cacheHit && m.cacheKey);
      const mostMissedKeys = cacheMisses.reduce((acc, m) => {
        if (m.cacheKey) {
          acc[m.cacheKey] = (acc[m.cacheKey] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      const mostMissedKeysArray = Object.entries(mostMissedKeys)
        .map(([key, count]) => ({ key, missCount: count }))
        .sort((a, b) => b.missCount - a.missCount)
        .slice(0, 10);
      
      // Transformation metrics
      const transformationMetrics = metrics.filter(m => m.transformationTime);
      const transformationTypes = transformationMetrics.reduce((acc, m) => {
        // Extract transformation type from endpoint or other indicators
        const type = m.endpoint.includes('transform') ? 'image' : 'content';
        if (!acc[type]) {
          acc[type] = { count: 0, totalTime: 0 };
        }
        acc[type].count++;
        acc[type].totalTime += m.transformationTime || 0;
        return acc;
      }, {} as Record<string, { count: number; totalTime: number }>);
      
      const topTransformations = Object.entries(transformationTypes)
        .map(([type, data]) => ({
          type,
          count: data.count,
          averageTime: data.totalTime / data.count,
        }))
        .sort((a, b) => b.count - a.count);
      
      return {
        timeRange: {
          start: timeRange.start.toISOString(),
          end: timeRange.end.toISOString(),
        },
        totalRequests,
        averageResponseTime,
        cacheHitRate,
        cdnHitRate,
        errorRate,
        slowestEndpoints,
        topGeolocation,
        cacheEfficiency: {
          hitRate: cacheHitRate,
          missRate: 1 - cacheHitRate,
          mostMissedKeys: mostMissedKeysArray,
        },
        transformationMetrics: {
          totalTransformations: transformationMetrics.length,
          averageTransformationTime: transformationMetrics.reduce((sum, m) => sum + (m.transformationTime || 0), 0) / transformationMetrics.length || 0,
          topTransformations,
        },
      };
    },

    getEmptyReport(timeRange: { start: Date; end: Date }): PerformanceReport {
      return {
        timeRange: {
          start: timeRange.start.toISOString(),
          end: timeRange.end.toISOString(),
        },
        totalRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        cdnHitRate: 0,
        errorRate: 0,
        slowestEndpoints: [],
        topGeolocation: [],
        cacheEfficiency: {
          hitRate: 0,
          missRate: 0,
          mostMissedKeys: [],
        },
        transformationMetrics: {
          totalTransformations: 0,
          averageTransformationTime: 0,
          topTransformations: [],
        },
      };
    },
  };
}

// Performance monitoring middleware
export function createPerformanceMiddleware(monitoringService: PerformanceMonitoringService) {
  return async (request: Request, response: Response, next: () => Promise<void>) => {
    const startTime = Date.now();
    
    try {
      await next();
      
      const responseTime = Date.now() - startTime;
      
      // Extract metrics from request/response
      const metrics: PerformanceMetrics = {
        timestamp: new Date().toISOString(),
        endpoint: new URL(request.url).pathname,
        method: request.method,
        responseTime,
        cacheHit: response.headers.get('x-cache-status') === 'hit',
        cacheKey: response.headers.get('x-cache-key') || undefined,
        cdnHit: response.headers.get('x-cdn-cache') === 'hit',
        edgeLocation: response.headers.get('x-edge-location') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        contentSize: parseInt(response.headers.get('content-length') || '0'),
        statusCode: response.status,
      };
      
      await monitoringService.recordMetrics(metrics);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const metrics: PerformanceMetrics = {
        timestamp: new Date().toISOString(),
        endpoint: new URL(request.url).pathname,
        method: request.method,
        responseTime,
        cacheHit: false,
        cdnHit: false,
        userAgent: request.headers.get('user-agent') || undefined,
        contentSize: 0,
        statusCode: 500,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      await monitoringService.recordMetrics(metrics);
      throw error;
    }
  };
}