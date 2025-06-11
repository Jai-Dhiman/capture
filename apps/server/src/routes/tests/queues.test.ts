import { describe, it, expect, vi, beforeEach } from 'vitest'

// 👇 Mock all the necessary modules BEFORE importing the queues
vi.mock('@/routes/lib/embeddings', () => {
  return {
    generatePostEmbedding: vi.fn().mockResolvedValue({
      postId: 'test-id',
      vector: [0.1, 0.2, 0.3],
    }),
    storePostEmbedding: vi.fn(),
    generateEmbedding: vi.fn().mockResolvedValue([0.4, 0.5, 0.6]),
  }
})

vi.mock('@/routes/lib/qdrantClient', () => {
  return {
    QdrantClient: vi.fn().mockImplementation(() => ({
      upsert: vi.fn(),
    })),
  }
})

vi.mock('@/db', () => {
  const mockGet = vi.fn().mockResolvedValue({
    id: 'test-id',
    content: 'test post content',
    userId: 'user-id',
  });

  const mockAll = vi.fn().mockResolvedValue([]);

  const dbMock = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockGet,
          all: mockAll,
        })),
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            all: mockAll,
          })),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            all: mockAll,
          })),
        })),
      })),
    })),
  };

  return {
    createD1Client: vi.fn(() => dbMock),
  };
});

// 👇 Import queues AFTER mocking
import { handlePostQueue } from '@/routes/queues'

describe('Queue Handlers', () => {
  it('should process a post, generate/store embedding, send to user queue, and ack', async () => {
    const mockAck = vi.fn()
    const mockRetry = vi.fn()
    const mockSend = vi.fn()

    const env = {
      AI: {},
      POST_VECTORS: {},
      USER_VECTOR_QUEUE: {
        send: mockSend,
      },
    }

    const batch = {
      messages: [
        {
          body: { postId: 'test-id' },
          id: 'msg-1',
          ack: mockAck,
          retry: mockRetry,
        },
      ],
    }

    await handlePostQueue(batch as any, env as any)

    expect(mockAck).toHaveBeenCalled()
    expect(mockSend).toHaveBeenCalledWith({ userId: 'user-id' })
  })
})