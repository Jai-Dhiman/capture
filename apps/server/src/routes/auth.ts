import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { z } from "zod";
import { authRateLimiter, passwordResetRateLimiter } from "../middleware/rateLimit";
import { createD1Client } from "../db";
import * as schema from "../db/schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { sign } from "hono/jwt"; // Import Hono JWT
import { authMiddleware } from "../middleware/auth";

// crypto is a global in Cloudflare Workers
// import { subtle } from 'crypto'; // Not needed for global crypto.subtle

// Helper to convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Helper to convert hex string to ArrayBuffer
function hexToBuffer(hexString: string): Uint8Array {
  const bytes = new Uint8Array(Math.ceil(hexString.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hexString.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

const router = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshTokenSchema = z.object({
  refresh_token: z.string(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
});

const updatePasswordSchema = z.object({
  password: z.string().min(8),
});

// --- Password Hashing Utilities (PBKDF2 with Web Crypto) ---
const PBKDF2_ITERATIONS = 100000; // Standard recommendation, adjust as needed
const SALT_LENGTH_BYTES = 16; // 128 bits
const KEY_LENGTH_BYTES = 32; // 256 bits for the derived key

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const passwordBuffer = new TextEncoder().encode(password);

  const key = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    KEY_LENGTH_BYTES * 8 // length in bits
  );

  const hashedPassword = new Uint8Array(derivedBits);
  // Store salt along with the hash, separated by a character not in hex (e.g., '.')
  return `${bufferToHex(salt.buffer)}.${bufferToHex(hashedPassword.buffer)}`;
}

async function verifyPassword(password: string, storedHashString: string): Promise<boolean> {
  const parts = storedHashString.split('.');
  if (parts.length !== 2) {
    console.error("Invalid stored hash format.");
    return false; // Or throw an error
  }
  const saltFromStorage: Uint8Array = hexToBuffer(parts[0]);
  const storedHashFromStorage: Uint8Array = hexToBuffer(parts[1]);
  const passwordBuffer = new TextEncoder().encode(password);

  const key = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltFromStorage,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    KEY_LENGTH_BYTES * 8
  );

  const derivedPasswordHash = new Uint8Array(derivedBits);

  // Constant-time comparison (important for security)
  if (derivedPasswordHash.length !== storedHashFromStorage.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < derivedPasswordHash.length; i++) {
    result |= derivedPasswordHash[i] ^ storedHashFromStorage[i];
  }
  return result === 0;
}

// const ACCESS_TOKEN_EXPIRATION = "15m"; // 15 minutes
const REFRESH_TOKEN_EXPIRATION_SECONDS = 60 * 60 * 24 * 7; // 7 days in seconds

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

    // For refresh tokens, we often use opaque strings stored in KV with an expiry.
    // The token itself doesn't need to be a JWT, but it needs to be unique and unpredictable.
    const refreshToken = nanoid(64); // Generate a strong random string

    if (env.REFRESH_TOKEN_KV) {
        await env.REFRESH_TOKEN_KV.put(`rt_${refreshToken}`, userId, { 
            expirationTtl: REFRESH_TOKEN_EXPIRATION_SECONDS 
        });
    } else {
        console.warn("REFRESH_TOKEN_KV is not available. Refresh token will not be stored.");
    }

    return { accessToken, refreshToken, accessTokenExpiresAt };
}

// --- Routes ---

router.post("/register", authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = registerSchema.safeParse(body);

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

    const { email, password } = validation.data;
    const db = createD1Client(c.env);

    // Check if user already exists
    const existingUser = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();
    if (existingUser) {
      return c.json({ error: "Email already in use", code: "auth/email-in-use" }, 409);
    }

    const hashedPassword = await hashPassword(password);
    const userId = nanoid();

    await db.insert(schema.users).values({
      id: userId,
      email,
      passwordHash: hashedPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // For now, we won't auto-create a profile or send verification email
    // These can be added later as per full requirements.

    return c.json({ message: "User registered successfully. Please verify your email.", userId }, 201);
  } catch (error) {
    console.error("Registration error:", error);
    return c.json({ error: "Registration failed", code: "auth/server-error" }, 500);
  }
});

