import { Hono } from 'hono'
import { authMiddleware } from 'middleware/jwt'
import type { Bindings } from 'types'

const profileRouter = new Hono<{
  Bindings: Bindings
}>()

profileRouter.post('/profile', authMiddleware, async (c) => {
  const { username, bio, phone } = await c.req.json()
  const supabaseUserId = c.get('userId') // From middleware

  // Insert into D1
  try {
    await c.env.DB.prepare(
      `
      INSERT INTO profiles (supabase_user_id, username, bio, phone)
      VALUES (?1, ?2, ?3, ?4)
    `
    )
      .bind(supabaseUserId, username, bio, phone)
      .run()

    return c.json({ success: true })
  } catch (err) {
    // Handle uniqueness errors (e.g., duplicate username)
    return c.json({ error: 'Username already taken' }, 400)
  }
})

profileRouter.get('/profile', authMiddleware, async (c) => {
  const supabaseUserId = c.get('userId')

  const profile = await c.env.DB.prepare(
    `
    SELECT * FROM profiles WHERE supabase_user_id = ?1
  `
  )
    .bind(supabaseUserId)
    .first()

  return c.json(profile)
})

export default profileRouter
