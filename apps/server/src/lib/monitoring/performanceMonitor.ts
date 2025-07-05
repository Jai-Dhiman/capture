/**
 * Performance Monitoring and Metrics Collection
 *
 * Comprehensive performance monitoring system for WASM recommendation engine
 * with metrics collection, alerting, and dashboard integration.
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  unit: 'ms' | 'count' | 'bytes' | 'percent' | 'ratio';
}

export interface PerformanceAlert {
  id: string;
  name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  tags: Record<string, string>;
  resolved: boolean;
}

export interface PerformanceThreshold {
  metricName: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  value: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export interface SystemMetrics {
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: number;
  eventLoopDelay: number;
  activeConnections: number;
  queuedQueries: number;
  cacheHitRate: number;
  wasmMemoryUsage: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private thresholds: PerformanceThreshold[] = [];
  private timers: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private isCollecting: boolean = false;
  private collectionInterval?: NodeJS.Timeout;

  private constructor() {
    this.setupDefaultThresholds();
    this.startCollection();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start performance metric collection
   */
  startCollection(): void {
    if (this.isCollecting) return;

    this.isCollecting = true;
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Collect every 30 seconds

    console.log('Performance monitoring started');
  }

  /**
   * Stop performance metric collection
   */
  stopCollection(): void {
    if (!this.isCollecting) return;

    this.isCollecting = false;
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
    }

    console.log('Performance monitoring stopped');
  }

  /**
   * Record a timing metric
   */
  timing(name: string, duration: number, tags: Record<string, string> = {}): void {
    this.recordMetric({
      name,
      value: duration,
      timestamp: new Date(),
      tags,
      unit: 'ms',
    });

    // Update histogram
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }
    const histogram = this.histograms.get(name)!;
    histogram.push(duration);

    // Keep only last 1000 measurements
    if (histogram.length > 1000) {
      histogram.shift();
    }

    this.checkThresholds(name, duration, tags);
  }

  /**
   * Start a timer for an operation
   */
  startTimer(operationId: string): void {
    this.timers.set(operationId, Date.now());
  }

  /**
   * End a timer and record the duration
   */
  endTimer(operationId: string, name: string, tags: Record<string, string> = {}): number {
    const startTime = this.timers.get(operationId);
    if (!startTime) {
      console.warn(`Timer ${operationId} not found`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operationId);
    this.timing(name, duration, tags);
    return duration;
  }

  /**
   * Measure an async operation
   */
  async measureOperation<T>(
    name: string,
    operation: () => Promise<T>,
    tags: Record<string, string> = {},
  ): Promise<T> {
    const operationId = `${name}-${Date.now()}-${Math.random()}`;
    this.startTimer(operationId);

    try {
      const result = await operation();
      this.endTimer(operationId, name, { ...tags, status: 'success' });
      return result;
    } catch (error) {
      this.endTimer(operationId, name, { ...tags, status: 'error' });
      this.increment(`${name}_errors`, tags);
      throw error;
    }
  }

  /**
   * Record a counter metric
   */
  increment(name: string, tags: Record<string, string> = {}, value: number = 1): void {
    const currentValue = this.counters.get(name) || 0;
    this.counters.set(name, currentValue + value);

    this.recordMetric({
      name,
      value: currentValue + value,
      timestamp: new Date(),
      tags,
      unit: 'count',
    });
  }

  /**
   * Record a gauge metric (current value)
   */
  gauge(name: string, value: number, tags: Record<string, string> = {}): void {
    this.recordMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      unit: 'count',
    });

    this.checkThresholds(name, value, tags);
  }

  /**
   * Record memory usage metric
   */
  recordMemoryUsage(name: string, bytes: number, tags: Record<string, string> = {}): void {
    this.recordMetric({
      name,
      value: bytes,
      timestamp: new Date(),
      tags,
      unit: 'bytes',
    });

    this.checkThresholds(name, bytes, tags);
  }

  /**
   * Record percentage metric
   */
  percentage(name: string, value: number, tags: Record<string, string> = {}): void {
    this.recordMetric({
      name,
      value: Math.min(100, Math.max(0, value)),
      timestamp: new Date(),
      tags,
      unit: 'percent',
    });

    this.checkThresholds(name, value, tags);
  }

  /**
   * Get performance statistics for a metric
   */
  getStats(metricName: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const histogram = this.histograms.get(metricName) || [];

    if (histogram.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...histogram].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: sum / count,
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    };
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(minutes: number = 5): PerformanceMetric[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.metrics.filter((metric) => metric.timestamp > cutoff);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter((alert) => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  /**
   * Add performance threshold
   */
  addThreshold(threshold: PerformanceThreshold): void {
    this.thresholds.push(threshold);
  }

  /**
   * Remove performance threshold
   */
  removeThreshold(metricName: string): void {
    this.thresholds = this.thresholds.filter((t) => t.metricName !== metricName);
  }

  /**
   * Get performance dashboard data
   */
  getDashboardData(): {
    systemMetrics: SystemMetrics;
    recentMetrics: PerformanceMetric[];
    activeAlerts: PerformanceAlert[];
    topOperations: Array<{
      name: string;
      stats: ReturnType<typeof this.getStats>;
    }>;
  } {
    const systemMetrics = this.getSystemMetrics();
    const recentMetrics = this.getRecentMetrics(15); // Last 15 minutes
    const activeAlerts = this.getActiveAlerts();

    // Get top operations by call count
    const operationCounts = new Map<string, number>();
    recentMetrics.forEach((metric) => {
      operationCounts.set(metric.name, (operationCounts.get(metric.name) || 0) + 1);
    });

    const topOperations = Array.from(operationCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name]) => ({
        name,
        stats: this.getStats(name),
      }));

    return {
      systemMetrics,
      recentMetrics,
      activeAlerts,
      topOperations,
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];
    const metricGroups = new Map<string, PerformanceMetric[]>();

    // Group metrics by name
    this.getRecentMetrics(5).forEach((metric) => {
      if (!metricGroups.has(metric.name)) {
        metricGroups.set(metric.name, []);
      }
      metricGroups.get(metric.name)!.push(metric);
    });

    // Generate Prometheus format
    metricGroups.forEach((metrics, name) => {
      const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_');
      lines.push(`# TYPE ${sanitizedName} ${this.getPrometheusType(metrics[0].unit)}`);

      metrics.forEach((metric) => {
        const tags = Object.entries(metric.tags)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        const tagString = tags ? `{${tags}}` : '';
        lines.push(`${sanitizedName}${tagString} ${metric.value} ${metric.timestamp.getTime()}`);
      });
    });

    return lines.join('\n');
  }

  // Private methods

  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only last 10,000 metrics to prevent memory leaks
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000);
    }
  }

  private checkThresholds(metricName: string, value: number, tags: Record<string, string>): void {
    const thresholds = this.thresholds.filter((t) => t.metricName === metricName);

    thresholds.forEach((threshold) => {
      let triggered = false;

      switch (threshold.operator) {
        case '>':
          triggered = value > threshold.value;
          break;
        case '<':
          triggered = value < threshold.value;
          break;
        case '>=':
          triggered = value >= threshold.value;
          break;
        case '<=':
          triggered = value <= threshold.value;
          break;
        case '==':
          triggered = value === threshold.value;
          break;
        case '!=':
          triggered = value !== threshold.value;
          break;
      }

      if (triggered) {
        this.createAlert(metricName, threshold, value, tags);
      }
    });
  }

  private createAlert(
    metricName: string,
    threshold: PerformanceThreshold,
    value: number,
    tags: Record<string, string>,
  ): void {
    const alertId = `${metricName}-${Date.now()}-${Math.random()}`;

    const alert: PerformanceAlert = {
      id: alertId,
      name: `${metricName} threshold exceeded`,
      severity: threshold.severity,
      message: `${threshold.message}. Current value: ${value}, threshold: ${threshold.value}`,
      timestamp: new Date(),
      tags: { ...tags, metric: metricName },
      resolved: false,
    };

    this.alerts.push(alert);
    console.warn(`Performance Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-500);
    }
  }

  private collectSystemMetrics(): void {
    try {
      const memUsage = process.memoryUsage();

      this.recordMemoryUsage('heap_used', memUsage.heapUsed, { type: 'heap' });
      this.recordMemoryUsage('heap_total', memUsage.heapTotal, { type: 'heap' });
      this.recordMemoryUsage('external_memory', memUsage.external, { type: 'external' });
      this.recordMemoryUsage('rss_memory', memUsage.rss, { type: 'rss' });

      // CPU usage (simplified)
      const cpuUsage = process.cpuUsage();
      this.gauge('cpu_usage_user', cpuUsage.user / 1000, { type: 'user' });
      this.gauge('cpu_usage_system', cpuUsage.system / 1000, { type: 'system' });

      // Node.js specific metrics
      if (process.uptime) {
        this.gauge('process_uptime', process.uptime() * 1000, { unit: 'ms' });
      }
    } catch (error) {
      console.error('Error collecting system metrics:', error);
    }
  }

  private getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();

    return {
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
      },
      cpuUsage: 0, // Would need actual CPU monitoring
      eventLoopDelay: 0, // Would need event loop monitoring
      activeConnections: 0, // Would need connection pool integration
      queuedQueries: 0, // Would need database integration
      cacheHitRate: 0, // Would need cache integration
      wasmMemoryUsage: 0, // Would need WASM memory monitoring
    };
  }

  private setupDefaultThresholds(): void {
    this.thresholds = [
      {
        metricName: 'recommendation_generation_time',
        operator: '>',
        value: 1000, // 1 second
        severity: 'medium',
        message: 'Recommendation generation is taking too long',
      },
      {
        metricName: 'heap_used',
        operator: '>',
        value: 1024 * 1024 * 1024, // 1GB
        severity: 'high',
        message: 'High memory usage detected',
      },
      {
        metricName: 'cache_hit_rate',
        operator: '<',
        value: 0.7, // 70%
        severity: 'medium',
        message: 'Cache hit rate is below optimal threshold',
      },
      {
        metricName: 'database_query_time',
        operator: '>',
        value: 500, // 500ms
        severity: 'medium',
        message: 'Database queries are running slowly',
      },
    ];
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  private getPrometheusType(unit: string): string {
    switch (unit) {
      case 'ms':
        return 'histogram';
      case 'count':
        return 'counter';
      case 'bytes':
        return 'gauge';
      case 'percent':
        return 'gauge';
      case 'ratio':
        return 'gauge';
      default:
        return 'gauge';
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopCollection();
    this.metrics = [];
    this.alerts = [];
    this.timers.clear();
    this.counters.clear();
    this.histograms.clear();
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();
