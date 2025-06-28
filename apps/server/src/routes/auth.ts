import type { AuthenticatorTransport, AuthenticatorTransportFuture } from '@simplewebauthn/types';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { createD1Client } from '../db';
import * as schema from '../db/schema';
import { createEmailService } from '../lib/emailService';
import { exchangeGoogleCode, validateGoogleAccessToken, verifyAppleToken } from '../lib/oauthUtils';
import { PasskeyService as PS, PasskeyService } from '../lib/passkeyService';
import { authMiddleware } from '../middleware/auth';
import { authRateLimiter, otpRateLimiter } from '../middleware/rateLimit';
import type { Bindings, Variables } from '../types';

const router = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Validation schemas
const sendCodeSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(), // For registration
});

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  phone: z.string().optional(), // For registration
});

const refreshTokenSchema = z.object({
  refresh_token: z.string(),
});

// OAuth validation schemas
const oauthGoogleSchema = z.object({
  code: z.string(),
  codeVerifier: z.string(),
  redirectUri: z.string(),
});

const oauthAppleSchema = z.object({
  code: z.string(),
  identityToken: z.string(),
});

// Passkey validation schemas
const passkeyRegistrationCompleteSchema = z.object({
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      attestationObject: z.string(),
      clientDataJSON: z.string(),
    }),
    type: z.literal('public-key'),
    clientExtensionResults: z.object({}).optional(),
  }),
  deviceName: z.string().optional(),
});

const passkeyAuthenticationBeginSchema = z.object({
  email: z.string().email(),
});

const passkeyAuthenticationCompleteSchema = z.object({
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      authenticatorData: z.string(),
      clientDataJSON: z.string(),
      signature: z.string(),
      userHandle: z.string().optional(),
    }),
    type: z.literal('public-key'),
    clientExtensionResults: z.object({}).optional(),
  }),
});

// Constants
const REFRESH_TOKEN_EXPIRATION_SECONDS = 60 * 60 * 24 * 7; // 7 days
const CODE_EXPIRATION_MINUTES = 10;

// Helper functions
function generateSecureCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function getUserSecurityStatus(db: any, userId: string) {
  try {
    // Check if user has any passkeys
    const passkeys = await db
      .select({ id: schema.passkeys.id })
      .from(schema.passkeys)
      .where(eq(schema.passkeys.userId, userId))
      .limit(1);

    const hasPasskeys = passkeys.length > 0;

    // For now, we only check passkeys. In the future, we can add other MFA methods here
    const hasAnyMFA = hasPasskeys;

    return {
      securitySetupRequired: !hasAnyMFA,
      hasPasskeys,
    };
  } catch (error) {
    console.error('Error checking user security status:', error);
    // Default to requiring security setup if there's an error
    return {
      securitySetupRequired: true,
      hasPasskeys: false,
    };
  }
}

async function generateJwtToken(
  userId: string,
  email: string,
  env: Bindings,
): Promise<{ accessToken: string; refreshToken: string; accessTokenExpiresAt: number }> {
  if (!env.JWT_SECRET) {
    console.error('JWT_SECRET is not defined in environment variables.');
    throw new Error('JWT_SECRET not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const accessTokenPayload = {
    sub: userId,
    email: email,
    iat: now,
    exp: now + 15 * 60, // 15 minutes from now
  };
  const accessToken = await sign(accessTokenPayload, env.JWT_SECRET);
  const accessTokenExpiresAt = accessTokenPayload.exp * 1000; // convert to milliseconds for client

  const refreshToken = nanoid(64);

  if (env.REFRESH_TOKEN_KV) {
    await env.REFRESH_TOKEN_KV.put(`rt_${refreshToken}`, userId, {
      expirationTtl: REFRESH_TOKEN_EXPIRATION_SECONDS,
    });
  } else {
    console.warn('REFRESH_TOKEN_KV is not available. Refresh token will not be stored.');
  }

  return { accessToken, refreshToken, accessTokenExpiresAt };
}

async function cleanupExpiredCodes(db: any) {
  const now = Date.now().toString();
  await db.delete(schema.emailCodes).where(lt(schema.emailCodes.expiresAt, now)).execute();
}

// Get current user info
router.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = createD1Client(c.env);
  let profileExists = false;
  try {
    const existingProfile = await db
      .select()
      .from(schema.profile)
      .where(eq(schema.profile.userId, user.id))
      .get();
    profileExists = Boolean(existingProfile);
  } catch (e) {
    console.error('Error checking profile existence in /auth/me:', e);
  }

  // Get security status
  const securityStatus = await getUserSecurityStatus(db, user.id);

  return c.json({
    id: user.id,
    email: user.email,
    profileExists,
    ...securityStatus,
  });
});

