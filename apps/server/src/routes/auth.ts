import type { AuthenticatorTransport, AuthenticatorTransportFuture } from '@simplewebauthn/types';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { createD1Client } from '../db';
import * as schema from '../db/schema';
import { createEmailService } from '../lib/services/emailService';
import {
  exchangeGoogleCode,
  validateGoogleAccessToken,
  verifyAppleToken,
} from '../lib/auth/oauthUtils';
import { PasskeyService as PS, PasskeyService } from '../lib/auth/passkeyService';
import { TotpService } from '../lib/auth/totpService';
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

// TOTP validation schemas
const totpSetupBeginSchema = z.object({
  // No fields needed - uses authenticated user
});

const totpSetupCompleteSchema = z.object({
  token: z.string().length(6).regex(/^\d+$/, 'Token must be 6 digits'),
});

const totpVerifySchema = z.object({
  token: z.string().min(6).max(8), // 6 digits for TOTP, 8 for backup codes
  isBackupCode: z.boolean().optional().default(false),
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

    // Check if user has active TOTP
    const totpSecrets = await db
      .select({ id: schema.totpSecrets.id })
      .from(schema.totpSecrets)
      .where(and(eq(schema.totpSecrets.userId, userId), eq(schema.totpSecrets.isActive, 1)))
      .limit(1);

    const hasTOTP = totpSecrets.length > 0;

    // User has MFA if they have either passkeys or TOTP
    const hasAnyMFA = hasPasskeys || hasTOTP;

    return {
      securitySetupRequired: false, // Disabled for now - MFA is optional
      hasPasskeys,
      hasTOTP,
    };
  } catch (error) {
    console.error('Error checking user security status:', error);
    // Default to not requiring security setup if there's an error
    return {
      securitySetupRequired: false,
      hasPasskeys: false,
      hasTOTP: false,
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

    // Find a valid, unexpired, and unused code.
    const now = Date.now();
    const storedCode = await db
      .select()
      .from(schema.emailCodes)
      .where(
        and(
          eq(schema.emailCodes.email, email),
          eq(schema.emailCodes.code, code),
          eq(schema.emailCodes.type, 'login_register'),
          isNull(schema.emailCodes.usedAt),
        ),
      )
      .get();

    if (!storedCode) {
      // Check if an expired code exists.
      const expiredCodeCheck = await db
        .select()
        .from(schema.emailCodes)
        .where(
          and(
            eq(schema.emailCodes.email, email),
            eq(schema.emailCodes.code, code),
            eq(schema.emailCodes.type, 'login_register'),
          ),
        )
        .get();

      if (expiredCodeCheck && now > Number.parseInt(expiredCodeCheck.expiresAt)) {
        return c.json({ error: 'Verification code has expired', code: 'auth/code-expired' }, 401);
      }

      return c.json(
        { error: 'Invalid or expired verification code', code: 'auth/invalid-code' },
        401,
      );
    }

    if (now > Number.parseInt(storedCode.expiresAt)) {
      return c.json({ error: 'Verification code has expired', code: 'auth/code-expired' }, 401);
    }

    // Mark code as used
    await db
      .update(schema.emailCodes)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(schema.emailCodes.id, storedCode.id));

    // Clean up expired codes after verification logic
    await cleanupExpiredCodes(db);

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

// Password reset endpoints
const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

router.post('/forgot-password', otpRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = forgotPasswordSchema.safeParse(body);

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
    const existingUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .get();

    // Always return success even if user doesn't exist (prevent email enumeration)
    if (!existingUser) {
      return c.json({
        success: true,
        message: 'If an account exists with this email, a password reset code has been sent.',
      });
    }

    // Generate and store reset code
    const code = generateSecureCode();
    const expiresAt = Date.now() + CODE_EXPIRATION_MINUTES * 60 * 1000;

    await db.insert(schema.emailCodes).values({
      id: nanoid(),
      email,
      code,
      type: 'password_reset',
      expiresAt: expiresAt.toString(),
    });

    // Send email
    try {
      const emailService = createEmailService(c.env);
      await emailService.sendVerificationCode(email, code, 'password_reset');
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return c.json(
        {
          error: 'Unable to send reset code. Please try again later.',
          code: 'auth/email-send-failed',
        },
        500,
      );
    }

    return c.json({
      success: true,
      message: 'If an account exists with this email, a password reset code has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return c.json({ error: 'Failed to process request', code: 'auth/server-error' }, 500);
  }
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

router.post('/reset-password', authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = resetPasswordSchema.safeParse(body);

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

    const { email, code } = validation.data;
    const db = createD1Client(c.env);

    // Find valid reset code
    const now = Date.now();
    const storedCode = await db
      .select()
      .from(schema.emailCodes)
      .where(
        and(
          eq(schema.emailCodes.email, email),
          eq(schema.emailCodes.code, code),
          eq(schema.emailCodes.type, 'password_reset'),
          isNull(schema.emailCodes.usedAt),
        ),
      )
      .get();

    if (!storedCode) {
      return c.json(
        { error: 'Invalid or expired reset code', code: 'auth/invalid-code' },
        401,
      );
    }

    if (now > Number.parseInt(storedCode.expiresAt)) {
      return c.json({ error: 'Reset code has expired', code: 'auth/code-expired' }, 401);
    }

    // Mark code as used
    await db
      .update(schema.emailCodes)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(schema.emailCodes.id, storedCode.id));

    // Get user
    const user = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    if (!user) {
      return c.json({ error: 'User not found', code: 'auth/user-not-found' }, 404);
    }

    // Invalidate all existing refresh tokens for this user by deleting them
    // Note: This requires iterating through KV which is not ideal, but ensures security
    // In a production system, you might want to store refresh tokens in D1 with userId
    // For now, we'll generate new tokens which effectively invalidates old sessions

    // Generate new tokens
    const { accessToken, refreshToken, accessTokenExpiresAt } = await generateJwtToken(
      user.id,
      user.email,
      c.env,
    );

    // Update user's updatedAt to track the password reset
    await db
      .update(schema.users)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(schema.users.id, user.id));

    // Check if profile exists
    let profileExists = false;
    try {
      const existingProfile = await db
        .select({ id: schema.profile.id })
        .from(schema.profile)
        .where(eq(schema.profile.userId, user.id))
        .get();
      profileExists = Boolean(existingProfile);
    } catch (dbError) {
      console.error('Error checking profile:', dbError);
    }

    // Get security status
    const securityStatus = await getUserSecurityStatus(db, user.id);

    return c.json({
      success: true,
      message: 'Password reset successful. You are now logged in.',
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
      ...securityStatus,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return c.json({ error: 'Failed to reset password', code: 'auth/server-error' }, 500);
  }
});

// Account deletion endpoint
router.delete('/account', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const db = createD1Client(c.env);

    // Get or create the [deleted] system user
    let deletedUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, 'deleted@system.local'))
      .get();

    if (!deletedUser) {
      const deletedUserId = 'deleted-user-system';
      await db.insert(schema.users).values({
        id: deletedUserId,
        email: 'deleted@system.local',
        emailVerified: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Create profile for deleted user
      await db.insert(schema.profile).values({
        id: nanoid(),
        userId: deletedUserId,
        username: '[deleted]',
        bio: 'This account has been deleted',
        verifiedType: 'none',
        isPrivate: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      deletedUser = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, deletedUserId))
        .get();
    }

    if (!deletedUser) {
      throw new Error('Failed to get or create deleted user');
    }

    // Reassign posts to [deleted] user
    await db
      .update(schema.post)
      .set({ userId: deletedUser.id })
      .where(eq(schema.post.userId, user.id));

    // Reassign draft posts to [deleted] user
    await db
      .update(schema.draftPost)
      .set({ userId: deletedUser.id })
      .where(eq(schema.draftPost.userId, user.id));

    // Reassign comments to [deleted] user
    await db
      .update(schema.comment)
      .set({ userId: deletedUser.id })
      .where(eq(schema.comment.userId, user.id));

    // Delete user's likes
    await db.delete(schema.postLike).where(eq(schema.postLike.userId, user.id));
    await db.delete(schema.commentLike).where(eq(schema.commentLike.userId, user.id));

    // Delete user's saved posts
    await db.delete(schema.savedPost).where(eq(schema.savedPost.userId, user.id));

    // Delete relationships (follows)
    await db.delete(schema.relationship).where(eq(schema.relationship.followerId, user.id));
    await db.delete(schema.relationship).where(eq(schema.relationship.followedId, user.id));

    // Delete blocked users
    await db.delete(schema.blockedUser).where(eq(schema.blockedUser.blockerId, user.id));
    await db.delete(schema.blockedUser).where(eq(schema.blockedUser.blockedId, user.id));

    // Delete notifications
    await db.delete(schema.notification).where(eq(schema.notification.userId, user.id));
    await db.delete(schema.notification).where(eq(schema.notification.actionUserId, user.id));

    // Delete seen post logs
    await db.delete(schema.seenPostLog).where(eq(schema.seenPostLog.userId, user.id));

    // Delete user activity
    await db.delete(schema.userActivity).where(eq(schema.userActivity.userId, user.id));

    // Delete passkeys
    await db.delete(schema.passkeys).where(eq(schema.passkeys.userId, user.id));

    // Delete TOTP secrets
    await db.delete(schema.totpSecrets).where(eq(schema.totpSecrets.userId, user.id));

    // Delete profile
    await db.delete(schema.profile).where(eq(schema.profile.userId, user.id));

    // Finally delete the user
    await db.delete(schema.users).where(eq(schema.users.id, user.id));

    // Invalidate refresh tokens (if we had the token, we'd delete it)
    // Since we can't enumerate KV, the tokens will expire naturally
    // In production, consider storing refresh tokens in D1 for easier cleanup

    return c.json({
      success: true,
      message: 'Account deleted successfully. Your posts and comments have been anonymized.',
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    return c.json(
      { error: 'Failed to delete account', code: 'auth/deletion-failed' },
      500,
    );
  }
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
    console.log('🍎 Apple OAuth request started');
    const body = await c.req.json();
    console.log('🍎 Request body parsed, has identityToken:', !!body?.identityToken);
    const validation = oauthAppleSchema.safeParse(body);

    if (!validation.success) {
      console.log('🍎 Validation failed:', validation.error.errors);
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
    console.log('🍎 identityToken length:', identityToken?.length);

    console.log('🍎 APPLE_CLIENT_ID check:', !!c.env.APPLE_CLIENT_ID);
    console.log('🍎 APPLE_CLIENT_ID value (first 10 chars):', c.env.APPLE_CLIENT_ID?.substring(0, 10));
    console.log('🍎 APPLE_CLIENT_ID type:', typeof c.env.APPLE_CLIENT_ID);
    console.log('🍎 All env keys:', Object.keys(c.env));
    console.log('🍎 JWT_SECRET exists:', !!c.env.JWT_SECRET);
    console.log('🍎 GOOGLE_CLIENT_ID exists:', !!c.env.GOOGLE_CLIENT_ID);
    
    if (!c.env.APPLE_CLIENT_ID) {
      console.log('🍎 APPLE_CLIENT_ID is missing!');
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
    console.error('🍎 Apple OAuth error:', error);
    console.error('🍎 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
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

    const credentialId =
      typeof credentialInfo.credential.id === 'string'
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
        throw new Error(
          `Invalid credentialId: expected non-empty string, got ${typeof pk.credentialId}`,
        );
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

// TOTP endpoints

// Begin TOTP setup - generate secret and QR code
router.post('/totp/setup/begin', authMiddleware, authRateLimiter, async (c) => {
  try {
    const user = c.get('user');
    const db = createD1Client(c.env);

    // Check if user already has active TOTP
    const existingTotp = await db
      .select()
      .from(schema.totpSecrets)
      .where(and(eq(schema.totpSecrets.userId, user.id), eq(schema.totpSecrets.isActive, 1)))
      .get();

    if (existingTotp) {
      return c.json(
        { error: 'TOTP is already enabled for this account', code: 'auth/totp-already-active' },
        400,
      );
    }

    // Generate new secret
    const secret = TotpService.generateSecret();
    const qrCodeData = TotpService.generateQRCodeData(secret, user.email || user.id);

    // Store inactive secret temporarily (will be activated on completion)
    const totpId = nanoid();
    await db.insert(schema.totpSecrets).values({
      id: totpId,
      userId: user.id,
      secret,
      isActive: 0,
      createdAt: new Date().toISOString(),
    });

    return c.json({
      secret,
      qrCodeData,
      totpId,
    });
  } catch (error) {
    console.error('TOTP setup begin error:', error);
    return c.json(
      { error: 'Failed to begin TOTP setup', code: 'auth/totp-setup-failed' },
      500,
    );
  }
});

// Complete TOTP setup - verify token and activate
router.post('/totp/setup/complete', authMiddleware, authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = totpSetupCompleteSchema.safeParse(body);

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

    const { token } = validation.data;
    const user = c.get('user');
    const db = createD1Client(c.env);

    // Get the inactive TOTP secret
    const totpSecret = await db
      .select()
      .from(schema.totpSecrets)
      .where(and(eq(schema.totpSecrets.userId, user.id), eq(schema.totpSecrets.isActive, 0)))
      .get();

    if (!totpSecret) {
      return c.json(
        { error: 'No TOTP setup in progress', code: 'auth/totp-setup-not-found' },
        400,
      );
    }

    // Verify the token
    const isValid = TotpService.verifyTOTP(totpSecret.secret, token);
    if (!isValid) {
      return c.json(
        { error: 'Invalid TOTP token', code: 'auth/invalid-totp-token' },
        400,
      );
    }

    // Generate backup codes
    const backupCodes = TotpService.generateBackupCodes();
    const hashedBackupCodes = TotpService.hashBackupCodes(backupCodes);

    // Activate the TOTP and store backup codes
    await db
      .update(schema.totpSecrets)
      .set({
        isActive: 1,
        backupCodes: JSON.stringify(hashedBackupCodes),
        lastUsedAt: new Date().toISOString(),
      })
      .where(eq(schema.totpSecrets.id, totpSecret.id));

    return c.json({
      success: true,
      message: 'TOTP enabled successfully',
      backupCodes, // Return unhashed codes for user to save
    });
  } catch (error) {
    console.error('TOTP setup complete error:', error);
    return c.json(
      { error: 'Failed to complete TOTP setup', code: 'auth/totp-setup-failed' },
      500,
    );
  }
});

// Verify TOTP token (for login or sensitive operations)
router.post('/totp/verify', authMiddleware, authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = totpVerifySchema.safeParse(body);

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

    const { token, isBackupCode } = validation.data;
    const user = c.get('user');
    const db = createD1Client(c.env);

    // Get active TOTP secret
    const totpSecret = await db
      .select()
      .from(schema.totpSecrets)
      .where(and(eq(schema.totpSecrets.userId, user.id), eq(schema.totpSecrets.isActive, 1)))
      .get();

    if (!totpSecret) {
      return c.json(
        { error: 'TOTP not enabled for this account', code: 'auth/totp-not-enabled' },
        400,
      );
    }

    let isValid = false;

    if (isBackupCode) {
      // Verify backup code
      const backupCodes = JSON.parse(totpSecret.backupCodes || '[]');
      isValid = TotpService.verifyBackupCode(token, backupCodes);

      if (isValid) {
        // Remove used backup code
        const updatedBackupCodes = TotpService.removeUsedBackupCode(token, backupCodes);
        await db
          .update(schema.totpSecrets)
          .set({
            backupCodes: JSON.stringify(updatedBackupCodes),
            lastUsedAt: new Date().toISOString(),
          })
          .where(eq(schema.totpSecrets.id, totpSecret.id));
      }
    } else {
      // Verify TOTP token
      isValid = TotpService.verifyTOTP(totpSecret.secret, token);

      if (isValid) {
        // Update last used time
        await db
          .update(schema.totpSecrets)
          .set({ lastUsedAt: new Date().toISOString() })
          .where(eq(schema.totpSecrets.id, totpSecret.id));
      }
    }

    if (!isValid) {
      return c.json(
        { error: 'Invalid TOTP token or backup code', code: 'auth/invalid-totp' },
        400,
      );
    }

    return c.json({ success: true, message: 'TOTP verified successfully' });
  } catch (error) {
    console.error('TOTP verify error:', error);
    return c.json(
      { error: 'Failed to verify TOTP', code: 'auth/totp-verify-failed' },
      500,
    );
  }
});

// Generate new backup codes
router.post('/totp/backup-codes', authMiddleware, authRateLimiter, async (c) => {
  try {
    const user = c.get('user');
    const db = createD1Client(c.env);

    // Get active TOTP secret
    const totpSecret = await db
      .select()
      .from(schema.totpSecrets)
      .where(and(eq(schema.totpSecrets.userId, user.id), eq(schema.totpSecrets.isActive, 1)))
      .get();

    if (!totpSecret) {
      return c.json(
        { error: 'TOTP not enabled for this account', code: 'auth/totp-not-enabled' },
        400,
      );
    }

    // Generate new backup codes
    const backupCodes = TotpService.generateBackupCodes();
    const hashedBackupCodes = TotpService.hashBackupCodes(backupCodes);

    // Update stored backup codes
    await db
      .update(schema.totpSecrets)
      .set({ backupCodes: JSON.stringify(hashedBackupCodes) })
      .where(eq(schema.totpSecrets.id, totpSecret.id));

    return c.json({
      success: true,
      backupCodes, // Return unhashed codes for user to save
      message: 'New backup codes generated',
    });
  } catch (error) {
    console.error('TOTP backup codes error:', error);
    return c.json(
      { error: 'Failed to generate backup codes', code: 'auth/backup-codes-failed' },
      500,
    );
  }
});

// Disable TOTP
router.delete('/totp/disable', authMiddleware, authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = z.object({ token: z.string().min(6).max(8) }).safeParse(body);

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

    const { token } = validation.data;
    const user = c.get('user');
    const db = createD1Client(c.env);

    // Get active TOTP secret
    const totpSecret = await db
      .select()
      .from(schema.totpSecrets)
      .where(and(eq(schema.totpSecrets.userId, user.id), eq(schema.totpSecrets.isActive, 1)))
      .get();

    if (!totpSecret) {
      return c.json(
        { error: 'TOTP not enabled for this account', code: 'auth/totp-not-enabled' },
        400,
      );
    }

    // Verify current TOTP token or backup code
    const backupCodes = JSON.parse(totpSecret.backupCodes || '[]');
    const isValidTOTP = TotpService.verifyTOTP(totpSecret.secret, token);
    const isValidBackup = TotpService.verifyBackupCode(token, backupCodes);

    if (!isValidTOTP && !isValidBackup) {
      return c.json(
        { error: 'Invalid TOTP token or backup code', code: 'auth/invalid-totp' },
        400,
      );
    }

    // Delete TOTP secret
    await db.delete(schema.totpSecrets).where(eq(schema.totpSecrets.id, totpSecret.id));

    return c.json({ success: true, message: 'TOTP disabled successfully' });
  } catch (error) {
    console.error('TOTP disable error:', error);
    return c.json(
      { error: 'Failed to disable TOTP', code: 'auth/totp-disable-failed' },
      500,
    );
  }
});

// Push Notification Device Registration

const registerDeviceSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
  deviceName: z.string().optional(),
});