router.post("/login", authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = loginSchema.safeParse(body);

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

    const { email, password } = validation.data;
    const db = createD1Client(c.env);

    const user = await db.select().from(schema.users).where(eq(schema.users.email, email)).get();

    if (!user) {
      return c.json({ error: "Invalid credentials", code: "auth/invalid-credentials" }, 401);
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return c.json({ error: "Invalid credentials", code: "auth/invalid-credentials" }, 401);
    }
    
    // Check if email is verified (optional step, can be enforced)
    // if (!user.emailVerified) {
    //   return c.json({ error: "Email not verified", code: "auth/email-not-verified" }, 403);
    // }

    const { accessToken, refreshToken, accessTokenExpiresAt } = await generateJwtToken(user.id, user.email, c.env);

    // Check D1 profile existence (similar to old logic, but now against user.id from our new users table)
    let profileExists = false;
    try {
      const existingProfile = await db.select({ id: schema.profile.id })
                                      .from(schema.profile)
                                      .where(eq(schema.profile.userId, user.id))
                                      .get();
      if (existingProfile) {
        profileExists = true;
        await db.insert(schema.userActivity).values({
          id: nanoid(),
          userId: user.id,
          eventType: "login",
          createdAt: new Date().toISOString(),
        }).execute();
      }
    } catch (dbError) {
      console.error("Error during D1 profile check or userActivity logging on login:", dbError);
    }
    
    return c.json({
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: accessTokenExpiresAt, // Send expiry to client
        // expires_in: 3600, // Typically, the JWT itself contains expiry
        // expires_at: Date.now() + 3600 * 1000, // Client can derive this from token
      },
      user: {
        id: user.id,
        email: user.email,
      },
      profileExists: profileExists
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: "Authentication failed", code: "auth/server-error" }, 500);
  }
});


// Renaming old /signin to /login and /signup to /register
// router.post("/signin", authRateLimiter, async (c) => { // This is now /login
// ... old code commented or removed ...
// });

// router.post("/signup", authRateLimiter, async (c) => { // This is now /register
// ... old code commented or removed ...
// });


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

    // TODO: Implement refresh token validation against KV store
    // 1. Check if refresh_token exists in KV
    // 2. Get associated userId
    // 3. Fetch user from D1
    // 4. Generate new access token (and optionally a new refresh token - rotating refresh tokens)
    // 5. Update/remove old refresh token in KV, store new one if applicable

    console.warn("TODO: Implement refresh token logic with KV store.");
    // Placeholder response:
    // const placeholderUser = { id: "refreshed-user-id", email: "refreshed@example.com", phone: null};
    // const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await generateJwtToken(placeholderUser.id, placeholderUser.email, c.env);

    if (!c.env.REFRESH_TOKEN_KV) {
        return c.json({ error: "Token refresh capability not configured.", code: "auth/kv-not-configured"}, 500);
    }

    const storedUserId = await c.env.REFRESH_TOKEN_KV.get(`rt_${refresh_token}`);
    if (!storedUserId) {
        return c.json({ error: "Invalid or expired refresh token", code: "auth/invalid-refresh-token" }, 401);
    }

    // (Important) Invalidate the used refresh token immediately to prevent reuse
    await c.env.REFRESH_TOKEN_KV.delete(`rt_${refresh_token}`);

    const db = createD1Client(c.env);
    const user = await db.select().from(schema.users).where(eq(schema.users.id, storedUserId)).get();

    if (!user) {
        // This case should be rare if KV is consistent with D1, but handle it.
        return c.json({ error: "User not found for refresh token", code: "auth/user-not-found" }, 401);
    }

    // Generate new pair of tokens
    const { accessToken: newAccessToken, refreshToken: newRefreshToken, accessTokenExpiresAt: newAccessTokenExpiresAt } = await generateJwtToken(user.id, user.email, c.env);

    // Check D1 profile existence
    let profileExists = false;
    try {
      const existingProfile = await db.select({ id: schema.profile.id })
                                      .from(schema.profile)
                                      .where(eq(schema.profile.userId, user.id))
                                      .get();
      if (existingProfile) {
        profileExists = true;
      }
    } catch (dbProfileError) {
      console.error("Error checking D1 profile during token refresh:", dbProfileError);
    }

    return c.json({
      session: {
         access_token: newAccessToken,
         refresh_token: newRefreshToken,
         expires_at: newAccessTokenExpiresAt, // Send new expiry
      },
      user: { // User data should come from the D1 record associated with the refresh token
        id: user.id,
        email: user.email,
      },
      profileExists: profileExists
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return c.json({ error: "Failed to refresh token", code: "auth/server-error" }, 500);
  }
});

