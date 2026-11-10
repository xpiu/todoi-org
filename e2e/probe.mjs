// Ad-hoc probe: load a URL, report console errors and hydration state.
import { chromium } from '@playwright/test';
const url = process.argv[2] ?? 'http://localhost:3000/';
const browser = await chromium.launch();
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message.slice(0, 300)}`));
await page.goto(url, { waitUntil: 'networkidle' });
console.log('title:', await page.title());
console.log('theme:', await page.evaluate(() => document.documentElement.getAttribute('data-theme') + ' ' + document.documentElement.className));
console.log('items:', await page.locator('li').count());
console.log(logs.join('\n') || 'no console errors');
await browser.close();
