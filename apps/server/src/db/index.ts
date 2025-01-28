import { Pool } from 'pg'
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { schema } from './schema'

interface Env {
  DATABASE_URL: string
}

export function createDb(env: Env): NodePgDatabase<typeof schema> {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
  })
  return drizzle(pool, { schema })
}