router.post('/send-code', otpRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = sendCodeSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
          code: 'auth/invalid-input',
        },
        400,
      );
    }

    const { email } = validation.data;
    const db = createD1Client(c.env);

    // Clean up expired codes first
    await cleanupExpiredCodes(db);

    // Check if user exists
    const existingUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .get();
    const isNewUser = !existingUser;

    // Generate and store code
    const code = generateSecureCode();
    const expiresAt = Date.now() + CODE_EXPIRATION_MINUTES * 60 * 1000;

    await db.insert(schema.emailCodes).values({
      id: nanoid(),
      email,
      code,
      type: 'login_register',
      expiresAt: expiresAt.toString(),
    });

    // Send email
    try {
      const emailService = createEmailService(c.env);
      await emailService.sendVerificationCode(email, code, 'login_register');
    } catch (emailError) {
      console.error('Failed to send email:', emailError);

      // Check if it's a configuration issue
      if (emailError instanceof Error && emailError.message.includes('RESEND_API_KEY')) {
        return c.json(
          {
            error: 'Email service is not configured. Please contact support.',
            code: 'auth/email-service-unavailable',
          },
          503,
        );
      }

      // Generic email send failure
      return c.json(
        {
          error: 'Unable to send verification code. Please check your email address and try again.',
          code: 'auth/email-send-failed',
        },
        500,
      );
    }

    const message = isNewUser
      ? "Welcome! We've sent a verification code to your email."
      : "Welcome back! We've sent a verification code to your email.";

    return c.json({
      success: true,
      message,
      isNewUser,
    });
  } catch (error) {
    console.error('Send code error:', error);
    return c.json({ error: 'Failed to send verification code', code: 'auth/server-error' }, 500);
  }
});

router.post('/verify-code', authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = verifyCodeSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
          code: 'auth/invalid-input',
        },
        400,
      );
    }

    const { email, code, phone } = validation.data;
    const db = createD1Client(c.env);

    // Clean up expired codes
    await cleanupExpiredCodes(db);

    // Verify code - first get all matching codes, then filter in JavaScript
    const allMatchingCodes = await db
      .select()
      .from(schema.emailCodes)
      .where(
        and(
          eq(schema.emailCodes.email, email),
          eq(schema.emailCodes.code, code),
          eq(schema.emailCodes.type, 'login_register'),
        ),
      )
      .limit(10);

    // Filter for unused codes in JavaScript
    const storedCode = allMatchingCodes.find((c) => c.usedAt === null);

    if (!storedCode) {
      return c.json(
        { error: 'Invalid or expired verification code', code: 'auth/invalid-code' },
        401,
      );
    }

    // Check if code is expired
    if (Date.now() > Number.parseInt(storedCode.expiresAt)) {
      return c.json({ error: 'Verification code has expired', code: 'auth/code-expired' }, 401);
    }

    // Mark code as used
    await db
      .update(schema.emailCodes)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(schema.emailCodes.id, storedCode.id));

    // Check if user exists or create new user
    let user = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    let isNewUser = false;

    if (!user) {
      // Create new user
      const userId = nanoid();
      await db.insert(schema.users).values({
        id: userId,
        email,
        emailVerified: 1, // Email is verified through code
        phone: phone || null,
        phoneVerified: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
      isNewUser = true;
    } else {
      // Update existing user
      const updateData: any = {
        emailVerified: 1,
        updatedAt: new Date().toISOString(),
      };

      // Update phone if provided and different
      if (phone && phone !== user.phone) {
        updateData.phone = phone;
        updateData.phoneVerified = 0; // Reset phone verification
      }

      await db.update(schema.users).set(updateData).where(eq(schema.users.id, user.id));

      // Refresh user data
      user = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).get();
    }

    if (!user) {
      return c.json(
        { error: 'Failed to create or update user', code: 'auth/user-creation-failed' },
        500,
      );
    }

    // Generate tokens
    const { accessToken, refreshToken, accessTokenExpiresAt } = await generateJwtToken(
      user.id,
      user.email,
      c.env,
    );

    // Check if profile exists
    let profileExists = false;
    try {
      const existingProfile = await db
        .select({ id: schema.profile.id })
        .from(schema.profile)
        .where(eq(schema.profile.userId, user.id))
        .get();
      profileExists = Boolean(existingProfile);

      // Log activity
      if (!isNewUser) {
        await db
          .insert(schema.userActivity)
          .values({
            id: nanoid(),
            userId: user.id,
            eventType: 'login',
            createdAt: new Date().toISOString(),
          })
          .execute();
      }
    } catch (dbError) {
      console.error('Error during profile check or activity logging:', dbError);
    }

    // Get security status
    const securityStatus = await getUserSecurityStatus(db, user.id);

    return c.json({
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: accessTokenExpiresAt,
      },
      user: {
        id: user.id,
        email: user.email,
      },
      profileExists,
      isNewUser,
      ...securityStatus,
    });
  } catch (error) {
    console.error('Verify code error:', error);
    return c.json({ error: 'Internal server error', code: 'auth/server-error' }, 500);
  }
});

