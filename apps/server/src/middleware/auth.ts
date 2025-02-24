import { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createClient } from '@supabase/supabase-js'

export async function authMiddleware(c: Context, next: Next) {
  // Bypass auth for both GET and POST GraphQL requests
  if (c.req.url.includes('/graphql')) {
    c.set('user', {
      id: 'test-user-id',
      email: 'test@example.com',
      username: 'testuser',
    })
    return await next()
  }

  const authHeader = c.req.header('Authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]

  try {
    if (!c.env.SUPABASE_URL || !c.env.SUPABASE_KEY) {
      throw new Error('Missing Supabase configuration')
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_KEY)

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error) {
      console.error('Supabase auth error:', error)
      throw new HTTPException(401, { message: 'Invalid token' })
    }

    if (!user) {
      throw new HTTPException(401, { message: 'Invalid token' })
    }

    c.set('user', user)
    await next()
  } catch (error) {
    console.error('Authentication error:', error)
    throw new HTTPException(401, { message: 'Authentication failed' })
  }
}
