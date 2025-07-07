/**
 * Optimized Qdrant Client with batch operations, advanced HNSW tuning,
 * and performance monitoring
 */

import type { Bindings } from '../../types';

export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, any>;
  vector?: number[];
}

// Add Qdrant API response types
interface QdrantPoint {
  id: string | number;
  score: number;
  payload?: Record<string, any>;
  vector?: number[];
}

interface QdrantBatchSearchResponse {
  result: QdrantPoint[][];
  status: string;
  time: number;
}

interface QdrantSearchResponse {
  result: QdrantPoint[];
  status: string;
  time: number;
}

interface QdrantScrollResponse {
  result: {
    points: QdrantPoint[];
    next_page_offset?: string;
  };
  status: string;
  time: number;
}

interface QdrantCollectionInfoResponse {
  result: {
    status: string;
    vectors_count: number;
    indexed_vectors_count: number;
    points_count: number;
    segments_count: number;
    config: any;
  };
  status: string;
  time: number;
}

export interface CollectionConfig {
  name: string;
  dimensions: number;
  distance?: 'Cosine' | 'Euclidean' | 'Dot';
  // Optimized HNSW parameters
  hnsw_config?: {
    m?: number; // Number of edges per node (default: 16, optimal range: 8-64)
    ef_construct?: number; // Size of dynamic candidate list (default: 200, optimal: 100-800)
    full_scan_threshold?: number; // Switch to exact search when collection size < threshold
    max_indexing_threads?: number; // Number of threads for indexing (0 = auto)
    on_disk?: boolean; // Store HNSW index on disk to save RAM
  };
  optimizers_config?: {
    deleted_threshold?: number; // Threshold for optimizing deleted vectors
    vacuum_min_vector_number?: number; // Minimum vectors before vacuum
    default_segment_number?: number; // Number of segments per collection
  };
  quantization_config?: {
    scalar?: {
      type: 'int8';
      quantile?: number; // Quantile for quantization (default: 0.99)
      always_ram?: boolean; // Keep quantized vectors in RAM
    };
  };
}

export interface BatchSearchParams {
  vectors: number[][];
  limit: number;
  filter?: Record<string, any>;
  with_payload?: boolean;
  with_vector?: boolean;
}

export interface SearchMetrics {
  totalSearches: number;
  batchSearches: number;
  cacheHits: number;
  cacheMisses: number;
  averageLatency: number;
  slowSearchCount: number;
}

// Simple query optimizer/cache
class QueryOptimizer {
  private cache = new Map<string, { data: any; expires: number }>();

  async cachedQuery<T>(
    queryFn: () => Promise<T>,
    cacheKey: string,
    options: { ttl: number } = { ttl: 300 }
  ): Promise<T> {
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    
    if (cached && cached.expires > now) {
      return cached.data;
    }

    const result = await queryFn();
    this.cache.set(cacheKey, {
      data: result,
      expires: now + (options.ttl * 1000)
    });

    return result;
  }

  async invalidateCache(pattern: string): Promise<void> {
    if (pattern.includes('*')) {
      const prefix = pattern.replace('*', '');
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.delete(pattern);
    }
  }
}

export class QdrantClient {
  private baseUrl: string;
  private apiKey: string;
  private defaultCollectionName: string;
  private queryOptimizer = new QueryOptimizer();
  private metrics: SearchMetrics = {
    totalSearches: 0,
    batchSearches: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageLatency: 0,
    slowSearchCount: 0,
  };
  private totalLatency = 0;
  private slowSearchThreshold = 2000; // 2 seconds

  constructor(env: Bindings) {
    this.baseUrl = env.QDRANT_URL || 'http://localhost:6333';
    this.apiKey = env.QDRANT_API_KEY || '';
    this.defaultCollectionName = env.QDRANT_COLLECTION_NAME || 'posts';
  }

