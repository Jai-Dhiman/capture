import { createD1Client } from '@/db';
import * as schema from '@/db/schema';
import type { Bindings } from '@/types';
import { Hono } from 'hono';

const healthRouter = new Hono<{
  Bindings: Bindings;
}>();

healthRouter.get('/', async (c) => {
  try {
    const dbInstance = createD1Client(c.env);
    const result = await dbInstance.select().from(schema.profile).limit(1).execute();

    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      dbCheck: result.length > 0 ? 'records exist' : 'no records',
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    return c.json(
      {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: 'error',
        error: error instanceof Error ? error.message : 'Unknown database error',
      },
      500,
    );
  }
});

export default healthRouter;
