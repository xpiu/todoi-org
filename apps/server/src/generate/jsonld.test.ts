import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadFullDirectory, type Database } from '@todoi/db';
import { testDatabase } from '../test/db.ts';
import { directoryGraph, serializeGraph } from './jsonld.ts';

const fixture = async (file: string) =>
  JSON.parse(await readFile(fileURLToPath(new URL(`../../test/fixtures/${file}`, import.meta.url)), 'utf8')) as {
    '@graph': Record<string, unknown>[];
  };

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(() => database.close());

describe('JSON-LD built from the database', () => {
  it.each([
    ['open-source', 'open-source.jsonld.json'],
    ['commercial', 'commercial.jsonld.json'],
  ])('%s is equivalent to the published graph, @ids unchanged', async (slug, file) => {
    const dir = (await loadFullDirectory(database.db, slug))!;
    // Through the serialiser and back: what a crawler parses.
    const ours = JSON.parse(serializeGraph(directoryGraph(dir, 'https://todoi.org'))) as typeof published;
    const published = await fixture(file);
    expect(ours['@graph'].map((n) => n['@id'])).toEqual(published['@graph'].map((n) => n['@id']));
    published['@graph'].forEach((node, i) => expect(ours['@graph'][i], String(node['@id'])).toEqual(node));
  });

  it('cannot be closed early by a string in the data', () => {
    const graph = { '@context': 'https://schema.org', '@graph': [{ name: '</script><script>alert(1)</script>' }] };
    expect(serializeGraph(graph)).not.toContain('</script>');
  });

  it('keeps one decimal on scores, as published', async () => {
    const dir = (await loadFullDirectory(database.db, 'open-source'))!;
    expect(serializeGraph(directoryGraph(dir, 'https://todoi.org'))).toContain('"name":"Data sovereignty","value":5.0,');
  });
});
