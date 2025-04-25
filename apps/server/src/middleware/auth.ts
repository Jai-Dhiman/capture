import type { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createClient } from '@supabase/supabase-js';

export async function authMiddleware(c: Context, next: Next) {
  console.log('[AuthMiddleware] Executing...');
  const authHeader = c.req.header('Authorization');

  console.log('[AuthMiddleware] Checking Authorization header...');
  if (!authHeader?.startsWith('Bearer ')) {
    console.error('[AuthMiddleware] Error: Invalid Authorization header format.');
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  console.log('[AuthMiddleware] Authorization header OK.');

  const token = authHeader.split(' ')[1];

  try {
    console.log('[AuthMiddleware] Checking Supabase config...');
    if (!c.env.SUPABASE_URL || !c.env.SUPABASE_KEY) {
      console.error('[AuthMiddleware] Error: Supabase URL or Key is missing.');
      throw new Error('Missing Supabase configuration');
    }
    console.log('[AuthMiddleware] Supabase config OK.');

    console.log('[AuthMiddleware] Creating Supabase client...');
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_KEY);
    console.log('[AuthMiddleware] Supabase client created.');

    console.log('[AuthMiddleware] Authenticating user with token...');
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('[AuthMiddleware] Supabase auth error or no user returned.');
      throw new HTTPException(401, { message: 'Invalid token' });
    }

    console.log('[AuthMiddleware] Authentication successful. User ID:', user.id);
    const userContext = {
      id: user.id,
      email: user.email,
      role: user.role,
      ...user.user_metadata,
    };

    c.set('user', userContext);
    console.log('[AuthMiddleware] Calling next()...');
    await next();
    console.log('[AuthMiddleware] next() returned.');
  } catch (error) {
    console.error('[AuthMiddleware] Caught error:', error);
    if (error instanceof HTTPException) {
      console.log('[AuthMiddleware] Re-throwing HTTPException:', error.status);
      throw error; // Re-throw Hono exceptions
    }
    // For unexpected errors not already wrapped in HTTPException
    console.error('[AuthMiddleware] Throwing generic 500 error for unexpected issue.');
    throw new HTTPException(500, { message: 'Internal Server Error' });
  }
}
