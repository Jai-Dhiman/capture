/**
 * WASM Memory Optimization and Management
 *
 * Memory optimization utilities for WASM recommendation engine
 * to prevent memory leaks and optimize performance.
 */

export interface WasmMemoryStats {
  heapSize: number;
  usedHeapSize: number;
  freeHeapSize: number;
  vectorCount: number;
  vectorMemoryUsage: number;
  cacheMemoryUsage: number;
  totalAllocatedMemory: number;
}

export interface MemoryOptimizationConfig {
  maxVectorCacheSize: number; // Maximum vectors to keep in memory
  maxCacheAgeMs: number; // Maximum age for cached vectors
  gcIntervalMs: number; // Garbage collection interval
  memoryThresholdBytes: number; // Memory threshold for cleanup
  batchSize: number; // Batch size for vector operations
}

export class WasmMemoryOptimizer {
  private static instance: WasmMemoryOptimizer;
  private config: MemoryOptimizationConfig;
  private vectorCache: Map<string, { vector: Float32Array; timestamp: number }> = new Map();
  private gcTimer?: NodeJS.Timeout;
  private isOptimizing = false;

  private constructor(config?: Partial<MemoryOptimizationConfig>) {
    this.config = {
      maxVectorCacheSize: 10000, // 10K vectors max
      maxCacheAgeMs: 30 * 60 * 1000, // 30 minutes
      gcIntervalMs: 5 * 60 * 1000, // 5 minutes
      memoryThresholdBytes: 500 * 1024 * 1024, // 500MB
      batchSize: 100,
      ...config,
    };

    // Don't start GC automatically - only when first used to avoid Cloudflare Workers global scope issues
  }

  static getInstance(config?: Partial<MemoryOptimizationConfig>): WasmMemoryOptimizer {
    if (!WasmMemoryOptimizer.instance) {
      WasmMemoryOptimizer.instance = new WasmMemoryOptimizer(config);
    }
    return WasmMemoryOptimizer.instance;
  }

  /**
   * Get current WASM memory statistics
   */
  getMemoryStats(): WasmMemoryStats {
    const nodeMemory = process.memoryUsage();
    const vectorMemoryUsage = this.calculateVectorMemoryUsage();

    return {
      heapSize: nodeMemory.heapTotal,
      usedHeapSize: nodeMemory.heapUsed,
      freeHeapSize: nodeMemory.heapTotal - nodeMemory.heapUsed,
      vectorCount: this.vectorCache.size,
      vectorMemoryUsage,
      cacheMemoryUsage: vectorMemoryUsage, // Simplified
      totalAllocatedMemory: nodeMemory.rss,
    };
  }

  /**
   * Cache a vector with automatic memory management
   */
  cacheVector(id: string, vector: Float32Array): void {
    // Ensure GC is started when we start caching
    this.ensureGarbageCollectionStarted();
    
    // Check if we need to clear cache first
    if (this.vectorCache.size >= this.config.maxVectorCacheSize) {
      this.clearOldestVectors(Math.floor(this.config.maxVectorCacheSize * 0.2)); // Clear 20%
    }

    // Check memory threshold
    const memoryStats = this.getMemoryStats();
    if (memoryStats.usedHeapSize > this.config.memoryThresholdBytes) {
      this.performEmergencyCleanup();
    }

    this.vectorCache.set(id, {
      vector: new Float32Array(vector), // Create defensive copy
      timestamp: Date.now(),
    });

    // TODO: Record memory usage (monitoring removed for beta)
  }

  /**
   * Retrieve a cached vector
   */
  getCachedVector(id: string): Float32Array | null {
    const cached = this.vectorCache.get(id);
    if (!cached) {
      return null;
    }

    // Check if vector is too old
    if (Date.now() - cached.timestamp > this.config.maxCacheAgeMs) {
      this.vectorCache.delete(id);
      return null;
    }

    // Update timestamp (LRU behavior)
    cached.timestamp = Date.now();
    return cached.vector;
  }

  /**
   * Process vectors in optimized batches
   */
  async processBatch<T>(
    vectors: Float32Array[],
    processor: (batch: Float32Array[]) => Promise<T[]>,
    options: { batchSize?: number; memoryCheck?: boolean } = {},
  ): Promise<T[]> {
    const batchSize = options.batchSize || this.config.batchSize;
    const results: T[] = [];

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);

      // Memory check before processing
      if (options.memoryCheck) {
        const memoryStats = this.getMemoryStats();
        if (memoryStats.usedHeapSize > this.config.memoryThresholdBytes) {
          await this.optimizeMemory();
        }
      }

      try {
        const batchResults = await processor(batch);
        results.push(...batchResults);
      } catch (error) {
        console.error(`Error processing batch ${i / batchSize + 1}:`, error);
        // Continue with next batch
      }

