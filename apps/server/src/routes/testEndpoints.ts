import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { createEmbeddingService } from '../lib/ai/embeddingService';
import { createCachingService } from '../lib/cache/cachingService';
import { QdrantClient } from '../lib/infrastructure/qdrantClient';
import { wasmVectorService } from '../lib/wasm/wasmVectorService';

const testRouter = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Test endpoint for Qdrant collection info
testRouter.get('/qdrant-info', async (c) => {
  try {
    // Get collection info
    const collectionName = c.env.QDRANT_COLLECTION_NAME || 'posts';
    const response = await fetch(`${c.env.QDRANT_URL}/collections/${collectionName}`, {
      method: 'GET',
      headers: {
        'Api-Key': c.env.QDRANT_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const collectionInfo = await response.json() as {
        result?: {
          config?: {
            params?: {
              vectors?: {
                size?: number;
                distance?: string;
              };
            };
          };
          points_count?: number;
        };
      };
      return c.json({
        exists: true,
        name: collectionName,
        dimensions: collectionInfo.result?.config?.params?.vectors?.size || 'unknown',
        distance: collectionInfo.result?.config?.params?.vectors?.distance || 'unknown',
        pointsCount: collectionInfo.result?.points_count || 0,
      });
    }
    
    return c.json({
      exists: false,
      name: collectionName,
      error: 'Collection not found or Qdrant unavailable',
    });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      qdrantUrl: c.env.QDRANT_URL,
    });
  }
});

// Test endpoint for WASM vector operations
testRouter.post('/wasm-similarity', async (c) => {
  try {
    const { vector1, vector2 } = await c.req.json();
    
    if (!vector1 || !vector2) {
      return c.json({ error: 'Missing vector1 or vector2' }, 400);
    }

    if (vector1.length !== 1024 || vector2.length !== 1024) {
      return c.json({ error: 'Vectors must be 1024 dimensions' }, 400);
    }

    const vec1 = new Float32Array(vector1);
    const vec2 = new Float32Array(vector2);

    const startTime = performance.now();
    const similarity = wasmVectorService.computeCosineSimilarity(vec1, vec2);
    const endTime = performance.now();

    return c.json({
      similarity,
      usedWasm: wasmVectorService.isWasmAvailable(),
      computeTimeMs: endTime - startTime,
      vectorDimensions: 1024,
    });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      usedWasm: false,
    });
  }
});

// Test endpoint for embedding generation
testRouter.post('/test-embedding', async (c) => {
  try {
    const { text, provider = 'voyage' } = await c.req.json();
    
    if (!text) {
      return c.json({ error: 'Missing text parameter' }, 400);
    }

    const cache = createCachingService(c.env);
    const embeddingService = createEmbeddingService(c.env, cache);

    const startTime = performance.now();
    const result = await embeddingService.generateTextEmbedding(text, provider);
    const endTime = performance.now();

    return c.json({
      success: true,
      provider: result.provider,
      dimensions: result.dimensions,
      vectorLength: result.vector.length,
      sampleValues: result.vector.slice(0, 5), // First 5 values for inspection
      generationTimeMs: endTime - startTime,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: 'unknown',
    });
  }
});