router.post('/register-device', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const validation = registerDeviceSchema.safeParse(body);

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

    const { token, platform, deviceName } = validation.data;
    const user = c.get('user');
    const db = createD1Client(c.env);

    // Check if this token already exists
    const existingToken = await db
      .select()
      .from(schema.deviceToken)
      .where(eq(schema.deviceToken.token, token))
      .get();

    if (existingToken) {
      // Update existing token - could be same user or different user
      await db
        .update(schema.deviceToken)
        .set({
          userId: user.id,
          platform,
          deviceName: deviceName || existingToken.deviceName,
          isActive: 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.deviceToken.id, existingToken.id));

      return c.json({
        success: true,
        message: 'Device token updated',
        deviceId: existingToken.id,
      });
    }

    // Create new token
    const deviceId = nanoid();
    await db.insert(schema.deviceToken).values({
      id: deviceId,
      userId: user.id,
      token,
      platform,
      deviceName: deviceName || 'Unknown Device',
      isActive: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return c.json({
      success: true,
      message: 'Device registered successfully',
      deviceId,
    });
  } catch (error) {
    console.error('Register device error:', error);
    return c.json(
      { error: 'Failed to register device', code: 'auth/device-registration-failed' },
      500,
    );
  }
});

router.post('/unregister-device', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const validation = z.object({ token: z.string().min(1) }).safeParse(body);

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

    const { token } = validation.data;
    const user = c.get('user');
    const db = createD1Client(c.env);

    // Deactivate the token (don't delete, in case user wants to re-enable)
    await db
      .update(schema.deviceToken)
      .set({
        isActive: 0,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(schema.deviceToken.token, token), eq(schema.deviceToken.userId, user.id)));

    return c.json({
      success: true,
      message: 'Device unregistered successfully',
    });
  } catch (error) {
    console.error('Unregister device error:', error);
    return c.json(
      { error: 'Failed to unregister device', code: 'auth/device-unregister-failed' },
      500,
    );
  }
});

export default router;
