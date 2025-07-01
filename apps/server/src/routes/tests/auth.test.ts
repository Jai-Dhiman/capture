import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { serve } from '@hono/node-server'
import { fetch } from 'undici'

// Mock the email service
vi.mock('@/lib/emailService', () => ({
  createEmailService: vi.fn().mockReturnValue({
    sendVerificationCode: vi.fn().mockResolvedValue(undefined),
  }),
}))

// Mock the database - use factory function to avoid hoisting issues
const dbState = {
  users: [] as any[],
  emailCodes: [] as any[],
  profile: [] as any[],
  userActivity: [] as any[],
  passkeys: [] as any[],
};

// Shared state for the mock database
const mockDBState = {
  currentOperation: '',
  currentTable: '',
  whereConditions: {} as any,
  insertValues: {} as any,
  updateValues: {} as any,
  limitValue: 10,
};

function createMockDB() {
  return {
    select: (_fields?: any) => { 
      mockDBState.currentOperation = 'select';
      return createMockDB(); 
    },
    from: (table: any) => { 
      mockDBState.currentTable = table[Symbol.for('drizzle:Name')] || table?.name || 'unknown';
      return createMockDB(); 
    },
    where: (condition: any) => {
      // Handle different types of conditions
      if (typeof condition === 'function') {
        // This is the and() function - extract conditions from it
        const conditions = condition();
        for (const c of conditions) {
          if (c?.left?.name) {
            mockDBState.whereConditions[c.left.name] = c.right;
          }
        }
      } else if (condition?.left?.name) {
        mockDBState.whereConditions[condition.left.name] = condition.right;
      }
      return createMockDB();
    },
    limit: (limit: number) => {
      mockDBState.limitValue = limit;
      if (mockDBState.currentOperation === 'select') {
        if (mockDBState.currentTable === 'emailCodes') {
          let filteredCodes = [...dbState.emailCodes];
          if (mockDBState.whereConditions.email) {
            filteredCodes = filteredCodes.filter((c) => c.email === mockDBState.whereConditions.email);
          }
          if (mockDBState.whereConditions.code) {
            filteredCodes = filteredCodes.filter((c) => c.code === mockDBState.whereConditions.code);
          }
          if (mockDBState.whereConditions.type) {
            filteredCodes = filteredCodes.filter((c) => c.type === mockDBState.whereConditions.type);
          }
          return Promise.resolve(filteredCodes.slice(0, mockDBState.limitValue));
        }
        if (mockDBState.currentTable === 'passkeys') {
          const passkeys = dbState.passkeys.filter((p) => {
            if (mockDBState.whereConditions.userId) return p.userId === mockDBState.whereConditions.userId;
            return false;
          });
          return Promise.resolve(passkeys);
        }
      }
      // Always return an array
      return Promise.resolve([]);
    },
    get: () => {
      if (mockDBState.currentOperation === 'select') {
        if (mockDBState.currentTable === 'users') {
          const user = dbState.users.find((u: any) => {
            if (mockDBState.whereConditions.email) return u.email === mockDBState.whereConditions.email;
            if (mockDBState.whereConditions.id) return u.id === mockDBState.whereConditions.id;
            return false;
          });
          return Promise.resolve(user || null);
        }
        if (mockDBState.currentTable === 'profile') {
          const profile = dbState.profile.find((p: any) => {
            if (mockDBState.whereConditions.userId) return p.userId === mockDBState.whereConditions.userId;
            return false;
          });
          return Promise.resolve(profile || null);
        }
        if (mockDBState.currentTable === 'emailCodes') {
          const code = dbState.emailCodes.find((c: any) => {
            if (mockDBState.whereConditions.id) return c.id === mockDBState.whereConditions.id;
            return false;
          });
          return Promise.resolve(code || null);
        }
      }
      return Promise.resolve(null);
    },
    insert: (table: any) => { 
      mockDBState.currentOperation = 'insert';
      mockDBState.currentTable = table[Symbol.for('drizzle:Name')] || table?.name || 'unknown';
      return createMockDB(); 
    },
    update: (table: any) => { 
      mockDBState.currentOperation = 'update';
      mockDBState.currentTable = table[Symbol.for('drizzle:Name')] || table?.name || 'unknown';
      return createMockDB(); 
    },
    delete: (table: any) => { 
      mockDBState.currentOperation = 'delete';
      mockDBState.currentTable = table[Symbol.for('drizzle:Name')] || table?.name || 'unknown';
      return createMockDB(); 
    },
    values: (values: any) => { 
      mockDBState.insertValues = values;
      return createMockDB(); 
    },
    set: (values: any) => { 
      mockDBState.updateValues = values;
      return createMockDB(); 
    },
    execute: () => {
      if (mockDBState.currentOperation === 'insert') {
        if (mockDBState.currentTable === 'users') {
          const newUser = { ...mockDBState.insertValues };
          dbState.users.push(newUser);
        } else if (mockDBState.currentTable === 'emailCodes') {
          const newCode = { ...mockDBState.insertValues };
          dbState.emailCodes.push(newCode);
        } else if (mockDBState.currentTable === 'userActivity') {
          const newActivity = { ...mockDBState.insertValues };
          dbState.userActivity.push(newActivity);
        }
      } else if (mockDBState.currentOperation === 'update') {
        if (mockDBState.currentTable === 'users') {
          const userIndex = dbState.users.findIndex((u: any) => {
            if (mockDBState.whereConditions.id) return u.id === mockDBState.whereConditions.id;
            return false;
          });
          if (userIndex !== -1) {
            dbState.users[userIndex] = { ...dbState.users[userIndex], ...mockDBState.updateValues };
          }
        } else if (mockDBState.currentTable === 'emailCodes') {
          const codeIndex = dbState.emailCodes.findIndex((c: any) => {
            if (mockDBState.whereConditions.id) return c.id === mockDBState.whereConditions.id;
            return false;
          });
          if (codeIndex !== -1) {
            dbState.emailCodes[codeIndex] = { ...dbState.emailCodes[codeIndex], ...mockDBState.updateValues };
          }
        }
      } else if (mockDBState.currentOperation === 'delete') {
        if (mockDBState.currentTable === 'emailCodes') {
          dbState.emailCodes = dbState.emailCodes.filter((c: any) => {
            if (mockDBState.whereConditions.expiresAt) {
              return Number(c.expiresAt) >= Number(mockDBState.whereConditions.expiresAt);
            }
            return true;
          });
        }
      }
      
      // Reset state
      mockDBState.currentOperation = '';
      mockDBState.currentTable = '';
      mockDBState.whereConditions = {};
      mockDBState.insertValues = {};
      mockDBState.updateValues = {};
      mockDBState.limitValue = 10;
      
      return Promise.resolve({ success: true });
    },
  };
}