router.post('/refresh', authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = refreshTokenSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: 'Invalid input',
          code: 'auth/invalid-input',
        },
        400,
      );
    }

    const { refresh_token } = validation.data;

    if (!c.env.REFRESH_TOKEN_KV) {
      return c.json(
        { error: 'Token refresh capability not configured.', code: 'auth/kv-not-configured' },
        500,
      );
    }

    const storedUserId = await c.env.REFRESH_TOKEN_KV.get(`rt_${refresh_token}`);
    if (!storedUserId) {
      return c.json(
        { error: 'Invalid or expired refresh token', code: 'auth/invalid-refresh-token' },
        401,
      );
    }

    // Invalidate the used refresh token immediately
    await c.env.REFRESH_TOKEN_KV.delete(`rt_${refresh_token}`);

    const db = createD1Client(c.env);
    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, storedUserId))
      .get();

    if (!user) {
      return c.json(
        { error: 'User not found for refresh token', code: 'auth/user-not-found' },
        401,
      );
    }

    // Generate new tokens
    const {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      accessTokenExpiresAt: newAccessTokenExpiresAt,
    } = await generateJwtToken(user.id, user.email, c.env);

    // Check profile existence
    let profileExists = false;
    try {
      const existingProfile = await db
        .select({ id: schema.profile.id })
        .from(schema.profile)
        .where(eq(schema.profile.userId, user.id))
        .get();
      profileExists = Boolean(existingProfile);
    } catch (dbProfileError) {
      console.error('Error checking profile during token refresh:', dbProfileError);
    }

    return c.json({
      session: {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_at: newAccessTokenExpiresAt,
      },
      user: {
        id: user.id,
        email: user.email,
      },
      profileExists,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json({ error: 'Failed to refresh token', code: 'auth/server-error' }, 500);
  }
});

router.post('/logout', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const refreshTokenToInvalidate = body.refresh_token;

  if (refreshTokenToInvalidate && c.env.REFRESH_TOKEN_KV) {
    await c.env.REFRESH_TOKEN_KV.delete(`rt_${refreshTokenToInvalidate}`);
  }

  return c.json({ success: true, message: 'Logged out successfully.' });
});

