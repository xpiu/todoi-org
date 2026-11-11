import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/**
 * "An edit in /admin appears instantly, survives a reload, and rolls back on a
 * forced failure" (plan §11), against the production build and the test
 * database (reset by e2e/tools/serve-test.mjs on every run).
 */

// PARKED, TEMP(json-store): sign-in and the editor need PostgreSQL, and the site
// runs on data.json for now, so /admin is a 404 (json-store.spec.ts checks
// that it is). Every test in this file is skipped, and reported as skipped,
// until the database returns: remove this one line then. See docs/json-store.md.
test.skip(true, 'Editor parked: the site runs on the seed JSON, without PostgreSQL (docs/json-store.md).');

const EMAIL = process.env.E2E_EDITOR_EMAIL ?? 'e2e-editor@todoi.test';
const PASSWORD = process.env.E2E_EDITOR_PASSWORD ?? 'e2e-editor-password';

test.describe.configure({ mode: 'serial' });

/** Put back every score these tests change, so a reused server reads as seeded. */
const TOUCHED = ['deploy', 'use', 'flex'] as const;
let originals: Record<string, { score: number; review: string }> = {};

async function apiSession(request: APIRequestContext, baseURL: string) {
  const res = await request.post('/api/v1/auth/login', {
    headers: { origin: baseURL },
    data: { email: EMAIL, password: PASSWORD },
  });
  return ((await res.json()) as { csrfToken: string }).csrfToken;
}

async function hulyScores(request: APIRequestContext) {
  const dir = (await (await request.get('/api/v1/admin/directories/open-source')).json()) as {
    records: { slug: string; scores: Record<string, { score: number; review: string; version: number }> }[];
  };
  return dir.records.find((r) => r.slug === 'huly')!.scores;
}

test.beforeAll(async ({ request, baseURL }) => {
  await apiSession(request, baseURL!);
  const scores = await hulyScores(request);
  originals = Object.fromEntries(TOUCHED.map((k) => [k, { score: scores[k]!.score, review: scores[k]!.review }]));
});

test.afterAll(async ({ request, baseURL }) => {
  const csrf = await apiSession(request, baseURL!);
  const scores = await hulyScores(request);
  for (const k of TOUCHED) {
    await request.put(`/api/v1/admin/directories/open-source/records/huly/scores/${k}`, {
      headers: { origin: baseURL!, 'x-csrf-token': csrf },
      data: { version: scores[k]!.version, ...originals[k] },
    });
  }
});

async function signIn(page: Page, url = '/admin?dir=open-source&record=huly') {
  await page.goto(url);
  await page.getByLabel('E-mail').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Huly', level: 2 })).toBeVisible();
}

const scoreForm = (page: Page, criterion: string) => page.locator(`form[data-criterion="${criterion}"]`);
const listScore = (page: Page, slug: string) => page.locator(`.admin-record[data-slug="${slug}"] .admin-record-score`);

test('the editor is client-only and kept out of the index', async ({ request }) => {
  const html = await (await request.get('/admin')).text();
  expect(html).toContain('<meta name="robots" content="noindex, nofollow"/>');
  expect(html).not.toContain('Sign in to edit');
});

test('a wrong password is refused, and nothing is optimistic about it', async ({ page }) => {
  await page.goto('/admin');
  await page.getByLabel('E-mail').fill(EMAIL);
  await page.getByLabel('Password').fill('wrong password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('That e-mail and password do not match.');
});

test('an edit appears at once, before the server answers, and survives a reload', async ({ page }) => {
  await signIn(page);
  await expect(listScore(page, 'huly')).toHaveText('4.2');
  // Hold the request so "at once" means before any answer.
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/api/v1/admin/directories/open-source/records/huly/scores/deploy', async (route) => {
    await held;
    await route.continue();
  });
  const form = scoreForm(page, 'deploy');
  await form.locator('input[name="score"]').fill('5');
  await form.locator('textarea[name="review"]').fill('A single container since the 2026 rewrite.');
  await form.getByRole('button', { name: 'Save' }).click();
  // (3.0 → 5.0 on one of seven inputs: 29.5/7 → 31.5/7 = 4.5)
  await expect(listScore(page, 'huly')).toHaveText('4.5');
  await expect(page.locator('.admin-score strong')).toHaveText('4.5');
  // Its sort position moved too: Huly now sits above the 4.4s.
  const order = await page.locator('.admin-record').evaluateAll((els) => els.map((e) => e.getAttribute('data-slug')));
  expect(order.indexOf('huly')).toBeLessThan(order.indexOf('redmine'));
  release();
  await expect(page.locator('.toast', { hasText: 'Saved' })).toBeVisible();
  await page.unroute('**/api/v1/admin/directories/open-source/records/huly/scores/deploy');

  await page.reload();
  await expect(scoreForm(page, 'deploy').locator('input[name="score"]')).toHaveValue('5.0');
  await expect(listScore(page, 'huly')).toHaveText('4.5');

  // And the public page, rendered again, shows it.
  await page.goto('/?open=huly');
  await expect(page.locator('tr.matrix-row[data-slug="huly"] .score-num')).toHaveText('4.5');
  await expect(page.locator('#detail-huly')).toContainText('A single container since the 2026 rewrite.');
});

test('a forced failure rolls the edit back and says why', async ({ page }) => {
  await signIn(page);
  const before = await listScore(page, 'huly').textContent();
  await page.route('**/api/v1/admin/directories/open-source/records/huly/scores/use', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'internal', message: 'Something went wrong on our side.' } }) }),
  );
  const form = scoreForm(page, 'use');
  await form.locator('input[name="score"]').fill('1');
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.toast', { hasText: 'Not saved' })).toContainText('Something went wrong on our side.');
  await expect(listScore(page, 'huly')).toHaveText(before!);
  await expect(scoreForm(page, 'use').locator('input[name="score"]')).toHaveValue('4.2');
});

test('a stale write is refused, and the other editor’s value is shown', async ({ page, browser }) => {
  await signIn(page);
  // A second editor saves the same score first.
  const other = await browser.newPage();
  await signIn(other);
  const theirs = scoreForm(other, 'flex');
  await theirs.locator('input[name="score"]').fill('3.9');
  await theirs.locator('textarea[name="review"]').fill('Fewer views than it advertises.');
  await theirs.getByRole('button', { name: 'Save' }).click();
  await expect(other.locator('.toast', { hasText: 'Saved' })).toBeVisible();
  await other.close();

  const mine = scoreForm(page, 'flex');
  await mine.locator('input[name="score"]').fill('4.8');
  await mine.getByRole('button', { name: 'Save' }).click();
  const toast = page.locator('.toast', { hasText: 'Someone else changed this first' });
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Their score: 3.9');
  // After the refetch the screen shows what was saved, not what was refused.
  await expect(scoreForm(page, 'flex').locator('input[name="score"]')).toHaveValue('3.9');
});

test('a record is created and deleted only once the server agrees', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'New record' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Example Tracker');
  await dialog.getByLabel('Slug (lower case, hyphens)').fill('example-tracker');
  await dialog.getByLabel('Website').fill('https://example.org/');
  await dialog.getByLabel('First appeared').fill('2026');
  await dialog.getByLabel('One-line description').fill('A record made by the end-to-end tests.');
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: 'Example Tracker', level: 2 })).toBeVisible();
  await expect(page.locator('.admin-record[data-slug="example-tracker"]')).toBeVisible();

  await page.getByRole('button', { name: 'Delete…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.admin-record[data-slug="example-tracker"]')).toHaveCount(0);
});
