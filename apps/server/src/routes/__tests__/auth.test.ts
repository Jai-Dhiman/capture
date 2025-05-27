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
vi.mock('nanoid', () => ({ nanoid: vi.fn().mockReturnValue('mock-refresh-token') }))

// Mock createD1Client to return mockQueryBuilder
vi.mock('../../db', () => ({
  createD1Client: () => mockQueryBuilder,
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
  })

  describe('POST /auth/register', () => {
    it('should return 400 for invalid input', async () => {
      const res = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid', password: 'short' }),
      })
      expect(res.status).toBe(400)
      const data: any = await res.json()
      expect(data.error).toBe('Invalid input')
      expect(data.code).toBe('auth/invalid-input')
    })

    it('should return 409 when email already in use', async () => {
      mockQueryBuilder.get.mockResolvedValue({ id: '1', email: 'test@example.com' })
      const res = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      })
      expect(res.status).toBe(409)
      const data: any = await res.json()
      expect(data.error).toBe('Email already in use')
      expect(data.code).toBe('auth/email-in-use')
    })

    it('should register user successfully', async () => {
      mockQueryBuilder.get.mockResolvedValue(null)
      const res = await app.request('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@example.com', password: 'password123' }),
      })
      expect(res.status).toBe(201)
      const data: any = await res.json()
      expect(data.message).toBe('User registered successfully. Please verify your email.')
      expect(data.userId).toBe('mock-refresh-token')
    })
  })

  describe('POST /auth/login', () => {
    it('should return 400 for invalid input', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid', password: 'short' }),
      })
      expect(res.status).toBe(400)
      const data: any = await res.json()
      expect(data.error).toBe('Invalid input')
      expect(data.code).toBe('auth/invalid-input')
    })

    it('should return 401 for invalid credentials', async () => {
      mockQueryBuilder.get.mockResolvedValue(null)
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      })
      expect(res.status).toBe(401)
      const data: any = await res.json()
      expect(data.error).toBe('Invalid credentials')
      expect(data.code).toBe('auth/invalid-credentials')
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

  describe('POST /auth/reset-password', () => {
    it('should return 400 for invalid input', async () => {
      const res = await app.request('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid' }),
      })
      expect(res.status).toBe(400)
      const data: any = await res.json()
      expect(data.error).toBe('Invalid input')
      expect(data.code).toBe('auth/invalid-input')
    })

    it('should return success message for valid input', async () => {
      const res = await app.request('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      })
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.success).toBe(true)
    })
  })

  describe('POST /auth/update-password', () => {
    it('should return 401 if not authenticated', async () => {
      const unauthApp = new Hono<{ Bindings: Bindings; Variables: Variables }>()
      unauthApp.use('*', async (c, next) => { c.env = mockBindings; await next() })
      unauthApp.route('/auth', authRouter)
      const res = await unauthApp.request('/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'newpassword123' }),
      })
      expect(res.status).toBe(401)
      const data: any = await res.json()
      expect(data.error).toBe('Unauthorized: No user session')
      expect(data.code).toBe('auth/no-session')
    })

    it('should update password successfully when authenticated', async () => {
      const authApp = new Hono<{ Bindings: Bindings; Variables: Variables }>()
      authApp.use('*', async (c, next) => { c.env = mockBindings; c.set('user', { id: 'test-user-id' }); await next() })
      authApp.route('/auth', authRouter)
      const res = await authApp.request('/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'newpassword123' }),
      })
      expect(res.status).toBe(200)
      const data: any = await res.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Password updated successfully.')
    })
  })
})
