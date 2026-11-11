/*
 * PARKED, TEMP(json-store): editor sign-in, against the users table in PostgreSQL.
 * The site runs on the seed files for now and nothing mounts this
 * (see editor-api.ts). Kept whole and compiled for the return to PostgreSQL:
 * docs/json-store.md.
 */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { DUMMY_HASH, schema, verifyPassword } from '@todoi/db';
import { LoginBody } from '@todoi/shared';
import { checkLoginRate, clearLoginRate, endSession, requireEditor, startSession } from '../auth.ts';
import { HttpProblem } from '../errors.ts';
import { zv } from '../middleware/validate.ts';
import type { EditorEnv } from '../types.ts';

/** Editor sign-in. Not optimistic: the editor waits for the server's answer. */
export const authApi = new Hono<EditorEnv>()
  .get('/session', (c) => {
    c.header('Cache-Control', 'no-store');
    // Signed out is an answer, not an error: null, with a 200.
    const user = c.var.user;
    return c.json(user ? { email: user.email, csrfToken: user.csrfToken } : null);
  })
  .post('/login', zv('json', LoginBody), async (c) => {
    c.header('Cache-Control', 'no-store');
    const { email, password } = c.req.valid('json');
    const address = email.toLowerCase();
    await checkLoginRate(c, address);
    const [user] = await c.var.db.select().from(schema.users).where(eq(schema.users.email, address));
    // Compare against something either way, so the time taken does not say whether the e-mail exists.
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new HttpProblem(401, 'unauthorized', 'That e-mail and password do not match.');
    await clearLoginRate(c, address);
    const csrfToken = await startSession(c, user.id);
    return c.json({ email: user.email, csrfToken });
  })
  .post('/logout', requireEditor, async (c) => {
    await endSession(c);
    return c.json({ ok: true });
  });
