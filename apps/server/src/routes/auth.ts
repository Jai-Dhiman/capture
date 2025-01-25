import { Hono } from 'hono'
import { auth } from '../lib/auth'
import { createUserSchema } from '@capture/validation/src/schemas'

const router = new Hono()

router.post('/register', async (c) => {
  try {
    const body = await c.req.json()
    const validatedData = createUserSchema.parse(body)

    const result = await auth.api.emailAndPassword.register({
      email: validatedData.email,
      password: validatedData.password,
      userData: {
        name: validatedData.name,
      },
    })

    return c.json(result)
  } catch (error) {
    return c.json({ error: error.message }, 400)
  }
})

router.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json()
    const result = await auth.api.emailAndPassword.login({
      email,
      password,
    })
    return c.json(result)
  } catch (error) {
    return c.json({ error: error.message }, 401)
  }
})

router.post('/logout', async (c) => {
  try {
    const session = c.get('session')
    if (!session) return c.json({ error: 'Not authenticated' }, 401)

    await auth.api.invalidateSession(session.id)
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: error.message }, 500)
  }
})

export default router
