/**
 * TEMP(json-store): the directories come from packages/db/seed/data.json, read
 * once when the server starts. No database is involved; a malformed seed
 * stops the server here, before it listens. See docs/json-store.md.
 */
import { loadSeedDirectories } from '@todoi/db/json';
import type { DirectorySource } from '../store.ts';

export function jsonSource(): DirectorySource {
  const directories = loadSeedDirectories();
  const bySlug = new Map(directories.map((d) => [d.config.slug, d]));
  const listing = directories.map((d) => ({ slug: d.config.slug, path: d.config.path, csvFile: d.config.csvFile }));
  return {
    list: async () => listing,
    load: async (slug) => bySlug.get(slug) ?? null,
  };
}
