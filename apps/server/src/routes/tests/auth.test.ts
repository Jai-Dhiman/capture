import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import authRouter from '../auth'
import { createMockBindings } from '../../test/utils/test-utils'
import type { Bindings, Variables } from '../../types'
import { mockQueryBuilder } from '../../test/mocks/db-mock'

// Stub JWT sign and verify
vi.mock('hono/jwt', () => ({
  sign: vi.fn().mockResolvedValue('mock-access-token'),
  verify: vi.fn(),
}))

// Stub nanoid for consistent IDs
vi.mock('nanoid', () => ({ nanoid: vi.fn().mockReturnValue('mock-id') }))

// Mock createD1Client to return mockQueryBuilder
vi.mock('../../db', () => ({
  createD1Client: () => mockQueryBuilder,
}))

// Mock email service
vi.mock('../../lib/emailService', () => ({
  createEmailService: () => ({
    sendVerificationCode: vi.fn().mockResolvedValue(undefined),
  }),
}))

describe('Auth Routes', () => {
  let app: Hono<{ Bindings: Bindings; Variables: Variables }>
  let mockBindings: Bindings

  beforeEach(() => {
    vi.clearAllMocks()
    mockBindings = createMockBindings()
    app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

    // Set environment for each request
    app.use('*', async (c, next) => {
      c.env = mockBindings
      await next()
    })

    app.route('/auth', authRouter)

    // Setup mockQueryBuilder for DB chains
    mockQueryBuilder.select.mockReturnValue(mockQueryBuilder)
    mockQueryBuilder.from.mockReturnValue(mockQueryBuilder)
    mockQueryBuilder.where.mockReturnValue(mockQueryBuilder)
    mockQueryBuilder.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'new-id' }]),
        execute: vi.fn().mockResolvedValue({ insertId: 'new-id' }),
      }),
    })
    mockQueryBuilder.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }) }),
      }),
    })
    mockQueryBuilder.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({ execute: vi.fn().mockResolvedValue({ rowsAffected: 1 }) }),
    })
  })

  describe('POST /auth/send-code', () => {
    it('should return 400 for invalid email', async () => {
      const res = await app.request('/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email' }),
      })
      expect(res.status).toBe(400)
      const data: any = await res.json()
      expect(data.error).toBe('Invalid input')
      expect(data.code).toBe('auth/invalid-input')
    })

    it('should send code for new user', async () => {
      mockQueryBuilder.get.mockResolvedValue(null) // No existing user
      const res = await app.request('/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@example.com', phone: '+1234567890' }),
      })
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.success).toBe(true)
      expect(data.isNewUser).toBe(true)
      expect(data.message).toContain('Welcome!')
    })

    it('should send code for existing user', async () => {
      mockQueryBuilder.get.mockResolvedValue({ id: '1', email: 'existing@example.com' })
      const res = await app.request('/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'existing@example.com' }),
      })
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.success).toBe(true)
      expect(data.isNewUser).toBe(false)
      expect(data.message).toContain('Welcome back!')
    })
  })

  describe('POST /auth/verify-code', () => {
    it('should return 400 for invalid input', async () => {
      const res = await app.request('/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid', code: '123' }),
      })
      expect(res.status).toBe(400)
      const data: any = await res.json()
      expect(data.error).toBe('Invalid input')
      expect(data.code).toBe('auth/invalid-input')
    })

    it('should return 401 for invalid code', async () => {
      mockQueryBuilder.get.mockResolvedValue(null) // No valid code found
      const res = await app.request('/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', code: '123456' }),
      })
      expect(res.status).toBe(401)
      const data: any = await res.json()
      expect(data.error).toBe('Invalid or expired verification code')
      expect(data.code).toBe('auth/invalid-code')
    })

    it('should create new user and return auth data', async () => {
      // Mock valid code
      mockQueryBuilder.get
        .mockResolvedValueOnce({
          id: 'code-id',
          email: 'new@example.com',
          code: '123456',
          expiresAt: (Date.now() + 10 * 60 * 1000).toString(), // Valid for 10 minutes
          usedAt: '',
        })
        .mockResolvedValueOnce(null) // No existing user
        .mockResolvedValueOnce({ id: 'new-user-id', email: 'new@example.com' }) // New user after creation
        .mockResolvedValueOnce(null) // No existing profile

      const res = await app.request('/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@example.com', code: '123456', phone: '+1234567890' }),
      })
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.session).toBeDefined()
      expect(data.user).toBeDefined()
      expect(data.isNewUser).toBe(true)
      expect(data.profileExists).toBe(false)
    })

    it('should authenticate existing user', async () => {
      // Mock valid code
      mockQueryBuilder.get
        .mockResolvedValueOnce({
          id: 'code-id',
          email: 'existing@example.com',
          code: '123456',
          expiresAt: (Date.now() + 10 * 60 * 1000).toString(),
          usedAt: '',
        })
        .mockResolvedValueOnce({ id: 'existing-user-id', email: 'existing@example.com' }) // Existing user
        .mockResolvedValueOnce({ id: 'existing-user-id', email: 'existing@example.com' }) // User after update
        .mockResolvedValueOnce({ id: 'profile-id' }) // Existing profile

      const res = await app.request('/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'existing@example.com', code: '123456' }),
      })
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.session).toBeDefined()
      expect(data.user).toBeDefined()
      expect(data.isNewUser).toBe(false)
      expect(data.profileExists).toBe(true)
    })
  })

  describe('POST /auth/refresh', () => {
    it('should return 400 for missing refresh token', async () => {
      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
      const data: any = await res.json()
      expect(data.error).toBe('Invalid input')
      expect(data.code).toBe('auth/invalid-input')
    })

    it('should return 401 for invalid refresh token', async () => {
      mockBindings.REFRESH_TOKEN_KV = { get: vi.fn().mockResolvedValue(null), delete: vi.fn() } as any
      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'invalid-token' }),
      })
      expect(res.status).toBe(401)
      const data: any = await res.json()
      expect(data.error).toBe('Invalid or expired refresh token')
      expect(data.code).toBe('auth/invalid-refresh-token')
    })

    it('should refresh tokens successfully', async () => {
      mockBindings.REFRESH_TOKEN_KV = { 
        get: vi.fn().mockResolvedValue('user-id'), 
        delete: vi.fn(),
        put: vi.fn()
      } as any
      mockQueryBuilder.get
        .mockResolvedValueOnce({ id: 'user-id', email: 'test@example.com' })
        .mockResolvedValueOnce({ id: 'profile-id' })

      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'valid-token' }),
      })
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.session).toBeDefined()
      expect(data.user).toBeDefined()
      expect(data.profileExists).toBe(true)
    })
  })

  describe('POST /auth/logout', () => {
    it('should logout successfully without token', async () => {
      const res = await app.request('/auth/logout', { method: 'POST' })
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data).toEqual({ success: true, message: 'Logged out successfully.' })
    })

    it('should delete refresh token when provided', async () => {
      mockBindings.REFRESH_TOKEN_KV = { delete: vi.fn() } as any
      const res = await app.request('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'token123' }),
      })
      expect(res.status).toBe(200)
      expect(mockBindings.REFRESH_TOKEN_KV.delete).toHaveBeenCalledWith('rt_token123')
    })
  })

  describe('GET /auth/me', () => {
    it('should return 401 if not authenticated', async () => {
      const res = await app.request('/auth/me', { method: 'GET' })
      expect(res.status).toBe(401)
    })

    it('should return user info when authenticated', async () => {
      const authApp = new Hono<{ Bindings: Bindings; Variables: Variables }>()
      authApp.use('*', async (c, next) => { 
        c.env = mockBindings
        c.set('user', { id: 'test-user-id', email: 'test@example.com' })
        await next() 
      })
      authApp.route('/auth', authRouter)
      
      mockQueryBuilder.get.mockResolvedValue({ id: 'profile-id' })

      const res = await authApp.request('/auth/me', { method: 'GET' })
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.id).toBe('test-user-id')
      expect(data.email).toBe('test@example.com')
      expect(data.profileExists).toBe(true)
    })
  })
})