  /**
   * Create collection with optimized HNSW parameters
   */
  async ensureCollection(collectionConfig?: CollectionConfig): Promise<void> {
    const defaultConfig: CollectionConfig = {
      name: this.defaultCollectionName,
      dimensions: 1024, // Voyage AI embedding dimension
      distance: 'Cosine',
      hnsw_config: {
        m: 32, // Higher for better recall, reasonable memory usage
        ef_construct: 400, // Higher for better index quality
        full_scan_threshold: 10000, // Use exact search for small collections
        max_indexing_threads: 0, // Auto-detect threads
        on_disk: true, // Save memory for large collections
      },
      optimizers_config: {
        deleted_threshold: 0.2, // Optimize when 20% vectors are deleted
        vacuum_min_vector_number: 1000, // Minimum vectors before vacuum
        default_segment_number: 4, // Multiple segments for better parallelism
      },
      quantization_config: {
        scalar: {
          type: 'int8',
          quantile: 0.99,
          always_ram: true, // Keep quantized vectors in RAM for speed
        },
      },
    };

    const finalConfig = { ...defaultConfig, ...collectionConfig };

    // Check if collection exists
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/collections/${finalConfig.name}`,
      { method: 'GET' }
    );

    if (response.status === 404) {
      // Create optimized collection
      const createResponse = await this.fetchWithRetry(
        `${this.baseUrl}/collections/${finalConfig.name}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vectors: {
              size: finalConfig.dimensions,
              distance: finalConfig.distance,
              hnsw_config: finalConfig.hnsw_config,
            },
            optimizers_config: finalConfig.optimizers_config,
            quantization_config: finalConfig.quantization_config,
          }),
        }
      );

      if (!createResponse.ok) {
        throw new Error(`Failed to create collection: ${createResponse.statusText}`);
      }
    }
  }

  /**
   * Batch search multiple vectors efficiently
   */
  async batchSearchVectors(params: BatchSearchParams): Promise<QdrantSearchResult[][]> {
    const startTime = Date.now();
    this.metrics.totalSearches++;
    this.metrics.batchSearches++;

    try {
      await this.ensureCollection();

      // Split large batches to avoid timeouts
      const batchSize = 10; // Process 10 vectors at a time
      const allResults: QdrantSearchResult[][] = [];

      for (let i = 0; i < params.vectors.length; i += batchSize) {
        const batchVectors = params.vectors.slice(i, i + batchSize);
        
        const batchResponse = await this.fetchWithRetry(
          `${this.baseUrl}/collections/${this.defaultCollectionName}/points/search/batch`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              searches: batchVectors.map(vector => ({
                vector,
                limit: params.limit,
                filter: params.filter,
                with_payload: params.with_payload !== false,
                with_vector: params.with_vector,
                params: {
                  hnsw_ef: Math.max(params.limit * 2, 128), // Dynamic ef for better recall
                  exact: false, // Use approximate search for speed
                },
              })),
            }),
          }
        );

        if (!batchResponse.ok) {
          throw new Error(`Batch search failed: ${batchResponse.statusText}`);
        }

        const batchResult = await batchResponse.json() as QdrantBatchSearchResponse;
        const formattedBatch = batchResult.result.map((searchResult: QdrantPoint[]) =>
          searchResult.map((point: QdrantPoint) => ({
            id: point.payload?.original_id || point.id.toString(),
            score: point.score,
            payload: point.payload || {},
            vector: point.vector,
          }))
        );

        allResults.push(...formattedBatch);
      }

      const results = allResults;

      this.updateMetrics(startTime);
      return results;
    } catch (error) {
      this.updateMetrics(startTime);
      throw error;
    }
  }

  /**
   * Optimized single vector search with advanced parameters
   */
  async searchVectors(params: {
    vector: number[];
    limit: number;
    filter?: Record<string, any>;
    with_payload?: boolean;
    with_vector?: boolean;
    search_params?: {
      hnsw_ef?: number; // Size of dynamic candidate list during search
      exact?: boolean; // Force exact search
      quantization?: {
        ignore?: boolean; // Ignore quantization for this search
        rescore?: boolean; // Rescore using original vectors
      };
    };
    collectionConfig?: CollectionConfig;
  }): Promise<QdrantSearchResult[]> {
    const startTime = Date.now();
    this.metrics.totalSearches++;

    try {
      const results = await this.queryOptimizer.cachedQuery(
        async () => {
          await this.ensureCollection(params.collectionConfig);

          const searchParams = {
            hnsw_ef: Math.max(params.limit * 4, 256), // 4x limit for better recall
            exact: false,
            quantization: {
              ignore: false,
              rescore: true, // Rescore for better accuracy
            },
            ...params.search_params,
          };

          const collectionName = params.collectionConfig?.name || this.defaultCollectionName;

          const response = await this.fetchWithRetry(
            `${this.baseUrl}/collections/${collectionName}/points/search`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                vector: params.vector,
                limit: params.limit,
                filter: params.filter,
                with_payload: params.with_payload !== false,
                with_vector: params.with_vector,
                params: searchParams,
              }),
            }
          );

          if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
          }

          const result = await response.json() as QdrantSearchResponse;
          return result.result.map((point: QdrantPoint) => ({
            id: point.payload?.original_id || point.id.toString(),
            score: point.score,
            payload: point.payload || {},
            vector: point.vector,
          }));
        },
        `search:${this.hashSearchParams(params)}`,
        { ttl: 180 } // Cache searches for 3 minutes
      );

      this.updateMetrics(startTime);
      return results;
    } catch (error) {
      this.updateMetrics(startTime);
      throw error;
    }
  }

  /**
   * Bulk upsert with optimized batching
   */
  async batchUpsertVectors(
    data: Array<{
      id: string;
      vector: number[];
      payload: Record<string, any>;
    }>
  ): Promise<void> {
    await this.ensureCollection();

    // Split into batches of 100 for optimal performance
    const batchSize = 100;
    const batches = [];

    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }

    // Process batches in parallel (max 3 concurrent)
    const maxConcurrency = 3;
    for (let i = 0; i < batches.length; i += maxConcurrency) {
      const concurrentBatches = batches.slice(i, i + maxConcurrency);
      
      await Promise.all(
        concurrentBatches.map(async (batch) => {
          const response = await this.fetchWithRetry(
            `${this.baseUrl}/collections/${this.defaultCollectionName}/points`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                points: batch.map(item => ({
                  id: this.convertToValidId(item.id),
                  vector: item.vector,
                  payload: {
                    ...item.payload,
                    original_id: item.id,
                  },
                })),
              }),
            }
          );

          if (!response.ok) {
            throw new Error(`Batch upsert failed: ${response.statusText}`);
          }
        })
      );
    }

    // Invalidate related caches
    await this.queryOptimizer.invalidateCache('search:*');
    await this.queryOptimizer.invalidateCache('batch_search:*');
  }

  /**
   * Recommend similar items with advanced filtering
   */
  async recommendSimilar(params: {
    positiveIds: string[];
    negativeIds?: string[];
    limit: number;
    filter?: Record<string, any>;
    strategy?: 'average_vector' | 'best_score';
  }): Promise<QdrantSearchResult[]> {
    await this.ensureCollection();

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/collections/${this.defaultCollectionName}/points/recommend`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positive: params.positiveIds.map(id => this.convertToValidId(id)),
          negative: params.negativeIds?.map(id => this.convertToValidId(id)) || [],
          limit: params.limit,
          filter: params.filter,
          with_payload: true,
          with_vector: false,
          params: {
            hnsw_ef: Math.max(params.limit * 4, 256),
            exact: false,
          },
          strategy: params.strategy || 'average_vector',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Recommendation failed: ${response.statusText}`);
    }

    const result = await response.json() as QdrantSearchResponse;
    return result.result.map((point: QdrantPoint) => ({
      id: point.payload?.original_id || point.id.toString(),
      score: point.score,
      payload: point.payload || {},
    }));
  }

  /**
   * Upsert a single vector with payload
   */
  async upsertVector(data: {
    id: string;
    vector: number[];
    payload: Record<string, any>;
    collectionConfig?: CollectionConfig;
  }): Promise<void> {
    await this.ensureCollection(data.collectionConfig);

    const collectionName = data.collectionConfig?.name || this.defaultCollectionName;

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/collections/${collectionName}/points`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: [{
            id: this.convertToValidId(data.id),
            vector: data.vector,
            payload: {
              ...data.payload,
              original_id: data.id,
            },
          }],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Upsert failed: ${response.statusText}`);
    }

    // Invalidate related caches
    await this.queryOptimizer.invalidateCache('search:*');
  }

  /**
   * Delete a vector by ID
   */
  async deleteVector(id: string): Promise<void> {
    await this.ensureCollection();

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/collections/${this.defaultCollectionName}/points/delete`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: [this.convertToValidId(id)],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }
  }

  /**
   * Search similar vectors (backward compatibility method)
   */
  async searchSimilar(
    vector: Float32Array | number[],
    limit: number,
    options: {
      excludeUserId?: string;
      minScore?: number;
      collectionConfig?: CollectionConfig;
    } = {}
  ): Promise<Array<{ id: string; score: number; vector: number[]; metadata: any }>> {
    const vectorArray = Array.isArray(vector) ? vector : Array.from(vector);

    const filter = options.excludeUserId
      ? {
          must_not: [{ key: 'userId', match: { value: options.excludeUserId } }],
        }
      : undefined;

    const results = await this.searchVectors({
      vector: vectorArray,
      limit,
      filter,
      with_payload: true,
      with_vector: false,
    });

    return results
      .filter((result) => !options.minScore || result.score >= options.minScore)
      .map((result) => ({
        id: result.id,
        score: result.score,
        vector: vectorArray, // Would need to fetch actual vector if needed
        metadata: result.payload,
      }));
  }

  /**
   * Search posts with filtering (backward compatibility method)
   */
  async searchPosts(options: {
    excludeUserId?: string;
    limit: number;
    includeEmbedding?: boolean;
    includeMetadata?: boolean;
    collectionConfig?: CollectionConfig;
  }): Promise<{ posts: any[] }> {
    const filter = options.excludeUserId
      ? {
          must_not: [{ key: 'userId', match: { value: options.excludeUserId } }],
        }
      : undefined;

    const results = await this.scroll({
      limit: options.limit,
      filter,
      with_payload: options.includeMetadata !== false,
      collectionConfig: options.collectionConfig,
    });

    const posts = results.map((result) => ({
      id: result.id,
      userId: result.payload?.userId,
      content: result.payload?.content || '',
      createdAt: result.payload?.createdAt || new Date().toISOString(),
      saveCount: result.payload?.saveCount || 0,
      commentCount: result.payload?.commentCount || 0,
      viewCount: result.payload?.viewCount || 0,
      hashtags: result.payload?.hashtags || [],
      contentType: result.payload?.contentType || 'text',
      isPrivate: result.payload?.isPrivate || false,
      embeddingVector: options.includeEmbedding ? result.vector : undefined,
    }));

    return { posts };
  }

  /**
   * Search by metadata (backward compatibility method)
   */
  async searchByMetadata(options: {
    filter: Record<string, any>;
    limit: number;
    includeEmbedding?: boolean;
    collectionConfig?: CollectionConfig;
  }): Promise<Array<{ id: string; metadata: any; vector?: number[] }>> {
    const results = await this.scroll({
      limit: options.limit,
      filter: options.filter,
      with_payload: true,
      collectionConfig: options.collectionConfig,
    });

    return results.map((result) => ({
      id: result.id,
      metadata: result.payload,
      vector: options.includeEmbedding ? result.vector : undefined,
    }));
  }

  /**
   * Scroll through collection points
   */
  async scroll(options: {
    limit: number;
    filter?: Record<string, any>;
    with_payload?: boolean;
    collectionConfig?: CollectionConfig;
  }): Promise<Array<{ id: string; payload: any; vector?: number[] }>> {
    await this.ensureCollection(options.collectionConfig);

    const collectionName = options.collectionConfig?.name || this.defaultCollectionName;

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/collections/${collectionName}/points/scroll`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: options.limit,
          filter: options.filter,
          with_payload: options.with_payload !== false,
          with_vector: true,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Scroll failed: ${response.statusText}`);
    }

    const result = await response.json() as QdrantScrollResponse;
    return result.result.points.map((point: QdrantPoint) => ({
      id: point.payload?.original_id || point.id.toString(),
      payload: point.payload || {},
      vector: point.vector,
    }));
  }

  /**
   * Get collection info and performance stats
   */
  async getCollectionInfo(): Promise<{
    status: string;
    vectors_count: number;
    indexed_vectors_count: number;
    points_count: number;
    segments_count: number;
    config: any;
  }> {
    const response = await this.fetchWithRetry(
      `${this.baseUrl}/collections/${this.defaultCollectionName}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(`Failed to get collection info: ${response.statusText}`);
    }

    const result = await response.json() as QdrantCollectionInfoResponse;
    return result.result;
  }

  /**
   * Get search metrics
   */
  getMetrics(): SearchMetrics & { averageLatency: number } {
    return {
      ...this.metrics,
      averageLatency: this.metrics.totalSearches > 0 
        ? this.totalLatency / this.metrics.totalSearches 
        : 0,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalSearches: 0,
      batchSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLatency: 0,
      slowSearchCount: 0,
    };
    this.totalLatency = 0;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3
  ): Promise<Response> {
    const requestOptions = {
      ...options,
      headers: {
        'Api-Key': this.apiKey,
        ...options.headers,
      },
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, requestOptions);
        return response;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 100));
      }
    }
    throw new Error('Max retries exceeded');
  }

  private updateMetrics(startTime: number): void {
    const latency = Date.now() - startTime;
    this.totalLatency += latency;
    
    if (latency > this.slowSearchThreshold) {
      this.metrics.slowSearchCount++;
    }
  }

  private hashSearchParams(params: any): string {
    return Buffer.from(JSON.stringify(params)).toString('base64').slice(0, 16);
  }

  private hashBatchParams(params: BatchSearchParams): string {
    // Hash based on vector count, limit, and filter
    const hashInput = {
      vectorCount: params.vectors.length,
      limit: params.limit,
      filter: params.filter,
    };
    return Buffer.from(JSON.stringify(hashInput)).toString('base64').slice(0, 16);
  }

  private convertToValidId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

/**
 * Factory function to create Qdrant client
 */
export function createQdrantClient(env: Bindings): QdrantClient {
  return new QdrantClient(env);
}