// OAuth endpoints
router.post('/oauth/google', authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = oauthGoogleSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
          code: 'auth/invalid-input',
        },
        400,
      );
    }

    const { code, codeVerifier, redirectUri } = validation.data;

    if (!c.env.GOOGLE_CLIENT_ID_IOS && !c.env.GOOGLE_CLIENT_ID) {
      return c.json(
        {
          error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID_IOS environment variable.',
          code: 'auth/oauth-not-configured',
        },
        500,
      );
    }

    // Exchange code for user info using the same iOS client ID
    const googleUser = await exchangeGoogleCode(code, codeVerifier, redirectUri, c.env);

    if (!googleUser.email) {
      return c.json(
        { error: 'Failed to get user email from Google', code: 'auth/oauth-failed' },
        400,
      );
    }

    const db = createD1Client(c.env);

    // Check if user exists or create new user
    let user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, googleUser.email))
      .get();
    let isNewUser = false;

    if (!user) {
      // Create new user
      const userId = nanoid();
      await db.insert(schema.users).values({
        id: userId,
        email: googleUser.email,
        emailVerified: googleUser.verified_email ? 1 : 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
      isNewUser = true;
    } else {
      // Update existing user
      await db
        .update(schema.users)
        .set({
          emailVerified: googleUser.verified_email ? 1 : 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.users.id, user.id));

      // Refresh user data
      user = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).get();
    }

    if (!user) {
      return c.json(
        { error: 'Failed to create or update user', code: 'auth/user-creation-failed' },
        500,
      );
    }

    // Generate tokens
    const { accessToken, refreshToken, accessTokenExpiresAt } = await generateJwtToken(
      user.id,
      user.email,
      c.env,
    );

    // Check if profile exists
    let profileExists = false;
    try {
      const existingProfile = await db
        .select({ id: schema.profile.id })
        .from(schema.profile)
        .where(eq(schema.profile.userId, user.id))
        .get();
      profileExists = Boolean(existingProfile);

      // Log activity
      if (!isNewUser) {
        await db
          .insert(schema.userActivity)
          .values({
            id: nanoid(),
            userId: user.id,
            eventType: 'oauth_login',
            createdAt: new Date().toISOString(),
          })
          .execute();
      }
    } catch (dbError) {
      console.error('Error during profile check or activity logging:', dbError);
    }

    // Get security status
    const securityStatus = await getUserSecurityStatus(db, user.id);

    return c.json({
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: accessTokenExpiresAt,
      },
      user: {
        id: user.id,
        email: user.email,
      },
      profileExists,
      isNewUser,
      ...securityStatus,
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    console.error('Google OAuth error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      env: {
        GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID ? 'PRESENT' : 'MISSING',
        GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET ? 'PRESENT' : 'MISSING',
      },
    });
    return c.json({ error: 'Google OAuth authentication failed', code: 'auth/oauth-failed' }, 500);
  }
});

// Google OAuth client-side token exchange
router.post('/oauth/google/token', authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = z
      .object({
        idToken: z.string(), // Changed from accessToken to idToken
      })
      .safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
          code: 'auth/invalid-input',
        },
        400,
      );
    }

    const { idToken } = validation.data;

    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
    );

    if (!tokenInfoResponse.ok) {
      console.error('❌ Failed to verify Google ID token:', {
        status: tokenInfoResponse.status,
        statusText: tokenInfoResponse.statusText,
      });
      return c.json({ error: 'Invalid Google ID token', code: 'auth/invalid-token' }, 401);
    }

    const tokenInfo = (await tokenInfoResponse.json()) as any;

    // Verify the audience (client ID) matches our expected client ID
    // The Google Sign-In SDK uses the web client ID for ID token audience
    const expectedClientId = c.env.GOOGLE_CLIENT_ID || c.env.GOOGLE_CLIENT_ID_IOS;
    if (tokenInfo.aud !== expectedClientId) {
      console.error('❌ ID token audience mismatch:', {
        expected: expectedClientId ? `${expectedClientId.substring(0, 20)}...` : 'MISSING',
        received: tokenInfo.aud ? `${tokenInfo.aud.substring(0, 20)}...` : 'MISSING',
        expectedSource: c.env.GOOGLE_CLIENT_ID ? 'GOOGLE_CLIENT_ID (web)' : 'GOOGLE_CLIENT_ID_IOS',
        sdkNote: 'Google Sign-In SDK uses webClientId for ID token audience',
      });
      return c.json({ error: 'ID token audience mismatch', code: 'auth/invalid-audience' }, 401);
    }

    if (!tokenInfo.email) {
      return c.json(
        { error: 'Failed to get user email from Google ID token', code: 'auth/oauth-failed' },
        400,
      );
    }

    const db = createD1Client(c.env);

    // Check if user exists or create new user
    let user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, tokenInfo.email))
      .get();
    let isNewUser = false;

    if (!user) {
      // Create new user
      const userId = nanoid();
      await db.insert(schema.users).values({
        id: userId,
        email: tokenInfo.email,
        emailVerified:
          tokenInfo.email_verified === 'true' || tokenInfo.email_verified === true ? 1 : 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
      isNewUser = true;
    } else {
      // Update existing user
      await db
        .update(schema.users)
        .set({
          emailVerified:
            tokenInfo.email_verified === 'true' || tokenInfo.email_verified === true ? 1 : 0,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.users.id, user.id));

      // Refresh user data
      user = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).get();
    }

    if (!user) {
      return c.json(
        { error: 'Failed to create or update user', code: 'auth/user-creation-failed' },
        500,
      );
    }

    // Generate tokens
    const { accessToken, refreshToken, accessTokenExpiresAt } = await generateJwtToken(
      user.id,
      user.email,
      c.env,
    );

    // Check if profile exists
    let profileExists = false;
    try {
      const existingProfile = await db
        .select({ id: schema.profile.id })
        .from(schema.profile)
        .where(eq(schema.profile.userId, user.id))
        .get();
      profileExists = Boolean(existingProfile);

      // Log activity
      if (!isNewUser) {
        await db
          .insert(schema.userActivity)
          .values({
            id: nanoid(),
            userId: user.id,
            eventType: 'oauth_login',
            createdAt: new Date().toISOString(),
          })
          .execute();
      }
    } catch (dbError) {
      console.error('Error during profile check or activity logging:', dbError);
    }

    // Get security status
    const securityStatus = await getUserSecurityStatus(db, user.id);

    const response = {
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: accessTokenExpiresAt,
      },
      user: {
        id: user.id,
        email: user.email,
      },
      profileExists,
      isNewUser,
      ...securityStatus,
    };

    return c.json(response);
  } catch (error) {
    console.error('❌ Google OAuth token validation error:', error);
    return c.json(
      { error: 'Google OAuth token validation failed', code: 'auth/oauth-failed' },
      500,
    );
  }
});

