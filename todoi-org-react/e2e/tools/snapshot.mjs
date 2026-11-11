// Screenshot one running site in its main states, or pixel-diff two such sets.
// For checking that a dependency update or a refactor changed nothing on screen:
//
//   node e2e/tools/snapshot.mjs http://127.0.0.1:3100 .screens/before     (before the change)
//   node e2e/tools/snapshot.mjs http://127.0.0.1:3100 .screens/after      (after it, rebuilt)
//   node e2e/tools/snapshot.mjs --diff .screens/before .screens/after     (exit 1 on any difference)
import { mkdir, readdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { imageDiff } from './image-diff.mjs';

const WIDTHS = {
  phone: [390, 844],
  tablet: [768, 1024],
  'narrow-desktop': [900, 900],
  desktop: [1440, 900],
};
const MODES = ['light', 'dark'];
// Two runs of one build differ by a few anti-aliased pixels in the hero mark, by up
// to 8 per colour channel. Anything a person could see is far above that.
const NOISE = 8;

/** [name, path, widths, modes, act?]: `act` puts the page in a state before the shot. */
const SCENES = [
  ['home', '/', Object.keys(WIDTHS), MODES],
  ['commercial', '/commercial-task-managers/', Object.keys(WIDTHS), MODES],
  ['home-filtered', '/?f=tt,gantt&sort=name-asc', ['phone', 'desktop'], ['light']],
  ['home-empty', '/?q=zzzz-nothing', ['phone', 'desktop'], MODES],
  ['commercial-sorted', '/commercial-task-managers/?sort=price-asc&lic=personal,software', ['phone', 'desktop'], ['light']],
  ['not-found', '/no-such-page', ['desktop'], MODES],
  ['row-detail', '/', ['desktop'], MODES, (page) => page.locator('tr.matrix-row[data-slug="plane"] button.row-expand').click()],
  ['card-detail', '/', ['phone'], MODES, (page) => page.locator('article.card:visible button.card-expand').first().click()],
  ['sort-menu', '/', ['desktop'], ['light'], (page) => page.locator('#sort-field').click()],
];

async function capture(base, out) {
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch();
  let count = 0;
  for (const [name, path, widths, modes, act] of SCENES) {
    for (const wname of widths) {
      for (const mode of modes) {
        const [width, height] = WIDTHS[wname];
        const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', colorScheme: mode });
        await ctx.addInitScript((m) => {
          try {
            localStorage.setItem('todoi-theme', m);
          } catch {
            /* storage disabled: the system preference decides */
          }
        }, mode);
        const page = await ctx.newPage();
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
        await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
        await page.evaluate(() => document.fonts.ready);
        if (act) await act(page);
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${out}/${name}-${wname}-${mode}.png`, fullPage: true });
        await ctx.close();
        count++;
      }
    }
  }
  await browser.close();
  console.log(`${count} screenshots in ${out}`);
}

async function diff(a, b, out = `${b}-diff`) {
  await mkdir(out, { recursive: true });
  const names = (await readdir(a)).filter((f) => f.endsWith('.png')).sort();
  const rows = [];
  for (const name of names) {
    const d = await imageDiff(`${a}/${name}`, `${b}/${name}`, `${out}/${name}`, NOISE);
    rows.push({ shot: name, size: `${d.width}x${d.height}`, sizeMatch: d.sizeMatch, diffPixels: d.diff });
  }
  const changed = rows.filter((r) => r.diffPixels > 0 || !r.sizeMatch);
  console.table(changed.length ? changed : rows);
  console.log(changed.length ? `${changed.length} of ${rows.length} differ: see ${out}` : `All ${rows.length} identical.`);
  process.exit(changed.length ? 1 : 0);
}

const args = process.argv.slice(2);
if (args[0] === '--diff') await diff(args[1], args[2], args[3]);
else await capture(args[0] ?? 'http://127.0.0.1:3100', args[1] ?? '.screens/snapshot');
