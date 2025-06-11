import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { z } from "zod";
import { authRateLimiter, otpRateLimiter } from "../middleware/rateLimit";
import { createD1Client } from "../db";
import * as schema from "../db/schema";
import { nanoid } from "nanoid";
import { eq, and, gt, isNull } from "drizzle-orm";
import { sign } from "hono/jwt";
import { authMiddleware } from "../middleware/auth";
import { createEmailService } from "../lib/emailService";

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

// Constants
const REFRESH_TOKEN_EXPIRATION_SECONDS = 60 * 60 * 24 * 7; // 7 days
const CODE_EXPIRATION_MINUTES = 10;

// Helper functions
function generateSecureCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function generateJwtToken(userId: string, email: string, env: Bindings): Promise<{accessToken: string, refreshToken: string, accessTokenExpiresAt: number}> {
    if (!env.JWT_SECRET) {
        console.error("JWT_SECRET is not defined in environment variables.");
        throw new Error("JWT_SECRET not configured");
    }

    const now = Math.floor(Date.now() / 1000);
    const accessTokenPayload = {
        sub: userId,
        email: email,
        iat: now,
        exp: now + (15 * 60), // 15 minutes from now
    };
    const accessToken = await sign(accessTokenPayload, env.JWT_SECRET);
    const accessTokenExpiresAt = accessTokenPayload.exp * 1000; // convert to milliseconds for client

    const refreshToken = nanoid(64);

    if (env.REFRESH_TOKEN_KV) {
        await env.REFRESH_TOKEN_KV.put(`rt_${refreshToken}`, userId, { 
            expirationTtl: REFRESH_TOKEN_EXPIRATION_SECONDS 
        });
    } else {
        console.warn("REFRESH_TOKEN_KV is not available. Refresh token will not be stored.");
    }

    return { accessToken, refreshToken, accessTokenExpiresAt };
}

async function cleanupExpiredCodes(db: any) {
  const now = Date.now().toString();
  await db.delete(schema.emailCodes)
    .where(gt(schema.emailCodes.expiresAt, now))
    .execute();
}

router.post("/send-code", otpRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = sendCodeSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: "Invalid input",
          details: validation.error.errors,
          code: "auth/invalid-input",
        },
        400
      );
    }

    const { email } = validation.data;
    const db = createD1Client(c.env);

    // Clean up expired codes first
    await cleanupExpiredCodes(db);

    // Check if user exists
    const existingUser = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    const isNewUser = !existingUser;

    // Generate and store code
    const code = generateSecureCode();
    const expiresAt = Date.now() + (CODE_EXPIRATION_MINUTES * 60 * 1000);

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
      console.error("Failed to send email:", emailError);
      return c.json({ error: "Failed to send verification code", code: "auth/email-send-failed" }, 500);
    }

    const message = isNewUser 
      ? "Welcome! We've sent a verification code to your email."
      : "Welcome back! We've sent a verification code to your email.";

    return c.json({ 
      success: true, 
      message,
      isNewUser 
    });
  } catch (error) {
    console.error("Send code error:", error);
    return c.json({ error: "Failed to send verification code", code: "auth/server-error" }, 500);
  }
});

// TEMPORARY TEST ROUTE - Remove before production
router.post("/send-code-test", otpRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = sendCodeSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: "Invalid input",
          details: validation.error.errors,
          code: "auth/invalid-input",
        },
        400
      );
    }

    const { email } = validation.data;
    const db = createD1Client(c.env);

    // Clean up expired codes first
    await cleanupExpiredCodes(db);

    // Check if user exists
    const existingUser = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    const isNewUser = !existingUser;

    // Generate and store code
    const code = generateSecureCode();
    const expiresAt = Date.now() + (CODE_EXPIRATION_MINUTES * 60 * 1000);

    try {
      await db.insert(schema.emailCodes).values({
        id: nanoid(),
        email,
        code,
        type: 'login_register',
        expiresAt: expiresAt.toString(),
      });
      console.log(`✅ Code stored in database for ${email}`);
    } catch (dbError) {
      console.error(`❌ Failed to store code in database for ${email}:`, dbError);
      throw dbError;
    }

    // FOR TESTING: Log the code instead of sending email
    console.log(`🔑 VERIFICATION CODE for ${email}: ${code}`);

    const message = isNewUser 
      ? "Welcome! Check the server console for your verification code (test mode)."
      : "Welcome back! Check the server console for your verification code (test mode).";

    return c.json({ 
      success: true, 
      message,
      isNewUser,
      testCode: code // Include code in response for testing only
    });
  } catch (error) {
    console.error("Send code test error:", error);
    return c.json({ error: "Failed to send verification code", code: "auth/server-error" }, 500);
  }
});

