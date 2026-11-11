import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * TEMP(json-store): the site runs on the committed seed file, data.json, with no
 * database, and sign-in and the editor are off (docs/json-store.md). These
 * hold the production build to both halves of that: every record in the seed
 * is served, and nothing that would need PostgreSQL is reachable.
 *
 * With the database back, delete this file and un-skip admin.spec.ts.
 */
interface Seed {
  slug: string;
  path: string;
  csvFile: string;
  records: { slug: string; name: string }[];
}
const SEEDS = (
  JSON.parse(readFileSync(fileURLToPath(new URL('../packages/db/seed/data.json', import.meta.url)), 'utf8')) as {
    directories: Seed[];
  }
).directories;

test('health reports data.json as the data, with no database behind it', async ({ request }) => {
  const res = await request.get('/healthz');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true, data: 'seed-json', directories: SEEDS.length });
});

for (const s of SEEDS) {
  test(`${s.slug}: the API serves every record in the seed file, in its order`, async ({ request }) => {
    const res = await request.get(`/api/v1/directories/${s.slug}`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { directory: { slug: string }; records: { slug: string; name: string }[] };
    expect(body.directory.slug).toBe(s.slug);
    expect(body.records.map((r) => [r.slug, r.name])).toEqual(s.records.map((r) => [r.slug, r.name]));
  });

  test(`${s.slug}: the page renders every record on the server`, async ({ request }) => {
    const html = await (await request.get(s.path)).text();
    // One matrix row per record, in the HTML before any script runs.
    const rows = [...html.matchAll(/<tr[^>]*\bdata-slug="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(rows)).toEqual(new Set(s.records.map((r) => r.slug)));
  });

  test(`${s.slug}: one record's detail and the dataset are served`, async ({ request }) => {
    const first = s.records[0]!;
    const detail = await request.get(`/api/v1/directories/${s.slug}/records/${first.slug}`);
    expect(detail.status()).toBe(200);
    expect(((await detail.json()) as { slug: string }).slug).toBe(first.slug);

    const csv = await request.get(`/${s.csvFile}`);
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toContain('text/csv');
    // A header row and one row per record (fields are quoted; none spans lines).
    expect((await csv.text()).trimEnd().split('\r\n')).toHaveLength(s.records.length + 1);
  });
}

test('sign-in and the editor API are not there', async ({ request, baseURL }) => {
  const origin = { origin: baseURL! };
  const calls = [
    await request.get('/api/v1/auth/session'),
    await request.post('/api/v1/auth/login', { headers: origin, data: { email: 'someone@example.org', password: 'x' } }),
    await request.post('/api/v1/auth/logout', { headers: origin }),
    await request.get('/api/v1/admin/directories'),
    await request.get('/api/v1/admin/directories/open-source'),
    await request.patch('/api/v1/admin/directories/open-source/records/huly', { headers: origin, data: { version: 1, name: 'x' } }),
    await request.put('/api/v1/admin/directories/open-source/records/huly/scores/use', {
      headers: origin,
      data: { version: 1, score: 1, review: 'x' },
    }),
    await request.post('/api/v1/admin/directories/open-source/records', { headers: origin, data: {} }),
    await request.delete('/api/v1/admin/directories/open-source/records/huly', { headers: origin }),
  ];
  for (const res of calls) {
    expect(res.status(), res.url()).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code, res.url()).toBe('not_found');
    expect(res.headers()['set-cookie'], res.url()).toBeUndefined();
  }
  // And the record the writes aimed at is as the seed has it.
  const dir = (await (await request.get('/api/v1/directories/open-source')).json()) as { records: { slug: string; name: string }[] };
  expect(dir.records.find((r) => r.slug === 'huly')?.name).toBe(SEEDS[0]!.records.find((r) => r.slug === 'huly')!.name);
});

test('/admin is the 404 page: no sign-in form, and the editor is never downloaded', async ({ page }) => {
  const scripts: string[] = [];
  const apiCalls: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (r.resourceType() === 'script') scripts.push(url.pathname);
    if (url.pathname.startsWith('/api/')) apiCalls.push(url.pathname);
  });

  const res = await page.goto('/admin?dir=commercial&record=asana');
  expect(res!.status()).toBe(404);
  await page.waitForLoadState('networkidle');

  await expect(page.getByLabel('E-mail')).toHaveCount(0);
  await expect(page.getByLabel('Password')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0);
  await expect(page.locator('.admin')).toHaveCount(0);
  // The same page any unknown address gets.
  const unknown = await page.context().request.get('/no-such-page');
  expect(unknown.status()).toBe(404);
  const heading = await page.getByRole('heading', { level: 1 }).innerText();
  expect(await unknown.text()).toContain(heading);

  expect(apiCalls, 'the page asks the API for nothing').toEqual([]);
  expect(scripts.filter((s) => /admin/i.test(s)), 'no editor chunk').toEqual([]);
});
