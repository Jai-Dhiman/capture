/**
 * WASM Integration Tests
 *
 * Tests to verify that the WASM vector mathematics module
 * integrates correctly with the TypeScript server code.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  ManagedVector768,
  ManagedDiscoveryScorer,
  ManagedBatchProcessor,
  scoreContentBatch,
  findSimilarContent,
  computeUserPreferenceCentroid,
  WasmPerformanceMonitor,
  type ContentItem,
} from '../lib/wasm/wasmUtils.js';

// Helper function to generate test vectors
function generateTestVector(value = 1.0): Float32Array {
  return new Float32Array(768).fill(value);
}

function generateRandomVector(): Float32Array {
  const vector = new Float32Array(768);
  for (let i = 0; i < 768; i++) {
    vector[i] = Math.random() * 2 - 1; // Values between -1 and 1
  }
  return vector;
}

describe('WASM Integration Tests', () => {
  let performanceMonitor: WasmPerformanceMonitor;

  beforeAll(() => {
    performanceMonitor = WasmPerformanceMonitor.getInstance();
  });

  afterEach(() => {
    // No global cleanup needed as we're using managed instances
  });

  describe('ManagedVector768', () => {
    it('should create and dispose vectors correctly', () => {
      const vector = new ManagedVector768(generateTestVector());

      expect(vector.magnitude()).toBeCloseTo(Math.sqrt(768));

      vector.dispose();

      expect(() => vector.magnitude()).toThrow('Vector has been disposed');
    });

    it('should calculate dot product correctly', () => {
      const vector1 = new ManagedVector768(generateTestVector(1.0));
      const vector2 = new ManagedVector768(generateTestVector(2.0));

      const dotProduct = vector1.dotProduct(vector2);
      expect(dotProduct).toBeCloseTo(768 * 2); // 768 * (1.0 * 2.0)

      vector1.dispose();
      vector2.dispose();
    });

    it('should calculate cosine similarity correctly', () => {
      const vector1 = new ManagedVector768(generateTestVector(1.0));
      const vector2 = new ManagedVector768(generateTestVector(1.0));

      const similarity = vector1.cosineSimilarity(vector2);
      expect(similarity).toBeCloseTo(1.0); // Identical vectors

      vector1.dispose();
      vector2.dispose();
    });

    it('should normalize vectors correctly', () => {
      const vector = new ManagedVector768(generateTestVector(2.0));
      const normalized = vector.normalize();

      expect(normalized.magnitude()).toBeCloseTo(1.0);

      vector.dispose();
      normalized.dispose();
    });

    it('should reject invalid vector sizes', () => {
      expect(() => {
        new ManagedVector768(new Float32Array(100));
      }).toThrow('Vector data must be exactly 768 dimensions');
    });
  });

  describe('ManagedDiscoveryScorer', () => {
    it('should score content within valid bounds', () => {
      const userPrefs = generateTestVector(1.0);
      const scorer = new ManagedDiscoveryScorer(userPrefs);

      const contentVector = generateTestVector(0.8);
      const score = scorer.scoreContent(contentVector, 0.9, 0.7);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);

      scorer.dispose();
    });

    it('should allow weight updates', () => {
      const userPrefs = generateTestVector(1.0);
      const scorer = new ManagedDiscoveryScorer(userPrefs);

      const contentVector = generateTestVector(0.8);
      const initialScore = scorer.scoreContent(contentVector, 0.9, 0.7);

      // Update weights to favor recency more
      scorer.updateWeights({
        relevance: 0.2,
        recency: 0.6,
        popularity: 0.1,
        diversity: 0.1,
      });

      const newScore = scorer.scoreContent(contentVector, 0.9, 0.7);

      // Score should be different after weight update
      expect(newScore).not.toBe(initialScore);

      scorer.dispose();
    });

    it('should handle disposed scorer gracefully', () => {
      const userPrefs = generateTestVector(1.0);
      const scorer = new ManagedDiscoveryScorer(userPrefs);

      scorer.dispose();

      expect(() => {
        scorer.scoreContent(generateTestVector(0.8), 0.9, 0.7);
      }).toThrow('Scorer has been disposed');
    });
  });

  describe('ManagedBatchProcessor', () => {
    it('should process similarity batches correctly', async () => {
      const processor = new ManagedBatchProcessor();
      const queryVector = generateTestVector(1.0);

      // Create batch of 3 vectors
      const batchData = new Float32Array(768 * 3);
      batchData.set(generateTestVector(0.5), 0);
      batchData.set(generateTestVector(1.0), 768);
      batchData.set(generateTestVector(1.5), 768 * 2);

      const similarities = await processor.processSimilarityBatch(queryVector, batchData);

      expect(similarities.length).toBe(3);
      expect(similarities[1]).toBeCloseTo(1.0); // Identical vectors

      processor.dispose();
    });

    it('should find top-k similar vectors', async () => {
      const processor = new ManagedBatchProcessor();
      const queryVector = generateTestVector(1.0);

      // Create batch of 5 vectors with different similarities
      const batchData = new Float32Array(768 * 5);
      for (let i = 0; i < 5; i++) {
        const similarity = (i + 1) * 0.2; // 0.2, 0.4, 0.6, 0.8, 1.0
        batchData.set(generateTestVector(similarity), i * 768);
      }

      const topSimilarities = await processor.findTopKSimilar(queryVector, batchData, 3);

      expect(topSimilarities.length).toBe(3);
      // Should be sorted in descending order
      expect(topSimilarities[0]).toBeGreaterThan(topSimilarities[1]);
      expect(topSimilarities[1]).toBeGreaterThan(topSimilarities[2]);

      processor.dispose();
    });

    it('should compute centroids correctly', async () => {
      const processor = new ManagedBatchProcessor();

      // Create batch with known vectors
      const batchData = new Float32Array(768 * 2);
      batchData.set(generateTestVector(1.0), 0);
      batchData.set(generateTestVector(3.0), 768);

      const centroid = await processor.computeCentroid(batchData);
      const expectedMagnitude = 2.0 * Math.sqrt(768); // Average should be 2.0

      expect(centroid.magnitude()).toBeCloseTo(expectedMagnitude);

      centroid.dispose();
      processor.dispose();
    });
  });

  describe('High-level utility functions', () => {
    it('should score content batches correctly', async () => {
      const userPrefs = generateTestVector(1.0);
      const contentItems: ContentItem[] = [
        {
          id: 'item1',
          embeddingVector: generateTestVector(0.8),
          recencyScore: 0.9,
          popularityScore: 0.7,
        },
        {
          id: 'item2',
          embeddingVector: generateTestVector(0.6),
          recencyScore: 0.8,
          popularityScore: 0.8,
        },
      ];

      const scoredContent = await scoreContentBatch(userPrefs, contentItems);

      expect(scoredContent).toHaveLength(2);
      expect(scoredContent[0].discoveryScore).toBeGreaterThanOrEqual(0);
      expect(scoredContent[0].discoveryScore).toBeLessThanOrEqual(1);
      expect(scoredContent[1].discoveryScore).toBeGreaterThanOrEqual(0);
      expect(scoredContent[1].discoveryScore).toBeLessThanOrEqual(1);
    });

    it('should find similar content correctly', async () => {
      const queryVector = generateTestVector(1.0);
      const contentVectors = [
        generateTestVector(0.5),
        generateTestVector(1.0), // Most similar
        generateTestVector(0.3),
      ];

      const { similarities, indices } = await findSimilarContent(queryVector, contentVectors, 2);

      expect(indices).toHaveLength(2);
      expect(indices[0]).toBe(1); // Most similar should be first
      expect(similarities[0]).toBeCloseTo(1.0);
    });

    it('should compute user preference centroids', async () => {
      const userVectors = [generateTestVector(1.0), generateTestVector(3.0)];

      const centroid = await computeUserPreferenceCentroid(userVectors);

      expect(centroid).toHaveLength(768);

      // Verify centroid is actually the average
      const expectedValue = 2.0; // (1.0 + 3.0) / 2
      expect(centroid[0]).toBeCloseTo(expectedValue);
    });
  });

  describe('Performance monitoring', () => {
    it('should measure operation performance', async () => {
      const result = await performanceMonitor.measureOperation('test-operation', async () => {
        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'test-result';
      });

      expect(result).toBe('test-result');

      const metrics = performanceMonitor.getMetrics('test-operation');
      expect(metrics.count).toBeGreaterThan(0);
      expect(metrics.avg).toBeGreaterThan(0);
    });

    it('should track multiple operations', async () => {
      await performanceMonitor.measureOperation('op1', () => 'result1');
      await performanceMonitor.measureOperation('op2', () => 'result2');

      const allMetrics = performanceMonitor.getAllMetrics();
      expect(allMetrics).toHaveProperty('op1');
      expect(allMetrics).toHaveProperty('op2');
    });
  });

  describe('Memory management', () => {
    it('should handle multiple vector operations without memory leaks', () => {
      const vectors: ManagedVector768[] = [];

      // Create many vectors
      for (let i = 0; i < 100; i++) {
        vectors.push(new ManagedVector768(generateRandomVector()));
      }

      // Perform operations
      for (let i = 0; i < vectors.length - 1; i++) {
        vectors[i].cosineSimilarity(vectors[i + 1]);
      }

      // Clean up
      vectors.forEach((vector) => vector.dispose());

      // Verify vectors are disposed
      expect(() => vectors[0].magnitude()).toThrow('Vector has been disposed');
    });

    it('should handle batch operations with large datasets', async () => {
      const processor = new ManagedBatchProcessor();
      const queryVector = generateRandomVector();

      // Create large batch (1000 vectors)
      const batchSize = 1000;
      const batchData = new Float32Array(768 * batchSize);
      for (let i = 0; i < batchSize; i++) {
        batchData.set(generateRandomVector(), i * 768);
      }

      const similarities = await processor.processSimilarityBatch(queryVector, batchData);

      expect(similarities.length).toBe(batchSize);

      processor.dispose();
    });
  });

  describe('Error handling', () => {
    it('should handle invalid vector dimensions gracefully', () => {
      expect(() => {
        new ManagedVector768(new Float32Array(100));
      }).toThrow('Vector data must be exactly 768 dimensions');
    });

    it('should handle empty batch data', async () => {
      const processor = new ManagedBatchProcessor();
      const emptyBatch = new Float32Array(0);

      await expect(processor.computeCentroid(emptyBatch)).rejects.toThrow();

      processor.dispose();
    });

    it('should handle operations on disposed resources', () => {
      const vector = new ManagedVector768(generateTestVector());
      vector.dispose();

      expect(() => vector.magnitude()).toThrow('Vector has been disposed');
    });
  });
});
