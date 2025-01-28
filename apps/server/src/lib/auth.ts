import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createDb } from 'db'
import { schema } from 'db/schema'

export function createAuth(env: { DATABASE_URL: string }) {
  return betterAuth({
    database: drizzleAdapter(createDb(env), {
      provider: 'pg',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
  })
}
