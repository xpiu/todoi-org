import { z } from 'zod';

/**
 * Parsed once at startup. A missing or malformed value stops the server with
 * a message naming it, instead of failing later on the first request.
 */
const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.url().refine((u) => /^postgres(ql)?:\/\//.test(u), 'must be a postgres:// URL'),
  SITE_URL: z
    .url()
    .default('https://todoi.org')
    .transform((u) => u.replace(/\/+$/, '')),
  SESSION_SECRET: z.string().min(32, 'at least 32 characters'),
  /** Trust X-Forwarded-For from the proxy in front (Traefik) for rate limiting. */
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
export type Env = z.infer<typeof Env>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`);
    console.error(`Invalid environment:\n${lines.join('\n')}`);
    process.exit(1);
  }
  return parsed.data;
}
