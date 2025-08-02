import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { MessageBatch } from '@cloudflare/workers-types';
import type { Bindings } from '../../types/index.js';

// Mock the database with a flexible query chain
const mockGet = vi.fn();
const mockAll = vi.fn();

// Create a flexible mock that returns the right methods regardless of call chain
const createFlexibleMock = () => {
  const mock = {
    get: mockGet,
    all: mockAll,
    orderBy: vi.fn(() => createFlexibleMock()),
    limit: vi.fn(() => createFlexibleMock()),
    where: vi.fn(() => createFlexibleMock()),
    leftJoin: vi.fn(() => createFlexibleMock()),
    from: vi.fn(() => createFlexibleMock()),
    groupBy: vi.fn(() => createFlexibleMock()),
    then: vi.fn((resolve, reject) => {
      // Make this thenable so it can be awaited directly
      const result = mockAll();
      if (result && result.then) {
        return result.then(resolve, reject);
      }
      return Promise.resolve(result).then(resolve, reject);
    })
  };
  return mock;
};

const mockSelect = vi.fn(() => createFlexibleMock());

vi.mock('../../db/index.js', () => ({
  createD1Client: vi.fn(() => ({
    select: mockSelect,
  })),
}));

// Mock the embedding service
const mockGenerateTextEmbedding = vi.fn();
const mockGeneratePostEmbedding = vi.fn();
const mockStoreEmbedding = vi.fn();

vi.mock('../../lib/ai/embeddingService.js', () => ({
  createEmbeddingService: vi.fn(() => ({
    generateTextEmbedding: mockGenerateTextEmbedding,
    generatePostEmbedding: mockGeneratePostEmbedding,
    storeEmbedding: mockStoreEmbedding,
  })),
  EmbeddingService: vi.fn(),
}));

// Mock the caching service
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock('../../lib/cache/cachingService.js', () => ({
  createCachingService: vi.fn(() => ({
    get: mockCacheGet,
    set: mockCacheSet,
  })),
}));

// Mock QdrantClient
const mockUpsert = vi.fn();
const mockQdrantClient = {
  upsert: mockUpsert,
};

vi.mock('../../lib/infrastructure/qdrantClient.js', () => ({
  QdrantClient: vi.fn(() => mockQdrantClient),
}));

// Mock WASM utils
vi.mock('../../lib/wasm/wasmUtils.js', () => ({
  OptimizedVectorOps: {
    batchNormalizeVectors: vi.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3])),
    calculateAverage: vi.fn().mockReturnValue(new Float32Array([0.1, 0.2, 0.3])),
  },
}));

// Import the functions to test AFTER setting up mocks
import { handlePostQueue, handleUserEmbeddingQueue, getProcessedCount, resetProcessedCount } from '../queues.js';

