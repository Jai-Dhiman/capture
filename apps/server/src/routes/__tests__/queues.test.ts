import { vi, describe, it, expect, beforeEach } from 'vitest';
import { handlePostQueue, handleUserEmbeddingQueue } from '../../routes/queues';
import { createMockBindings } from '../../test/utils/test-utils';
import type { Bindings } from '../../types';
import type { MessageBatch } from '@cloudflare/workers-types';
import * as embeddings from '../../lib/embeddings';
import { createD1Client } from '../../db';

vi.mock('../../lib/embeddings', () => ({
  generatePostEmbedding: vi.fn(),
  storePostEmbedding: vi.fn(),
  generateEmbedding: vi.fn(),
}));

vi.mock('../../db', () => ({
  createD1Client: vi.fn(),
}));

const createMockMessageBatch = <T>(messages: Array<{ id: string; body: T }>): MessageBatch<T> => {
  return {
    messages: messages.map((msg, index) => ({
      id: msg.id,
      timestamp: new Date(Date.now() + index),
      body: msg.body,
      ack: vi.fn(),
      retry: vi.fn(),
      attempts: 1,
    })),
    queue: 'test-queue',
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  };
};

describe('Queue Handlers', () => {
  let bindings: Bindings;
  let mockPostVectors: NonNullable<Bindings['POST_VECTORS']>;
  let mockUserVectors: NonNullable<Bindings['USER_VECTORS']>;
  let mockVectorize: NonNullable<Bindings['VECTORIZE']>;
  let mockAi: NonNullable<Bindings['AI']>;
  let mockUserVectorQueue: NonNullable<Bindings['USER_VECTOR_QUEUE']>;
  let mockDrizzleSelect: ReturnType<typeof vi.fn>;
  let mockDrizzleFrom: ReturnType<typeof vi.fn>;
  let mockDrizzleWhere: ReturnType<typeof vi.fn>;
  let mockDrizzleGet: ReturnType<typeof vi.fn>;
  let mockDrizzleLeftJoin: ReturnType<typeof vi.fn>;
  let mockDrizzleAll: ReturnType<typeof vi.fn>;
  let mockDrizzleOrderBy: ReturnType<typeof vi.fn>;
  let mockDrizzleLimit: ReturnType<typeof vi.fn>;
  let mockDrizzleDbClient: any;

  beforeEach(() => {
    bindings = createMockBindings();
    mockPostVectors = bindings.POST_VECTORS;
    mockUserVectors = bindings.USER_VECTORS;
    mockVectorize = bindings.VECTORIZE;
    mockAi = bindings.AI;
    mockUserVectorQueue = bindings.USER_VECTOR_QUEUE;

    vi.clearAllMocks();

    mockDrizzleSelect = vi.fn();
    mockDrizzleFrom = vi.fn();
    mockDrizzleWhere = vi.fn();
    mockDrizzleGet = vi.fn();
    mockDrizzleLeftJoin = vi.fn();
    mockDrizzleAll = vi.fn();
    mockDrizzleOrderBy = vi.fn();
    mockDrizzleLimit = vi.fn();

    mockDrizzleDbClient = {
      select: mockDrizzleSelect.mockReturnThis(),
      from: mockDrizzleFrom.mockReturnThis(),
      where: mockDrizzleWhere.mockReturnThis(),
      leftJoin: mockDrizzleLeftJoin.mockReturnThis(),
      orderBy: mockDrizzleOrderBy.mockReturnThis(),
      limit: mockDrizzleLimit.mockReturnThis(),
      get: mockDrizzleGet,
      all: mockDrizzleAll,
    };

    vi.mocked(createD1Client).mockReturnValue(mockDrizzleDbClient);
  });

  describe('handlePostQueue', () => {
    const postId = 'post-test-123';
    const userId = 'user-abc';
    const messageId = 'msg001';

    it('should process a post, generate/store embedding, send to user queue, and ack', async () => {
      const batch = createMockMessageBatch([{ id: messageId, body: { postId } }]);
      const mockMessage = batch.messages[0];
      const mockVector = [0.1, 0.2, 0.3];
      const mockVectorData: embeddings.VectorData = {
        postId,
        vector: mockVector,
        text: 'Test content tag1 tag2',
        createdAt: new Date().toISOString(),
      };

      mockDrizzleGet.mockResolvedValueOnce({ id: postId, content: 'Test content', userId });
      mockDrizzleAll.mockResolvedValueOnce([{ name: 'tag1' }, { name: 'tag2' }]);

      vi.mocked(embeddings.generatePostEmbedding).mockResolvedValue(mockVectorData);
      vi.mocked(embeddings.storePostEmbedding).mockResolvedValue(undefined);

      await handlePostQueue(batch, bindings);

      expect(createD1Client).toHaveBeenCalledWith(bindings);
      expect(mockDrizzleSelect).toHaveBeenCalled();
      expect(mockDrizzleGet).toHaveBeenCalledTimes(1);
      expect(mockDrizzleAll).toHaveBeenCalledTimes(1);

      expect(embeddings.generatePostEmbedding).toHaveBeenCalledWith(
        postId,
        'Test content',
        ['tag1', 'tag2'],
        bindings.AI,
      );
      expect(embeddings.storePostEmbedding).toHaveBeenCalledWith(
        mockVectorData,
        mockPostVectors,
        mockVectorize,
      );

      expect(mockUserVectorQueue.send).toHaveBeenCalledWith({ userId });

      expect(mockMessage.ack).toHaveBeenCalledTimes(1);
      expect(mockMessage.retry).not.toHaveBeenCalled();
    });
  });

  describe('handleUserEmbeddingQueue', () => {
    const userId = 'user-embed-test';
    const messageId = 'msg-user-001';
    const cooldownKey = `user-vector-cooldown:${userId}`;

    it('should ack immediately if cooldown is active', async () => {
      const batch = createMockMessageBatch([{ id: messageId, body: { userId } }]);
      const mockMessage = batch.messages[0];

      (mockUserVectors.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce('cooling');

      await handleUserEmbeddingQueue(batch, bindings);

      expect(mockUserVectors.get).toHaveBeenCalledWith(cooldownKey);
      expect(createD1Client).toHaveBeenCalledTimes(1);
      expect(mockDrizzleSelect).not.toHaveBeenCalled();
      expect(mockPostVectors.get).not.toHaveBeenCalled();
      expect(mockUserVectors.put).not.toHaveBeenCalled();
      expect(mockMessage.ack).toHaveBeenCalledTimes(1);
      expect(mockMessage.retry).not.toHaveBeenCalled();
    });
  });
});
