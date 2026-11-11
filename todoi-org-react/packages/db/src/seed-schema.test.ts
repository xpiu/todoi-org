import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { directoriesFromSeed, loadSeedDirectories } from './json.ts';
import { readSeeds, SEED_FILE } from './seed.ts';
import { SeedData } from './seed-schema.ts';

/**
 * seed/data.json holds every directory. TEMP(json-store): it is also the data
 * the site serves, so these run without a database.
 */
const raw = JSON.parse(readFileSync(SEED_FILE, 'utf8')) as { directories: unknown[] };

describe('seed/data.json', () => {
  it('holds every directory, in page order: the order that decides the ids', () => {
    const dirs = loadSeedDirectories();
    expect(dirs.map((d) => [d.id, d.config.slug])).toEqual([
      [1, 'open-source'],
      [2, 'commercial'],
    ]);
    // Record ids run on across directories, as PostgreSQL's serial does.
    expect(dirs[1]!.records[0]!.id).toBe(dirs[0]!.records.length + 1);
  });

  it('reads the same for the database seeder as for the JSON store', async () => {
    const seeds = await readSeeds();
    expect(directoriesFromSeed(seeds)).toEqual(loadSeedDirectories());
  });

  it('refuses a misspelt top-level key or an empty list instead of serving nothing', () => {
    expect(() => SeedData.parse({ directory: raw.directories })).toThrow();
    expect(() => SeedData.parse({ ...raw, extra: true })).toThrow();
    expect(() => SeedData.parse({ directories: [] })).toThrow();
  });

  it('refuses the same directory twice', () => {
    const { directories } = SeedData.parse(raw);
    expect(() => directoriesFromSeed([directories[0]!, directories[0]!])).toThrow(/share the slug "open-source"/);
  });
});
