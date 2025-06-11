import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handlePostQueue } from '../queues'
import { createD1Client } from '@/db'

const mockStorePostEmbedding = vi.fn()
const mockGeneratePostEmbedding = vi.fn(() => ({
  vector: [0.1, 0.2, 0.3],
  id: 'mock-id',
  postId: 'post-123',
}))

const mockSend = vi.fn()
const mockAck = vi.fn()
const mockRetry = vi.fn()

vi.mock('@/lib/embeddings', () => ({
  storePostEmbedding: mockStorePostEmbedding,
  generatePostEmbedding: mockGeneratePostEmbedding,
}))

vi.mock('@/lib/qdrantClient', () => ({
  QdrantClient: vi.fn(() => ({
    upsert: vi.fn(),
    insert: vi.fn(),
    query: vi.fn(),
    deleteByIds: vi.fn(),
    getByIds: vi.fn(),
  })),
}))

vi.mock('@/db', () => ({
  createD1Client: vi.fn(),
}))

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  get: vi.fn(),
  leftJoin: vi.fn().mockReturnThis(),
  all: vi.fn(),
}

describe('Queue Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    createD1Client.mockReturnValue(mockDb)

    mockDb.get.mockResolvedValue({
      id: 'post-123',
      content: 'Test content',
      userId: 'user-456',
    })

    mockDb.all.mockResolvedValue([
      { name: 'tag1' },
      { name: 'tag2' },
    ])
  })

  it('should process a post, generate/store embedding, send to user queue, and ack', async () => {
    const env = {
      AI: {},
      POST_VECTORS: {},
      USER_VECTOR_QUEUE: { send: mockSend },
    }

    const batch = {
      messages: [
        {
          body: { postId: 'post-123' },
          id: 'msg-1',
          ack: mockAck,
          retry: mockRetry,
        },
      ],
    }

    await handlePostQueue(batch, env)

    expect(mockGeneratePostEmbedding).toHaveBeenCalledWith(
      'post-123',
      'Test content',
      ['tag1', 'tag2'],
      env.AI
    )

    expect(mockStorePostEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({ postId: 'post-123' }),
      env.POST_VECTORS,
      expect.any(Object) // qdrant client instance
    )

    expect(mockSend).toHaveBeenCalledWith({ userId: 'user-456' })
    expect(mockAck).toHaveBeenCalled()
  })
})