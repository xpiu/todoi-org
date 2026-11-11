import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadSeedDirectories } from '@todoi/db/json';
import { directoryCsv } from './csv.ts';

/** The published datasets, committed as fixtures: the proof the store holds them whole. */
const fixture = (file: string) => readFile(fileURLToPath(new URL(`../../test/fixtures/${file}`, import.meta.url)), 'utf8');

// TEMP(json-store): these read the directories from data.json, as the site
// does. With PostgreSQL back they read the test database again
// (testDatabase() and loadFullDirectory): see docs/json-store.md.
const directories = loadSeedDirectories();

describe('CSV regenerated from the store', () => {
  it.each([
    ['open-source', 'todoi-dataset-2026-09-17.csv'],
    ['commercial', 'todoi-commercial-dataset-2026-11-10.csv'],
  ])('%s matches the published %s byte for byte', async (slug, file) => {
    const dir = directories.find((d) => d.config.slug === slug);
    expect(dir).toBeDefined();
    const csv = directoryCsv(dir!);
    const published = await fixture(file);
    // Compare line by line first, so a failure names the row.
    const a = csv.split('\r\n');
    const b = published.split('\r\n');
    for (let i = 0; i < Math.max(a.length, b.length); i++) expect(a[i], `line ${i + 1}`).toBe(b[i]);
    expect(csv).toBe(published);
  });
});
