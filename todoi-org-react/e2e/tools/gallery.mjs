// Screenshots of the build for review: both pages at three widths in both modes, an open record, the editor.
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const [base = 'http://127.0.0.1:3100', out = '.screens/gallery'] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const b = await chromium.launch();
const shots = [
  ['home', '/', 1440, 900], ['home-open', '/?open=plane&sort=deploy-desc', 1440, 900], ['commercial', '/commercial-task-managers/', 1440, 900],
  ['commercial-tablet', '/commercial-task-managers/?f=free', 768, 1024], ['home-phone', '/', 390, 844], ['commercial-phone-card', '/commercial-task-managers/?open=asana', 390, 844],
];
for (const mode of ['light', 'dark']) {
  for (const [name, path, w, h] of shots) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: mode, reducedMotion: 'reduce' });
    await ctx.addInitScript((m) => localStorage.setItem('todoi-theme', m), mode);
    const p = await ctx.newPage();
    await p.goto(base + path, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/${name}-${mode}.png` });
    await ctx.close();
  }
}
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
await ctx.addInitScript(() => localStorage.setItem('todoi-theme', 'dark'));
const p = await ctx.newPage();
// TEMP(json-store): the editor is off (docs/json-store.md), so /admin is the 404 page and the
// sign-in below finds no form. Run this tool with EDITOR=1 once PostgreSQL and the editor are back.
if (!process.env.EDITOR) {
  await b.close();
  process.exit(0);
}
await p.goto(base + '/admin?dir=commercial&record=asana');
await p.getByLabel('E-mail').fill(process.env.E2E_EDITOR_EMAIL ?? 'e2e-editor@todoi.test');
await p.getByLabel('Password').fill(process.env.E2E_EDITOR_PASSWORD ?? 'e2e-editor-password');
await p.getByRole('button', { name: 'Sign in' }).click();
await p.getByRole('heading', { name: 'Asana', level: 2 }).waitFor();
await p.screenshot({ path: `${out}/admin-dark.png` });
await b.close();
console.log('written to', out);