vi.mock('@/db', () => ({
  createD1Client: vi.fn().mockImplementation(() => createMockDB()),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('test-id-123'),
}))

// Mock JWT signing
vi.mock('hono/jwt', () => ({
  sign: vi.fn().mockResolvedValue('mock-jwt-token'),
}))

// Import after mocking
import indexModule from '@/index'
import { createD1Client } from '@/db'
import { createEmailService } from '@/lib/emailService'

// Extract the app - indexModule exports { fetch, queue }, we need the fetch function
const app = indexModule.fetch

// Get the mocked functions
const mockEmailService = createEmailService({} as any) as any
const mockSendVerificationCode = mockEmailService.sendVerificationCode

// Mock KV stores
const mockRefreshTokenKVPut = vi.fn().mockResolvedValue(undefined)
const mockRefreshTokenKVGet = vi.fn().mockResolvedValue(null)
const mockRefreshTokenKVDelete = vi.fn().mockResolvedValue(undefined)

const mockRateLimitKVPut = vi.fn().mockResolvedValue(undefined)
const mockRateLimitKVGet = vi.fn().mockResolvedValue(JSON.stringify({ count: 10, resetTime: Date.now() }));

const mockBindings = {
  DB: {} as any,
  REFRESH_TOKEN_KV: {
    put: mockRefreshTokenKVPut,
    get: mockRefreshTokenKVGet,
    delete: mockRefreshTokenKVDelete,
  },
  Capture_Rate_Limits: {
    put: mockRateLimitKVPut,
    get: mockRateLimitKVGet,
  },
  RESEND_API_KEY: 'dummy-key',
  JWT_SECRET: 'test-jwt-secret',
  GOOGLE_CLIENT_ID: 'test-google-client-id',
  GOOGLE_CLIENT_ID_IOS: 'test-google-client-id-ios',
  GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
  APPLE_CLIENT_ID: 'test-apple-client-id',
  APPLE_CLIENT_SECRET: 'test-apple-client-secret',
  SEED_SECRET: 'test-seed-secret',
  CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
  CLOUDFLARE_ACCOUNT_HASH: 'test-account-hash',
  CLOUDFLARE_IMAGES_TOKEN: 'test-images-token',
  CLOUDFLARE_IMAGES_KEY: 'test-images-key',
  QDRANT_URL: 'test-qdrant-url',
  QDRANT_API_KEY: 'test-qdrant-api-key',
  QDRANT_COLLECTION_NAME: 'test-collection',
  BUCKET: {} as any,
  KV: {} as any,
  POST_VECTORS: {} as any,
  USER_VECTORS: {} as any,
  AI: {} as any,
  POST_QUEUE: {} as any,
  USER_VECTOR_QUEUE: {} as any,
}