// Test endpoint for full post embedding flow
testRouter.post('/test-post-embedding', async (c) => {
  try {
    const { postId, content, hashtags = [], userId = 'test-user' } = await c.req.json();
    
    if (!postId || !content) {
      return c.json({ error: 'Missing postId or content' }, 400);
    }

    const cache = createCachingService(c.env);
    const embeddingService = createEmbeddingService(c.env, cache);
    const qdrantClient = new QdrantClient(c.env);

    // Generate embedding
    const startTime = performance.now();
    const embeddingResult = await embeddingService.generatePostEmbedding(
      postId,
      content,
      hashtags,
      userId,
      false, // isPrivate
      'voyage'
    );
    const embeddingTime = performance.now();

    // Store in Qdrant
    await embeddingService.storeEmbedding(
      `post:${postId}`,
      embeddingResult.embeddingResult,
      embeddingResult.metadata,
      qdrantClient
    );
    const storageTime = performance.now();

    return c.json({
      success: true,
      postId,
      embeddingDimensions: embeddingResult.embeddingResult.dimensions,
      embeddingProvider: embeddingResult.embeddingResult.provider,
      generationTimeMs: embeddingTime - startTime,
      storageTimeMs: storageTime - embeddingTime,
      totalTimeMs: storageTime - startTime,
      metadata: embeddingResult.metadata,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test endpoint for batch vector search
testRouter.post('/test-batch-search', async (c) => {
  try {
    const { queryVector, candidateVectors, k = 5 } = await c.req.json();
    
    if (!queryVector || !candidateVectors) {
      return c.json({ error: 'Missing queryVector or candidateVectors' }, 400);
    }

    if (queryVector.length !== 1024) {
      return c.json({ error: 'Query vector must be 1024 dimensions' }, 400);
    }

    const query = new Float32Array(queryVector);
    const candidates = new Float32Array(candidateVectors);

    if (candidates.length % 1024 !== 0) {
      return c.json({ error: 'Candidate vectors must be multiple of 1024 dimensions' }, 400);
    }

    const startTime = performance.now();
    const similarities = wasmVectorService.findTopKSimilar(query, candidates, k);
    const endTime = performance.now();

    return c.json({
      success: true,
      topKResults: Array.from(similarities),
      candidateCount: candidates.length / 1024,
      k,
      searchTimeMs: endTime - startTime,
      usedWasm: wasmVectorService.isWasmAvailable(),
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Test endpoint for discovery scoring
testRouter.post('/test-discovery-scoring', async (c) => {
  try {
    const { 
      userPreferences, 
      contentVectors, 
      recencyScores, 
      popularityScores 
    } = await c.req.json();
    
    if (!userPreferences || !contentVectors || !recencyScores || !popularityScores) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }

    const userPrefs = new Float32Array(userPreferences);
    const content = new Float32Array(contentVectors);
    const recency = new Float32Array(recencyScores);
    const popularity = new Float32Array(popularityScores);

    const startTime = performance.now();
    const scores = wasmVectorService.scoreBatchContent(userPrefs, content, recency, popularity);
    const endTime = performance.now();

    return c.json({
      success: true,
      discoveryScores: Array.from(scores),
      contentCount: content.length / 1024,
      scoringTimeMs: endTime - startTime,
      usedWasm: wasmVectorService.isWasmAvailable(),
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Health check for all embedding components
testRouter.get('/embedding-health', async (c) => {
  const health = {
    voyage: false,
    wasm: false,
    qdrant: false,
    cache: false,
  };

  try {
    // Test Voyage API
    try {
      const cache = createCachingService(c.env);
      const embeddingService = createEmbeddingService(c.env, cache);
      await embeddingService.generateTextEmbedding('test', 'voyage');
      health.voyage = true;
    } catch (_) {
      // Expected if no API key
    }

    // Test WASM
    health.wasm = wasmVectorService.isWasmAvailable();

    // Test Qdrant
    try {
      const response = await fetch(`${c.env.QDRANT_URL}/collections`, {
        method: 'GET',
        headers: { 'Api-Key': c.env.QDRANT_API_KEY },
      });
      health.qdrant = response.ok;
    } catch (_) {
      // Expected if Qdrant not available
    }

    // Test cache
    try {
      const cache = createCachingService(c.env);
      await cache.set('health-check', 'ok', 10);
      const value = await cache.get('health-check');
      health.cache = value === 'ok';
    } catch (_) {
      // Expected if cache not available
    }

    return c.json({
      status: 'ok',
      components: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({
      status: 'error',
      components: health,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

export default testRouter;