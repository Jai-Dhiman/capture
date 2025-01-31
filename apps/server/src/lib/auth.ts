import { jwtVerify } from 'jose'
import { user } from '../db/schema'

export default {
  async fetch(request: Request, env: Env) {
    const token = request.headers.get('Authorization')?.split('Bearer ')[1]
    if (!token) return new Response('Unauthorized', { status: 401 })

    try {
      // Verify JWT using Supabase's secret key
      const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
      const { payload } = await jwtVerify(token, secret)

      // Get user from D1 (optional: create if new)
      const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
        .bind(payload.sub)
        .first()

      if (!user) {
        // Create a new user in D1
        await env.DB.prepare('INSERT INTO users (id, email) VALUES (?, ?)')
          .bind(payload.sub, payload.email)
          .run()
      }

      // Proceed with your API logic here
      return new Response('Authenticated!')
    } catch (error) {
      return new Response('Invalid token', { status: 401 })
    }
  },
}

interface Env {
  DB: D1Database
  SUPABASE_JWT_SECRET: string
}
