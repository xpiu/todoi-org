import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { hashPassword, schema, type Database } from '@todoi/db';
import { createApp } from '../app.ts';
import type { Env } from '../env.ts';
import { DirectoryStore } from '../store.ts';
import { testDatabase } from '../test/db.ts';

const env: Env = {
  NODE_ENV: 'test',
  PORT: 0,
  HOST: '127.0.0.1',
  DATABASE_URL: 'postgres://unused',
  SITE_URL: 'https://todoi.org',
  SESSION_SECRET: 'x'.repeat(32),
  TRUST_PROXY: false,
};
const ORIGIN = 'http://localhost';
const EMAIL = 'editor@example.org';
const PASSWORD = 'correct horse battery staple';

let database: Database;
let app: ReturnType<typeof createApp>;
let store: DirectoryStore;

beforeAll(async () => {
  database = await testDatabase();
  const passwordHash = await hashPassword(PASSWORD);
  await database.db.insert(schema.users).values({ email: EMAIL, passwordHash }).onConflictDoUpdate({ target: schema.users.email, set: { passwordHash } });
  store = new DirectoryStore(database.db);
  app = createApp({
    db: database.db,
    store,
    env,
    cachePages: false,
    render: async () => new Response('<html><body></body></html>', { headers: { 'content-type': 'text/html' } }),
  });
});
afterAll(() => database.close());
beforeEach(async () => {
  await database.db.execute(sql`delete from login_attempts`);
});

function req(path: string, init: RequestInit & { cookie?: string; csrf?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set('host', 'localhost');
  if (init.method && init.method !== 'GET') headers.set('origin', ORIGIN);
  if (init.body) headers.set('content-type', 'application/json');
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.csrf) headers.set('x-csrf-token', init.csrf);
  return app.request(`http://localhost${path}`, { ...init, headers });
}

