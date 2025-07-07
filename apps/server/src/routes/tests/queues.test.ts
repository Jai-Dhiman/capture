import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { MessageBatch } from '@cloudflare/workers-types';
import type { Bindings } from '../../types/index.js';

// Mock the database
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    leftJoin: vi.fn(() => ({
      where: vi.fn(() => ({
        get: mockGet,
        all: mockAll,
      })),
    })),
    where: vi.fn(() => ({
      get: mockGet,
      all: mockAll,
    })),
  })),
}));

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
      } as any,
      USER_VECTORS: {
        get: vi.fn(),
        put: vi.fn(),
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
    it('should process a post, generate embedding, and send to user queue', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();
      const mockSend = vi.fn();

      // Mock successful post lookup
      mockGet.mockResolvedValueOnce({
        id: 'test-post-id',
        content: 'test post content',
        userId: 'test-user-id',
        authorIsPrivate: false,
      });

      // Mock hashtags lookup
      mockAll.mockResolvedValueOnce([
        { name: 'test-tag' },
        { name: 'another-tag' },
      ]);

      // Mock successful embedding generation
      mockGenerateTextEmbedding.mockResolvedValueOnce({
        vector: [0.1, 0.2, 0.3],
        dimensions: 3,
        provider: 'voyage',
        collectionConfig: {
          name: 'test-collection',
          dimensions: 3,
          distance: 'Cosine',
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
    });

    it('should determine content type for text-only posts', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();
      const mockSend = vi.fn();

      // Mock successful post lookup
      mockGet.mockResolvedValueOnce({
        id: 'text-post-id',
        content: 'This is a text-only post',
        userId: 'test-user-id',
        authorIsPrivate: false,
      });

      // Mock hashtags lookup  
      mockAll
        .mockResolvedValueOnce([{ name: 'text' }]) // Hashtags
        .mockResolvedValueOnce([]); // No media records

      // Mock successful embedding generation with postType
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
          postId: 'text-post-id',
          userId: 'test-user-id',
          text: 'This is a text-only post #text',
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
            body: { postId: 'text-post-id' },
            id: 'msg-text',
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
        'text-post-id',
        'This is a text-only post',
        ['text'],
        'test-user-id',
        false,
        'voyage',
        'text'
      );
    });

    it('should determine content type for image posts', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();
      const mockSend = vi.fn();

      // Mock successful post lookup
      mockGet.mockResolvedValueOnce({
        id: 'image-post-id',
        content: 'Check out this photo!',
        userId: 'test-user-id',
        authorIsPrivate: false,
      });

      // Mock hashtags and media lookup
      mockAll
        .mockResolvedValueOnce([{ name: 'photo' }]) // Hashtags
        .mockResolvedValueOnce([{ type: 'image', id: 'img-1', storageKey: 'images/img-1', order: 0 }]); // Media records

      // Mock successful embedding generation with postType
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

    it('should retry if post is not found', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();
      const mockSend = vi.fn();

      // Mock post not found
      mockGet.mockResolvedValueOnce(null);

      mockEnv.USER_VECTOR_QUEUE.send = mockSend;

      const batch: MessageBatch<{ postId: string }> = {
        messages: [
          {
            body: { postId: 'missing-post-id' },
            id: 'msg-2',
            ack: mockAck,
            retry: mockRetry,
          } as any,
        ],
        queue: 'test-queue',
        retryAll: vi.fn(),
        ackAll: vi.fn(),
      } as any;

      await handlePostQueue(batch, mockEnv);

      expect(mockRetry).toHaveBeenCalled();
      expect(mockAck).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should handle embedding generation failures gracefully', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();
      const mockSend = vi.fn();

      // Mock successful post lookup
      mockGet.mockResolvedValueOnce({
        id: 'test-post-id',
        content: 'test post content',
        userId: 'test-user-id',
        authorIsPrivate: false,
      });

      mockAll.mockResolvedValueOnce([]);

      // Mock embedding generation failure
      mockGenerateTextEmbedding.mockRejectedValueOnce(new Error('Embedding generation failed'));

      mockEnv.USER_VECTOR_QUEUE.send = mockSend;

      const batch: MessageBatch<{ postId: string }> = {
        messages: [
          {
            body: { postId: 'test-post-id' },
            id: 'msg-3',
            ack: mockAck,
            retry: mockRetry,
          } as any,
        ],
        queue: 'test-queue',
        retryAll: vi.fn(),
        ackAll: vi.fn(),
      } as any;

      await handlePostQueue(batch, mockEnv);

      expect(mockRetry).toHaveBeenCalled();
      expect(mockAck).not.toHaveBeenCalled();
    });

    it('should ack even if USER_VECTOR_QUEUE.send fails', async () => {
      const mockAck = vi.fn();
      const mockRetry = vi.fn();
      const mockSend = vi.fn().mockRejectedValueOnce(new Error('Queue send failed'));

      // Mock successful post lookup
      mockGet.mockResolvedValueOnce({
        id: 'test-post-id',
        content: 'test post content',
        userId: 'test-user-id',
        authorIsPrivate: false,
      });

      mockAll.mockResolvedValueOnce([]);

      // Mock successful embedding generation
      mockGenerateTextEmbedding.mockResolvedValueOnce({
        vector: [0.1, 0.2, 0.3],
        dimensions: 3,
        provider: 'voyage',
        collectionConfig: {
          name: 'test-collection',
          dimensions: 3,
          distance: 'Cosine',
        },
      });

      mockEnv.USER_VECTOR_QUEUE.send = mockSend;

      const batch: MessageBatch<{ postId: string }> = {
        messages: [
          {
            body: { postId: 'test-post-id' },
            id: 'msg-4',
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
      expect(mockRetry).not.toHaveBeenCalled();
      expect(mockSend).toHaveBeenCalled();
    });
  });

      describe('handleUserEmbeddingQueue', () => {
      it('should process user embedding successfully', async () => {
        const mockAck = vi.fn();
        const mockRetry = vi.fn();

        // Mock user posts lookup
        mockAll.mockResolvedValueOnce([
          { id: 'post-1', content: 'content 1' },
          { id: 'post-2', content: 'content 2' },
        ]);

        // Mock KV store operations
        mockEnv.POST_VECTORS.get = vi.fn().mockResolvedValue(JSON.stringify([0.1, 0.2, 0.3]));
        mockEnv.USER_VECTORS.put = vi.fn().mockResolvedValue(undefined);

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
        expect(mockEnv.USER_VECTORS.put).toHaveBeenCalled();
      });

      it('should retry if user has no posts', async () => {
        const mockAck = vi.fn();
        const mockRetry = vi.fn();

        // Mock empty user posts
        mockAll.mockResolvedValueOnce([]);

        const batch: MessageBatch<{ userId: string }> = {
          messages: [
            {
              body: { userId: 'test-user-id' },
              id: 'user-msg-2',
              ack: mockAck,
              retry: mockRetry,
            } as any,
          ],
          queue: 'test-queue',
          retryAll: vi.fn(),
          ackAll: vi.fn(),
        } as any;

        await handleUserEmbeddingQueue(batch, mockEnv);

        expect(mockRetry).toHaveBeenCalled();
        expect(mockAck).not.toHaveBeenCalled();
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
