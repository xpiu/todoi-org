import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadFullDirectory, type Database } from '@todoi/db';
import { testDatabase } from '../test/db.ts';
import { directoryCsv } from './csv.ts';

/** The published datasets, committed as fixtures: the proof the database holds them whole. */
const fixture = (file: string) => readFile(fileURLToPath(new URL(`../../test/fixtures/${file}`, import.meta.url)), 'utf8');

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(() => database.close());

describe('CSV regenerated from the database', () => {
  it.each([
    ['open-source', 'todoi-dataset-2026-09-17.csv'],
    ['commercial', 'todoi-commercial-dataset-2026-11-10.csv'],
  ])('%s matches the published %s byte for byte', async (slug, file) => {
    const dir = await loadFullDirectory(database.db, slug);
    expect(dir).not.toBeNull();
    const csv = directoryCsv(dir!);
    const published = await fixture(file);
    // Compare line by line first, so a failure names the row.
    const a = csv.split('\r\n');
    const b = published.split('\r\n');
    for (let i = 0; i < Math.max(a.length, b.length); i++) expect(a[i], `line ${i + 1}`).toBe(b[i]);
    expect(csv).toBe(published);
  });
});
