import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { serve } from '@hono/node-server'
import { fetch } from 'undici'

// Mock BEFORE importing the app
vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}))

// Import after mocking
import indexModule from '@/index'
import { sendVerificationEmail } from '@/lib/email'

// Extract the app
const app = indexModule.default || indexModule.app || indexModule

// Mocks
const mockAuthKVGet = vi.fn().mockResolvedValue(null)
const mockAuthKVPut = vi.fn().mockResolvedValue(undefined)
const mockRateLimitKVGet = vi.fn().mockResolvedValue(null)
const mockRateLimitKVPut = vi.fn().mockResolvedValue(undefined)

const mockDB = {
  prepare: vi.fn().mockImplementation((query: string) => ({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue({}),
    run: vi.fn().mockResolvedValue({ success: true }),
    all: vi.fn().mockResolvedValue([]),
  })),
}

const mockBindings = {
  AUTH_KV: {
    put: mockAuthKVPut,
    get: mockAuthKVGet,
  },
  RATE_LIMIT_KV: {
    put: mockRateLimitKVPut,
    get: mockRateLimitKVGet,
  },
  DB: mockDB,
  RESEND_API_KEY: 'dummy-key',
  EMAIL_DOMAIN: 'example.com',
}

// ✅ FIXED: setupTestServer injects ctx.env properly via a wrapper
const setupTestServer = async () => {
  const { Hono } = await import('hono')
  const wrapper = new Hono()

  // Inject env BEFORE routing hits your app
  wrapper.use('*', async (c, next) => {
    c.env = mockBindings as any
    await next()
  })

  // Mount your real app
  wrapper.route('/', app)

  const server = serve({ fetch: wrapper.fetch, port: 8787 })
  await new Promise((res) => setTimeout(res, 100))

  return {
    close: () => server.close(),
    url: `http://localhost:8787`,
  }
}

describe('/auth/send-code', () => {
  let server: Awaited<ReturnType<typeof setupTestServer>>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockAuthKVGet.mockResolvedValue(null)
    mockAuthKVPut.mockResolvedValue(undefined)
    mockRateLimitKVGet.mockResolvedValue(null)
    mockRateLimitKVPut.mockResolvedValue(undefined)
    ;(sendVerificationEmail as vi.Mock).mockResolvedValue(undefined)

    server = await setupTestServer()
  })

  afterEach(async () => {
    await server.close()
  })

  it('should send a verification code if valid email is provided', async () => {
    const response = await fetch(`${server.url}/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com' }),
    })

    expect(response.status).toBe(200)
    expect(mockAuthKVGet).toHaveBeenCalledWith('user@example.com')
    expect(mockAuthKVPut).toHaveBeenCalled()
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.any(String)
    )
  })
})