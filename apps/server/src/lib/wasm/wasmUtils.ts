/**
 * WASM Vector Mathematics Utilities
 *
 * This module provides helper functions for managing WASM vector operations,
 * including memory management, error handling, and performance optimization.
 */

import { Vector1024, DiscoveryScorer, BatchProcessor } from '../../../wasm/capture_wasm.js';

// Type definitions for better TypeScript integration
export interface VectorData {
  data: Float32Array;
  dimensions: number;
}

export interface ScoringWeights {
  relevance: number;
  recency: number;
  popularity: number;
  diversity: number;
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
 * Helper class for managing Vector1024 instances with automatic cleanup
 */
export class ManagedVector1024 {
  private vector: Vector1024;
  private disposed = false;

  constructor(data: Float32Array) {
    if (data.length !== 1024) {
      throw new Error('Vector data must be exactly 1024 dimensions');
    }
    this.vector = new Vector1024(data);
  }

  get instance(): Vector1024 {
    if (this.disposed) {
      throw new Error('Vector has been disposed');
    }
    return this.vector;
  }

  dispose(): void {
    if (!this.disposed) {
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
 * Helper class for managing DiscoveryScorer with automatic cleanup
 */
export class ManagedDiscoveryScorer {
  private scorer: DiscoveryScorer;
  private userVector: ManagedVector1024;
  private disposed = false;

  constructor(userPreferences: Float32Array, weights?: ScoringWeights) {
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
    this.scorer.update_weights(
      weights.relevance,
      weights.recency,
      weights.popularity,
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
    if (!this.disposed) {
      this.scorer.free();
      this.userVector.dispose();
      this.disposed = true;
    }
  }
}

/**
 * Helper class for batch processing with automatic cleanup
 */
export class ManagedBatchProcessor {
  private processor: BatchProcessor;
  private disposed = false;

  constructor(batchSize = 100) {
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
    if (!this.disposed) {
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
    resources.forEach((resource) => {
      try {
        resource.dispose();
      } catch (error) {
        console.warn('Error disposing WASM resource:', error);
      }
    });
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