router.post("/verify-code", authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = verifyCodeSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: "Invalid input",
          details: validation.error.errors,
          code: "auth/invalid-input",
        },
        400
      );
    }

    const { email, code, phone } = validation.data;
    const db = createD1Client(c.env);

    // Clean up expired codes
    await cleanupExpiredCodes(db);

    // Verify code - first get all matching codes, then filter in JavaScript
    const allMatchingCodes = await db.select()
      .from(schema.emailCodes)
      .where(and(
        eq(schema.emailCodes.email, email),
        eq(schema.emailCodes.code, code),
        eq(schema.emailCodes.type, 'login_register')
      ))
      .limit(10);
    
    // Filter for unused codes in JavaScript
    const storedCode = allMatchingCodes.find(c => c.usedAt === null);

    console.log("🔍 Verification attempt:", { email, code, type: 'login_register' });
    console.log("🔍 Database result:", storedCode);

    if (!storedCode) {
      // Let's also check without the usedAt condition for debugging
      const allCodes = await db.select()
        .from(schema.emailCodes)
        .where(and(
          eq(schema.emailCodes.email, email),
          eq(schema.emailCodes.code, code),
          eq(schema.emailCodes.type, 'login_register')
        ))
        .limit(5);
      console.log("🔍 All matching codes (ignoring usedAt):", allCodes);
      
      return c.json({ error: "Invalid or expired verification code", code: "auth/invalid-code" }, 401);
    }

    // Check if code is expired
    if (Date.now() > Number.parseInt(storedCode.expiresAt)) {
      return c.json({ error: "Verification code has expired", code: "auth/code-expired" }, 401);
    }

    // Mark code as used
    await db.update(schema.emailCodes)
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

      await db.update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, user.id));

      // Refresh user data
      user = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).get();
    }

    if (!user) {
      return c.json({ error: "Failed to create or update user", code: "auth/user-creation-failed" }, 500);
    }

    // Generate tokens
    const { accessToken, refreshToken, accessTokenExpiresAt } = await generateJwtToken(user.id, user.email, c.env);

    // Check if profile exists
    let profileExists = false;
    try {
      const existingProfile = await db.select({ id: schema.profile.id })
                                      .from(schema.profile)
                                      .where(eq(schema.profile.userId, user.id))
                                      .get();
      profileExists = Boolean(existingProfile);

      // Log activity
      if (!isNewUser) {
        await db.insert(schema.userActivity).values({
          id: nanoid(),
          userId: user.id,
          eventType: "login",
          createdAt: new Date().toISOString(),
        }).execute();
      }
    } catch (dbError) {
      console.error("Error during profile check or activity logging:", dbError);
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
      isNewUser,
    });
  } catch (error) {
    console.error("Verify code error:", error);
    return c.json({ error: "Failed to verify code", code: "auth/server-error" }, 500);
  }
});

router.post("/refresh", authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = refreshTokenSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: "Invalid input",
          code: "auth/invalid-input",
        },
        400
      );
    }
    
    const { refresh_token } = validation.data;

    if (!c.env.REFRESH_TOKEN_KV) {
        return c.json({ error: "Token refresh capability not configured.", code: "auth/kv-not-configured"}, 500);
    }

    const storedUserId = await c.env.REFRESH_TOKEN_KV.get(`rt_${refresh_token}`);
    if (!storedUserId) {
        return c.json({ error: "Invalid or expired refresh token", code: "auth/invalid-refresh-token" }, 401);
    }

    // Invalidate the used refresh token immediately
    await c.env.REFRESH_TOKEN_KV.delete(`rt_${refresh_token}`);

    const db = createD1Client(c.env);
    const user = await db.select().from(schema.users).where(eq(schema.users.id, storedUserId)).get();

    if (!user) {
        return c.json({ error: "User not found for refresh token", code: "auth/user-not-found" }, 401);
    }

    // Generate new tokens
    const { accessToken: newAccessToken, refreshToken: newRefreshToken, accessTokenExpiresAt: newAccessTokenExpiresAt } = await generateJwtToken(user.id, user.email, c.env);

    // Check profile existence
    let profileExists = false;
    try {
      const existingProfile = await db.select({ id: schema.profile.id })
                                      .from(schema.profile)
                                      .where(eq(schema.profile.userId, user.id))
                                      .get();
      profileExists = Boolean(existingProfile);
    } catch (dbProfileError) {
      console.error("Error checking profile during token refresh:", dbProfileError);
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
    console.error("Token refresh error:", error);
    return c.json({ error: "Failed to refresh token", code: "auth/server-error" }, 500);
  }
});

