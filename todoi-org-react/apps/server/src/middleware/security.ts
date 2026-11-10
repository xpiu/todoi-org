import { createMiddleware } from 'hono/factory';

/**
 * The headers nginx sent for the static site, on every response. No
 * includeSubDomains on HSTS: other subdomains aren't ours to promise for.
 * TLS ends at Traefik; HSTS is honoured only there, which is the point.
 */
export const securityHeaders = createMiddleware(async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('Strict-Transport-Security', 'max-age=31536000');
});
