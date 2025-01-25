import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createDb } from '../db'

export const auth = betterAuth({
  database: drizzleAdapter(createDb, {
    provider: 'sqlite',
  }),
  emailAndPassword: {
    enabled: true,
  },
})
