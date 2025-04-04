import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import type { Bindings, Variables } from "../types";
import { z } from "zod";
import { authRateLimiter, passwordResetRateLimiter, otpRateLimiter } from "../middleware/rateLimit";

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

const oauthSchema = z.object({
  provider: z.enum(["google", "apple"]),
  code_challenge: z.string(),
  code_challenge_method: z.enum(["S256"]),
});

const callbackSchema = z.object({
  url: z.string().url(),
  code_verifier: z.string().optional(),
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

router.post("/oauth", authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = z
      .object({
        provider: z.enum(["google", "apple"]),
      })
      .safeParse(body);

    if (!validation.success) {
      return c.json(
        {
          error: "Invalid input",
          code: "auth/invalid-input",
        },
        400
      );
    }

    const { provider } = validation.data;
    const supabase = getSupabaseClient(c);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${c.req.header("origin") || ""}/auth/callback`,
      },
    });

    if (error) {
      return c.json({ error: error.message, code: "auth/oauth-failed" }, 400);
    }

    return c.json(data);
  } catch (error) {
    console.error("OAuth error:", error);
    return c.json({ error: "OAuth authentication failed", code: "auth/server-error" }, 500);
  }
});

router.post("/handle-callback", authRateLimiter, async (c) => {
  try {
    const body = await c.req.json();
    const validation = z
      .object({
        url: z.string().url(),
      })
      .safeParse(body);

    if (!validation.success) {
      console.error("Invalid input for handle-callback:", validation.error);
      return c.json(
        {
          error: "Invalid input",
          details: validation.error.errors,
          code: "auth/invalid-input",
        },
        400
      );
    }

    const { url } = validation.data;
    console.log("Processing auth callback URL:", url);

    if (!url || typeof url !== "string") {
      console.error("Invalid URL provided:", url);
      return c.json(
        {
          error: "Invalid URL provided",
          code: "auth/invalid-url",
        },
        400
      );
    }

    let code = null;
    try {
      const urlObj = new URL(url);
      code = urlObj.searchParams.get("code");
      console.log("Extracted code from URL:", code ? "Yes" : "No");
    } catch (err) {
      console.error("Error parsing URL:", err);
      return c.json(
        {
          error: "Failed to parse URL",
          code: "auth/invalid-url",
        },
        400
      );
    }

    const supabase = getSupabaseClient(c);

    if (code) {
      try {
        console.log("Exchanging code for session");

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("Error exchanging code for session:", error);
          return c.json(
            {
              error: error.message,
              code: "auth/exchange-failed",
            },
            400
          );
        }

        if (!data.session || !data.user) {
          console.error("Missing session or user in auth response");
          return c.json(
            {
              error: "Invalid authentication response",
              code: "auth/invalid-response",
            },
            400
          );
        }

        console.log("Successfully exchanged code for session");
        return c.json({
          session: data.session,
          user: data.user,
        });
      } catch (err) {
        console.error("Exception during code exchange:", err);
        return c.json(
          {
            error: err instanceof Error ? err.message : "Failed to exchange code for session",
            code: "auth/exchange-error",
          },
          400
        );
      }
    } else if (url.includes("#")) {
      try {
        const hashFragment = url.split("#")[1] || "";
        const hashParams = new URLSearchParams(hashFragment);

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        console.log(
          "Extracted from hash fragment - access token:",
          accessToken ? "Yes" : "No",
          "refresh token:",
          refreshToken ? "Yes" : "No"
        );

        if (accessToken && refreshToken) {
          console.log("Setting session from access and refresh tokens");
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("Error setting session:", error);
            return c.json(
              {
                error: error.message,
                code: "auth/session-error",
              },
              400
            );
          }

          console.log("Successfully set session from tokens");
          return c.json({
            session: data.session,
            user: data.user,
            type,
          });
        } else {
          console.error("Missing tokens in hash fragment");
          return c.json(
            {
              error: "Missing authentication tokens",
              code: "auth/missing-tokens",
            },
            400
          );
        }
      } catch (err) {
        console.error("Error processing token response:", err);
        return c.json(
          {
            error: err instanceof Error ? err.message : "Failed to process authentication response",
            code: "auth/token-error",
          },
          400
        );
      }
    } else {
      console.error("No auth parameters found in URL:", url);
      return c.json(
        {
          error: "Invalid auth callback URL. No authentication parameters found.",
          code: "auth/invalid-callback",
        },
        400
      );
    }
  } catch (error) {
    console.error("Unhandled error in auth callback:", error);
    return c.json(
      {
        error: "Failed to process authentication",
        code: "auth/server-error",
      },
      500
    );
  }
});

export default router;
