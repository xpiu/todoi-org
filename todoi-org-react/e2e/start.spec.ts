import { expect, test } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { ready } from './ready.ts';

/** "Where to start" is a page of its own for each directory; the home page no longer carries it. */

const PAGES = [
  { name: 'open-source', url: '/where-to-start/', home: '/', situations: 14, firstPick: 'openproject' },
  { name: 'commercial', url: '/commercial-task-managers/where-to-start/', home: '/commercial-task-managers/', situations: 12, firstPick: 'asana' },
];

for (const p of PAGES) {
  test.describe(p.name, () => {
    test('the page answers, with a title, canonical and the situations', async ({ page }) => {
      await ready(page, p.url);
      await expect(page.locator('h1')).toHaveText('Where to start');
      await expect(page).toHaveTitle(/^Where to start: choosing a/);
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', new RegExp(`${p.url}$`));
      await expect(page.locator('.route')).toHaveCount(p.situations);
      await expect(page.locator('.start-question')).toHaveCount(3);
      await expect(page.locator('.trial-step')).toHaveCount(4);
      await expect(page.locator('.site-nav a[aria-current=page]')).toHaveText('Where to start');
    });

    test('a pick opens its record in the directory', async ({ page }) => {
      await ready(page, p.url);
      await page.locator(`.route-pick a[href*="open=${p.firstPick}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`${p.home}\\?open=${p.firstPick}$`));
      await expect(page.locator(`tr.matrix-row[data-slug="${p.firstPick}"], article.card[data-slug="${p.firstPick}"]`).first()).toBeVisible();
    });

    test('the directory no longer carries the section, and points here', async ({ page }) => {
      await ready(page, p.home);
      await expect(page.locator('#start')).toHaveCount(0);
      await expect(page.locator('.site-nav a', { hasText: 'Where to start' })).toHaveAttribute('href', new RegExp(`${p.url}$`));
      await expect(page.locator('.hero-start a')).toHaveAttribute('href', new RegExp(`${p.url}$`));
    });

    test('the old #start link lands on the page', async ({ page }) => {
      await page.goto(`${p.home}#start`);
      await expect(page).toHaveURL(new RegExp(`${p.url}$`));
    });

    test('no accessibility violations', async ({ page }) => {
      await ready(page, p.url);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);
    });
  });
}

test('the address without its trailing slash redirects to it', async ({ request }) => {
  for (const base of ['/where-to-start', '/commercial-task-managers/where-to-start']) {
    const res = await request.get(base, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers().location).toBe(`${base}/`);
  }
});

test('the sitemap lists both pages', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text();
  expect(xml).toContain('<loc>https://todoi.org/where-to-start/</loc>');
  expect(xml).toContain('<loc>https://todoi.org/commercial-task-managers/where-to-start/</loc>');
});