async function signIn() {
  const res = await req('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  expect(res.status).toBe(200);
  const cookie = res.headers.get('set-cookie')!.split(';')[0]!;
  const { csrfToken } = (await res.json()) as { csrfToken: string };
  return { cookie, csrf: csrfToken };
}

describe('sign-in', () => {
  it('sets an HttpOnly, SameSite session cookie and returns a CSRF token', async () => {
    const res = await req('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
    expect(res.status).toBe(200);
    const set = res.headers.get('set-cookie')!;
    expect(set).toMatch(/todoi_session=/);
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=Lax/i);
  });

  it('refuses a wrong password with the one error shape', async () => {
    const res = await req('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: 'nope' }) });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: 'unauthorized', message: 'That e-mail and password do not match.' } });
  });

  it('rate limits repeated attempts on one e-mail', async () => {
    let last = 0;
    for (let i = 0; i < 9; i++) {
      last = (await req('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: 'nope' }) })).status;
    }
    expect(last).toBe(429);
  });

  it('refuses a cross-site sign-in', async () => {
    const res = await app.request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { host: 'localhost', origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    expect(res.status).toBe(403);
  });
});

describe('editor writes', () => {
  it('need a session, then the CSRF token', async () => {
    const body = JSON.stringify({ version: 1, score: 4, review: 'x' });
    const path = '/api/v1/admin/directories/open-source/records/huly/scores/deploy';
    expect((await req(path, { method: 'PUT', body })).status).toBe(401);
    const { cookie } = await signIn();
    expect((await req(path, { method: 'PUT', body, cookie })).status).toBe(403);
    expect((await req(path, { method: 'PUT', body, cookie, csrf: 'wrong' })).status).toBe(403);
  });

  it('save a score, bump its version, and show at once on the public API', async () => {
    const { cookie, csrf } = await signIn();
    const before = (await (await req('/api/v1/directories/open-source')).json()) as { records: { slug: string; scores: Record<string, number> }[] };
    expect(before.records.find((r) => r.slug === 'huly')!.scores.deploy).toBe(3);
    const admin = (await (await req('/api/v1/admin/directories/open-source', { cookie })).json()) as {
      records: { slug: string; scores: Record<string, { version: number }> }[];
    };
    const version = admin.records.find((r) => r.slug === 'huly')!.scores.deploy!.version;
    const res = await req('/api/v1/admin/directories/open-source/records/huly/scores/deploy', {
      method: 'PUT',
      cookie,
      csrf,
      body: JSON.stringify({ version, score: 3.4, review: 'Fewer services since the 2026 rewrite.' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ score: 3.4, review: 'Fewer services since the 2026 rewrite.', version: version + 1 });
    const after = (await (await req('/api/v1/directories/open-source')).json()) as typeof before;
    expect(after.records.find((r) => r.slug === 'huly')!.scores.deploy).toBe(3.4);
  });

  it('reject a stale write with 409 and the value someone else saved', async () => {
    const { cookie, csrf } = await signIn();
    const path = '/api/v1/admin/directories/commercial/records/asana';
    const first = await req(path, { method: 'PATCH', cookie, csrf, body: JSON.stringify({ version: 1, caveat: 'First editor.' }) });
    expect(first.status).toBe(200);
    const second = await req(path, { method: 'PATCH', cookie, csrf, body: JSON.stringify({ version: 1, caveat: 'Second editor.' }) });
    expect(second.status).toBe(409);
    const body = (await second.json()) as { error: { code: string; current: { caveat: string; version: number } } };
    expect(body.error.code).toBe('conflict');
    expect(body.error.current.caveat).toBe('First editor.');
    expect(body.error.current.version).toBe(2);
  });

  it('validate every body at the boundary', async () => {
    const { cookie, csrf } = await signIn();
    const res = await req('/api/v1/admin/directories/open-source/records/huly/scores/deploy', {
      method: 'PUT',
      cookie,
      csrf,
      body: JSON.stringify({ version: 1, score: 7, review: '' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { issues: { path: string }[] } };
    expect(body.error.issues.map((i) => i.path).sort()).toEqual(['review', 'score']);
  });

  it('sanitise an FAQ answer to the inline allow-list', async () => {
    const { cookie, csrf } = await signIn();
    const dir = (await (await req('/api/v1/admin/directories/open-source', { cookie })).json()) as {
      directory: { faqs: { id: number; version: number }[] };
    };
    const faq = dir.directory.faqs[0]!;
    const res = await req(`/api/v1/admin/directories/open-source/faqs/${faq.id}`, {
      method: 'PUT',
      cookie,
      csrf,
      body: JSON.stringify({
        version: faq.version,
        question: 'What is todoi.org?',
        answer: '<p onclick="x()">A <strong>directory</strong><script>alert(1)</script> <a href="javascript:x">link</a>.</p>',
      }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { answer: string }).answer).toBe('<p>A <strong>directory</strong> <a>link</a>.</p>');
  });

  it('create and delete a record, waiting for the server each time', async () => {
    const { cookie, csrf } = await signIn();
    const created = await req('/api/v1/admin/directories/open-source/records', {
      method: 'POST',
      cookie,
      csrf,
      body: JSON.stringify({ slug: 'example-tracker', name: 'Example Tracker', url: 'https://example.org/', blurb: 'A test.', model: 'foss', year: 2026 }),
    });
    expect(created.status).toBe(201);
    const list = (await (await req('/api/v1/directories/open-source')).json()) as { records: { slug: string }[] };
    expect(list.records.map((r) => r.slug)).toContain('example-tracker');
    const gone = await req('/api/v1/admin/directories/open-source/records/example-tracker', { method: 'DELETE', cookie, csrf });
    expect(gone.status).toBe(200);
  });

  it('sign out ends the session', async () => {
    const { cookie, csrf } = await signIn();
    expect((await req('/api/v1/auth/logout', { method: 'POST', cookie, csrf })).status).toBe(200);
    expect((await req('/api/v1/auth/session', { cookie })).status).toBe(401);
  });
});
