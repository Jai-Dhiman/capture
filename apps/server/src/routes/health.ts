import { createDb } from 'db'
import { Hono } from 'hono'
import { schema } from 'db/schema'
import { PgTable } from 'drizzle-orm/pg-core'

type Bindings = {
  DATABASE_URL: string
}

const healthRouter = new Hono<{
  Bindings: Bindings
}>()

healthRouter.get('/', async (c) => {
  try {
    const dbInstance = createDb(c.env)
    const result = await dbInstance
      .select()
      .from(schema.user as PgTable | any)
      .limit(1)

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

export default healthRouter
