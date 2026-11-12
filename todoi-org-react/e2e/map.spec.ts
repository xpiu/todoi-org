import { expect, test, type Page } from '@playwright/test';
import { ready } from './ready.ts';

/**
 * The map under the matrix: every record as a bubble, set by two of the
 * figures the matrix sorts by. The two pages open on different pictures.
 */

const dots = (page: Page) => page.locator('#map .map-dot[role="button"]');
const ghosts = (page: Page) => page.locator('#map .map-dot-ghost');

test('open source opens on effort against depth, a bubble a project, inked by licence', async ({ page }) => {
  await ready(page, '/');
  await expect(page.locator('#map .map-view[aria-pressed="true"]')).toHaveText('Effort and depth');
  await expect(page.locator('#map-x')).toHaveText('Ease of deployment');
  await expect(page.locator('#map-y')).toHaveText('Enterprise features');
  await expect(dots(page)).toHaveCount(25);
  await expect(ghosts(page)).toHaveCount(0);
  // The four licensing models are four inks, and the chips under the plot are their key.
  await expect(page.locator('#map .map-dot .map-dot-mark[data-look="part"]')).toHaveCount(5);
  await expect(page.locator('#map .map-dot .map-dot-mark[data-look="split"]')).toHaveCount(2);
  await expect(page.locator('#map .map-dot .map-dot-mark[data-look="shut"]')).toHaveCount(2);
  await expect(page.locator('#map .map-key-item')).toHaveText('Mixed source');
  await expect(page.locator('#map .map-key-item .map-dot-mark[data-look="split"]')).toHaveCount(1);
  await expect(page.locator('#map .map-chip')).toHaveText(['FOSS', 'Open core', 'Source-available', 'Mixed source']);
  await expect(page.locator('#map-finding')).toHaveText('Ease of deployment and enterprise features do not move together.');
  await expect(page.locator('#map-dot-plane')).toHaveAccessibleName(
    'Plane. Ease of deployment: 4.4. Enterprise features: 4.5. Community size: Very large. Open core',
  );
});

test('commercial opens on price against Score, filled where there is a free plan', async ({ page }) => {
  await ready(page, '/commercial-task-managers/');
  await expect(page.locator('#map .map-view[aria-pressed="true"]')).toHaveText('Price and Score');
  await expect(page.locator('#map-x')).toHaveText('Paid from');
  await expect(page.locator('#map-y')).toHaveText('Score');
  await expect(dots(page)).toHaveCount(58);
  await expect(page.locator('#map .map-dot .map-dot-mark[data-look="full"]')).toHaveCount(41);
  await expect(page.locator('#map .map-dot .map-dot-mark[data-look="hollow"]')).toHaveCount(17);
  // A quote-only price has no place on the scale: it gets the lane past its end.
  await expect(page.locator('#map .map-tick', { hasText: 'Quote' })).toHaveCount(1);
  await expect(page.locator('#map-finding')).toHaveText('Price and Score do not move together.');
  await expect(page.locator('#map-dot-workfront')).toHaveAccessibleName(/Paid from: Quote\. Score: 3\.5\./);
});

test('a view or an axis changes the picture, and the address keeps it', async ({ page }) => {
  await ready(page, '/commercial-task-managers/');
  await page.locator('#map .map-view', { hasText: 'Simple or powerful' }).click();
  await expect(page).toHaveURL(/\?map=use-enterprise$/);
  await expect(page.locator('#map-x')).toHaveText('Ease of use');
  await expect(page.locator('#map-y')).toHaveText('Enterprise features');
  await expect(page.locator('#map-finding')).toHaveText('The higher the ease of use, the lower the enterprise features, but loosely.');
  await expect(page.locator('#copy-link')).toBeVisible();

  // Picking the figure the other axis shows swaps the two; so does the button.
  await page.locator('#map-x').click();
  await page.getByRole('option', { name: 'Enterprise features' }).click();
  await expect(page).toHaveURL(/\?map=enterprise-use$/);
  await page.locator('#map .map-swap').click();
  await expect(page).toHaveURL(/\?map=use-enterprise$/);

  await page.reload();
  await expect(page.locator('#map .map-view[aria-pressed="true"]')).toHaveText('Simple or powerful');
  // Back on the page's own pair, the address is clean again.
  await page.locator('#map .map-view', { hasText: 'Price and Score' }).click();
  await expect(page).not.toHaveURL(/map=/);
});

