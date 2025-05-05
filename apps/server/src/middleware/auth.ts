import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { createClient } from "@supabase/supabase-js";

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    console.error("[AuthMiddleware] Error: Invalid Authorization header format.");
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    if (!c.env.SUPABASE_URL || !c.env.SUPABASE_KEY) {
      console.error("[AuthMiddleware] Error: Supabase URL or Key is missing.");
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_KEY);

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error("[AuthMiddleware] Supabase auth error or no user returned.");
      throw new HTTPException(401, { message: "Invalid token" });
    }

    const userContext = {
      id: user.id,
      email: user.email,
      role: user.role,
      ...user.user_metadata,
    };

    c.set("user", userContext);
    await next();
  } catch (error) {
    console.error("[AuthMiddleware] Caught error:", error);
    if (error instanceof HTTPException) {
      throw error; // Re-throw Hono exceptions
    }
    // For unexpected errors not already wrapped in HTTPException
    console.error("[AuthMiddleware] Throwing generic 500 error for unexpected issue.");
    throw new HTTPException(500, { message: "Internal Server Error" });
  }
}
