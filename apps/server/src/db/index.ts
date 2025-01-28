import { Pool } from 'pg'
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { schema } from './schema'
import { Bindings } from 'types'

export function createDb(env: Bindings): NodePgDatabase<typeof schema> {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
  })
  return drizzle(pool, { schema })
}
