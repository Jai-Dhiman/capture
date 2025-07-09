/**
 * WASM Vector Mathematics Utilities
 *
 * This module provides helper functions for managing WASM vector operations,
 * including memory management, error handling, and performance optimization.
 */

// Dynamic imports for WASM module to handle Cloudflare Workers properly
let wasmModule: any = null;
let wasmInitialized = false;
let wasmInitPromise: Promise<any> | null = null;

// WASM function references - populated after initialization
let initialize_global_vector_pool: (max_size: number, vector_size: number) => void;
let get_global_vector: () => number | undefined;
let release_global_vector: (index: number) => boolean;
let get_global_pool_stats: () => any[];
let batch_normalize_vectors: (vectors: Float32Array) => Float32Array;
let compute_diversity_scores: (vectors: Float32Array, threshold: number) => Float32Array;
let apply_temporal_decay: (scores: Float32Array, timestamps: BigUint64Array) => Float32Array;
let batch_privacy_filter: (post_user_ids: Uint32Array, is_private_flags: Uint8Array, user_permission: any) => Uint32Array;
let Vector1024: any;
let DiscoveryScorer: any;
let BatchProcessor: any;
let VectorPool: any;
let BatchVectorProcessor: any;
let PostInfo: any;
let UserPermission: any;

/**
 * Initialize WASM module dynamically
 */
