import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Bindings, Variables } from '../../types/index.js';
import authRouter from '../auth.js';

// Mock dependencies - declare at top level for hoisting
const mockSendVerificationCode = vi.fn();
vi.mock('../../lib/services/emailService.js', () => ({
  createEmailService: vi.fn(() => ({
    sendVerificationCode: mockSendVerificationCode,
  })),
}));

// Mock database with flexible query chain
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockExecute = vi.fn();

const createFlexibleMock = () => {
  const mock = {
    get: mockGet,
    all: mockAll,
    execute: mockExecute,
    select: vi.fn(() => createFlexibleMock()),
    from: vi.fn(() => createFlexibleMock()),
    where: vi.fn(() => createFlexibleMock()),
    orderBy: vi.fn(() => createFlexibleMock()),
    limit: vi.fn(() => createFlexibleMock()),
    insert: vi.fn(() => ({ 
      values: vi.fn(() => ({ 
        returning: vi.fn(() => Promise.resolve([{ id: 'test-id-123' }])),
        execute: mockExecute
      })) 
    })),
    update: vi.fn(() => ({ 
      set: vi.fn(() => ({ 
        where: vi.fn(() => ({ 
          execute: mockExecute 
        })),
        execute: mockExecute
      })) 
    })),
    delete: vi.fn(() => ({ 
      where: vi.fn(() => ({ 
        execute: mockExecute 
      })),
      execute: mockExecute
    })),
    then: vi.fn((resolve, reject) => {
      const result = mockGet();
      if (result && result.then) {
        return result.then(resolve, reject);
      }
      return Promise.resolve(result).then(resolve, reject);
    })
  };
  return mock;
};

vi.mock('../../db/index.js', () => ({
  createD1Client: vi.fn(() => createFlexibleMock()),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('test-id-123'),
}));

// Mock JWT
vi.mock('hono/jwt', () => ({
  sign: vi.fn().mockResolvedValue('mock-jwt-token'),
}));

// Mock OAuth utilities
vi.mock('../../lib/auth/oauthUtils.js', () => ({
  exchangeGoogleCode: vi.fn(),
  validateGoogleAccessToken: vi.fn(),
  verifyAppleToken: vi.fn(),
}));

// Mock PasskeyService
vi.mock('../../lib/auth/passkeyService.js', () => ({
  PasskeyService: vi.fn(() => ({})),
}));

// Mock TotpService
vi.mock('../../lib/auth/totpService.js', () => ({
  TotpService: vi.fn(() => ({})),
}));

// Mock middleware - directly mock the middleware functions (not factories)
vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    await next();
  }),
}));

vi.mock('../../middleware/rateLimit.js', () => ({
  authRateLimiter: vi.fn(async (c: any, next: any) => {
    await next();
  }),
  otpRateLimiter: vi.fn(async (c: any, next: any) => {
    await next();
  }),
}));

