import { vi } from 'vitest'

export const mockAuthMiddleware = vi.fn().mockImplementation(async (c, next) => {
  c.set('user', { id: 'test-user-id' })
  await next()
})

vi.mock('../../middleware/auth', () => ({
  authMiddleware: mockAuthMiddleware,
}))