router.post('/oauth/apple', authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = oauthAppleSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
          code: 'auth/invalid-input',
        },
        400,
      );
    }

    const { identityToken } = validation.data;

    if (!c.env.APPLE_CLIENT_ID) {
      return c.json(
        { error: 'Apple OAuth not configured', code: 'auth/oauth-not-configured' },
        500,
      );
    }

    const db = createD1Client(c.env);

    // Verify Apple identity token
    const appleUser = await verifyAppleToken(identityToken, c.env);

    let user = null;
    let isNewUser = false;

    if (!appleUser.email) {
      // Check if we have an existing user with this Apple ID (sub)
      const existingUserBySub = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.appleId, appleUser.sub))
        .get();

      if (existingUserBySub) {
        user = existingUserBySub;
      } else {
        return c.json(
          {
            error:
              'Email required for new Apple Sign-In users. Please sign out of Apple ID and try again to share email.',
            code: 'auth/email-required',
          },
          400,
        );
      }
    } else {
      // Check if user exists by email or Apple ID
      const existingUserByEmail = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, appleUser.email))
        .get();

      const existingUserByAppleId = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.appleId, appleUser.sub))
        .get();

      user = existingUserByEmail || existingUserByAppleId;

      if (!user) {
        // Create new user
        const userId = nanoid();
        await db.insert(schema.users).values({
          id: userId,
          email: appleUser.email,
          emailVerified: appleUser.email_verified ? 1 : 0,
          appleId: appleUser.sub,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
        isNewUser = true;
      } else {
        // Update existing user with Apple ID if not set, and update email verification
        const updateData: any = {
          emailVerified: appleUser.email_verified ? 1 : 0,
          updatedAt: new Date().toISOString(),
        };

        // Link Apple ID to existing user if not already linked
        if (!user.appleId) {
          updateData.appleId = appleUser.sub;
        }

        await db.update(schema.users).set(updateData).where(eq(schema.users.id, user.id));

        // Refresh user data
        user = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).get();
      }
    }

    if (!user) {
      return c.json(
        { error: 'Failed to create or update user', code: 'auth/user-creation-failed' },
        500,
      );
    }

    // Generate tokens
    const { accessToken, refreshToken, accessTokenExpiresAt } = await generateJwtToken(
      user.id,
      user.email,
      c.env,
    );

    // Check if profile exists
    let profileExists = false;
    try {
      const existingProfile = await db
        .select({ id: schema.profile.id })
        .from(schema.profile)
        .where(eq(schema.profile.userId, user.id))
        .get();
      profileExists = Boolean(existingProfile);

      // Log activity
      if (!isNewUser) {
        await db
          .insert(schema.userActivity)
          .values({
            id: nanoid(),
            userId: user.id,
            eventType: 'oauth_login',
            createdAt: new Date().toISOString(),
          })
          .execute();
      }
    } catch (dbError) {
      console.error('Error during profile check or activity logging:', dbError);
    }

    const securityStatus = await getUserSecurityStatus(db, user.id);

    return c.json({
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: accessTokenExpiresAt,
      },
      user: {
        id: user.id,
        email: user.email,
      },
      profileExists,
      isNewUser,
      ...securityStatus,
    });
  } catch (error) {
    console.error('Apple OAuth error:', error);
    return c.json({ error: 'Apple OAuth authentication failed', code: 'auth/oauth-failed' }, 500);
  }
});

