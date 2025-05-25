import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import type { Bindings, Variables } from "../types";
import { z } from "zod";
import { authRateLimiter, passwordResetRateLimiter, otpRateLimiter } from "../middleware/rateLimit";
import { createD1Client } from "../db";
import * as schema from "../db/schema";
import { nanoid } from "nanoid";

const router = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const signUpSchema = z.object({
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

const sendOTPSchema = z.object({
  phone: z.string(),
});

const verifyOTPSchema = z.object({
  phone: z.string(),
  token: z.string(),
});

function getSupabaseClient(c: { env: Bindings }) {
  return createClient(c.env.SUPABASE_URL, c.env.SUPABASE_KEY, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

router.post("/signin", authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = signInSchema.safeParse(body);

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
    const supabase = getSupabaseClient(c);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return c.json({ error: error.message, code: "auth/invalid-credentials" }, 400);
    }

    // record login event
    const db = createD1Client(c.env);
    await db.insert(schema.userActivity).values({
      id: nanoid(),
      userId: data.user?.id,
      eventType: "login",
      createdAt: new Date().toISOString(),
    });

    return c.json(data);
  } catch (error) {
    console.error("Sign in error:", error);
    return c.json({ error: "Authentication failed", code: "auth/server-error" }, 500);
  }
});

router.post("/signup", authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = signUpSchema.safeParse(body);

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
    const supabase = getSupabaseClient(c);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${c.req.header("origin") || ""}/auth/callback`,
      },
    });

    if (error) {
      return c.json({ error: error.message, code: "auth/signup-failed" }, 400);
    }

    return c.json(data);
  } catch (error) {
    console.error("Sign up error:", error);
    return c.json({ error: "Registration failed", code: "auth/server-error" }, 500);
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
    const supabase = getSupabaseClient(c);

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error) {
      return c.json({ error: error.message, code: "auth/refresh-failed" }, 401);
    }

    if (!data.session) {
      return c.json({ error: "Failed to refresh session", code: "auth/refresh-failed" }, 401);
    }

    return c.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
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

    const { email } = validation.data;
    const supabase = getSupabaseClient(c);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${c.req.header("origin") || ""}/auth/reset-password`,
    });

    if (error) {
      return c.json({ error: error.message, code: "auth/reset-failed" }, 400);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Password reset error:", error);
    return c.json({ error: "Failed to reset password", code: "auth/server-error" }, 500);
  }
});

router.post("/update-password", authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
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
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return c.json({ error: "No token provided", code: "auth/no-token" }, 401);
    }

    const supabase = getSupabaseClient(c);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      return c.json({ error: error.message, code: "auth/update-failed" }, 400);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Password update error:", error);
    return c.json({ error: "Failed to update password", code: "auth/server-error" }, 500);
  }
});

router.post("/send-otp", otpRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = sendOTPSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: "Invalid input",
          code: "auth/invalid-input",
        },
        400
      );
    }

    const { phone } = validation.data;
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return c.json({ error: "No token provided", code: "auth/no-token" }, 401);
    }

    const supabase = getSupabaseClient(c);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return c.json({ error: userError?.message || "Invalid token", code: "auth/invalid-token" }, 401);
    }

    const { data, error } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (error) {
      return c.json({ error: error.message, code: "auth/otp-failed" }, 400);
    }

    return c.json(data);
  } catch (error) {
    console.error("OTP send error:", error);
    return c.json({ error: "Failed to send verification code", code: "auth/server-error" }, 500);
  }
});

router.post("/verify-otp", otpRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = verifyOTPSchema.safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: "Invalid input",
          code: "auth/invalid-input",
        },
        400
      );
    }

    const { phone, token } = validation.data;
    const supabase = getSupabaseClient(c);

    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });

    if (error) {
      return c.json({ error: error.message, code: "auth/verify-failed" }, 400);
    }

    return c.json(data);
  } catch (error) {
    console.error("OTP verification error:", error);
    return c.json({ error: "Failed to verify code", code: "auth/server-error" }, 500);
  }
});

router.post("/validate-session", authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const { session, user } = body;

    if (!session || !session.access_token || !user || !user.id) {
      return c.json({ error: "Invalid session data", code: "auth/invalid-session" }, 400);
    }

    const supabase = getSupabaseClient(c);

    const { data: validatedUser, error: validationError } = await supabase.auth.getUser(session.access_token);

    if (validationError || !validatedUser) {
      return c.json({ error: "Invalid session", code: "auth/invalid-session" }, 401);
    }

    if (validatedUser.user.id !== user.id) {
      return c.json({ error: "User ID mismatch", code: "auth/user-mismatch" }, 401);
    }

    return c.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone || null,
        phone_confirmed_at: user.phone_confirmed_at || null,
      },
    });
  } catch (error) {
    console.error("Session validation error:", error);
    return c.json({ error: "Failed to validate session", code: "auth/server-error" }, 500);
  }
});

export default router;
