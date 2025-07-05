import type { Vector1024, DiscoveryScorer, BatchProcessor } from '../../../wasm/capture_wasm';

export interface IWasmVectorService {
  computeCosineSimilarity(a: Float32Array, b: Float32Array): number;
  findTopKSimilar(queryVector: Float32Array, candidateVectors: Float32Array, k: number): Float32Array;
  scoreBatchContent(
    userPrefs: Float32Array,
    contentVectors: Float32Array,
    recencyScores: Float32Array,
    popularityScores: Float32Array,
  ): Float32Array;
  batchSimilaritySearch(queryVector: Float32Array, vectors: Float32Array): Float32Array;
}

/**
 * WASM-powered vector operations service
 * Provides high-performance vector similarity calculations
 */
export class WasmVectorService implements IWasmVectorService {
  private wasmModule: any;
  private isInitialized = false;

  constructor() {
    this.initWasm();
  }

  private async initWasm() {
    try {
      // Dynamic import of WASM module
      this.wasmModule = await import('../../../wasm/capture_wasm');
      
      // Import the WASM binary directly for Cloudflare Workers
      const wasmBinary = await import('../../../wasm/capture_wasm_bg.wasm');
      
      // Initialize synchronously with the WASM binary
      this.wasmModule.initSync({ module: wasmBinary.default });
      
      // Now call init_wasm if it exists and the module is properly loaded
      if (this.wasmModule.init_wasm) {
        this.wasmModule.init_wasm();
      }
      
      this.isInitialized = true;
      console.log('WASM vector service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WASM module:', error);
      this.isInitialized = false;
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.wasmModule) {
      throw new Error('WASM module not initialized. Vector operations unavailable.');
    }
  }

  /**
   * Compute cosine similarity between two 1024-dimensional vectors
   */
  computeCosineSimilarity(a: Float32Array, b: Float32Array): number {
    this.ensureInitialized();

    if (a.length !== 1024 || b.length !== 1024) {
      throw new Error('Vectors must be exactly 1024 dimensions');
    }

    try {
      const vectorA = new this.wasmModule.Vector1024(a);
      const vectorB = new this.wasmModule.Vector1024(b);
      
      return vectorA.cosine_similarity(vectorB);
    } catch (error) {
      console.error('WASM cosine similarity calculation failed:', error);
      // Fallback to JavaScript implementation
      return this.fallbackCosineSimilarity(a, b);
    }
  }

  /**
   * Find top K most similar vectors using WASM
   */
  findTopKSimilar(queryVector: Float32Array, candidateVectors: Float32Array, k: number): Float32Array {
    this.ensureInitialized();

    if (queryVector.length !== 1024) {
      throw new Error('Query vector must be exactly 1024 dimensions');
    }

    if (candidateVectors.length % 1024 !== 0) {
      throw new Error('Candidate vectors must be multiple of 1024 dimensions');
    }

    try {
      const processor = new this.wasmModule.BatchProcessor(100);
      const queryVec = new this.wasmModule.Vector1024(queryVector);
      
      return processor.find_top_k_similar(queryVec, candidateVectors, k);
    } catch (error) {
      console.error('WASM top-K search failed:', error);
      throw error;
    }
  }

  /**
   * Score content using discovery algorithm with WASM
   */
  scoreBatchContent(
    userPrefs: Float32Array,
    contentVectors: Float32Array,
    recencyScores: Float32Array,
    popularityScores: Float32Array,
  ): Float32Array {
    this.ensureInitialized();

    if (userPrefs.length !== 1024) {
      throw new Error('User preferences vector must be exactly 1024 dimensions');
    }

    try {
      return this.wasmModule.score_content_batch(
        userPrefs,
        contentVectors,
        recencyScores,
        popularityScores,
      );
    } catch (error) {
      console.error('WASM content scoring failed:', error);
      throw error;
    }
  }

  /**
   * Perform batch similarity search against multiple vectors
   */
  batchSimilaritySearch(queryVector: Float32Array, vectors: Float32Array): Float32Array {
    this.ensureInitialized();

    if (queryVector.length !== 1024) {
      throw new Error('Query vector must be exactly 1024 dimensions');
    }

    try {
      return this.wasmModule.compute_batch_similarities(queryVector, vectors);
    } catch (error) {
      console.error('WASM batch similarity search failed:', error);
      throw error;
    }
  }

  /**
   * JavaScript fallback for cosine similarity
   */
  private fallbackCosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Check if WASM is available and initialized
   */
  isWasmAvailable(): boolean {
    return this.isInitialized && !!this.wasmModule;
  }

  /**
   * Get WASM module instance (for advanced usage)
   */
  getWasmModule(): any {
    this.ensureInitialized();
    return this.wasmModule;
  }
}

/**
 * Singleton instance for global use
 */
export const wasmVectorService = new WasmVectorService();

/**
 * Utility function to create vector service
 */
export function createWasmVectorService(): IWasmVectorService {
  return new WasmVectorService();
}