// Passkey endpoints
router.post('/passkey/register/begin', authMiddleware, authRateLimiter, async (c) => {
  try {
    // Get authenticated user
    const user = c.get('user');
    const db = createD1Client(c.env);
    const passkeyService = new PasskeyService(c.env);

    // Get existing passkeys to exclude
    const existingPasskeys = await db
      .select()
      .from(schema.passkeys)
      .where(eq(schema.passkeys.userId, user.id));

    const excludeCredentials = existingPasskeys.map((pk) => pk.credentialId);

    // Generate registration options
    const options = await passkeyService.generateRegistrationOptions(
      { id: user.id, email: user.email || '', displayName: user.email || user.id },
      excludeCredentials,
    );

    return c.json(options);
  } catch (error) {
    console.error('Passkey registration begin error:', error);
    return c.json(
      { error: 'Failed to begin passkey registration', code: 'auth/passkey-registration-failed' },
      500,
    );
  }
});

router.post('/passkey/register/complete', authMiddleware, authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = passkeyRegistrationCompleteSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
          code: 'auth/invalid-input',
        },
        400,
      );
    }

    const { credential, deviceName } = validation.data;
    const db = createD1Client(c.env);
    const passkeyService = new PasskeyService(c.env);

    // Get authenticated user
    const user = c.get('user');

    // Add missing clientExtensionResults if not present
    const credentialWithExtensions = {
      ...credential,
      clientExtensionResults: credential.clientExtensionResults || {},
    };

    const verification = await passkeyService.verifyRegistrationResponse(
      user.id,
      credentialWithExtensions,
    );

    if (!verification.verified || !verification.registrationInfo) {
      return c.json(
        { error: 'Passkey registration failed', code: 'auth/passkey-verification-failed' },
        400,
      );
    }

    // Store passkey in database
    const passkeyId = nanoid();
    const credentialInfo = verification.registrationInfo;

    const credentialId = typeof credentialInfo.credential.id === 'string'
      ? credentialInfo.credential.id
      : PS.uint8ArrayToBase64(credentialInfo.credential.id);
    
    const publicKey = PS.uint8ArrayToBase64(credentialInfo.credential.publicKey);

    await db.insert(schema.passkeys).values({
      id: passkeyId,
      userId: user.id,
      credentialId,
      publicKey,
      counter: credentialInfo.credential.counter,
      deviceName: deviceName || 'Unknown Device',
      createdAt: new Date().toISOString(),
    });

    return c.json({
      success: true,
      message: 'Passkey registered successfully',
      passkeyId,
    });
  } catch (error) {
    console.error('Passkey registration complete error:', error);
    return c.json(
      {
        error: 'Failed to complete passkey registration',
        code: 'auth/passkey-registration-failed',
      },
      500,
    );
  }
});

