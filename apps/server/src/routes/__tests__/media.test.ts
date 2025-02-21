import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import mediaRouter from '../media'
import { createMockBindings, createTestFile, createFormData } from '../../test/utils/test-utils'
import { authMiddleware } from '../../middleware/auth'
import type { Bindings, Variables } from '../../types'

vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn().mockImplementation(() => ({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
    query: {
      media: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'test-media-id',
          url: 'test-url',
          type: 'image/jpeg',
          userId: 'test-user-id',
        }),
      },
    },
  })),
}))

vi.mock('../../db', () => ({
  createD1Client: vi.fn().mockImplementation(() => ({
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
    query: {
      media: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'test-media-id',
          url: 'test-url',
          type: 'image/jpeg',
          userId: 'test-user-id',
        }),
      },
    },
  })),
}))

describe('Media Routes', () => {
  let app: Hono<{ Bindings: Bindings; Variables: Variables }>
  let mockBindings: Bindings

  beforeEach(() => {
    vi.clearAllMocks()
    mockBindings = createMockBindings()
    app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

    app.use('*', async (c, next) => {
      c.env = mockBindings
      await next()
    })

    app.use('/api/*', authMiddleware)
    app.route('/api/media', mediaRouter)
  })

  describe('POST /', () => {
    it('should upload a file successfully', async () => {
      const file = createTestFile()
      const formData = createFormData(file)
      const res = await app.request('/api/media', {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect((data as { media: unknown }).media).toBeDefined()
      expect((data as { media: { url: string } }).media.url).toBeDefined()
    })

    it('should reject files that are too large', async () => {
      const file = createTestFile({
        size: 6 * 1024 * 1024,
        type: 'image/jpeg',
        name: 'large-image.jpg',
      })
      const formData = createFormData(file)

      const res = await app.request('/api/media', {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: 'Bearer test-token',
        },
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect((data as { error: string }).error).toBe('File too large')
    })

    it('should reject invalid file types', async () => {
      const file = createTestFile({
        type: 'text/plain',
        name: 'test.txt',
      })
      const formData = createFormData(file)

      const res = await app.request('/api/media', {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: 'Bearer test-token',
        },
        cf: {
          env: mockBindings,
        },
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect((data as { error: string }).error).toBe('Invalid file type')
    })
  })
})
