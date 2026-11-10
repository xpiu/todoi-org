// Compare where each block sits on both sites, to find what makes the pages differ in height.
// Usage: node e2e/tools/layout-compare.mjs <react-base> <static-base> <path> <width> [mode]
import { chromium } from '@playwright/test';

const [reactBase, staticBase, path = '/', width = '1440', mode = 'light'] = process.argv.slice(2);
const SEL = [
  '.site-header', '.hero', '.controls', '.matrix-scroll', 'table.matrix thead', '#cards', '.matrix-updated', '.matrix-foot',
  '#start', '.route-list', '#method', '.criteria', '.models', '#faq', '.acc-list', '.acc:first-child', '.acc-q', '.acc-a',
  '#contribute', '.crosslink', '.site-footer', '.filter-disclosure', '#filter-options', 'tr.matrix-row', 'article.card',
];
const browser = await chromium.launch();
async function measure(base) {
  const ctx = await browser.newContext({ viewport: { width: Number(width), height: 900 }, reducedMotion: 'reduce', colorScheme: mode });
  const page = await ctx.newPage();
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate((sels) => Object.fromEntries(sels.map((s) => {
    const el = document.querySelector(s);
    if (!el) return [s, null];
    const b = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return [s, { top: Math.round(b.top + scrollY), h: Math.round(b.height), w: Math.round(b.width), display: cs.display, font: `${cs.fontSize} ${cs.fontWeight} ${cs.lineHeight}`, pad: cs.padding }];
  })), SEL);
  await ctx.close();
  return r;
}
const a = await measure(staticBase);
const b = await measure(reactBase);
for (const s of SEL) {
  const x = a[s], y = b[s];
  const same = JSON.stringify(x) === JSON.stringify(y);
  console.log(`${same ? '  ' : '≠ '}${s.padEnd(22)} static ${JSON.stringify(x)}\n${' '.repeat(24)} react  ${JSON.stringify(y)}`);
}
await browser.close();