async function initializeWasmModule(): Promise<void> {
  if (wasmInitialized) return;
  
  if (wasmInitPromise) {
    return wasmInitPromise;
  }

  wasmInitPromise = (async () => {
    try {
      // Dynamic import for Cloudflare Workers compatibility
      wasmModule = await import('../../../wasm/capture_wasm.js');
      
      // For Cloudflare Workers, we need to initialize with the WASM binary
      try {
        const wasmBinary = await import('../../../wasm/capture_wasm_bg.wasm');
        
        // Initialize with the WASM binary
        if (wasmModule.initSync && wasmBinary.default) {
          wasmModule.initSync({ module: wasmBinary.default });
        } else if (wasmModule.default) {
          await wasmModule.default({ module: wasmBinary.default });
        }
      } catch (error) {
        console.warn('Failed to initialize with binary, trying default init:', error);
        // Fallback to default initialization
        if (wasmModule.default) {
          await wasmModule.default();
        }
      }

      // Call init_wasm if available
      if (wasmModule.init_wasm) {
        wasmModule.init_wasm();
      }

      // Assign function references
      initialize_global_vector_pool = wasmModule.initialize_global_vector_pool;
      get_global_vector = wasmModule.get_global_vector;
      release_global_vector = wasmModule.release_global_vector;
      get_global_pool_stats = wasmModule.get_global_pool_stats;
      batch_normalize_vectors = wasmModule.batch_normalize_vectors;
      compute_diversity_scores = wasmModule.compute_diversity_scores;
      apply_temporal_decay = wasmModule.apply_temporal_decay;
      batch_privacy_filter = wasmModule.batch_privacy_filter;
      Vector1024 = wasmModule.Vector1024;
      DiscoveryScorer = wasmModule.DiscoveryScorer;
      BatchProcessor = wasmModule.BatchProcessor;
      VectorPool = wasmModule.VectorPool;
      BatchVectorProcessor = wasmModule.BatchVectorProcessor;
      PostInfo = wasmModule.PostInfo;
      UserPermission = wasmModule.UserPermission;

      // Verify critical functions are available
      if (!initialize_global_vector_pool) {
        throw new Error('initialize_global_vector_pool function not available after WASM initialization');
      }

      wasmInitialized = true;
    } catch (error) {
      wasmInitPromise = null;
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initalize WASM module: ${errorMessage}`);
    }
  })();

  return wasmInitPromise;
}

/**
 * Ensure WASM is initialized before use
 */
async function ensureWasmInitialized(): Promise<void> {
  if (!wasmInitialized) {
    await initializeWasmModule();
  }
  
  if (!wasmInitialized) {
    throw new Error('WASM module failed to initialize');
  }
}

import { wasmMemoryOptimizer } from './wasmMemoryOptimizer.js';

// Type definitions for better TypeScript integration
export interface VectorData {
  data: Float32Array;
  dimensions: number;
}

export interface ScoringWeights {
  similarity: number;
  temporal: number;
  diversity: number;
  engagement: number;
  privacy: number;
}

export interface ContentItem {
  id: string;
  embeddingVector: Float32Array;
  recencyScore: number;
  popularityScore: number;
}

export interface ScoredContent extends ContentItem {
  discoveryScore: number;
}

/**
 * Managed Vector class for automatic memory management
 */
export class ManagedVector1024 {
  private vector: any; // Use any instead of Vector1024 type
  private disposed = false;

  constructor(data: Float32Array) {
    if (!Vector1024) {
      throw new Error('WASM not initialized. Call ensureWasmInitialized() first.');
    }
    this.vector = new Vector1024(data);
  }

  get instance(): any { // Use any instead of Vector1024 type
    if (this.disposed) {
      throw new Error('Vector has been disposed');
    }
    return this.vector;
  }

  dispose(): void {
    if (!this.disposed && this.vector) {
      this.vector.free();
      this.disposed = true;
    }
  }

  // Convenience methods that automatically handle the underlying vector
  dotProduct(other: ManagedVector1024): number {
    return this.instance.dot_product(other.instance);
  }

  cosineSimilarity(other: ManagedVector1024): number {
    return this.instance.cosine_similarity(other.instance);
  }

  magnitude(): number {
    return this.instance.magnitude();
  }

  normalize(): ManagedVector1024 {
    const normalized = this.instance.normalize();
    return new ManagedVector1024(normalized.to_js_array());
  }
}

/**
 * Managed DiscoveryScorer with automatic cleanup
 */
export class ManagedDiscoveryScorer {
  private scorer: any; // Use any instead of DiscoveryScorer type
  private userVector: ManagedVector1024;
  private disposed = false;

  constructor(userPreferences: Float32Array, weights?: ScoringWeights) {
    if (!DiscoveryScorer || !Vector1024) {
      throw new Error('WASM not initialized. Call ensureWasmInitialized() first.');
    }
    
    this.userVector = new ManagedVector1024(userPreferences);
    this.scorer = new DiscoveryScorer(this.userVector.instance);
    
    if (weights) {
      this.updateWeights(weights);
    }
  }

  updateWeights(weights: ScoringWeights): void {
    if (this.disposed) {
      throw new Error('Scorer has been disposed');
    }
    // Map new scoring weights to the old interface for WASM compatibility
    this.scorer.update_weights(
      weights.similarity,
      weights.temporal,
      weights.engagement,
      weights.diversity,
    );
  }

  scoreContent(contentVector: Float32Array, recencyScore: number, popularityScore: number): number {
    if (this.disposed) {
      throw new Error('Scorer has been disposed');
    }

    const content = new ManagedVector1024(contentVector);
    try {
      return this.scorer.score_content(content.instance, recencyScore, popularityScore);
    } finally {
      content.dispose();
    }
  }

  dispose(): void {
    if (!this.disposed && this.scorer) {
      this.scorer.free();
      this.userVector.dispose();
      this.disposed = true;
    }
  }
}

/**
 * Managed BatchProcessor for batch operations
 */
export class ManagedBatchProcessor {
  private processor: any; // Use any instead of BatchProcessor type
  private disposed = false;

  constructor(batchSize = 100) {
    if (!BatchProcessor) {
      throw new Error('WASM not initialized. Call ensureWasmInitialized() first.');
    }
    this.processor = new BatchProcessor(batchSize);
  }

  async processSimilarityBatch(
    queryVector: Float32Array,
    vectorsData: Float32Array,
  ): Promise<Float32Array> {
    if (this.disposed) {
      throw new Error('Batch processor has been disposed');
    }

    const query = new ManagedVector1024(queryVector);
    try {
      return this.processor.process_similarity_batch(query.instance, vectorsData);
    } finally {
      query.dispose();
    }
  }

  async findTopKSimilar(
    queryVector: Float32Array,
    vectorsData: Float32Array,
    k: number,
  ): Promise<Float32Array> {
    if (this.disposed) {
      throw new Error('Batch processor has been disposed');
    }

    const query = new ManagedVector1024(queryVector);
    try {
      return this.processor.find_top_k_similar(query.instance, vectorsData, k);
    } finally {
      query.dispose();
    }
  }

  async computeCentroid(vectorsData: Float32Array): Promise<ManagedVector1024> {
    if (this.disposed) {
      throw new Error('Batch processor has been disposed');
    }

    const centroid = this.processor.compute_centroid(vectorsData);
    return new ManagedVector1024(centroid.to_js_array());
  }

  dispose(): void {
    if (!this.disposed && this.processor) {
      this.processor.free();
      this.disposed = true;
    }
  }
}

/**
 * High-level utility functions for common vector operations
 */

/**
 * Score a batch of content items for discovery feed
 */
export async function scoreContentBatch(
  userPreferences: Float32Array,
  contentItems: ContentItem[],
  weights?: ScoringWeights,
): Promise<ScoredContent[]> {
  const scorer = new ManagedDiscoveryScorer(userPreferences, weights);

  try {
    return contentItems.map((item) => ({
      ...item,
      discoveryScore: scorer.scoreContent(
        item.embeddingVector,
        item.recencyScore,
        item.popularityScore,
      ),
    }));
  } finally {
    scorer.dispose();
  }
}

/**
 * Find similar content using cosine similarity
 */
export async function findSimilarContent(
  queryVector: Float32Array,
  contentVectors: Float32Array[],
  topK = 10,
): Promise<{ similarities: Float32Array; indices: number[] }> {
  const processor = new ManagedBatchProcessor();

  try {
    // Combine all vectors into a single Float32Array
    const combinedVectors = new Float32Array(contentVectors.length * 1024);
    contentVectors.forEach((vector, index) => {
      combinedVectors.set(vector, index * 1024);
    });

    const similarities = await processor.findTopKSimilar(queryVector, combinedVectors, topK);

    // Get indices of top similar vectors
    const indices = Array.from({ length: contentVectors.length }, (_, i) => i)
      .sort((a, b) => {
        const simA = similarities[a] || 0;
        const simB = similarities[b] || 0;
        return simB - simA;
      })
      .slice(0, topK);

    return { similarities, indices };
  } finally {
    processor.dispose();
  }
}

/**
 * Compute user preference centroid from multiple vectors
 */
export async function computeUserPreferenceCentroid(
  userInteractionVectors: Float32Array[],
): Promise<Float32Array> {
  const processor = new ManagedBatchProcessor();

  try {
    // Combine vectors
    const combinedVectors = new Float32Array(userInteractionVectors.length * 1024);
    userInteractionVectors.forEach((vector, index) => {
      combinedVectors.set(vector, index * 1024);
    });

    const centroid = await processor.computeCentroid(combinedVectors);
    const result = centroid.instance.to_js_array();
    centroid.dispose();

    return result;
  } finally {
    processor.dispose();
  }
}

/**
 * Memory-safe wrapper for vector operations
 */
export async function withVectorCleanup<T>(operation: () => Promise<T> | T): Promise<T> {
  const resources: Array<{ dispose: () => void }> = [];

  try {
    return await operation();
  } finally {
    for (const resource of resources) {
      try {
        resource.dispose();
      } catch (error) {
        console.warn('Error disposing WASM resource:', error);
      }
    }
  }
}

/**
 * Performance monitoring utilities
 */
export class WasmPerformanceMonitor {
  private static instance: WasmPerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): WasmPerformanceMonitor {
    if (!WasmPerformanceMonitor.instance) {
      WasmPerformanceMonitor.instance = new WasmPerformanceMonitor();
    }
    return WasmPerformanceMonitor.instance;
  }

  async measureOperation<T>(operationName: string, operation: () => Promise<T> | T): Promise<T> {
    const start = performance.now();
    try {
      return await operation();
    } finally {
      const duration = performance.now() - start;
      this.recordMetric(operationName, duration);
    }
  }

  private recordMetric(name: string, duration: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const metrics = this.metrics.get(name)!;
    metrics.push(duration);

    // Keep only the last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  getMetrics(operationName: string): { avg: number; min: number; max: number; count: number } {
    const metrics = this.metrics.get(operationName) || [];
    if (metrics.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const sum = metrics.reduce((a, b) => a + b, 0);
    return {
      avg: sum / metrics.length,
      min: Math.min(...metrics),
      max: Math.max(...metrics),
      count: metrics.length,
    };
  }

  getAllMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, any> = {};
    for (const [name] of this.metrics) {
      result[name] = this.getMetrics(name);
    }
    return result;
  }
}

/**
 * Enhanced WASM Vector Operations
 * TypeScript bindings for optimized vector functions
 */

export interface VectorPoolStats {
  totalCapacity: number;
  available: number;
  inUse: number;
}

export interface PrivacyFilterOptions {
  userId: number;
  blockedUsers: number[];
  following: number[];
}

/**
 * Managed VectorPool for efficient memory management
 */
export class ManagedVectorPool {
  private pool: any; // Use any instead of VectorPool type
  private disposed = false;

  constructor(maxSize: number, vectorSize = 1024) {
    if (!VectorPool) {
      throw new Error('WASM not initialized. Call ensureWasmInitialized() first.');
    }
    this.pool = new VectorPool(maxSize, vectorSize);
  }

  get instance(): any { // Use any instead of VectorPool type
    if (this.disposed) {
      throw new Error('VectorPool has been disposed');
    }
    return this.pool;
  }

  getVector(): number | null {
    if (this.disposed) return null;
    return this.pool.get_vector() ?? null;
  }

  releaseVector(index: number): boolean {
    if (this.disposed) return false;
    return this.pool.release_vector(index);
  }

  getVectorData(index: number): Float32Array | null {
    if (this.disposed) return null;
    return this.pool.get_vector_data(index) ?? null;
  }

  setVectorData(index: number, data: Float32Array): boolean {
    if (this.disposed) return false;
    return this.pool.set_vector_data(index, data);
  }

  getStats(): VectorPoolStats {
    if (this.disposed) {
      return { totalCapacity: 0, available: 0, inUse: 0 };
    }
    return {
      totalCapacity: this.pool.total_capacity(),
      available: this.pool.available_count(),
      inUse: this.pool.in_use_count(),
    };
  }

  resize(newSize: number): boolean {
    if (this.disposed) return false;
    return this.pool.resize_pool(newSize);
  }

  reset(): void {
    if (!this.disposed) {
      this.pool.reset_pool();
    }
  }

  dispose(): void {
    if (!this.disposed && this.pool) {
      this.pool.free();
      this.disposed = true;
    }
  }
}

/**
 * Managed BatchVectorProcessor for batch operations
 */
export class ManagedBatchVectorProcessor {
  private processor: any; // Use any instead of BatchVectorProcessor type
  private disposed = false;

  constructor(poolSize: number) {
    if (!BatchVectorProcessor) {
      throw new Error('WASM not initialized. Call ensureWasmInitialized() first.');
    }
    this.processor = new BatchVectorProcessor(poolSize);
  }

  get instance(): any { // Use any instead of BatchVectorProcessor type
    if (this.disposed) {
      throw new Error('BatchVectorProcessor has been disposed');
    }
    return this.processor;
  }

  processSimilarityBatchPooled(
    queryVector: Float32Array,
    vectorsData: Float32Array,
  ): Float32Array | null {
    if (this.disposed) return null;
    return this.processor.process_similarity_batch_pooled(queryVector, vectorsData) ?? null;
  }

  getPoolStats(): VectorPoolStats {
    if (this.disposed) {
      return { totalCapacity: 0, available: 0, inUse: 0 };
    }
    const stats = this.processor.get_pool_stats();
    return {
      totalCapacity: stats[0] as number,
      available: stats[1] as number,
      inUse: stats[2] as number,
    };
  }

  dispose(): void {
    if (!this.disposed && this.processor) {
      this.processor.free();
      this.disposed = true;
    }
  }
}

/**
 * Optimized Vector Operations
 */
export namespace OptimizedVectorOps {

  /**
   * Batch normalize vectors using WASM
   */
  export async function batchNormalizeVectors(vectors: Float32Array): Promise<Float32Array> {
    await ensureWasmInitialized();
    if (!batch_normalize_vectors) {
      throw new Error('batch_normalize_vectors not available');
    }
    return batch_normalize_vectors(vectors);
  }

  /**
   * Compute diversity scores using WASM
   */
  export async function computeDiversityScores(vectors: Float32Array, threshold: number): Promise<Float32Array> {
    await ensureWasmInitialized();
    if (!compute_diversity_scores) {
      throw new Error('compute_diversity_scores not available');
    }
    return compute_diversity_scores(vectors, threshold);
  }

  /**
   * Apply temporal decay using WASM
   */
  export async function applyTemporalDecay(scores: Float32Array, timestamps: BigUint64Array): Promise<Float32Array> {
    await ensureWasmInitialized();
    if (!apply_temporal_decay) {
      throw new Error('apply_temporal_decay not available');
    }
    return apply_temporal_decay(scores, timestamps);
  }

  /**
   * Apply privacy filter using WASM
   */
  export async function batchPrivacyFilter(
    userIds: Uint32Array,
    privateFlags: Uint8Array,
    userPermission: { userId: number; blockedUsers: number[]; following: number[] }
  ): Promise<Uint32Array> {
    await ensureWasmInitialized();
    if (!batch_privacy_filter || !UserPermission) {
      throw new Error('Privacy filter functions not available');
    }
    
    const permission = new UserPermission(userPermission.userId);
    for (const id of userPermission.blockedUsers) {
      permission.add_blocked_user(id);
    }
    for (const id of userPermission.following) {
      permission.add_following(id);
    }
    
    try {
      return batch_privacy_filter(userIds, privateFlags, permission);
    } finally {
      permission.free();
    }
  }
}

/**
 * Global Vector Pool Management
 */
export namespace GlobalVectorPoolManager {
  let initialized = false;

  /**
   * Initialize the global vector pool
   */
  export async function initializeGlobalPool(maxSize: number, vectorSize = 1024): Promise<void> {
    await ensureWasmInitialized();
    initialize_global_vector_pool(maxSize, vectorSize);
    initialized = true;
  }

  /**
   * Get a vector from the global pool
   */
  export async function getGlobalVector(): Promise<number | null> {
    if (!initialized) {
      throw new Error('Global vector pool not initialized. Call initializeGlobalPool() first.');
    }
    await ensureWasmInitialized();
    return get_global_vector() ?? null;
  }

  /**
   * Release a vector back to the global pool
   */
  export async function releaseGlobalVector(index: number): Promise<boolean> {
    if (!initialized) {
      return false;
    }
    await ensureWasmInitialized();
    return release_global_vector(index);
  }

  /**
   * Get global pool statistics
   */
  export async function getGlobalPoolStats(): Promise<VectorPoolStats> {
    if (!initialized) {
      return { totalCapacity: 0, available: 0, inUse: 0 };
    }
    await ensureWasmInitialized();
    const stats = get_global_pool_stats();
    return {
      totalCapacity: stats[0] as number,
      available: stats[1] as number,
      inUse: stats[2] as number,
    };
  }

  /**
   * Check if global pool is initialized
   */
  export function isInitialized(): boolean {
    return initialized;
  }
}

/**
 * Utility functions for user preference centroid computation
 */
// Duplicate function removed - keeping WASM async version only

/**
 * WASM Module Initialization Optimizer
 * Optimizes WASM module startup time and memory allocation
 */
export class WasmInitializationOptimizer {
  private static instance: WasmInitializationOptimizer;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private moduleCache: Map<string, any> = new Map();
  private preallocationSettings = {
    globalPoolSize: 1000,
    vectorSize: 1024,
    batchProcessorPoolSize: 50,
  };

  static getInstance(): WasmInitializationOptimizer {
    if (!WasmInitializationOptimizer.instance) {
      WasmInitializationOptimizer.instance = new WasmInitializationOptimizer();
    }
    return WasmInitializationOptimizer.instance;
  }

  /**
   * Optimized WASM module initialization with preallocation
   */
  async initializeWasmModule(options?: {
    globalPoolSize?: number;
    vectorSize?: number;
    batchProcessorPoolSize?: number;
    preloadFunctions?: boolean;
  }): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization(options);
    return this.initializationPromise;
  }

  private async performInitialization(options?: {
    globalPoolSize?: number;
    vectorSize?: number;
    batchProcessorPoolSize?: number;
    preloadFunctions?: boolean;
  }): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Update preallocation settings
      if (options) {
        this.preallocationSettings = {
          ...this.preallocationSettings,
          ...options,
        };
      }

      // Initialize global vector pool for memory efficiency
      GlobalVectorPoolManager.initializeGlobalPool(
        this.preallocationSettings.globalPoolSize,
        this.preallocationSettings.vectorSize
      );

      // Pre-warm the batch processor pool
      const batchProcessor = new ManagedBatchVectorProcessor(
        this.preallocationSettings.batchProcessorPoolSize
      );
      this.moduleCache.set('batchProcessor', batchProcessor);

      // Preload and cache commonly used WASM functions if requested
      if (options?.preloadFunctions !== false) {
        await this.preloadWasmFunctions();
      }

      // Initialize memory optimizer with WASM-specific settings
      wasmMemoryOptimizer.updateConfig({
        maxVectorCacheSize: this.preallocationSettings.globalPoolSize * 2,
        batchSize: Math.floor(this.preallocationSettings.batchProcessorPoolSize / 2),
        memoryThresholdBytes: 750 * 1024 * 1024, // 750MB for WASM operations
      });

      this.isInitialized = true;
      const initTime = performance.now() - startTime;
      
      console.log(`WASM module initialized in ${initTime.toFixed(2)}ms`);
    } catch (error) {
      this.initializationPromise = null;
      this.isInitialized = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize WASM module: ${errorMessage}`);
    }
  }

  /**
   * Preload commonly used WASM functions to reduce first-call latency
   */
  private async preloadWasmFunctions(): Promise<void> {
    try {
      // Create small test vectors for function preloading
      const testVector = new Float32Array(1024).fill(0.1);
      const testScores = new Float32Array(10).fill(0.5);
      const testTimestamps = new BigUint64Array(10).fill(BigInt(Date.now()));
      const testUserIds = new Uint32Array(10).fill(1);
      const testPrivateFlags = new Uint8Array(10).fill(0);

      // Preload batch normalization
      await OptimizedVectorOps.batchNormalizeVectors(testVector);

      // Preload diversity scoring
      await OptimizedVectorOps.computeDiversityScores(testVector, 0.8);

      // Preload temporal decay
      await OptimizedVectorOps.applyTemporalDecay(testScores, testTimestamps);

      // Preload privacy filtering
      await OptimizedVectorOps.batchPrivacyFilter(
        testUserIds,
        testPrivateFlags,
        { userId: 1, blockedUsers: [], following: [] }
      );

    } catch (error) {
      console.warn('Failed to preload WASM functions:', error);
    }
  }

  /**
   * Get cached WASM components for reuse
   */
  getCachedComponent<T>(key: string): T | null {
    return this.moduleCache.get(key) || null;
  }

  /**
   * Cache a WASM component for reuse
   */
  setCachedComponent(key: string, component: any): void {
    this.moduleCache.set(key, component);
  }

  /**
   * Create an optimized vector pool with smart sizing
   */
  createOptimizedVectorPool(estimatedUsage?: number): ManagedVectorPool {
    const poolSize = estimatedUsage 
      ? Math.min(estimatedUsage * 1.5, this.preallocationSettings.globalPoolSize)
      : this.preallocationSettings.batchProcessorPoolSize;

    return new ManagedVectorPool(Math.floor(poolSize), this.preallocationSettings.vectorSize);
  }

  /**
   * Get initialization status
   */
  isModuleInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Reset and reinitialize the module
   */
  async reinitialize(options?: {
    globalPoolSize?: number;
    vectorSize?: number;
    batchProcessorPoolSize?: number;
  }): Promise<void> {
    this.isInitialized = false;
    this.initializationPromise = null;
    this.moduleCache.clear();
    
    return this.initializeWasmModule(options);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Dispose cached components
    for (const [_key, component] of this.moduleCache.entries()) {
      if (component && typeof component.dispose === 'function') {
        component.dispose();
      }
    }
    this.moduleCache.clear();
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Get performance metrics for the initialization
   */
  getInitializationMetrics(): {
    isInitialized: boolean;
    cachedComponents: number;
    poolSize: number;
    memoryUsage: number;
  } {
    const poolStats = GlobalVectorPoolManager.isInitialized() 
      ? { totalCapacity: 0, available: 0, inUse: 0 } // Use default values since async call not allowed here
      : { totalCapacity: 0, available: 0, inUse: 0 };

    return {
      isInitialized: this.isInitialized,
      cachedComponents: this.moduleCache.size,
      poolSize: poolStats.totalCapacity,
      memoryUsage: wasmMemoryOptimizer.getMemoryStats().vectorMemoryUsage,
    };
  }

  /**
   * Get performance metrics for the initialization (async version)
   */
  async getInitializationMetricsAsync(): Promise<{
    isInitialized: boolean;
    cachedComponents: number;
    poolSize: number;
    memoryUsage: number;
  }> {
    const poolStats = GlobalVectorPoolManager.isInitialized() 
      ? await GlobalVectorPoolManager.getGlobalPoolStats()
      : { totalCapacity: 0, available: 0, inUse: 0 };

    return {
      isInitialized: this.isInitialized,
      cachedComponents: this.moduleCache.size,
      poolSize: poolStats.totalCapacity,
      memoryUsage: wasmMemoryOptimizer.getMemoryStats().vectorMemoryUsage,
    };
  }
}

/**
 * Auto-initializing WASM utilities that ensure module is ready before use
 */
export namespace AutoInitializingWasmUtilsNamespace {
  const optimizer = WasmInitializationOptimizer.getInstance();

  /**
   * Ensure WASM module is initialized before vector operations
   */
  export async function ensureInitialized(): Promise<void> {
    if (!optimizer.isModuleInitialized()) {
      await optimizer.initializeWasmModule();
    }
  }

  /**
   * Create a managed vector with automatic initialization
   */
  export async function createManagedVector(data: Float32Array): Promise<ManagedVector1024> {
    await ensureInitialized();
    return new ManagedVector1024(data);
  }

  /**
   * Create a discovery scorer with automatic initialization
   */
  export async function createDiscoveryScorer(
    userPreferences: Float32Array,
    weights?: ScoringWeights
  ): Promise<ManagedDiscoveryScorer> {
    await ensureInitialized();
    return new ManagedDiscoveryScorer(userPreferences, weights);
  }

  /**
   * Create a batch processor with automatic initialization
   */
  export async function createBatchProcessor(batchSize = 100): Promise<ManagedBatchProcessor> {
    await ensureInitialized();
    return new ManagedBatchProcessor(batchSize);
  }

  /**
   * Create an optimized vector pool with automatic initialization
   */
  export async function createVectorPool(
    maxSize: number,
    _vectorSize = 1024
  ): Promise<ManagedVectorPool> {
    await ensureInitialized();
    return optimizer.createOptimizedVectorPool(maxSize);
  }

  /**
   * Run optimized vector operations with automatic initialization
   */
  export async function runOptimizedOp<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    await ensureInitialized();
    return WasmPerformanceMonitor.getInstance().measureOperation(operationName, operation);
  }
}

