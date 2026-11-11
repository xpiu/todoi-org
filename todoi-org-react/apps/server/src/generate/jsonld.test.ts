import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadSeedDirectories } from '@todoi/db/json';
import { directoryGraph, serializeGraph } from './jsonld.ts';

const fixture = async (file: string) =>
  JSON.parse(await readFile(fileURLToPath(new URL(`../../test/fixtures/${file}`, import.meta.url)), 'utf8')) as {
    '@graph': Record<string, unknown>[];
  };

// TEMP(json-store): these read the directories from the seed files, as the site
// does. With PostgreSQL back they read the test database again
// (testDatabase() and loadFullDirectory): see docs/json-store.md.
const directories = loadSeedDirectories();
const directory = (slug: string) => directories.find((d) => d.config.slug === slug)!;

describe('JSON-LD built from the store', () => {
  it.each([
    ['open-source', 'open-source.jsonld.json'],
    ['commercial', 'commercial.jsonld.json'],
  ])('%s is equivalent to the published graph, @ids unchanged', async (slug, file) => {
    const dir = directory(slug);
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

  it('keeps one decimal on scores, as published', () => {
    const dir = directory('open-source');
    expect(serializeGraph(directoryGraph(dir, 'https://todoi.org'))).toContain('"name":"Data sovereignty","value":5.0,');
  });
});
