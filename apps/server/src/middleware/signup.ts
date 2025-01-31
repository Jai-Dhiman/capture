import { drizzle } from 'drizzle-orm/d1'
import { profile } from 'db/schema'
import { jwtVerify } from 'jose'

export interface Env {
  DB: D1Database
  SUPABASE_JWT_SECRET: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const token = request.headers.get('Authorization')?.split('Bearer ')[1]
    if (!token) {
      return new Response('Unauthorized', { status: 401 })
    }

    try {
      const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
      const { payload } = await jwtVerify(token, secret)

      const userId = payload.sub
      const email = payload.email as string

      if (!userId || !email) {
        return new Response('Invalid token', { status: 400 })
      }

      const db = drizzle(env.DB)

      await db
        .insert(profile)
        .values({
          id: userId,
          email: email,
          username: email.split('@')[0],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: profile.id,
          set: { email: email, username: email.split('@')[0] },
        })

      return new Response('Profile created/updated', { status: 200 })
    } catch (error) {
      console.error(error)
      return new Response('Internal server error', { status: 500 })
    }
  },
}
