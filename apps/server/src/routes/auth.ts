import { Hono } from 'hono'
import { createAuth } from '../lib/auth'

const authRouter = new Hono<{
  Bindings: {
    DATABASE_URL: string
  }
}>()

// console.log('auth.api keys:', Object.keys(auth.api))

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

export default authRouter