// Export the optimized initialization utilities
export const wasmInitOptimizer = WasmInitializationOptimizer.getInstance();

/**
 * AutoInitializingWasmUtils Class (Beta Version)
 * Simplified class wrapper that bridges the namespace methods for discovery resolver
 */
export class AutoInitializingWasmUtils {
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    // Auto-initialize on construction
    this.initializationPromise = this.ensureInitialized();
  }

  /**
   * Ensure WASM module is initialized
   */
  async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = ensureWasmInitialized();
    return this.initializationPromise;
  }

  /**
   * Check if WASM module is ready
   */
  isReady(): boolean {
    return wasmInitialized;
  }

  /**
   * Normalize a vector using WASM operations
   */
  normalizeVector(vector: Float32Array): Float32Array {
    if (!this.isReady() || !batch_normalize_vectors) {
      // Fallback to simple normalization
      return this.fallbackNormalizeVector(vector);
    }
    
    try {
      return batch_normalize_vectors(vector);
    } catch (error) {
      console.warn('WASM normalization failed, using fallback:', error);
      return this.fallbackNormalizeVector(vector);
    }
  }

  /**
   * Compute cosine similarity between two vectors
   */
  cosineSimilarity(vectorA: Float32Array, vectorB: Float32Array): number {
    if (!this.isReady() || vectorA.length !== vectorB.length || !Vector1024) {
      return this.fallbackCosineSimilarity(vectorA, vectorB);
    }

    try {
      const managedA = new ManagedVector1024(vectorA);
      const managedB = new ManagedVector1024(vectorB);
      
      try {
        return managedA.cosineSimilarity(managedB);
      } finally {
        managedA.dispose();
        managedB.dispose();
      }
    } catch (error) {
      console.warn('WASM cosine similarity failed, using fallback:', error);
      return this.fallbackCosineSimilarity(vectorA, vectorB);
    }
  }

  /**
   * Compute exponential decay for temporal scoring
   */
  exponentialDecay(ageHours: number, decayRate: number): number {
    // Simple exponential decay calculation
    return Math.exp(-decayRate * ageHours);
  }

  /**
   * Compute adaptive parameters (simplified implementation)
   */
  computeAdaptiveParameters(params: {
    engagementRate: number;
    diversityPreference: number;
    recencyPreference: number;
    sessionDuration: number;
  }): {
    contentBasedWeight: number;
    temporalWeight: number;
    diversityWeight: number;
    engagementBoost: number;
  } {
    // Simple adaptive parameter computation
    return {
      contentBasedWeight: 0.8 + params.engagementRate * 0.2,
      temporalWeight: 0.5 + params.recencyPreference * 0.5,
      diversityWeight: 0.5 + params.diversityPreference * 0.5,
      engagementBoost: 1.0 + params.sessionDuration / 600, // Boost based on session length
    };
  }

  /**
   * Fallback vector normalization (pure JavaScript)
   */
  private fallbackNormalizeVector(vector: Float32Array): Float32Array {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    
    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / magnitude;
    }
    return normalized;
  }

  /**
   * Fallback cosine similarity (pure JavaScript)
   */
  private fallbackCosineSimilarity(vectorA: Float32Array, vectorB: Float32Array): number {
    if (vectorA.length !== vectorB.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      magnitudeA += vectorA[i] * vectorA[i];
      magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

// Export additional types for better TypeScript support
export { 
  VectorPool, 
  BatchVectorProcessor, 
  PostInfo, 
  UserPermission 
};
