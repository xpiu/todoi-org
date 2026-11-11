import type { FullDirectory } from '@todoi/db';

/**
 * Where the directories come from. One implementation is wired at a time:
 *
 *   sources/json.ts      the committed seed/data.json <- TEMP(json-store): in use
 *   sources/postgres.ts  PostgreSQL, through Drizzle   <- parked until the database returns
 *
 * See docs/json-store.md.
 */
export interface DirectorySource {
  /** Every directory's addresses, in their stored order. */
  list(): Promise<{ slug: string; path: string; csvFile: string }[]>;
  /** Everything a directory holds. Null if there is no such directory. */
  load(slug: string): Promise<FullDirectory | null>;
}

/**
 * The public side reads every directory whole: a few hundred rows. They are
 * loaded once and kept until a write says otherwise, so a page render or an
 * API call never waits on the source after the first. `generation` moves on
 * every invalidation; caches downstream (rendered pages, ETags) key on it.
 */
export class DirectoryStore {
  private cache = new Map<string, Promise<FullDirectory | null>>();
  private listing: Promise<{ slug: string; path: string; csvFile: string }[]> | null = null;
  private listeners = new Set<() => void>();
  generation = 0;

  constructor(private readonly source: DirectorySource) {}

  get(slug: string): Promise<FullDirectory | null> {
    let hit = this.cache.get(slug);
    if (!hit) {
      hit = this.source.load(slug);
      this.cache.set(slug, hit);
      // A failed load must not be cached; the next request tries again.
      hit.catch(() => this.cache.delete(slug));
    }
    return hit;
  }

  list() {
    this.listing ??= this.source.list();
    return this.listing;
  }

  async byPath(path: string): Promise<FullDirectory | null> {
    const entry = (await this.list()).find((d) => d.path === path);
    return entry ? this.get(entry.slug) : null;
  }

  async byCsv(file: string): Promise<FullDirectory | null> {
    const entry = (await this.list()).find((d) => d.csvFile === file);
    return entry ? this.get(entry.slug) : null;
  }

  invalidate(): void {
    this.cache.clear();
    this.listing = null;
    this.generation++;
    for (const fn of this.listeners) fn();
  }

  onInvalidate(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
