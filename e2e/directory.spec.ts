import { expect, test, type Page } from '@playwright/test';

/** Behaviour that must survive the rebuild (plan §06), exercised in a real browser. */

const errors: string[] = [];
test.beforeEach(({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Outdated Optimize Dep/.test(m.text())) errors.push(m.text());
  });
});
test.afterEach(() => {
  expect(errors, 'no errors in the console (hydration included)').toEqual([]);
});

async function ready(page: Page, url: string) {
  await page.goto(url);
  // Hydrated: the theme store has synced and React owns the board.
  await page.waitForFunction(() => document.querySelector('#theme-switch [aria-checked="true"]') !== null);
  await page.waitForLoadState('networkidle');
}

const visibleSlugs = (page: Page) =>
  page.locator('tr.matrix-row:visible').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-slug')));

test('opens by community size, largest first, ties alphabetical', async ({ page }) => {
  await ready(page, '/');
  const slugs = await visibleSlugs(page);
  expect(slugs.slice(0, 4)).toEqual(['huly', 'openproject', 'plane', 'redmine']);
  await expect(page.locator('th[aria-sort="descending"]')).toHaveText(/Community/);
  await expect(page.locator('#result-count')).toHaveText('25 projects');
});

test('a header sorts, a second click reverses, and the URL keeps the view', async ({ page }) => {
  await ready(page, '/');
  await page.locator('button.th-sort[data-sort="name"]').click();
  await expect(page).toHaveURL(/\?sort=name-asc$/);
  expect((await visibleSlugs(page))[0]).toBe('affine');
  await expect(page.locator('#sort-dir-label')).toHaveText('A to Z');
  await page.locator('button.th-sort[data-sort="name"]').click();
  await expect(page).toHaveURL(/\?sort=name-desc$/);
  expect((await visibleSlugs(page))[0]).toBe('worklenz');
  await page.reload();
  expect((await visibleSlugs(page))[0]).toBe('worklenz');
});

test('the lead column follows a criterion sort, and the select names it', async ({ page }) => {
  await ready(page, '/');
  await page.locator('#sort-field').click();
  await page.getByRole('option', { name: 'Ease of deployment' }).click();
  await expect(page).toHaveURL(/sort=deploy-desc/);
  await expect(page.locator('.th-lead-l')).toHaveText('Deploy');
  await expect(page.locator('#sort-field')).toHaveText('Ease of deployment');
  // Super Productivity deploys at 5.0: first, and its lead cell shows the criterion.
  const first = page.locator('tr.matrix-row:visible').first();
  await expect(first).toHaveAttribute('data-slug', 'super-productivity');
  await expect(first.locator('.score-num')).toHaveText('5.0');
  await expect(first.locator('[data-score-sr]')).toHaveText('Ease of deployment: 5.0 out of 5');
  await page.locator('#sort-dir').click();
  await expect(page).toHaveURL(/sort=deploy-asc/);
});

test('records with no figure sort last both ways', async ({ page }) => {
  await ready(page, '/commercial-task-managers/?sort=price-asc');
  const asc = await visibleSlugs(page);
  await page.locator('#sort-dir').click();
  const desc = await visibleSlugs(page);
  // Quote-only products end both orders.
  expect(asc.at(-1)).toBe(desc.at(-1));
  await expect(page.locator('#sort-dir-label')).toHaveText('Dearest first');
});

test('search narrows the list and announces the count', async ({ page }) => {
  await ready(page, '/');
  await page.locator('#q').fill('kanban');
  await expect(page).toHaveURL(/\?q=kanban/);
  await expect(page.locator('#result-count')).toHaveText('5 of 25 projects');
  await expect(page.locator('#copy-link')).toBeVisible();
  await page.locator('#q').fill('');
  await expect(page.locator('#result-count')).toHaveText('25 projects');
  await expect(page).toHaveURL(/\/$/);
});

test('a must-have accepts native support only, never partial', async ({ page }) => {
  await ready(page, '/');
  await page.locator('label.toggle', { hasText: 'Time' }).click();
  await expect(page).toHaveURL(/f=tt/);
  const slugs = await visibleSlugs(page);
  // Huly's time tracking is partial: out. OpenProject's is native: in.
  expect(slugs).not.toContain('huly');
  expect(slugs).toContain('openproject');
  // Base UI renders the control as role=checkbox; #f-tt is its form input.
  await expect(page.getByRole('checkbox', { name: 'Time tracking' })).toHaveAttribute('aria-checked', 'true');
});

test('the empty state names each constraint and removes it on demand', async ({ page }) => {
  await ready(page, '/commercial-task-managers/?f=free,sync&lic=enterprise&q=zz');
  const empty = page.locator('#empty');
  await expect(empty).toBeVisible();
  await expect(page.locator('#empty-title')).toHaveText('Nothing matches “zz” with those filters');
  await expect(page.locator('.matrix-scroll')).toBeHidden();
  await page.getByRole('button', { name: 'Remove search zz' }).click();
  await expect(page.locator('#empty-text')).toHaveText(
    'No product here has two-way calendar sync and a free plan and is built for large organisations. Partial support never satisfies a must-have. Remove one constraint below.',
  );
  await page.locator('#empty-clear').click();
  await expect(empty).toBeHidden();
  await expect(page.locator('#q')).toBeFocused();
  await expect(page.locator('#result-count')).toHaveText('57 products');
});

