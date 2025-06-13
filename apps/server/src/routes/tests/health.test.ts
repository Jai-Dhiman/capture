import { describe, it, expect, vi, beforeEach } from 'vitest'
import app from '../../index'

const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  execute: vi.fn(),
}

vi.mock('@/db', () => ({
  createD1Client: vi.fn(() => mockQueryBuilder),
}))

describe('Health Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return ok status when database is connected and has records', async () => {
    mockQueryBuilder.execute.mockResolvedValue([{ id: 1 }])

    const req = new Request('http://localhost/')
    const env = { DB: {} }

    const res = await app.fetch(req, env)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
      database: 'connected',
      dbCheck: 'records exist',
    })
  })

  it('should return degraded status when database connection fails', async () => {
    mockQueryBuilder.execute.mockImplementation(() => {
      throw new Error('Database connection failed')
    })

    const req = new Request('http://localhost/')
    const env = { DB: {} }

    const res = await app.fetch(req, env)
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data).toEqual({
      status: 'degraded',
      timestamp: expect.any(String),
      database: 'error',
      error: 'Database connection failed',
    })
  })

  it('should return no records message when database is empty', async () => {
    mockQueryBuilder.execute.mockResolvedValue([])

    const req = new Request('http://localhost/')
    const env = { DB: {} }

    const res = await app.fetch(req, env)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
      database: 'connected',
      dbCheck: 'no records',
    })
  })
})