router.post('/passkey/authenticate/begin', authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = passkeyAuthenticationBeginSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
          code: 'auth/invalid-input',
        },
        400,
      );
    }

    const { email } = validation.data;
    const db = createD1Client(c.env);
    const passkeyService = new PasskeyService(c.env);

    // Check if user exists
    const user = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    if (!user) {
      return c.json({ error: 'User not found', code: 'auth/user-not-found' }, 404);
    }

    // Get user's passkeys
    const passkeys = await db
      .select()
      .from(schema.passkeys)
      .where(eq(schema.passkeys.userId, user.id));

    if (passkeys.length === 0) {
      return c.json({ error: 'No passkeys found for user', code: 'auth/no-passkeys-found' }, 404);
    }

    // Convert passkeys to device format
    const devices = passkeys.map((pk) => {
      // Ensure credentialId and publicKey are strings, with safety conversion
      const credentialId = pk.credentialId ? String(pk.credentialId) : null;
      const publicKey = pk.publicKey ? String(pk.publicKey) : null;
      
      if (!credentialId || typeof credentialId !== 'string') {
        console.error('Invalid credentialId:', pk.credentialId, typeof pk.credentialId);
        throw new Error(`Invalid credentialId: expected non-empty string, got ${typeof pk.credentialId}`);
      }
      if (!publicKey || typeof publicKey !== 'string') {
        console.error('Invalid publicKey:', pk.publicKey, typeof pk.publicKey);
        throw new Error(`Invalid publicKey: expected non-empty string, got ${typeof pk.publicKey}`);
      }

      return {
        credentialID: passkeyService.base64ToUint8Array(credentialId),
        credentialPublicKey: passkeyService.base64ToUint8Array(publicKey),
        counter: pk.counter,
        transports: ['hybrid'] as AuthenticatorTransportFuture[],
        credentialIdString: credentialId,
      };
    });

    // Generate authentication options
    const options = await passkeyService.generateAuthenticationOptions(devices);

    // Store challenge for later verification
    if (c.env.REFRESH_TOKEN_KV) {
      await c.env.REFRESH_TOKEN_KV.put(`passkey_auth_challenge_${user.id}`, options.challenge, {
        expirationTtl: 300, // 5 minutes
      });
    }

    // Transform the response to match mobile app expectations
    const response = {
      challenge: options.challenge,
      allowCredentials: options.allowCredentials || [],
      userVerification: options.userVerification || 'preferred',
      timeout: options.timeout || 300000,
      rpId: options.rpId,
    };

    return c.json(response);
  } catch (error) {
    console.error('Passkey authentication begin error:', error);
    return c.json(
      {
        error: 'Failed to begin passkey authentication',
        code: 'auth/passkey-authentication-failed',
      },
      500,
    );
  }
});

router.post('/passkey/authenticate/complete', authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = passkeyAuthenticationCompleteSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
          code: 'auth/invalid-input',
        },
        400,
      );
    }

    const { credential } = validation.data;
    const db = createD1Client(c.env);
    const passkeyService = new PasskeyService(c.env);

    // Find passkey by credential ID
    const passkey = await db
      .select()
      .from(schema.passkeys)
      .where(eq(schema.passkeys.credentialId, credential.id))
      .get();

    if (!passkey) {
      return c.json({ error: 'Passkey not found', code: 'auth/passkey-not-found' }, 404);
    }

    // Get user
    const user = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, passkey.userId))
      .get();
    if (!user) {
      return c.json({ error: 'User not found', code: 'auth/user-not-found' }, 404);
    }

    // Get stored challenge
    const challenge = c.env.REFRESH_TOKEN_KV
      ? await c.env.REFRESH_TOKEN_KV.get(`passkey_auth_challenge_${user.id}`)
      : null;

    if (!challenge) {
      return c.json(
        { error: 'Challenge not found or expired', code: 'auth/challenge-expired' },
        400,
      );
    }

    // Prepare device for verification
    const device = {
      credentialID: passkeyService.base64ToUint8Array(passkey.credentialId),
      credentialPublicKey: passkeyService.base64ToUint8Array(passkey.publicKey),
      counter: passkey.counter,
      transports: ['hybrid'] as AuthenticatorTransportFuture[],
      credentialIdString: passkey.credentialId,
    };

    // Verify authentication response
    // Add missing clientExtensionResults if not present
    const credentialWithExtensions = {
      ...credential,
      clientExtensionResults: credential.clientExtensionResults || {},
    };

    const verification = await passkeyService.verifyAuthenticationResponse(
      credentialWithExtensions,
      device,
      challenge,
    );

    if (!verification.verified) {
      return c.json(
        { error: 'Passkey authentication failed', code: 'auth/passkey-verification-failed' },
        400,
      );
    }

    // Update passkey counter
    await db
      .update(schema.passkeys)
      .set({
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date().toISOString(),
      })
      .where(eq(schema.passkeys.id, passkey.id));

    // Clean up challenge
    if (c.env.REFRESH_TOKEN_KV) {
      await c.env.REFRESH_TOKEN_KV.delete(`passkey_auth_challenge_${user.id}`);
    }

    // Generate tokens
    const { accessToken, refreshToken, accessTokenExpiresAt } = await generateJwtToken(
      user.id,
      user.email,
      c.env,
    );

    // Check if profile exists
    let profileExists = false;
    try {
      const existingProfile = await db
        .select({ id: schema.profile.id })
        .from(schema.profile)
        .where(eq(schema.profile.userId, user.id))
        .get();
      profileExists = Boolean(existingProfile);

      // Log activity
      await db
        .insert(schema.userActivity)
        .values({
          id: nanoid(),
          userId: user.id,
          eventType: 'passkey_login',
          createdAt: new Date().toISOString(),
        })
        .execute();
    } catch (dbError) {
      console.error('Error during profile check or activity logging:', dbError);
    }

    return c.json({
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: accessTokenExpiresAt,
      },
      user: {
        id: user.id,
        email: user.email,
      },
      profileExists,
      isNewUser: false,
    });
  } catch (error) {
    console.error('Passkey authentication complete error:', error);
    return c.json(
      {
        error: 'Failed to complete passkey authentication',
        code: 'auth/passkey-authentication-failed',
      },
      500,
    );
  }
});