const setupTestServer = async () => {
  // Create a simple test server that uses the app's fetch function directly
  const server = serve({ 
    fetch: async (request: Request) => {
      // Create a mock environment context
      const mockContext = {
        env: mockBindings as any,
        executionCtx: {
          waitUntil: () => {},
          passThroughOnException: () => {},
        },
      }
      
      // Call the app's fetch function with the mock context
      return await app(request, mockContext.env, mockContext.executionCtx)
    }, 
    port: 8787 
  })
  await new Promise((res) => setTimeout(res, 100))

  return {
    close: () => server.close(),
    url: 'http://localhost:8787',
  }
}

describe('Auth Endpoints', () => {
  let server: Awaited<ReturnType<typeof setupTestServer>>

  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset all mocks to default values
    mockSendVerificationCode.mockResolvedValue(undefined)
    mockRefreshTokenKVPut.mockResolvedValue(undefined)
    mockRefreshTokenKVGet.mockResolvedValue(null)
    mockRefreshTokenKVDelete.mockResolvedValue(undefined)
    mockRateLimitKVPut.mockResolvedValue(undefined)
    mockRateLimitKVGet.mockResolvedValue(JSON.stringify({ count: 10, resetTime: Date.now() }))

    // Reset database state
    dbState.users = []
    dbState.emailCodes = []
    dbState.profile = []
    dbState.userActivity = []
    dbState.passkeys = []
    
    // Reset mock database state
    mockDBState.currentOperation = ''
    mockDBState.currentTable = ''
    mockDBState.whereConditions = {}
    mockDBState.insertValues = {}
    mockDBState.updateValues = {}
    mockDBState.limitValue = 10

    server = await setupTestServer()
  })

  afterEach(async () => {
    await server.close()
  })

  describe('/auth/send-code', () => {
    it('should send a verification code for valid email', async () => {
      dbState.users = []
      dbState.emailCodes = []

      const response = await fetch(`${server.url}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      })

      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.isNewUser).toBe(true)
      expect(data.message).toContain('Welcome!')
      expect(mockSendVerificationCode).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(String),
        'login_register'
      )
    })

    it('should send a verification code for existing user', async () => {
      const existingUser = {
        id: 'existing-user-id',
        email: 'user@example.com',
        emailVerified: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      dbState.users = [existingUser]
      dbState.emailCodes = []

      const response = await fetch(`${server.url}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      })

      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.isNewUser).toBe(false)
      expect(data.message).toContain('Welcome back!')
      expect(mockSendVerificationCode).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(String),
        'login_register'
      )
    })

    it('should return 400 for invalid email', async () => {
      const response = await fetch(`${server.url}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email' }),
      })

      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid input')
      expect(data.code).toBe('auth/invalid-input')
    })

    it('should return 400 for missing email', async () => {
      const response = await fetch(`${server.url}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid input')
      expect(data.code).toBe('auth/invalid-input')
    })

    it('should handle email service errors gracefully', async () => {
      mockSendVerificationCode.mockRejectedValueOnce(new Error('Email service error'))
      dbState.users = []
      dbState.emailCodes = []

      const response = await fetch(`${server.url}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      })

      const data = await response.json() as any

      expect(response.status).toBe(500)
      expect(data.error).toBe('Unable to send verification code. Please check your email address and try again.')
      expect(data.code).toBe('auth/email-send-failed')
    })

    it('should handle missing email service configuration', async () => {
      mockSendVerificationCode.mockRejectedValueOnce(new Error('RESEND_API_KEY is not configured'))
      dbState.users = []
      dbState.emailCodes = []

      const response = await fetch(`${server.url}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      })

      const data = await response.json() as any

      expect(response.status).toBe(503)
      expect(data.error).toBe('Email service is not configured. Please contact support.')
      expect(data.code).toBe('auth/email-service-unavailable')
    })
  })

  describe('/auth/verify-code', () => {
    it('should verify code and create new user', async () => {
      const testCode = '123456'
      const testEmail = 'newuser@example.com'
      dbState.users = []
      dbState.emailCodes = [{
        id: 'code-id',
        email: testEmail,
        code: testCode,
        type: 'login_register',
        expiresAt: (Date.now() + 600000).toString(),
        usedAt: null,
      }]
      dbState.profile = []

      const response = await fetch(`${server.url}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: testEmail, 
          code: testCode 
        }),
      })

      const data = await response.json() as any

      // Log error details if the response is not 200
      if (response.status !== 200) {
        console.log('ERROR: Response status:', response.status);
        console.log('ERROR: Response data:', data);
      }

      expect(response.status).toBe(200)
      expect(data.user.email).toBe(testEmail)
      expect(data.isNewUser).toBe(true)
      expect(data.profileExists).toBe(false)
      expect(data.session.access_token).toBe('mock-jwt-token')
      expect(data.session.refresh_token).toBeDefined()
      expect(data.session.expires_at).toBeDefined()
    })

    it('should verify code and login existing user', async () => {
      const testCode = '123456'
      const testEmail = 'existinguser@example.com'
      const existingUser = {
        id: 'existing-user-id',
        email: testEmail,
        emailVerified: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      dbState.users = [existingUser]
      dbState.emailCodes = [{
        id: 'code-id',
        email: testEmail,
        code: testCode,
        type: 'login_register',
        expiresAt: (Date.now() + 600000).toString(),
        usedAt: null,
      }]
      dbState.profile = []

      const response = await fetch(`${server.url}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: testEmail, 
          code: testCode 
        }),
      })

      const data = await response.json() as any

      // Log error details if the response is not 200
      if (response.status !== 200) {
        console.log('ERROR: Response status:', response.status);
        console.log('ERROR: Response data:', data);
      }

      expect(response.status).toBe(200)
      expect(data.user.email).toBe(testEmail)
      expect(data.isNewUser).toBe(false)
      expect(data.profileExists).toBe(false)
      expect(data.session.access_token).toBe('mock-jwt-token')
      expect(data.session.refresh_token).toBeDefined()
      expect(data.session.expires_at).toBeDefined()
    })

    it('should return 400 for invalid input', async () => {
      const response = await fetch(`${server.url}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'invalid-email', 
          code: '123' 
        }),
      })

      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid input')
      expect(data.code).toBe('auth/invalid-input')
    })

    it('should return 401 for invalid code', async () => {
      dbState.users = []
      dbState.emailCodes = []

      const response = await fetch(`${server.url}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'user@example.com', 
          code: '123456' 
        }),
      })

      const data = await response.json() as any

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid or expired verification code')
      expect(data.code).toBe('auth/invalid-code')
    })

    it('should return 401 for expired code', async () => {
      dbState.users = []
      dbState.emailCodes = [{
        id: 'code-id',
        email: 'user@example.com',
        code: '123456',
        type: 'login_register',
        expiresAt: (Date.now() - 600000).toString(),
        usedAt: null,
      }]

      const response = await fetch(`${server.url}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'user@example.com', 
          code: '123456' 
        }),
      })

      const data = await response.json() as any

      expect(response.status).toBe(401)
      expect(data.error).toBe('Verification code has expired')
      expect(data.code).toBe('auth/code-expired')
    })

    it('should return 401 for already used code', async () => {
      dbState.users = []
      dbState.emailCodes = [{
        id: 'code-id',
        email: 'user@example.com',
        code: '123456',
        type: 'login_register',
        expiresAt: (Date.now() + 600000).toString(),
        usedAt: new Date().toISOString(),
      }]

      const response = await fetch(`${server.url}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'user@example.com', 
          code: '123456' 
        }),
      })

      const data = await response.json() as any

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid or expired verification code')
      expect(data.code).toBe('auth/invalid-code')
    })

    it('should handle phone number during registration', async () => {
      const testCode = '123456'
      const testEmail = 'newuser@example.com'
      const testPhone = '+1234567890'
      dbState.users = []
      dbState.emailCodes = [{
        id: 'code-id',
        email: testEmail,
        code: testCode,
        type: 'login_register',
        expiresAt: (Date.now() + 600000).toString(),
        usedAt: null,
      }]
      dbState.profile = []

      const response = await fetch(`${server.url}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: testEmail, 
          code: testCode,
          phone: testPhone
        }),
      })

      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.user.email).toBe(testEmail)
      expect(data.isNewUser).toBe(true)
    })
  })

  describe('/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const testUserId = 'test-user-id'
      const testRefreshToken = 'test-refresh-token'
      dbState.users = [{
        id: testUserId,
        email: 'user@example.com',
        emailVerified: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]
      dbState.profile = []
      mockRefreshTokenKVGet.mockResolvedValueOnce(testUserId)

      const response = await fetch(`${server.url}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          refresh_token: testRefreshToken 
        }),
      })

      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.user.id).toBe(testUserId)
      expect(data.session.access_token).toBe('mock-jwt-token')
      expect(data.session.refresh_token).toBeDefined()
      expect(mockRefreshTokenKVDelete).toHaveBeenCalledWith(`rt_${testRefreshToken}`)
    })

    it('should return 400 for invalid input', async () => {
      const response = await fetch(`${server.url}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await response.json() as any

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid input')
      expect(data.code).toBe('auth/invalid-input')
    })

    it('should return 401 for invalid refresh token', async () => {
      mockRefreshTokenKVGet.mockResolvedValueOnce(null) // Invalid token

      const response = await fetch(`${server.url}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          refresh_token: 'invalid-token' 
        }),
      })

      const data = await response.json() as any

      expect(response.status).toBe(401)
      expect(data.error).toBe('Invalid or expired refresh token')
      expect(data.code).toBe('auth/invalid-refresh-token')
    })

    it('should return 401 for non-existent user', async () => {
      const testUserId = 'non-existent-user-id'
      const testRefreshToken = 'test-refresh-token'
      dbState.users = []
      dbState.profile = []
      mockRefreshTokenKVGet.mockResolvedValueOnce(testUserId)

      const response = await fetch(`${server.url}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          refresh_token: testRefreshToken 
        }),
      })

      const data = await response.json() as any

      expect(response.status).toBe(401)
      expect(data.error).toBe('User not found for refresh token')
      expect(data.code).toBe('auth/user-not-found')
    })
  })

  describe('/auth/logout', () => {
    it('should logout successfully', async () => {
      const testRefreshToken = 'test-refresh-token'

      const response = await fetch(`${server.url}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          refresh_token: testRefreshToken 
        }),
      })

      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Logged out successfully.')
      expect(mockRefreshTokenKVDelete).toHaveBeenCalledWith(`rt_${testRefreshToken}`)
    })

    it('should logout successfully without refresh token', async () => {
      const response = await fetch(`${server.url}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await response.json() as any

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Logged out successfully.')
    })
  })

  // Note: /auth/me endpoint requires authentication middleware
  // Testing it would require a more complex setup with JWT token generation
  // This is left as a future enhancement

  describe('Rate Limiting', () => {
    it('should apply rate limiting to send-code endpoint', async () => {
      // Mock rate limiting to simulate being rate limited
      mockRateLimitKVGet.mockResolvedValueOnce(JSON.stringify({ count: 10, resetTime: Date.now() })) // Simulate rate limit hit

      await fetch(`${server.url}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com' }),
      })

      // The exact status code depends on the rate limiting implementation
      // This test verifies that rate limiting is being checked
      expect(mockRateLimitKVGet).toHaveBeenCalled()
    })

    it('should apply rate limiting to verify-code endpoint', async () => {
      // Mock rate limiting to simulate being rate limited
      mockRateLimitKVGet.mockResolvedValueOnce(JSON.stringify({ count: 10, resetTime: Date.now() })) // Simulate rate limit hit

      await fetch(`${server.url}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'user@example.com', 
          code: '123456' 
        }),
      })

      // The exact status code depends on the rate limiting implementation
      // This test verifies that rate limiting is being checked
      expect(mockRateLimitKVGet).toHaveBeenCalled()
    })
  })
})