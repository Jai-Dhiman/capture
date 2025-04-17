import { Hono } from 'hono';
import { createD1Client } from '../db';
import { seedDatabase } from '../lib/seedDatabase';
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
  const result = await seedDatabase(db);
  return c.json({
    message: 'Database seeded!',
    ...result,
  });
});

export default seedRouter;
