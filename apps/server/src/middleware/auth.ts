import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { verify } from "hono/jwt";
import type { Bindings, Variables, AppUser } from "../types";

export async function authMiddleware(c: Context<{ Bindings: Bindings, Variables: Variables }>, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    console.error("[AuthMiddleware] Error: Invalid Authorization header format.");
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    console.error("[AuthMiddleware] Error: No token provided.");
    throw new HTTPException(401, { message: "Unauthorized: No token" });
  }

  try {
    if (!c.env.JWT_SECRET) {
      console.error("[AuthMiddleware] Error: JWT_SECRET is not configured.");
      throw new HTTPException(500, { message: "Internal Server Error: Auth configuration missing" });
    }

    const payload = await verify(token, c.env.JWT_SECRET);

    // Runtime checks for payload properties
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
      console.error("[AuthMiddleware] Error: Invalid token payload - sub or exp missing or wrong type.");
      throw new HTTPException(401, { message: "Invalid token: Payload structure issue" });
    }
    
    const emailFromPayload = typeof payload.email === 'string' ? payload.email : undefined;

    // Check if token is expired (verify should handle this, but an explicit check is fine too)
    if (Date.now() > payload.exp * 1000) {
        console.error("[AuthMiddleware] Error: Token expired.");
        throw new HTTPException(401, { message: "Token expired" });
    }

    const userContext: AppUser = { 
      id: payload.sub, // Now known to be a string
      email: emailFromPayload, // Now string or undefined
    };

    c.set("user", userContext);
    await next();
  } catch (e) {
    const error = e as Error;
    console.error("[AuthMiddleware] JWT verification error:", error.message);
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }
}