      // Small delay to prevent blocking
      if (i + batchSize < vectors.length) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    return results;
  }

  /**
   * Create memory-efficient vector operations
   */
  createOptimizedVector(size: number, fill?: number): Float32Array {
    try {
      const vector = new Float32Array(size);
      if (fill !== undefined) {
        vector.fill(fill);
      }
      return vector;
    } catch (error) {
      console.error('Failed to create vector, attempting memory optimization:', error);
      this.performEmergencyCleanup();
      throw new Error('Insufficient memory for vector creation');
    }
  }

  /**
   * Perform vector computation with memory optimization
   */
  async computeWithMemoryCheck<T>(computation: () => T, memoryRequirement = 0): Promise<T> {
    const memoryStats = this.getMemoryStats();

    // Check if we have enough free memory
    if (memoryRequirement > 0 && memoryStats.freeHeapSize < memoryRequirement) {
      await this.optimizeMemory();
    }

    try {
      return computation();
    } catch (error) {
      const isMemoryError = error instanceof Error && 
        (error.message?.includes('memory') || error.name === 'RangeError');
      
      if (isMemoryError) {
        console.warn('Memory error detected, performing cleanup and retrying');
        await this.performEmergencyCleanup();
        return computation(); // Retry once
      }
      throw error;
    }
  }

  /**
   * Optimize memory usage
   */
  async optimizeMemory(): Promise<void> {
    if (this.isOptimizing) return;

    this.isOptimizing = true;
    const startTime = Date.now();

    try {
      const beforeStats = this.getMemoryStats();

      // Clear expired vectors
      this.clearExpiredVectors();

      // If still over threshold, clear more aggressively
      if (beforeStats.usedHeapSize > this.config.memoryThresholdBytes) {
        this.clearOldestVectors(Math.floor(this.vectorCache.size * 0.5)); // Clear 50%
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterStats = this.getMemoryStats();
      const memoryFreed = beforeStats.usedHeapSize - afterStats.usedHeapSize;
      const optimizationTime = Date.now() - startTime;

      console.log(
        `Memory optimization completed: freed ${Math.round(memoryFreed / 1024 / 1024)}MB in ${optimizationTime}ms`,
      );
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * Emergency memory cleanup
   */
  async performEmergencyCleanup(): Promise<void> {
    console.warn('Performing emergency memory cleanup');

    // Clear all cached vectors
    this.vectorCache.clear();

    // Force garbage collection
    if (global.gc) {
      global.gc();
    }

    await new Promise((resolve) => setTimeout(resolve, 100)); // Brief pause
  }

  /**
   * Configure memory optimization settings
   */
  updateConfig(config: Partial<MemoryOptimizationConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart GC with new interval if changed
    if (config.gcIntervalMs) {
      this.stopGarbageCollection();
      this.startGarbageCollection();
    }
  }

  /**
   * Get memory optimization recommendations
   */
  getOptimizationRecommendations(): Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    action?: string;
  }> {
    const stats = this.getMemoryStats();
    const recommendations = [];

    const memoryUsagePercent = (stats.usedHeapSize / stats.heapSize) * 100;
    const vectorMemoryPercent = (stats.vectorMemoryUsage / stats.usedHeapSize) * 100;

    if (memoryUsagePercent > 90) {
      recommendations.push({
        type: 'error' as const,
        message: `Critical memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        action: 'Immediate cleanup required',
      });
    } else if (memoryUsagePercent > 75) {
      recommendations.push({
        type: 'warning' as const,
        message: `High memory usage: ${memoryUsagePercent.toFixed(1)}%`,
        action: 'Consider reducing cache size or batch size',
      });
    }

    if (this.vectorCache.size > this.config.maxVectorCacheSize * 0.8) {
      recommendations.push({
        type: 'warning' as const,
        message: `Vector cache is ${((this.vectorCache.size / this.config.maxVectorCacheSize) * 100).toFixed(1)}% full`,
        action: 'Consider increasing cache cleanup frequency',
      });
    }

    if (vectorMemoryPercent > 50) {
      recommendations.push({
        type: 'info' as const,
        message: `Vectors use ${vectorMemoryPercent.toFixed(1)}% of heap memory`,
        action: 'Vector usage is within normal range',
      });
    }

    return recommendations;
  }

  // Private methods

  private ensureGarbageCollectionStarted(): void {
    if (!this.gcTimer) {
      this.startGarbageCollection();
    }
  }

  private startGarbageCollection(): void {
    // Only start GC if we're in a request context, not global scope
    if (typeof globalThis !== 'undefined') {
      this.gcTimer = setInterval(() => {
        this.clearExpiredVectors();
      }, this.config.gcIntervalMs);
    }
  }

  private stopGarbageCollection(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = undefined;
    }
  }

  private clearExpiredVectors(): void {
    const now = Date.now();

    for (const [id, cached] of this.vectorCache.entries()) {
      if (now - cached.timestamp > this.config.maxCacheAgeMs) {
        this.vectorCache.delete(id);
      }
    }
  }

  private clearOldestVectors(count: number): void {
    if (count <= 0) return;

    // Sort by timestamp and remove oldest
    const entries = Array.from(this.vectorCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, count);

    for (const [id] of entries) {
      this.vectorCache.delete(id);
    }
  }

  private calculateVectorMemoryUsage(): number {
    let totalBytes = 0;

    for (const [, cached] of this.vectorCache.entries()) {
      totalBytes += cached.vector.byteLength;
      totalBytes += 50; // Estimated overhead per cache entry
    }

    return totalBytes;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopGarbageCollection();
    this.vectorCache.clear();
  }
}

// Export singleton instance
export const wasmMemoryOptimizer = WasmMemoryOptimizer.getInstance();
