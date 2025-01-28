import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { schema } from './schema'

interface Env {
  DATABASE_URL: string
}

export function createDb(env: Env) {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
  })
  return drizzle(pool, { schema })
}
