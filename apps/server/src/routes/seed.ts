import { Hono } from 'hono';
import { createD1Client } from '../db';
import { seedDatabase } from '../lib/database/seedDatabase';
import type { Bindings, Variables } from '../types';

const seedRouter = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

seedRouter.post('/', async (c) => {
  const providedSecret = c.req.header('x-seed-secret');
  const expectedSecret = c.env.SEED_SECRET;

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = createD1Client(c.env);

  try {
    // Parse query parameters for optional parameters
    const url = new URL(c.req.url);
    const userCount = Number.parseInt(url.searchParams.get('userCount') || '50');
    const postsPerUser = Number.parseInt(url.searchParams.get('postsPerUser') || '5');
    const commentsPerPost = Number.parseInt(url.searchParams.get('commentsPerPost') || '3');

    const result = await seedDatabase(db, c.env, userCount, postsPerUser, commentsPerPost);
    return c.json({
      message: 'Database seeded successfully!',
      ...result,
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    return c.json({ error: 'Failed to seed database' }, 500);
  }
});

export default seedRouter;
