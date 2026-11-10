// Screenshot both sites at the same widths and modes, then pixel-diff them.
// Usage: node e2e/tools/visual-compare.mjs <react-base> <static-base> <out-dir> [extra-query]
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { imageDiff } from './image-diff.mjs';

const [reactBase = 'http://localhost:3000', staticBase = 'http://127.0.0.1:8080', out = '.screens', query = ''] =
  process.argv.slice(2);
const PAGES = [
  ['home', '/'],
  ['commercial', '/commercial-task-managers/'],
];
const WIDTHS = [
  ['phone', 390, 844],
  ['tablet', 768, 1024],
  ['narrow-desktop', 900, 900],
  ['desktop', 1440, 900],
];
const MODES = ['light', 'dark'];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const rows = [];
for (const [name, path] of PAGES) {
  for (const [wname, width, height] of WIDTHS) {
    for (const mode of MODES) {
      const shots = {};
      for (const [site, base] of [
        ['static', staticBase],
        ['react', reactBase],
      ]) {
        const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', colorScheme: mode });
        await ctx.addInitScript((m) => {
          try {
            localStorage.setItem('todoi-theme', m);
          } catch {
            /* storage disabled: the system preference decides */
          }
        }, mode);
        const page = await ctx.newPage();
        await page.goto(`${base}${path}${query}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(200);
        const file = `${out}/${name}-${wname}-${mode}-${site}.png`;
        await page.screenshot({ path: file, fullPage: true });
        shots[site] = file;
        await ctx.close();
      }
      const d = await imageDiff(shots.static, shots.react, `${out}/${name}-${wname}-${mode}-diff.png`);
      rows.push({ shot: `${name}-${wname}-${mode}`, size: `${d.width}x${d.height}`, sizeMatch: d.sizeMatch, diffPct: (d.ratio * 100).toFixed(3), bbox: d.bbox?.join(',') ?? '' });
    }
  }
}
await browser.close();
console.table(rows);
