import { describe, it, expect, vi } from 'vitest'

// 👇 Mock all the necessary modules BEFORE importing queues
// Fixed: Mock the relative paths as they would be resolved from queues.ts location
vi.mock('../../lib/embeddings', () => ({
  generatePostEmbedding: vi.fn().mockResolvedValue({
    postId: 'test-id',
    vector: [0.1, 0.2, 0.3],
  }),
  storePostEmbedding: vi.fn(),
}))

vi.mock('../../lib/qdrantClient', () => ({
  QdrantClient: vi.fn().mockImplementation(() => ({
    upsert: vi.fn(),
  })),
}))

vi.mock('@/lib/ai', () => ({
  ai: {
    run: vi.fn(() => Promise.resolve({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    })),
  },
}))

vi.mock('@/db', () => {
  const mockGet = vi.fn().mockResolvedValue({
    id: 'test-id',
    content: 'test post content',
    userId: 'user-id',
  })

  const mockAll = vi.fn().mockResolvedValue([
    { name: 'mock-tag-1' },
    { name: 'mock-tag-2' },
  ])

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
  }

  return {
    createD1Client: vi.fn(() => dbMock),
  }
})

// 👇 Import AFTER mocks
import { ai } from '@/lib/ai'
import { handlePostQueue } from '../queues' // Fixed: Go up one directory to find queues.ts

describe('Queue Handlers', () => {
  it('should process a post, generate/store embedding, send to user queue, and ack', async () => {
    const mockAck = vi.fn()
    const mockRetry = vi.fn()
    const mockSend = vi.fn()

    const env = {
      AI: ai,
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