import { Hono } from 'hono'
import { z } from 'zod'
import { drizzle } from 'drizzle-orm/d1'
import { nanoid } from 'nanoid'
import { profile } from '../db/schema'
import { eq } from 'drizzle-orm'
import type { Bindings, Variables } from '../types'

const router = new Hono<{
  Bindings: Bindings
  Variables: Variables
}>()

router.get('/check-username', async (c) => {
  const username = c.req.query('username')

  if (!username) {
    return c.json({ available: false, message: 'Username is required' }, 400)
  }

  const db = drizzle(c.env.DB)

  const existingProfile = await db
    .select()
    .from(profile)
    .where(eq(profile.username, username))
    .get()

  return c.json({ available: !existingProfile })
})

router.post('/', async (c) => {
  const user = c.get('user')

  const schema = z.object({
    userId: z.string().uuid(),
    username: z.string().min(3).max(30),
    bio: z.string().max(160).nullable().optional(),
    profileImage: z.string().nullable().optional(),
  })

  try {
    const body = await c.req.json()
    const data = schema.parse(body)

    if (data.userId !== user.id) {
      return c.json({ message: 'Unauthorized' }, 403)
    }

    const db = drizzle(c.env.DB)

    const existingProfile = await db
      .select()
      .from(profile)
      .where(eq(profile.username, data.username))
      .get()

    if (existingProfile) {
      return c.json({ message: 'Username already taken' }, 400)
    }

    const newProfile = {
      id: nanoid(),
      userId: data.userId,
      username: data.username,
      bio: data.bio || null,
      profileImage: data.profileImage || null,
      verifiedType: 'none',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await db.insert(profile).values(newProfile)

    return c.json(newProfile, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ message: 'Invalid input', errors: error.errors }, 400)
    }

    console.error('Error creating profile:', error)
    return c.json({ message: 'Failed to create profile' }, 500)
  }
})

router.get('/check/:userId', async (c) => {
  const userId = c.req.param('userId')
  const db = drizzle(c.env.DB)

  const existingProfile = await db.select().from(profile).where(eq(profile.userId, userId)).get()

  return c.json({ exists: Boolean(existingProfile) })
})

router.get('/:userId', async (c) => {
  const userId = c.req.param('userId')
  const db = drizzle(c.env.DB)

  try {
    const userProfile = await db.select().from(profile).where(eq(profile.userId, userId)).get()

    if (!userProfile) {
      return c.json({ message: 'Profile not found' }, 404)
    }

    return c.json(userProfile)
  } catch (error) {
    console.error('Error fetching profile:', error)
    return c.json({ message: 'Failed to fetch profile' }, 500)
  }
})

router.delete('/:userId', async (c) => {
  const userId = c.req.param('userId')
  const user = c.get('user')

  if (userId !== user.id) {
    return c.json({ message: 'Unauthorized' }, 403)
  }

  const db = drizzle(c.env.DB)

  try {
    const userProfile = await db.select().from(profile).where(eq(profile.userId, userId)).get()

    if (!userProfile) {
      return c.json({ message: 'Profile not found' }, 404)
    }
    await db.delete(profile).where(eq(profile.userId, userId))

    // Note: This does not cascade delete related data like posts, comments, etc.
    // In a production environment, you would want to handle that too

    return c.json({ message: 'Profile deleted successfully' })
  } catch (error) {
    console.error('Error deleting profile:', error)
    return c.json({ message: 'Failed to delete profile' }, 500)
  }
})

export default router