// Get user's passkeys
router.get('/passkey/list', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const db = createD1Client(c.env);

    const passkeys = await db
      .select({
        id: schema.passkeys.id,
        credentialId: schema.passkeys.credentialId,
        deviceName: schema.passkeys.deviceName,
        createdAt: schema.passkeys.createdAt,
        lastUsedAt: schema.passkeys.lastUsedAt,
      })
      .from(schema.passkeys)
      .where(eq(schema.passkeys.userId, user.id));

    return c.json({ passkeys });
  } catch (error) {
    console.error('Get passkeys error:', error);
    return c.json({ error: 'Failed to get passkeys', code: 'auth/get-passkeys-failed' }, 500);
  }
});

// Delete a passkey
router.delete('/passkey/:passkeyId', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const passkeyId = c.req.param('passkeyId');
    const db = createD1Client(c.env);

    // Verify passkey belongs to user
    const passkey = await db
      .select()
      .from(schema.passkeys)
      .where(and(eq(schema.passkeys.id, passkeyId), eq(schema.passkeys.userId, user.id)))
      .get();

    if (!passkey) {
      return c.json({ error: 'Passkey not found', code: 'auth/passkey-not-found' }, 404);
    }

    // Delete passkey
    await db.delete(schema.passkeys).where(eq(schema.passkeys.id, passkeyId));

    return c.json({ success: true, message: 'Passkey deleted successfully' });
  } catch (error) {
    console.error('Delete passkey error:', error);
    return c.json({ error: 'Failed to delete passkey', code: 'auth/delete-passkey-failed' }, 500);
  }
});

// Check if user has passkeys
router.post('/passkey/check', authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = z.object({ email: z.string().email() }).safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: 'Invalid input',
          details: validation.error.errors,
          code: 'auth/invalid-input',
        },
        400,
      );
    }

    const { email } = validation.data;
    const db = createD1Client(c.env);

    // Check if user exists
    const user = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    if (!user) {
      return c.json({ userExists: false, hasPasskeys: false });
    }

    // Check if user has any passkeys
    const passkeys = await db
      .select({ id: schema.passkeys.id })
      .from(schema.passkeys)
      .where(eq(schema.passkeys.userId, user.id))
      .limit(1);

    return c.json({ userExists: true, hasPasskeys: Boolean(passkeys.length) });
  } catch (error) {
    console.error('Check passkeys error:', error);
    return c.json({ error: 'Failed to check passkeys', code: 'auth/check-passkeys-failed' }, 500);
  }
});

export default router;