test('the map follows the matrix’s search and filters, and its chips are the same filter', async ({ page }) => {
  await ready(page, '/');
  await page.locator('label.toggle', { hasText: 'Time' }).click();
  const count = Number((await page.locator('#result-count').innerText()).split(' ')[0]);
  await expect(dots(page)).toHaveCount(count);
  await expect(ghosts(page)).toHaveCount(25 - count);
  await expect(page.locator('#map-count')).toHaveText(`${count} of 25 projects shown`);

  await page.locator('#map .map-clear').click();
  await expect(dots(page)).toHaveCount(25);

  await page.locator('#map .map-chip[data-seg="open-core"]').click();
  await expect(page).toHaveURL(/lic=open-core/);
  await expect(page.locator('button.chip[data-model="open-core"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#result-count')).toHaveText('5 of 25 projects');
  await expect(dots(page)).toHaveCount(5);

  // Nothing left: the field stays on the sheet as ghosts, and the plot says so.
  await page.goto('/?q=zzzz');
  await expect(dots(page)).toHaveCount(0);
  await expect(ghosts(page)).toHaveCount(25);
  await expect(page.locator('#map-finding')).toHaveText(/^No project matches/);
});

test('pointing at a bubble reads it; clicking keeps it and leads to its record', async ({ page }) => {
  await ready(page, '/');
  await page.locator('#map').scrollIntoViewIfNeeded();
  const box = (await page.locator('#map-dot-vikunja').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const tip = page.locator('#map .map-tip');
  await expect(tip).toContainText('Vikunja');
  await expect(tip).toContainText('4.8 Ease of deployment');
  await expect(tip).toContainText('3.1 Enterprise features');

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const pin = page.locator('#map .map-pin');
  await expect(pin).toHaveAttribute('data-slug', 'vikunja');
  await expect(pin.locator('.map-fig')).toHaveCount(11);
  await expect(pin.locator('.map-fig[data-axis]')).toHaveText([/Ease of deployment.*4\.8/, /Enterprise features.*3\.1/]);
  await expect(page.locator('#map-dot-vikunja')).toHaveAttribute('aria-pressed', 'true');
  await expect(tip).toHaveCount(0);

  await pin.locator('.map-pin-open').click();
  await expect(page).toHaveURL(/open=vikunja/);
  await expect(page.locator('#detail-vikunja')).toBeVisible();
  await expect(page.locator('tr.matrix-row[data-slug="vikunja"]')).toBeInViewport();
  await expect(page.locator('tr.matrix-row[data-slug="vikunja"] button.row-expand')).toBeFocused();
});

test('the keyboard reaches one bubble, walks the field with the arrows, and pins with Enter', async ({ page }) => {
  await ready(page, '/');
  await expect(page.locator('#map .map-dot[tabindex="0"]')).toHaveCount(1);
  await page.locator('#map-dot-huly').focus();
  await expect(page.locator('#map .map-tip')).toContainText('Huly');
  // Huly sits alone on the left edge: everything else is to its right.
  await page.keyboard.press('ArrowRight');
  const next = await page.evaluate(() => document.activeElement?.getAttribute('data-slug'));
  expect(next).not.toBe('huly');
  expect(next).toBeTruthy();
  await expect(page.locator('#map .map-dot[tabindex="0"]')).toHaveAttribute('data-slug', next!);
  await page.keyboard.press('Enter');
  await expect(page.locator('#map .map-pin')).toHaveAttribute('data-slug', next!);
  // Letting go hands focus back to the bubble it came from.
  await page.locator('#map .map-pin-close').click();
  await expect(page.locator('#map .map-pin')).toHaveCount(0);
  await expect(page.locator(`#map-dot-${next}`)).toBeFocused();
});

test.describe('phone width', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('the map fits the screen, and a tap keeps a bubble under it', async ({ page }) => {
    await ready(page, '/commercial-task-managers/');
    await page.locator('#map').scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(dots(page)).toHaveCount(58);
    const box = (await page.locator('#map-dot-akiflow').boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('#map .map-pin')).toHaveAttribute('data-slug', 'akiflow');
    await page.locator('#map .map-pin-open').click();
    await expect(page.locator('#cdetail-akiflow')).toBeVisible();
  });
});

test('without JavaScript the map is already drawn', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/commercial-task-managers/');
  await expect(page.locator('#map .map-dot')).toHaveCount(58);
  await expect(page.locator('#map .map-name').first()).toBeVisible();
  await expect(page.locator('#map-finding')).toHaveText('Price and Score do not move together.');
  await ctx.close();
});
