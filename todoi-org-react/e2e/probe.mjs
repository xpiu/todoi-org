// Ad-hoc probe: load a URL, report console errors, optionally screenshot.
import { chromium } from '@playwright/test';
const [url = 'http://localhost:3000/', shot, width = '1440'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text().slice(0, 400)}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message.slice(0, 400)}`));
const res = await page.goto(url, { waitUntil: 'networkidle' });
console.log('status:', res.status(), 'title:', await page.title());
console.log('rows:', await page.locator('tr.matrix-row:visible').count(), 'count:', await page.locator('#result-count').textContent());
if (shot) await page.screenshot({ path: shot, fullPage: false });
console.log(logs.join('\n') || 'no console errors');
await browser.close();
