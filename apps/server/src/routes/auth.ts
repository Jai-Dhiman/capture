import { Hono } from 'hono'
import { createAuth } from 'lib/auth'
import { requireAuth } from 'middleware/auth'
import type { Bindings, Variables } from 'types'

const authRouter = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

// Sign up with email
authRouter.post('/sign-up', async (c) => {
  const auth = createAuth(c.env)
  const { email, password, name } = await c.req.json()
  try {
    const user = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    })
    return c.json({ user })
  } catch (error) {
    console.error('Sign-up failed:', error)
    return c.json({ error: 'Sign-up failed' }, 400)
  }
})

// Sign in with email
authRouter.post('/sign-in', async (c) => {
  const auth = createAuth(c.env)
  const { email, password } = await c.req.json()
  try {
    const session = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    })
    return c.json({ session })
  } catch (error) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }
})

// Sign out (protected route)
authRouter.post('/sign-out', requireAuth, async (c) => {
  const auth = createAuth(c.env)
  const session = c.get('session')

  try {
    await auth.api.signOut({
      headers: new Headers({
        Authorization: `Bearer ${session?.token}`,
      }),
    })
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: 'Sign out failed' }, 400)
  }
})

// Get current session
authRouter.get('/session', async (c) => {
  const session = c.get('session')
  const user = c.get('user')

  if (!user) {
    return c.json(null, 401)
  }

  return c.json({
    session,
    user,
  })
})

export default authRouter
