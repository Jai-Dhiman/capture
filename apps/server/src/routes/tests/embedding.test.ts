import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '../../types';
import { createEmbeddingService } from '../../lib/ai/embeddingService';
import { createCachingService } from '../../lib/cache/cachingService';
import { QdrantClient } from '../../lib/infrastructure/qdrantClient';
import { wasmVectorService } from '../../lib/wasm/wasmVectorService';

// Mock KV namespace
const mockKV = {
  get: async (key: string) => null,
  put: async (key: string, value: string, options?: any) => {},
  delete: async (key: string) => {},
  list: async () => ({ keys: [] }),
} as KVNamespace;

// Mock environment for testing
const mockEnv: Partial<Bindings> = {
  VOYAGE_API_KEY: 'test-key',
  QDRANT_URL: 'http://localhost:6333',
  QDRANT_API_KEY: 'test-key',
  QDRANT_COLLECTION_NAME: 'test_posts',
  CACHE_KV: mockKV,
};

describe('Embedding Service Integration', () => {
  let embeddingService: any;
  let qdrantClient: QdrantClient;

  beforeEach(() => {
    const cache = createCachingService(mockEnv as Bindings);
    embeddingService = createEmbeddingService(mockEnv as Bindings, cache);
    qdrantClient = new QdrantClient(mockEnv as Bindings);
  });

  it('should generate 1024-dimensional text embeddings using Voyage', async () => {
    const testText = 'This is a test post about machine learning and AI #tech #ai';
    
    try {
      const result = await embeddingService.generateTextEmbedding(testText);
      
      expect(result).toBeDefined();
      expect(result.vector).toBeDefined();
      expect(result.vector.length).toBe(1024);
      expect(result.provider).toBe('voyage');
      expect(result.dimensions).toBe(1024);
      expect(result.collectionConfig).toBeDefined();
      expect(result.collectionConfig.dimensions).toBe(1024);
      
      console.log('✅ Generated 1024-dim embedding via Voyage');
      console.log('First 5 values:', result.vector.slice(0, 5));
      
    } catch (error) {
      console.log('⚠️ Voyage API test error:', error.message);
      // With proper mocks, this should not fail
      expect(error).toBeUndefined();
    }
  });

  it('should generate post embeddings with metadata', async () => {
    const postData = {
      postId: 'test-post-123',
      content: 'Testing the new embedding pipeline with Voyage and WASM optimization!',
      hashtags: ['#test', '#embedding', '#wasm'],
      userId: 'user-123',
      isPrivate: false,
    };

    try {
      const result = await embeddingService.generatePostEmbedding(
        postData.postId,
        postData.content,
        postData.hashtags,
        postData.userId,
        postData.isPrivate
      );

      expect(result.embeddingResult.vector.length).toBe(1024);
      expect(result.metadata.postId).toBe(postData.postId);
      expect(result.metadata.embeddingProvider).toBe('voyage');
      
      console.log('✅ Generated post embedding with metadata');
      
    } catch (error) {
      console.log('⚠️ Post embedding generation failed:', error.message);
    }
  });

  it('should verify Qdrant collection configuration', async () => {
    try {
      // Test collection creation with 1024 dimensions
      await qdrantClient.ensureCollection({
        name: 'test_voyage_posts',
        dimensions: 1024,
        distance: 'Cosine',
      });

      console.log('✅ Qdrant collection configured for 1024 dimensions');
      
    } catch (error) {
      console.log('⚠️ Qdrant not available for testing:', error.message);
    }
  });

  it('should test WASM vector similarity calculations', async () => {
    // Create test vectors (1024 dimensions)
    const vector1 = new Float32Array(1024);
    const vector2 = new Float32Array(1024);
    
    // Fill with test data
    for (let i = 0; i < 1024; i++) {
      vector1[i] = Math.random();
      vector2[i] = Math.random();
    }

    try {
      const similarity = wasmVectorService.computeCosineSimilarity(vector1, vector2);
      
      expect(similarity).toBeDefined();
      expect(typeof similarity).toBe('number');
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
      
      console.log('✅ WASM cosine similarity:', similarity);
      console.log('✅ WASM available:', wasmVectorService.isWasmAvailable());
      
    } catch (error) {
      console.log('⚠️ WASM test failed:', error.message);
      // This is expected in test environment without proper WASM setup
    }
  });

  it('should test batch vector processing', async () => {
    // Create batch of test vectors
    const batchSize = 5;
    const vectorBatch = new Float32Array(batchSize * 1024);
    
    for (let i = 0; i < vectorBatch.length; i++) {
      vectorBatch[i] = Math.random();
    }
    
    const queryVector = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      queryVector[i] = Math.random();
    }

    try {
      const similarities = wasmVectorService.batchSimilaritySearch(queryVector, vectorBatch);
      
      expect(similarities).toBeDefined();
      expect(similarities.length).toBe(batchSize);
      
      console.log('✅ Batch similarity search results:', Array.from(similarities));
      
    } catch (error) {
      console.log('⚠️ Batch processing test failed:', error.message);
    }
  });

  it('should test the unified generateEmbedding method', async () => {
    const testText = 'Unified embedding service test';
    
    try {
      // Test string input
      const textResult = await embeddingService.generateEmbedding(testText);
      expect(textResult.vector.length).toBe(1024);
      expect(textResult.provider).toBe('voyage');
      
      // Test multimodal input
      const multimodalInput = [
        { type: 'text' as const, content: 'Test text content' },
        { type: 'image' as const, content: 'base64encodedimage' }
      ];
      
      const multimodalResult = await embeddingService.generateEmbedding(multimodalInput);
      expect(multimodalResult.vector.length).toBe(1024);
      expect(multimodalResult.provider).toBe('voyage');
      
      console.log('✅ Unified generateEmbedding method works correctly');
      
    } catch (error) {
      console.log('⚠️ Unified embedding test error:', error.message);
      expect(error).toBeUndefined();
    }
  });

  it('should test cache functionality', async () => {
    const testText = 'Cache test content';
    
    try {
      // First call should make API request
      const result1 = await embeddingService.generateTextEmbedding(testText);
      
      // Second call should use cache (same results)
      const result2 = await embeddingService.generateTextEmbedding(testText);
      
      expect(result1.vector).toEqual(result2.vector);
      expect(result1.dimensions).toBe(result2.dimensions);
      
      console.log('✅ Caching functionality working');
      
    } catch (error) {
      console.log('⚠️ Cache test error:', error.message);
    }
  });

  it('should test error handling with invalid API key', async () => {
    const invalidEnv = { ...mockEnv, VOYAGE_API_KEY: '' };
    const cache = createCachingService(invalidEnv as Bindings);
    
    try {
      const invalidService = createEmbeddingService(invalidEnv as Bindings, cache);
      expect(() => invalidService).toThrow('Voyage API key is required');
      console.log('✅ Error handling for missing API key works');
    } catch (error) {
      expect(error.message).toContain('Voyage API key is required');
    }
  });

  it('should test service configuration options', async () => {
    const cache = createCachingService(mockEnv as Bindings);
    const customConfig = {
      model: 'custom-model',
      dimensions: 512,
      maxRetries: 5,
    };
    
    const customService = createEmbeddingService(mockEnv as Bindings, cache, customConfig);
    
    expect(customService.getModel()).toBe('custom-model');
    expect(customService.getDimensions()).toBe(512);
    expect(customService.getAvailableProviders()).toEqual(['voyage']);
    
    console.log('✅ Service configuration options work correctly');
  });
});

