import { createDb } from 'db'
import { Hono } from 'hono'
import * as schema from 'db/schema'

type Bindings = {
  DATABASE_URL: string
}

const healthRouter = new Hono<{
  Bindings: Bindings
}>()

healthRouter.get('/', async (c) => {
  try {
    const dbInstance = createDb(c.env)
    const result = await dbInstance.select().from(schema.user).limit(1)

    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      dbCheck: result.length > 0 ? 'records exist' : 'no records',
    })
  } catch (error) {
    console.error('Database health check failed:', error)
    return c.json(
      {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: 'error',
        error: error instanceof Error ? error.message : 'Unknown database error',
      },
      500
    )
  }
})

healthRouter.get('/api/test-db', async (c) => {
  const db = createDb(c.env)

  try {
    const result = await db.select().from(schema.user).limit(1)
    return c.json({ result })
  } catch (error) {
    console.error('Database connection failed:', error)
    return c.json({ error: 'Database connection failed' }, 500)
  }
})

export default healthRouter
