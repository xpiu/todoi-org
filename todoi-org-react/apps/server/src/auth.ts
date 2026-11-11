/*
 * PARKED, TEMP(json-store): sessions, CSRF and the sign-in rate limit, all stored in PostgreSQL.
 * The site runs on the seed files for now and nothing mounts this
 * (see editor-api.ts). Kept whole and compiled for the return to PostgreSQL:
 * docs/json-store.md.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { getConnInfo } from '@hono/node-server/conninfo';
import { schema } from '@todoi/db';
import { forbidden, HttpProblem, unauthorized } from './errors.ts';
import type { EditorEnv, SessionUser } from './types.ts';

export const SESSION_COOKIE = 'todoi_session';
const SESSION_DAYS = 14;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Create a session, set its cookie, and return the CSRF token the editor must send with every write. */
export async function startSession(c: Context<EditorEnv>, userId: number): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await c.var.db.insert(schema.sessions).values({ id: sha256(token), userId, csrfToken, expiresAt });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: c.var.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
  // Expired sessions go when anyone signs in; there are never many.
  await c.var.db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
  return csrfToken;
}

export async function endSession(c: Context<EditorEnv>): Promise<void> {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.var.db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

/** Reads the session cookie, if any, into c.var.user. */
export const loadSession = createMiddleware<EditorEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const [row] = await c.var.db
      .select({
        sessionId: schema.sessions.id,
        csrfToken: schema.sessions.csrfToken,
        id: schema.users.id,
        email: schema.users.email,
      })
      .from(schema.sessions)
      .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
      .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())));
    if (row) c.set('user', row satisfies SessionUser);
  }
  await next();
});

/**
 * A write must come from this site: the Origin header (sent by every browser
 * on a POST, PUT, PATCH or DELETE) names this host. With SameSite=Lax cookies
 * that already stops cross-site forms; the CSRF token below covers the rest.
 */
export const sameOrigin = createMiddleware<EditorEnv>(async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const origin = c.req.header('origin');
    const host = c.req.header('x-forwarded-host') ?? c.req.header('host');
    if (!origin || !host || new URL(origin).host !== host) throw forbidden('Cross-site request refused.');
  }
  await next();
});

/** Signed in, and (for writes) carrying the session's CSRF token. */
export const requireEditor = createMiddleware<EditorEnv>(async (c, next) => {
  const user = c.var.user;
  if (!user) throw unauthorized();
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    const sent = c.req.header('x-csrf-token') ?? '';
    if (!sameToken(sent, user.csrfToken)) throw forbidden('Missing or stale CSRF token. Reload the editor.');
  }
  c.header('Cache-Control', 'no-store');
  await next();
});

export function clientAddress(c: Context<EditorEnv>): string {
  if (c.var.env.TRUST_PROXY) {
    const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
    if (fwd) return fwd;
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

const WINDOW_MINUTES = 15;
const LIMITS = { ip: 20, email: 8 };

/**
 * Login is rate limited per client address and per e-mail, counted in the
 * database so a restart does not reset it and two processes share it.
 */
export async function checkLoginRate(c: Context<EditorEnv>, email: string): Promise<void> {
  const keys = [`ip:${clientAddress(c)}`, `email:${email}`];
  const since = sql`now() - make_interval(mins => ${WINDOW_MINUTES})`;
  const counts = await Promise.all(
    keys.map(async (key) => {
      const [row] = await c.var.db
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.loginAttempts)
        .where(and(eq(schema.loginAttempts.key, key), gt(schema.loginAttempts.at, since)));
      return row?.n ?? 0;
    }),
  );
  if (counts[0]! >= LIMITS.ip || counts[1]! >= LIMITS.email) {
    c.header('Retry-After', String(WINDOW_MINUTES * 60));
    throw new HttpProblem(429, 'rate_limited', 'Too many sign-in attempts. Wait a few minutes and try again.');
  }
  await c.var.db.insert(schema.loginAttempts).values(keys.map((key) => ({ key })));
  await c.var.db.delete(schema.loginAttempts).where(lt(schema.loginAttempts.at, sql`now() - interval '1 day'`));
}

export async function clearLoginRate(c: Context<EditorEnv>, email: string): Promise<void> {
  await c.var.db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.key, `email:${email}`));
}