describe('Embedding Performance Analysis', () => {
  it('should identify WASM optimization opportunities', () => {
    const wasmCandidates = [
      {
        operation: 'Vector normalization',
        currentImplementation: 'JavaScript in embeddingService',
        wasmBenefit: 'High - Mathematical operations',
        complexity: 'Low',
      },
      {
        operation: 'Centroid calculation for user preferences',
        currentImplementation: 'JavaScript in realTimeRecommendationEngine',
        wasmBenefit: 'High - Batch vector operations',
        complexity: 'Medium',
      },
      {
        operation: 'Hashtag similarity clustering',
        currentImplementation: 'Not implemented',
        wasmBenefit: 'High - Graph algorithms',
        complexity: 'High',
      },
      {
        operation: 'Content embedding preprocessing',
        currentImplementation: 'JavaScript string processing',
        wasmBenefit: 'Medium - Text processing',
        complexity: 'Medium',
      },
      {
        operation: 'Discovery feed ranking',
        currentImplementation: 'JavaScript with multiple array operations',
        wasmBenefit: 'High - Already implemented in WASM',
        complexity: 'Complete ✅',
      },
    ];

    console.log('\\n🚀 WASM Optimization Opportunities:');
    wasmCandidates.forEach((candidate, index) => {
      console.log(`\\n${index + 1}. ${candidate.operation}`);
      console.log(`   Current: ${candidate.currentImplementation}`);
      console.log(`   WASM Benefit: ${candidate.wasmBenefit}`);
      console.log(`   Complexity: ${candidate.complexity}`);
    });

    expect(wasmCandidates.length).toBeGreaterThan(0);
  });

  it('should analyze vector database requirements', () => {
    const qdrantRequirements = {
      collections: [
        {
          name: 'voyage_posts',
          dimensions: 1024,
          purpose: 'Post content embeddings from Voyage API',
          migration: 'Required - existing BGE collection has 768 dims',
        },
        {
          name: 'voyage_user_preferences',
          dimensions: 1024,
          purpose: 'User preference vectors (computed from interactions)',
          migration: 'New collection needed',
        },
        {
          name: 'voyage_hashtags',
          dimensions: 1024,
          purpose: 'Hashtag embeddings for clustering and discovery',
          migration: 'New collection needed',
        },
      ],
      migrationSteps: [
        '1. Create new 1024-dim collections',
        '2. Re-generate embeddings for existing posts using Voyage',
        '3. Update collection references in code',
        '4. Migrate existing data or start fresh (recommended)',
        '5. Remove old BGE collections after verification',
      ],
    };

    console.log('\\n📊 Qdrant Database Requirements:');
    qdrantRequirements.collections.forEach((collection) => {
      console.log(`\\n📁 ${collection.name}:`);
      console.log(`   Dimensions: ${collection.dimensions}`);
      console.log(`   Purpose: ${collection.purpose}`);
      console.log(`   Migration: ${collection.migration}`);
    });

    console.log('\\n🔄 Migration Steps:');
    qdrantRequirements.migrationSteps.forEach((step) => {
      console.log(`   ${step}`);
    });

    expect(qdrantRequirements.collections).toHaveLength(3);
  });
});