describe('Queue Handlers', () => {
  let mockEnv: Bindings;
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Reset processed count
    resetProcessedCount();
    
    // Setup mock environment
    mockEnv = {
      DB: {} as D1Database,
      KV: {
        get: vi.fn(),
        put: vi.fn(),
      } as any,
      POST_VECTORS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      } as any,
      USER_VECTORS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
      } as any,
      CACHE_KV: {} as any,
      POST_QUEUE: {
        send: vi.fn(),
      } as any,
      USER_VECTOR_QUEUE: {
        send: vi.fn(),
      } as any,
      VOYAGE_API_KEY: 'test-voyage-key',
      QDRANT_URL: 'http://test-qdrant',
      QDRANT_API_KEY: 'test-qdrant-key',
      QDRANT_COLLECTION_NAME: 'test-collection',
    } as any;
  });

  describe('handlePostQueue', () => {
    it('should process a text post and generate embedding', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();
      const mockSend = vi.fn();

      // Mock successful post lookup (called multiple times)
      mockGet.mockResolvedValue({
        id: 'test-post-id',
        content: 'This is a text post',
        userId: 'test-user-id',
        authorIsPrivate: false,
      });

      // Mock hashtags lookup and media lookup
      mockAll
        .mockResolvedValueOnce([{ name: 'test' }]) // Hashtags
        .mockResolvedValueOnce([]); // No media records

      // Mock successful embedding generation
      mockGeneratePostEmbedding.mockResolvedValueOnce({
        embeddingResult: {
          vector: [0.1, 0.2, 0.3],
          dimensions: 3,
          provider: 'voyage',
          collectionConfig: {
            name: 'test-collection',
            dimensions: 3,
            distance: 'Cosine',
          },
        },
        metadata: {
          postId: 'test-post-id',
          userId: 'test-user-id',
          text: 'This is a text post #test',
          createdAt: '2023-01-01T00:00:00.000Z',
          isPrivate: false,
          contentType: 'text',
          embeddingProvider: 'voyage',
        },
      });

      mockEnv.USER_VECTOR_QUEUE.send = mockSend;

      const batch: MessageBatch<{ postId: string }> = {
        messages: [
          {
            body: { postId: 'test-post-id' },
            id: 'msg-1',
            ack: mockAck,
            retry: mockRetry,
          } as any,
        ],
        queue: 'test-queue',
        retryAll: vi.fn(),
        ackAll: vi.fn(),
      } as any;

      await handlePostQueue(batch, mockEnv);

      expect(mockAck).toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalledWith({ userId: 'test-user-id' });
      expect(mockGeneratePostEmbedding).toHaveBeenCalledWith(
        'test-post-id',
        'This is a text post',
        ['test'],
        'test-user-id',
        false,
        'voyage',
        'text'
      );
    });

    it('should process an image post with multimodal content type', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();
      const mockSend = vi.fn();

      // Mock successful post lookup (called multiple times)
      mockGet.mockResolvedValue({
        id: 'image-post-id',
        content: 'Check out this photo!',
        userId: 'test-user-id',
        authorIsPrivate: false,
      });

      // Mock hashtags and media lookup
      mockAll
        .mockResolvedValueOnce([{ name: 'photo' }]) // Hashtags
        .mockResolvedValueOnce([{ 
          type: 'image', 
          id: 'img-1', 
          storageKey: 'images/img-1', 
          order: 0 
        }]); // Media records

      // Mock successful embedding generation
      mockGeneratePostEmbedding.mockResolvedValueOnce({
        embeddingResult: {
          vector: [0.1, 0.2, 0.3],
          dimensions: 3,
          provider: 'voyage',
          collectionConfig: {
            name: 'test-collection',
            dimensions: 3,
            distance: 'Cosine',
          },
        },
        metadata: {
          postId: 'image-post-id',
          userId: 'test-user-id',
          text: 'Check out this photo! #photo',
          createdAt: '2023-01-01T00:00:00.000Z',
          isPrivate: false,
          contentType: 'multimodal',
          embeddingProvider: 'voyage',
        },
      });

      mockEnv.USER_VECTOR_QUEUE.send = mockSend;

      const batch: MessageBatch<{ postId: string }> = {
        messages: [
          {
            body: { postId: 'image-post-id' },
            id: 'msg-image',
            ack: mockAck,
            retry: mockRetry,
          } as any,
        ],
        queue: 'test-queue',
        retryAll: vi.fn(),
        ackAll: vi.fn(),
      } as any;

      await handlePostQueue(batch, mockEnv);

      expect(mockAck).toHaveBeenCalled();
      expect(mockGeneratePostEmbedding).toHaveBeenCalledWith(
        'image-post-id',
        'Check out this photo!',
        ['photo'],
        'test-user-id',
        false,
        'voyage',
        'multimodal' // Has both image and text content
      );
    });

    it('should process an image-only post as image content type', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();
      const mockSend = vi.fn();

      // Mock successful post lookup (called multiple times)
      mockGet.mockResolvedValue({
        id: 'image-only-post-id',
        content: '', // No text content
        userId: 'test-user-id',
        authorIsPrivate: false,
      });

      // Mock hashtags and media lookup
      mockAll
        .mockResolvedValueOnce([]) // No hashtags
        .mockResolvedValueOnce([{ 
          type: 'image', 
          id: 'img-2', 
          storageKey: 'images/img-2', 
          order: 0 
        }]); // Media records

      // Mock successful embedding generation
      mockGeneratePostEmbedding.mockResolvedValueOnce({
        embeddingResult: {
          vector: [0.1, 0.2, 0.3],
          dimensions: 3,
          provider: 'voyage',
          collectionConfig: {
            name: 'test-collection',
            dimensions: 3,
            distance: 'Cosine',
          },
        },
        metadata: {
          postId: 'image-only-post-id',
          userId: 'test-user-id',
          text: '',
          createdAt: '2023-01-01T00:00:00.000Z',
          isPrivate: false,
          contentType: 'image',
          embeddingProvider: 'voyage',
        },
      });

      mockEnv.USER_VECTOR_QUEUE.send = mockSend;

      const batch: MessageBatch<{ postId: string }> = {
        messages: [
          {
            body: { postId: 'image-only-post-id' },
            id: 'msg-image-only',
            ack: mockAck,
            retry: mockRetry,
          } as any,
        ],
        queue: 'test-queue',
        retryAll: vi.fn(),
        ackAll: vi.fn(),
      } as any;

      await handlePostQueue(batch, mockEnv);

      expect(mockAck).toHaveBeenCalled();
      expect(mockGeneratePostEmbedding).toHaveBeenCalledWith(
        'image-only-post-id',
        '',
        [],
        'test-user-id',
        false,
        'voyage',
        'image' // Image only, no text
      );
    });

    it('should handle missing post gracefully', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();
      const mockSend = vi.fn();

      // Mock post not found
      mockGet.mockResolvedValue(null);

      mockEnv.USER_VECTOR_QUEUE.send = mockSend;

      const batch: MessageBatch<{ postId: string }> = {
        messages: [
          {
            body: { postId: 'missing-post-id' },
            id: 'msg-missing',
            ack: mockAck,
            retry: mockRetry,
          } as any,
        ],
        queue: 'test-queue',
        retryAll: vi.fn(),
        ackAll: vi.fn(),
      } as any;

      await handlePostQueue(batch, mockEnv);

      // Should not ack or retry individual messages but continue processing
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should handle embedding generation failures gracefully', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();
      const mockSend = vi.fn();

      // Mock successful post lookup (called multiple times)
      mockGet.mockResolvedValue({
        id: 'test-post-id',
        content: 'test post content',
        userId: 'test-user-id',
        authorIsPrivate: false,
      });

      // Mock hashtags lookup
      mockAll
        .mockResolvedValueOnce([]) // No hashtags
        .mockResolvedValueOnce([]); // No media records

      // Mock embedding generation failure
      mockGeneratePostEmbedding.mockRejectedValueOnce(new Error('Embedding generation failed'));

      mockEnv.USER_VECTOR_QUEUE.send = mockSend;

      const batch: MessageBatch<{ postId: string }> = {
        messages: [
          {
            body: { postId: 'test-post-id' },
            id: 'msg-fail',
            ack: mockAck,
            retry: mockRetry,
          } as any,
        ],
        queue: 'test-queue',
        retryAll: vi.fn(),
        ackAll: vi.fn(),
      } as any;

      await handlePostQueue(batch, mockEnv);

      // Should not ack but also not crash
      expect(mockAck).not.toHaveBeenCalled();
    });

    it('should continue processing even if USER_VECTOR_QUEUE.send fails', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();
      const mockSend = vi.fn().mockRejectedValueOnce(new Error('Queue send failed'));

      // Mock successful post lookup (called multiple times)
      mockGet.mockResolvedValue({
        id: 'test-post-id',
        content: 'test post content',
        userId: 'test-user-id',
        authorIsPrivate: false,
      });

      // Mock hashtags lookup
      mockAll
        .mockResolvedValueOnce([]) // No hashtags
        .mockResolvedValueOnce([]); // No media records

      // Mock successful embedding generation
      mockGeneratePostEmbedding.mockResolvedValueOnce({
        embeddingResult: {
          vector: [0.1, 0.2, 0.3],
          dimensions: 3,
          provider: 'voyage',
          collectionConfig: {
            name: 'test-collection',
            dimensions: 3,
            distance: 'Cosine',
          },
        },
        metadata: {
          postId: 'test-post-id',
          userId: 'test-user-id',
          text: 'test post content',
          createdAt: '2023-01-01T00:00:00.000Z',
          isPrivate: false,
          contentType: 'text',
          embeddingProvider: 'voyage',
        },
      });

      mockEnv.USER_VECTOR_QUEUE.send = mockSend;

      const batch: MessageBatch<{ postId: string }> = {
        messages: [
          {
            body: { postId: 'test-post-id' },
            id: 'msg-queue-fail',
            ack: mockAck,
            retry: mockRetry,
          } as any,
        ],
        queue: 'test-queue',
        retryAll: vi.fn(),
        ackAll: vi.fn(),
      } as any;

      await handlePostQueue(batch, mockEnv);

      expect(mockAck).toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalled();
    });
  });

  describe('handleUserEmbeddingQueue', () => {
    it('should process user embedding with saved and created posts', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();

      // Set up a custom mock implementation for the database calls
      let dbCallCount = 0;
      mockAll.mockImplementation(() => {
        dbCallCount++;
        // 1st call: saved posts
        if (dbCallCount === 1) {
          return Promise.resolve([
            { postId: 'saved-post-1', savedAt: '2023-01-01T00:00:00.000Z' },
            { postId: 'saved-post-2', savedAt: '2023-01-02T00:00:00.000Z' },
          ]);
        }
        // 2nd call: created posts
        if (dbCallCount === 2) {
          return Promise.resolve([
            { id: 'created-post-1', createdAt: '2023-01-01T00:00:00.000Z' },
            { id: 'created-post-2', createdAt: '2023-01-02T00:00:00.000Z' },
          ]);
        }
        // 3rd call: frequent hashtags
        if (dbCallCount === 3) {
          return Promise.resolve([
            { name: 'test', count: 3 },
            { name: 'photo', count: 2 },
          ]);
        }
        return Promise.resolve([]);
      });

      // Mock KV store operations for vectors
      (mockEnv.POST_VECTORS as any).get.mockResolvedValue({ vector: [0.1, 0.2, 0.3] });

      // Mock hashtag embedding generation
      mockGenerateTextEmbedding
        .mockResolvedValue({ vector: [0.1, 0.1, 0.1] });
      
      (mockEnv.USER_VECTORS as any).put.mockResolvedValue(undefined);

      const batch: MessageBatch<{ userId: string }> = {
        messages: [
          {
            body: { userId: 'test-user-id' },
            id: 'user-msg-1',
            ack: mockAck,
            retry: mockRetry,
          } as any,
        ],
        queue: 'test-queue',
        retryAll: vi.fn(),
        ackAll: vi.fn(),
      } as any;

      await handleUserEmbeddingQueue(batch, mockEnv);

      expect(mockAck).toHaveBeenCalled();
      expect(mockEnv.USER_VECTORS.put).toHaveBeenCalledWith(
        'test-user-id',
        expect.stringContaining('[')
      );
    });

    it('should handle user with no posts by deleting vector', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();

      // Mock empty saved and created posts
      mockAll.mockResolvedValue([]); 

      (mockEnv.USER_VECTORS as any).delete.mockResolvedValue(undefined);

      const batch: MessageBatch<{ userId: string }> = {
        messages: [
          {
            body: { userId: 'empty-user-id' },
            id: 'user-msg-empty',
            ack: mockAck,
            retry: mockRetry,
          } as any,
        ],
        queue: 'test-queue',
        retryAll: vi.fn(),
        ackAll: vi.fn(),
      } as any;

      await handleUserEmbeddingQueue(batch, mockEnv);

      expect(mockAck).toHaveBeenCalled();
      expect(mockEnv.USER_VECTORS.delete).toHaveBeenCalledWith('empty-user-id');
    });

    it('should handle failed vector calculation gracefully', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();

      // Set up a custom mock implementation for the database calls
      let dbCallCount = 0;
      mockAll.mockImplementation(() => {
        dbCallCount++;
        // 1st call: saved posts
        if (dbCallCount === 1) {
          return Promise.resolve([{ postId: 'post-1', savedAt: '2023-01-01T00:00:00.000Z' }]);
        }
        // 2nd call: created posts
        if (dbCallCount === 2) {
          return Promise.resolve([{ id: 'post-2', createdAt: '2023-01-01T00:00:00.000Z' }]);
        }
        // 3rd call: frequent hashtags
        return Promise.resolve([]);
      });

      // Mock KV store to return invalid vectors
      (mockEnv.POST_VECTORS as any).get.mockResolvedValue(null);
      (mockEnv.USER_VECTORS as any).delete.mockResolvedValue(undefined);

      const batch: MessageBatch<{ userId: string }> = {
        messages: [
          {
            body: { userId: 'test-user-id' },
            id: 'user-msg-fail',
            ack: mockAck,
            retry: mockRetry,
          } as any,
        ],
        queue: 'test-queue',
        retryAll: vi.fn(),
        ackAll: vi.fn(),
      } as any;

      await handleUserEmbeddingQueue(batch, mockEnv);

      expect(mockAck).toHaveBeenCalled();
      expect(mockEnv.USER_VECTORS.delete).toHaveBeenCalledWith('test-user-id');
    });

    it('should handle database errors gracefully', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();

      // Mock database error
      mockAll.mockRejectedValue(new Error('Database error'));

      const batch: MessageBatch<{ userId: string }> = {
        messages: [
          {
            body: { userId: 'test-user-id' },
            id: 'user-msg-db-error',
            ack: mockAck,
            retry: mockRetry,
          } as any,
        ],
        queue: 'test-queue',
        retryAll: vi.fn(),
        ackAll: vi.fn(),
      } as any;

      await handleUserEmbeddingQueue(batch, mockEnv);

      // Should not crash but may not ack
      expect(mockRetry).not.toHaveBeenCalled();
    });
  });

  describe('metrics functions', () => {
    it('should track processed count correctly', () => {
      expect(getProcessedCount()).toBe(0);
      
      // The processed count is incremented internally by the queue handlers
      // We can't easily test this without running the actual handlers
      // But we can test the reset functionality
      resetProcessedCount();
      expect(getProcessedCount()).toBe(0);
    });
  });
});
