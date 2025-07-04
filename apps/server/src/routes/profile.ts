import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { profile } from '../db/schema';
import type { Bindings, Variables } from '../types';

const router = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

router.get('/check-username', async (c) => {
  const username = c.req.query('username');

  if (!username) {
    return c.json({ available: false, message: 'Username is required' }, 400);
  }

  const db = drizzle(c.env.DB);

  const existingProfile = await db
    .select()
    .from(profile)
    .where(eq(profile.username, username))
    .get();

  return c.json({ available: !existingProfile });
});

router.post('/', async (c) => {
  const user = c.get('user');

  const schema = z.object({
    userId: z.string(),
    username: z.string().min(3).max(30),
    bio: z.string().max(160).nullable().optional(),
    profileImage: z.string().nullable().optional(),
  });

  try {
    const body = await c.req.json();

    const data = schema.parse(body);

    if (data.userId !== user.id) {
      return c.json({ message: 'Unauthorized' }, 403);
    }

    const db = drizzle(c.env.DB);

    const existingProfile = await db
      .select()
      .from(profile)
      .where(eq(profile.username, data.username))
      .get();

    if (existingProfile) {
      return c.json({ message: 'Username already taken' }, 400);
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
    };

    await db.insert(profile).values(newProfile);

    return c.json(newProfile, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Profile validation error:', {
        userId: user?.id,
        errors: error.errors,
        receivedData: error.issues,
      });
      return c.json({ message: 'Invalid input', errors: error.errors }, 400);
    }

    console.error('Profile creation error:', {
      userId: user?.id,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
    });
    return c.json({ message: 'Failed to create profile' }, 500);
  }
});

router.delete('/:userId', async (c) => {
  const userId = c.req.param('userId');
  const user = c.get('user');

  if (userId !== user.id) {
    return c.json({ message: 'Unauthorized' }, 403);
  }

  const db = drizzle(c.env.DB);

  try {
    const userProfile = await db.select().from(profile).where(eq(profile.userId, userId)).get();

    if (!userProfile) {
      return c.json({ message: 'Profile not found' }, 404);
    }
    await db.delete(profile).where(eq(profile.userId, userId));

    // Note: This does not cascade delete related data like posts, comments, etc.
    // In a production environment, you would want to handle that too

    return c.json({ message: 'Profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting profile:', error);
    return c.json({ message: 'Failed to delete profile' }, 500);
  }
});

export default router;
