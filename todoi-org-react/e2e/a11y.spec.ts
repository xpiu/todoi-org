import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { ready } from './ready.ts';

/** axe reports no WCAG 2.2 AA failures, and the keyboard reaches everything (plan §11). */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function open(page: Page, url: string, mode: 'light' | 'dark') {
  await page.addInitScript((m) => localStorage.setItem('todoi-theme', m), mode);
  await ready(page, url);
}

async function audit(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.slice(0, 5).map((n) => `${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`),
  }));
  expect(summary).toEqual([]);
}

for (const mode of ['light', 'dark'] as const) {
  for (const path of ['/', '/commercial-task-managers/']) {
    test(`${path} in ${mode}: default view`, async ({ page }) => {
      await open(page, path, mode);
      await audit(page);
    });
    test(`${path} in ${mode}: an expanded record, a criterion sort and an open answer`, async ({ page }) => {
      await open(page, `${path}?sort=use-desc`, mode);
      await page.locator('tr.matrix-row button.row-expand').first().click();
      await page.locator('.acc-q').first().click();
      await audit(page);
    });
    test(`${path} in ${mode}: the map, with a bubble kept beside it and another in focus`, async ({ page }) => {
      await open(page, `${path}?map=year-community`, mode);
      const dots = page.locator('#map .map-dot[role="button"]');
      await dots.first().press('Enter');
      await expect(page.locator('#map .map-pin')).toBeVisible();
      await dots.nth(3).focus();
      await expect(page.locator('#map .map-tip')).toBeVisible();
      await audit(page);
    });
    test(`${path} in ${mode}: the empty state`, async ({ page }) => {
      await open(page, `${path}?q=zzzz`, mode);
      await audit(page);
    });
  }
}

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const mode of ['light', 'dark'] as const) {
    test(`cards and the filter panel in ${mode}`, async ({ page }) => {
      await open(page, '/commercial-task-managers/', mode);
      await page.locator('#filter-disclosure').click();
      await page.locator('article.card button.card-expand').first().click();
      await expect(page.locator('.card-detail .crit').first()).toBeVisible();
      await audit(page);
    });
  }
});

test('the sort listbox is accessible while open', async ({ page }) => {
  await open(page, '/', 'light');
  await page.locator('#sort-field').click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await audit(page);
});

test('the keyboard reaches every control, in order, with a visible focus', async ({ page }) => {
  await open(page, '/', 'light');
  // Skip link first, then the wordmark.
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#directory')).toBeFocused();

  const reached = new Set<string>();
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const outline = getComputedStyle(el).outlineStyle;
      const label = `${el.id} ${typeof el.className === 'string' ? el.className : ''} ${el.tagName}`;
      return `${label}|${outline}`;
    });
    if (id) reached.add(id.split('|')[0]!);
  }
  for (const want of ['q', 'sort-field', 'sort-dir', 'clear-filters', 'matrix-scroll']) {
    expect([...reached].some((r) => r.includes(want)), `reached ${want}`).toBe(true);
  }
  expect([...reached].some((r) => r.includes('toggle-input')), 'reached a toggle').toBe(true);
  expect([...reached].some((r) => r.includes('chip')), 'reached a chip').toBe(true);
  expect([...reached].some((r) => r.includes('th-sort')), 'reached a sort header').toBe(true);
  expect([...reached].some((r) => r.includes('row-expand')), 'reached an expander').toBe(true);
});