router.post("/reset-password", passwordResetRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = resetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: "Invalid input",
          code: "auth/invalid-input",
        },
        400
      );
    }
    // const { email } = validation.data; // email not used yet
    // TODO: 
    // 1. Check if email exists in `users` table.
    // 2. Generate a unique, short-lived reset token.
    // 3. Store token in KV with user ID and expiry (e.g., user_reset_tokens:{token} -> userId, TTL 1 hour).
    // 4. Send email with reset link: /auth/update-password?token={token}
    console.warn("TODO: Implement password reset logic (token generation, KV storage, email sending).");

    return c.json({ success: true, message: "If your email is registered, you will receive a password reset link." });
  } catch (error) {
    console.error("Password reset error:", error);
    return c.json({ error: "Failed to reset password", code: "auth/server-error" }, 500);
  }
});

router.post("/update-password", authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    // The update-password route might receive a token (from email link) or use an existing session.
    // For now, let's assume it requires an active session (JWT in Authorization header).
    // If using a reset token, the schema would need a `token` field from the query/body.
    const validation = updatePasswordSchema.safeParse(body); 

    if (!validation.success) {
      return c.json(
        {
          error: "Invalid input",
          code: "auth/invalid-input",
        },
        400
      );
    }

    const { password } = validation.data;
    const userFromContext = c.get("user"); // Assumes authMiddleware populates this after JWT validation

    if (!userFromContext || !userFromContext.id) {
         // This case should ideally be caught by authMiddleware if the route is protected
        return c.json({ error: "Unauthorized: No user session", code: "auth/no-session" }, 401);
    }
    
    // TODO: If using a reset token (passed in body or query):
    // 1. Validate the token against KV.
    // 2. Get userId from KV.
    // 3. Hash the new password.
    // 4. Update user's passwordHash in D1.
    // 5. Invalidate/delete the reset token from KV.

    // Assuming JWT based update for now:
    const db = createD1Client(c.env);
    const newPasswordHash = await hashPassword(password);
    await db.update(schema.users)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date().toISOString() })
      .where(eq(schema.users.id, userFromContext.id));
    
    console.warn("TODO: Invalidate existing sessions/refresh tokens for the user after password update.");

    return c.json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("Password update error:", error);
    return c.json({ error: "Failed to update password", code: "auth/server-error" }, 500);
  }
});

// router.post("/send-otp", otpRateLimiter, async (c) => {
//   // ... old code commented or removed ...
//   // TODO: Implement OTP sending with KV and SMS provider
// });

// router.post("/verify-otp", otpRateLimiter, async (c) => {
//   // ... old code commented or removed ...
//   // TODO: Implement OTP verification against KV
// });


// This route is no longer needed as session validation will be handled by authMiddleware
// and the refresh mechanism.
// router.post("/validate-session", authRateLimiter, async (c) => {
//  // ... old code commented or removed ...
// });

router.post("/logout", async (c) => {
    // For stateless JWTs, logout is primarily a client-side operation (deleting the token).
    // For stateful sessions using refresh tokens in KV:
    // 1. Client sends refresh token (if available and strategy requires it for logout).
    // 2. Server invalidates/deletes the refresh token from KV.
    
    const body = await c.req.json().catch(() => ({})); // Optional: client might send refresh_token
    const refreshTokenToInvalidate = body.refresh_token;

    if (refreshTokenToInvalidate && c.env.REFRESH_TOKEN_KV) {
        await c.env.REFRESH_TOKEN_KV.delete(`rt_${refreshTokenToInvalidate}`);
        // console.warn("TODO: Implement refresh token invalidation in KV for logout."); // Addressed
    }
    
    // It's also good practice to clear any cookies if they were set (though JWTs are often Bearer tokens)
    // c.res.headers.append('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0; Secure; SameSite=Lax');

    return c.json({ success: true, message: "Logged out successfully." });
});

// Add GET /me to return current user info and profile existence
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

export default router;