describe('Auth Routes', () => {
  let app: Hono<{ Bindings: Bindings; Variables: Variables }>;
  let mockEnv: Bindings;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Set up default mock returns
    mockExecute.mockResolvedValue({ success: true });
    mockSendVerificationCode.mockResolvedValue(undefined);
    
    mockEnv = {
      DB: {} as any,
      POST_QUEUE: {} as any,
      USER_VECTOR_QUEUE: {} as any,
      CAPTURE_KV: {
        put: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cursor: undefined }),
      } as any,
      RESEND_API_KEY: 'test-resend-key',
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
      AI: {} as any,
      VOYAGE_API_KEY: 'test-voyage-key',
    } as any;

    app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

    // Set up environment in context
    app.use('*', async (c, next) => {
      c.env = mockEnv;
      await next();
    });

    app.route('/auth', authRouter);
  });

  describe('POST /send-code', () => {
    it('should send verification code for new user', async () => {
      // Mock database to return no existing user
      mockGet.mockResolvedValue(null);
      mockSendVerificationCode.mockResolvedValue(undefined);

      const res = await app.request('/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'newuser@example.com' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('isNewUser', true);
      expect(data.message).toContain('Welcome!');
      expect(mockSendVerificationCode).toHaveBeenCalled();
    });

    it('should send verification code for existing user', async () => {
      // Mock database to return existing user
      mockGet.mockResolvedValue({
        id: 'existing-user-id',
        email: 'existing@example.com',
        emailVerified: 1,
      });
      mockSendVerificationCode.mockResolvedValue(undefined);

      const res = await app.request('/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'existing@example.com' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('isNewUser', false);
      expect(data.message).toContain('Welcome back!');
      expect(mockSendVerificationCode).toHaveBeenCalled();
    });

    it('should return 400 for invalid email', async () => {
      const res = await app.request('/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty('error', 'Invalid input');
      expect(data).toHaveProperty('code', 'auth/invalid-input');
    });

    it('should return 400 for missing email', async () => {
      const res = await app.request('/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty('error', 'Invalid input');
    });

    it('should handle email service errors', async () => {
      mockGet.mockResolvedValue(null);
      mockSendVerificationCode.mockRejectedValue(new Error('Email service error'));

      const res = await app.request('/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toHaveProperty('error', 'Unable to send verification code. Please check your email address and try again.');
    });
  });

  describe('POST /verify-code', () => {
    it('should verify code and create new user', async () => {
      // Mock valid verification code
      mockGet.mockResolvedValueOnce({
        id: 'code-id',
        email: 'newuser@example.com',
        code: '123456',
        type: 'login_register',
        expiresAt: (Date.now() + 300000).toString(),
        usedAt: null,
      });
      
      // Mock no existing user initially, then return created user
      mockGet.mockResolvedValueOnce(null); // No existing user
      mockGet.mockResolvedValueOnce({
        id: 'test-user-id',
        email: 'newuser@example.com',
        emailVerified: 1,
      }); // User after creation
      mockGet.mockResolvedValueOnce(null); // No existing profile

      const res = await app.request('/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@example.com',
          code: '123456',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('session');
      expect(data.session).toHaveProperty('access_token', 'mock-jwt-token');
      expect(data.session).toHaveProperty('refresh_token');
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('isNewUser', true);
    });

    it('should verify code and login existing user', async () => {
      // Mock valid verification code
      mockGet.mockResolvedValueOnce({
        id: 'code-id',
        email: 'existing@example.com',
        code: '123456',
        type: 'login_register',
        expiresAt: (Date.now() + 300000).toString(),
        usedAt: null,
      });
      
      // Mock existing user
      const mockUser = {
        id: 'existing-user-id',
        email: 'existing@example.com',
        emailVerified: 1,
      };
      mockGet.mockResolvedValueOnce(mockUser); // Existing user
      mockGet.mockResolvedValueOnce(mockUser); // User after update
      mockGet.mockResolvedValueOnce(null); // No existing profile

      const res = await app.request('/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'existing@example.com',
          code: '123456',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('session');
      expect(data.session).toHaveProperty('access_token', 'mock-jwt-token');
      expect(data.session).toHaveProperty('refresh_token');
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('isNewUser', false);
    });

    it('should return 400 for invalid input', async () => {
      const res = await app.request('/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email', code: '123' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty('error', 'Invalid input');
    });

    it('should return 401 for invalid code', async () => {
      // Mock no matching verification code
      mockGet.mockResolvedValueOnce(null);

      const res = await app.request('/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          code: '999999',
        }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toHaveProperty('error', 'Invalid or expired verification code');
    });

    it('should return 401 for expired code', async () => {
      // Mock expired verification code
      mockGet.mockResolvedValueOnce({
        id: 'code-id',
        email: 'test@example.com',
        code: '123456',
        type: 'login_register',
        expiresAt: (Date.now() - 1000).toString(), // Expired
        usedAt: null,
      });

      const res = await app.request('/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          code: '123456',
        }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toHaveProperty('error', 'Verification code has expired');
    });

    it('should return 401 for already used code', async () => {
      // Mock no valid unused code (first query fails)
      mockGet.mockResolvedValueOnce(null);
      // Mock expired code check returns used code
      mockGet.mockResolvedValueOnce({
        id: 'code-id',
        email: 'test@example.com',
        code: '123456',
        type: 'login_register',
        expiresAt: (Date.now() + 300000).toString(),
        usedAt: Date.now().toString(), // Already used
      });

      const res = await app.request('/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          code: '123456',
        }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toHaveProperty('error', 'Invalid or expired verification code');
    });
  });

  describe('POST /refresh', () => {
    it('should refresh token successfully', async () => {
      // Mock valid refresh token in KV - return the user ID directly
      (mockEnv.CAPTURE_KV.get as any).mockResolvedValue('test-user-id');

      // Mock user lookup
      mockGet.mockResolvedValueOnce({
        id: 'test-user-id',
        email: 'test@example.com',
        emailVerified: 1,
      });
      // Mock profile check
      mockGet.mockResolvedValueOnce(null);

      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'valid-refresh-token' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('session');
      expect(data.session).toHaveProperty('access_token', 'mock-jwt-token');
      expect(data.session).toHaveProperty('refresh_token');
      expect(mockEnv.CAPTURE_KV.get).toHaveBeenCalledWith('auth:rt:valid-refresh-token');
    });

    it('should return 400 for invalid input', async () => {
      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data).toHaveProperty('error', 'Invalid input');
    });

    it('should return 401 for invalid refresh token', async () => {
      // Mock no refresh token in KV
      (mockEnv.CAPTURE_KV.get as any).mockResolvedValue(null);

      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'invalid-token' }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toHaveProperty('error', 'Invalid or expired refresh token');
    });

    it('should return 401 for expired refresh token', async () => {
      // Mock expired refresh token (KV returns null for expired tokens)
      (mockEnv.CAPTURE_KV.get as any).mockResolvedValue(null);

      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'expired-token' }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toHaveProperty('error', 'Invalid or expired refresh token');
    });

    it('should return 401 for non-existent user', async () => {
      // Mock valid refresh token but no user
      (mockEnv.CAPTURE_KV.get as any).mockResolvedValue('non-existent-user');
      mockGet.mockResolvedValue(null);

      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'valid-token' }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data).toHaveProperty('error', 'User not found for refresh token');
    });
  });

  describe('POST /logout', () => {
    it('should logout successfully', async () => {
      const res = await app.request('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'some-token' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('success', true);
      expect(mockEnv.CAPTURE_KV.delete).toHaveBeenCalledWith('auth:rt:some-token');
    });

    it('should logout successfully without refresh token', async () => {
      const res = await app.request('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('success', true);
    });
  });
});