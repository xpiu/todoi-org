import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadFullDirectory, type Database, type FullDirectory } from '@todoi/db';
import { testDatabase } from '../test/db.ts';
import { llmsTxt, sitemapXml } from './site-files.ts';

const fixture = (file: string) => readFile(fileURLToPath(new URL(`../../test/fixtures/${file}`, import.meta.url)), 'utf8');

let database: Database;
let dirs: FullDirectory[];
beforeAll(async () => {
  database = await testDatabase();
  dirs = [(await loadFullDirectory(database.db, 'open-source'))!, (await loadFullDirectory(database.db, 'commercial'))!];
});
afterAll(() => database.close());

describe('sitemap.xml', () => {
  it('lists the same pages with the same dates as the published one', async () => {
    const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]);
    expect(locs(sitemapXml(dirs, 'https://todoi.org'))).toEqual(locs(await fixture('sitemap.xml')));
  });
});

describe('llms.txt', () => {
  it('matches the published file, with commercial Scores corrected to the page', async () => {
    const ours = llmsTxt(dirs);
    const published = await fixture('llms.txt');
    // The published commercial lines carry the six-criterion means of an older
    // build; the page has shown seven-input Scores since. Same lines otherwise.
    const noScore = (s: string) => s.replace(/Score \d\.\d\/5/g, 'Score x/5');
    expect(noScore(ours)).toBe(noScore(published));
    // Open-source Scores were already right: those lines are identical.
    const ossLines = (s: string) => s.split('\n').filter((l) => l.includes('Source: https://'));
    expect(ossLines(ours)).toEqual(ossLines(published));
    // Every commercial line now quotes the Score the page shows.
    expect(ours).toContain('- [Adobe Workfront](https://business.adobe.com/products/workfront.html):');
    expect(ours).toMatch(/Adobe Workfront\].*Score 3\.5\/5, confidence High\./);
  });
});