test('a record expands, names itself in the URL, and closes from its foot', async ({ page }) => {
  await ready(page, '/');
  const row = page.locator('tr.matrix-row[data-slug="plane"]');
  const detail = page.locator('#detail-plane');
  await expect(detail).toBeHidden();
  await row.locator('button.row-expand').click();
  await expect(detail).toBeVisible();
  await expect(row.locator('button.row-expand')).toHaveAttribute('aria-expanded', 'true');
  await expect(page).toHaveURL(/\?open=plane/);
  await expect(detail.locator('.detail-summary')).toContainText('Plane');
  await detail.locator('.detail-close').click();
  await expect(detail).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await expect(row.locator('button.row-expand')).toBeFocused();
});

test('old links keep working: ?open=, #slug and /index.html', async ({ page }) => {
  await ready(page, '/?open=vikunja');
  await expect(page.locator('#detail-vikunja')).toBeVisible();
  await ready(page, '/commercial-task-managers/#asana');
  await expect(page.locator('#detail-asana')).toBeVisible();
  await expect(page).toHaveURL(/\/commercial-task-managers\/\?open=asana$/);
  await page.goto('/commercial-task-managers/index.html?sort=name-asc');
  await expect(page).toHaveURL(/\/commercial-task-managers\/\?sort=name-asc$/);
  await page.goto('/commercial-task-managers');
  await expect(page).toHaveURL(/\/commercial-task-managers\/$/);
});

test('a filtered-out record does not stay open behind the filter', async ({ page }) => {
  await ready(page, '/?open=huly');
  await expect(page.locator('#detail-huly')).toBeVisible();
  await page.locator('#q').fill('vikunja');
  await expect(page.locator('#result-count')).toHaveText('1 of 25 projects');
  await page.locator('#q').fill('');
  await expect(page.locator('tr.matrix-row[data-slug="huly"]')).toBeVisible();
  await expect(page.locator('#detail-huly')).toBeHidden();
});

test('"/" focuses the search box, but never steals it from a field', async ({ page }) => {
  await ready(page, '/');
  await page.locator('body').press('/');
  await expect(page.locator('#q')).toBeFocused();
  await page.locator('#q').pressSequentially('a/b');
  await expect(page.locator('#q')).toHaveValue('a/b');
});

test('the theme switch persists, follows the arrows, and never flashes', async ({ page }) => {
  await ready(page, '/');
  await page.locator('.theme-switch-opt[data-theme-value="dark"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('todoi-theme'))).toBe('dark');
  await page.reload();
  // Set by the head script before paint, before React hydrates.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('.theme-switch-opt[data-theme-value="dark"]').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('.theme-switch-opt[data-theme-value="light"]')).toBeFocused();
});

test('method tooltips open on hover and on keyboard focus', async ({ page }) => {
  await ready(page, '/');
  const tip = page.locator('#token-tip');
  await page.locator('tr.matrix-row').first().locator('.tag').focus();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('recognised free and open-source licence');
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await page.locator('thead .methodology', { hasText: 'Year' }).hover();
  await expect(tip).toBeVisible();
  await expect(tip.locator('.tip-label')).toHaveText('Year');
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('cards replace the table, and a card fetches its record when opened', async ({ page }) => {
    await ready(page, '/commercial-task-managers/');
    await expect(page.locator('.matrix-scroll')).toBeHidden();
    const card = page.locator('article.card[data-slug="asana"]');
    await card.locator('button.card-expand').click();
    const panel = page.locator('#cdetail-asana');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.detail-summary')).toContainText('Asana');
    await expect(panel.locator('.crit')).toHaveCount(7);
  });

  test('the filters sit behind one disclosure that reports what is active', async ({ page }) => {
    await ready(page, '/');
    await expect(page.locator('#filter-options')).toBeHidden();
    await page.locator('#filter-disclosure').click();
    await expect(page.locator('#filter-options')).toBeVisible();
    await page.locator('button.chip[data-model="foss"]').click();
    await expect(page.locator('#filter-disclosure-summary')).toHaveText(/1 active · \d+ results/);
    await expect(page.locator('#filter-disclosure')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#filter-disclosure')).toHaveAccessibleName(/^Filters 1 active · \d+ results$/);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('every record’s detail is in the page and readable', async ({ page }) => {
    for (const [path, count] of [
      ['/', 25],
      ['/commercial-task-managers/', 57],
    ] as const) {
      await page.goto(path);
      const details = page.locator('tr.detail-row .detail');
      await expect(details).toHaveCount(count);
      await expect(page.locator('tr.detail-row:visible')).toHaveCount(count);
      for (const d of await details.all()) {
        await expect(d.locator('.crit')).toHaveCount(7);
        expect((await d.locator('.summary').innerText()).length).toBeGreaterThan(200);
      }
      // The FAQ answers are open too: nothing could open them.
      await expect(page.locator('.acc-a').first()).toBeVisible();
    }
  });
});
