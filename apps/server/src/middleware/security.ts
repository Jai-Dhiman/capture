import type { Context, Next } from 'hono';
import type { Bindings, Variables } from '@/types';

export const securityHeaders = () => {
  return async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
    // Set security headers for CDN and SSL/TLS
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy for CDN integration
    const cspDirectives = [
      "default-src 'self'",
      "img-src 'self' data: https: blob: https://cdn.capture-app.com https://imagedelivery.net",
      "media-src 'self' https: blob: https://cdn.capture-app.com https://imagedelivery.net",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://api.cloudflare.com https://capture-api.jai-d.workers.dev",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ];
    
    c.header('Content-Security-Policy', cspDirectives.join('; '));
    
    // Additional security headers for CDN
    c.header('X-Permitted-Cross-Domain-Policies', 'none');
    c.header('Cross-Origin-Embedder-Policy', 'require-corp');
    c.header('Cross-Origin-Opener-Policy', 'same-origin');
    c.header('Cross-Origin-Resource-Policy', 'same-origin');
    
    await next();
  };
};

export const cdnSecurityHeaders = () => {
  return async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
    // Enhanced security headers for CDN endpoints
    c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
    c.header('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Allow CDN domain in CSP for image requests
    const cdnDomain = c.env.CDN_DOMAIN || 'cdn.capture-app.com';
    c.header('Access-Control-Allow-Origin', `https://${cdnDomain}`);
    c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    await next();
  };
};

export const sslRedirectMiddleware = () => {
  return async (c: Context<{ Bindings: Bindings; Variables: Variables }>, next: Next) => {
    // Cloudflare Workers automatically handle HTTPS, but we can add additional checks
    const protocol = c.req.header('x-forwarded-proto') || 'https';
    const host = c.req.header('host');
    
    // Force HTTPS redirect for custom domains (CDN domain)
    if (protocol === 'http' && host && host.includes('capture-app.com')) {
      const httpsUrl = `https://${host}${c.req.url}`;
      return c.redirect(httpsUrl, 301);
    }
    
    await next();
  };
};