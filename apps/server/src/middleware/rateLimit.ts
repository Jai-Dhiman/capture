import { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyGenerator?: (c: Context) => string;
  message?: string;
  statusCode?: number;
};

const defaultOptions: RateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
  statusCode: 429,
};

export function createRateLimiter(options: Partial<RateLimitOptions> = {}) {
  const opts = { ...defaultOptions, ...options };

  return async function rateLimitMiddleware(c: Context, next: Next) {
    const keyGen = opts.keyGenerator || ((c: Context) => c.req.header("CF-Connecting-IP") || "unknown");
    const key = keyGen(c);

    const limiterKey = `ratelimit:${key}`;
    let requests: { count: number; resetTime: number } | null = null;

    try {
      const storedData = await c.env.KV.get(limiterKey);
      if (storedData) {
        requests = JSON.parse(storedData);
      }
    } catch (error) {
      console.error("Error retrieving rate limit data:", error);
    }

    const now = Date.now();

    if (!requests) {
      requests = {
        count: 1,
        resetTime: now + opts.windowMs,
      };
    } else if (now > requests.resetTime) {
      requests = {
        count: 1,
        resetTime: now + opts.windowMs,
      };
    } else {
      requests.count += 1;
    }

    try {
      await c.env.KV.put(limiterKey, JSON.stringify(requests), { expirationTtl: Math.ceil(opts.windowMs / 1000) });
    } catch (error) {
      console.error("Error storing rate limit data:", error);
    }

    c.header("X-RateLimit-Limit", opts.max.toString());
    c.header("X-RateLimit-Remaining", Math.max(0, opts.max - requests.count).toString());
    c.header("X-RateLimit-Reset", Math.ceil(requests.resetTime / 1000).toString());

    if (requests.count > opts.max) {
      c.header("Retry-After", Math.ceil((requests.resetTime - now) / 1000).toString());
      throw new HTTPException(opts.statusCode as 429, { message: opts.message });
    }

    await next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many authentication attempts, please try again later.",
});

export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many password reset attempts, please try again later.",
});

export const otpRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: "Too many OTP requests, please try again later.",
});
