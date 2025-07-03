import { describe, expect, it, vi } from 'vitest';

// Mock dependencies BEFORE importing handlePostQueue
vi.mock('../../lib/embeddings', () => ({
  generatePostEmbedding: vi.fn().mockResolvedValue({
    postId: 'test-id',
    vector: [0.1, 0.2, 0.3],
  }),
  storePostEmbedding: vi.fn(),
}));

vi.mock('../../lib/qdrantClient', () => ({
  QdrantClient: vi.fn().mockImplementation(() => ({
    upsert: vi.fn(),
  })),
}));

vi.mock('@/lib/ai', () => ({
  ai: {
    run: vi.fn(() =>
      Promise.resolve({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      }),
    ),
  },
}));

// Default DB mocks
const mockGet = vi.fn().mockResolvedValue({
  id: 'test-id',
  content: 'test post content',
  userId: 'user-id',
});
const mockAll = vi.fn().mockResolvedValue([{ name: 'mock-tag-1' }, { name: 'mock-tag-2' }]);

vi.mock('@/db', () => {
  const dbMock = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockGet,
          all: mockAll,
          leftJoin: vi.fn(() => ({
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

// Import AFTER mocks
import { ai } from '@/lib/ai';
import { handlePostQueue } from '../queues';
import { generatePostEmbedding } from '../../lib/embeddings';

describe('Queue Handlers', () => {
  it('should process a post, generate/store embedding, send to user queue, and ack', async () => {
    const mockAck = vi.fn();
    const mockRetry = vi.fn();
    const mockSend = vi.fn();

    const env = {
      AI: ai,
      POST_VECTORS: {},
      USER_VECTOR_QUEUE: {
        send: mockSend,
      },
    };

    const batch = {
      messages: [
        {
          body: { postId: 'test-id' },
          id: 'msg-1',
          ack: mockAck,
          retry: mockRetry,
        },
      ],
    };

    await handlePostQueue(batch as any, env as any);

    expect(mockAck).toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledWith({ userId: 'user-id' });
  });

  it('should retry if post is not found', async () => {
    mockGet.mockResolvedValueOnce(null); // simulate missing post

    const mockAck = vi.fn();
    const mockRetry = vi.fn();
    const mockSend = vi.fn();

    const env = {
      AI: ai,
      POST_VECTORS: {},
      USER_VECTOR_QUEUE: {
        send: mockSend,
      },
    };

    const batch = {
      messages: [
        {
          body: { postId: 'missing-id' },
          id: 'msg-2',
          ack: mockAck,
          retry: mockRetry,
        },
      ],
    };

    await handlePostQueue(batch as any, env as any);

    expect(mockRetry).toHaveBeenCalled();
    expect(mockAck).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should retry if embedding generation fails (empty vector)', async () => {
    (generatePostEmbedding as any).mockResolvedValueOnce({
      postId: 'test-id',
      vector: [], // simulate failure
    });

    const mockAck = vi.fn();
    const mockRetry = vi.fn();
    const mockSend = vi.fn();

    const env = {
      AI: ai,
      POST_VECTORS: {},
      USER_VECTOR_QUEUE: {
        send: mockSend,
      },
    };

    const batch = {
      messages: [
        {
          body: { postId: 'test-id' },
          id: 'msg-3',
          ack: mockAck,
          retry: mockRetry,
        },
      ],
    };

    await handlePostQueue(batch as any, env as any);

    expect(mockRetry).toHaveBeenCalled();
    expect(mockAck).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should ack even if USER_VECTOR_QUEUE.send fails', async () => {
    const mockAck = vi.fn();
    const mockRetry = vi.fn();
    const mockSend = vi.fn().mockRejectedValueOnce(new Error('Queue send failed')); // force failure

    const env = {
      AI: ai,
      POST_VECTORS: {},
      USER_VECTOR_QUEUE: {
        send: mockSend,
      },
    };

    const batch = {
      messages: [
        {
          body: { postId: 'test-id' },
          id: 'msg-4',
          ack: mockAck,
          retry: mockRetry,
        },
      ],
    };

    await handlePostQueue(batch as any, env as any);

    expect(mockAck).toHaveBeenCalled();
    expect(mockRetry).not.toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalled();
  });
});
