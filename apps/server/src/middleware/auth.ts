import type { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import type { AppUser, Bindings, Variables } from '../types';

export async function authMiddleware(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  next: Next,
) {
  // Development bypass for localhost dashboard access
  const origin = c.req.header('Origin');
  const userAgent = c.req.header('User-Agent');

  // Allow requests from localhost during development
  if (origin?.includes('localhost') || userAgent?.includes('localhost')) {
    console.log('[AuthMiddleware] Development bypass activated for localhost');
    // Set a mock user for development
    const mockUser: AppUser = {
      id: 'dev-admin-user',
      email: 'admin@localhost.dev',
    };
    c.set('user', mockUser);
    await next();
    return;
  }

  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return c.json({ error: 'Unauthorized: No token' }, 401);
  }

  try {
    if (!c.env.JWT_SECRET) {
      console.error('[AuthMiddleware] Error: JWT_SECRET is not configured.');
      return c.json({ error: 'Internal Server Error: Auth configuration missing' }, 500);
    }

    const payload = await verify(token, c.env.JWT_SECRET);

    // Runtime checks for payload properties
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
      return c.json({ error: 'Invalid token: Payload structure issue' }, 401);
    }

    const emailFromPayload = typeof payload.email === 'string' ? payload.email : undefined;

    // Check if token is expired (verify should handle this, but an explicit check is fine too)
    if (Date.now() > payload.exp * 1000) {
      return c.json({ error: 'Token expired' }, 401);
    }

    const userContext: AppUser = {
      id: payload.sub, // Now known to be a string
      email: emailFromPayload, // Now string or undefined
    };

    c.set('user', userContext);
    await next();
  } catch (e) {
    const error = e as Error;
    console.error('[AuthMiddleware] JWT verification error:', error.message);
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}
