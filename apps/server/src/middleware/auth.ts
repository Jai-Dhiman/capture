import { MiddlewareHandler } from 'hono'
import { auth } from '../lib/auth'

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const session = await auth.api.getSession(c.req.raw)
  if (session) {
    c.set('user', session.user)
    c.set('session', session)
  } else {
    c.set('user', null)
    c.set('session', null)
  }
  await next()
}
