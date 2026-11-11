import type { Page } from '@playwright/test';

/**
 * Waits until React has hydrated the page. The server markup already looks
 * complete, so input sent before this (an arrow key on the theme switch, a
 * click on a sort header) can land on HTML that nothing is listening to yet.
 */
export async function hydrated(page: Page) {
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  await page.waitForLoadState('networkidle');
}

export async function ready(page: Page, url: string) {
  await page.goto(url);
  await hydrated(page);
}