router.post("/logout", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const refreshTokenToInvalidate = body.refresh_token;

    if (refreshTokenToInvalidate && c.env.REFRESH_TOKEN_KV) {
        await c.env.REFRESH_TOKEN_KV.delete(`rt_${refreshTokenToInvalidate}`);
    }

    return c.json({ success: true, message: "Logged out successfully." });
});

// Get current user info
router.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = createD1Client(c.env);
  let profileExists = false;
  try {
    const existingProfile = await db.select().from(schema.profile).where(eq(schema.profile.userId, user.id)).get();
    profileExists = Boolean(existingProfile);
  } catch (e) {
    console.error("Error checking profile existence in /auth/me:", e);
  }
  return c.json({ id: user.id, email: user.email, profileExists });
});

// DEBUG ENDPOINT - Remove before production
router.post("/debug-db-test", async (c) => {
  try {
    const db = createD1Client(c.env);
    const testEmail = "debug@test.com";
    const testCode = "123456";
    
    // Insert a test code
    const codeId = nanoid();
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
    
    await db.insert(schema.emailCodes).values({
      id: codeId,
      email: testEmail,
      code: testCode,
      type: 'login_register',
      expiresAt: expiresAt.toString(),
    });
    
    console.log("✅ Inserted test code:", testCode, "for", testEmail);
    
    // Try to retrieve it
    const retrieved = await db.select()
      .from(schema.emailCodes)
      .where(and(
        eq(schema.emailCodes.email, testEmail),
        eq(schema.emailCodes.code, testCode),
        eq(schema.emailCodes.type, 'login_register'),
        isNull(schema.emailCodes.usedAt)
      ))
      .get();
    
    console.log("🔍 Retrieved:", retrieved);
    
    return c.json({
      success: true,
      message: "Database test completed",
      inserted: { id: codeId, email: testEmail, code: testCode },
      retrieved: retrieved || null
    });
  } catch (error) {
    console.error("Database test error:", error);
    return c.json({ error: "Database test failed", details: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// COMBINED TEST ENDPOINT - Remove before production
router.post("/test-complete-flow", async (c) => {
  try {
    const db = createD1Client(c.env);
    const testEmail = "flow@test.com";
    const testCode = "999888";
    
    console.log("🧪 Starting complete flow test");
    
    // Step 1: Insert a test code
    const codeId = nanoid();
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
    
    await db.insert(schema.emailCodes).values({
      id: codeId,
      email: testEmail,
      code: testCode,
      type: 'login_register',
      expiresAt: expiresAt.toString(),
    });
    
    console.log("✅ Step 1: Code inserted");
    
    // Step 2: Immediately try to verify it
    const allMatchingCodes = await db.select()
      .from(schema.emailCodes)
      .where(and(
        eq(schema.emailCodes.email, testEmail),
        eq(schema.emailCodes.code, testCode),
        eq(schema.emailCodes.type, 'login_register')
      ))
      .limit(10);
    
    console.log("🔍 Step 2: Found codes:", allMatchingCodes);
    
    const storedCode = allMatchingCodes.find(c => c.usedAt === null);
    console.log("🔍 Step 3: Unused code:", storedCode);
    
    if (!storedCode) {
      return c.json({ 
        success: false, 
        error: "Code not found after insertion",
        allCodes: allMatchingCodes 
      });
    }
    
    // Step 3: Mark as used
    await db.update(schema.emailCodes)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(schema.emailCodes.id, storedCode.id));
    
    console.log("✅ Step 4: Code marked as used");
    
    return c.json({
      success: true,
      message: "Complete flow test successful",
      steps: {
        inserted: { id: codeId, email: testEmail, code: testCode },
        found: storedCode,
        marked_used: true
      }
    });
  } catch (error) {
    console.error("Complete flow test error:", error);
    return c.json({ 
      success: false, 
      error: "Complete flow test failed", 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

export default router;
