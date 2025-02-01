import { Context } from 'hono'
import { jwtVerify } from 'jose'

export async function authMiddleware(c: Context, next: Function) {
  const jwt = c.req.header('Authorization')?.split('Bearer ')[1]

  if (!jwt) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    // Fetch Supabase's public key from JWKS endpoint
    const jwksUrl = `${SUPABASE_URL}/auth/v1/jwks`
    const { publicKey } = await fetchPublicKey(jwksUrl, 'supabase')

    // Verify JWT
    const { payload } = await jwtVerify(jwt, publicKey, { issuer: 'supabase' })

    // Attach user ID to context
    c.set('userId', payload.sub)
    await next()
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401)
  }
}

// Helper to fetch Supabase public key
async function fetchPublicKey(url: string, kid: string) {
  const res = await fetch(url)
  const jwks = await res.json()
  const key = jwks.keys.find((k: any) => k.kid === kid)
  return importJWK(key)
}
