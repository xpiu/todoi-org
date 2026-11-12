import { z } from 'zod';
import type { DirectoryConfig, RecordSummary } from './directory.ts';
import { computeScore } from './score.ts';

/**
 * The view lives in the address bar: ?q= search, ?f= must-have toggles,
 * ?lic= licensing models or audiences, ?sort=key-dir, ?open=slug. These are
 * the parameter names the static site has always written, so every link
 * anyone has shared keeps working. ?map=x-y names the two figures the map
 * plots when they are not the page's own. Parsing is lenient on purpose: an
 * unknown key is dropped, never an error page.
 */
export const DirectorySearch = z.object({
  q: z.string().optional().catch(undefined),
  f: z.string().optional().catch(undefined),
  lic: z.string().optional().catch(undefined),
  sort: z.string().optional().catch(undefined),
  open: z.string().optional().catch(undefined),
  map: z.string().optional().catch(undefined),
});
export type DirectorySearch = z.infer<typeof DirectorySearch>;

export type SortDir = 'asc' | 'desc';

export interface View {
  q: string;
  toggles: string[];
  segments: string[];
  sortKey: string;
  sortDir: SortDir;
  open: string | null;
  /** The map's two figures, across then up; null is the directory's own opening pair. */
  map: [string, string] | null;
}

export const DEFAULT_SORT_KEY = 'community';
export const DEFAULT_SORT_DIR: SortDir = 'desc';

/** Every key the records can be ordered by on this directory. */
export function sortKeys(dir: Pick<DirectoryConfig, 'kind' | 'criteria'>): string[] {
  return [
    'name',
    'avg',
    ...dir.criteria.map((c) => c.key),
    'community',
    dir.kind === 'oss' ? 'stars' : 'price',
    'integrations',
    'year',
  ];
}

function list(raw: string | undefined, allowed: readonly string[]): string[] {
  if (!raw) return [];
  const wanted = raw.split(',');
  // Keep the directory's own order, so ?f=gantt,tt and ?f=tt,gantt are one view.
  return allowed.filter((k) => wanted.includes(k));
}

export function parseView(
  search: DirectorySearch,
  dir: Pick<DirectoryConfig, 'kind' | 'criteria' | 'toggles' | 'segments'>,
): View {
  const keys = sortKeys(dir);
  let sortKey = DEFAULT_SORT_KEY;
  let sortDir: SortDir = DEFAULT_SORT_DIR;
  const [k, d] = String(search.sort ?? '').split('-');
  if (k && keys.includes(k)) {
    sortKey = k;
    sortDir = d === 'asc' ? 'asc' : 'desc';
  }
  // Any two different sort keys but the name, which has no position on an axis.
  const [mx, my] = String(search.map ?? '').split('-');
  const map: View['map'] = mx && my && mx !== my && mx !== 'name' && my !== 'name' && keys.includes(mx) && keys.includes(my) ? [mx, my] : null;
  return {
    q: search.q ?? '',
    toggles: list(search.f, dir.toggles.map((t) => t.key)),
    segments: list(search.lic, dir.segments.filter((s) => s.chip !== null).map((s) => s.key)),
    sortKey,
    sortDir,
    open: search.open || null,
    map,
  };
}

/** The view as search params, defaults left out. */
export function viewSearch(view: View): DirectorySearch {
  const out: DirectorySearch = {};
  const q = view.q.trim();
  if (q) out.q = q;
  if (view.toggles.length) out.f = view.toggles.join(',');
  if (view.segments.length) out.lic = view.segments.join(',');
  if (`${view.sortKey}-${view.sortDir}` !== `${DEFAULT_SORT_KEY}-${DEFAULT_SORT_DIR}`) {
    out.sort = `${view.sortKey}-${view.sortDir}`;
  }
  if (view.open) out.open = view.open;
  if (view.map) out.map = view.map.join('-');
  return out;
}

export function terms(q: string): string[] {
  return q.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function scoreOf(record: RecordSummary): number {
  return computeScore(Object.values(record.scores), record.band);
}

/**
 * A record's figure for a sort key. -Infinity is "no figure" (a quote-only
 * price): it goes last whichever way the column is read.
 */
export function valueOf(record: RecordSummary, key: string): number {
  switch (key) {
    case 'avg':
      return scoreOf(record);
    case 'community':
      return record.band;
    case 'integrations':
      return record.integrations;
    case 'year':
      return record.year;
    case 'stars':
      return record.kind === 'oss' ? record.stars : -Infinity;
    case 'price':
      return record.kind === 'commercial' && record.price !== null ? record.price : -Infinity;
    default: {
      const v = record.scores[key];
      return v === undefined ? -Infinity : v;
    }
  }
}

/**
 * Checked toggles accept native support (2) only. Partial (1) means the
 * capability sits behind a paid tier, a plugin or an add-on, so it must not
 * satisfy a must-have. No pressed chip means no licensing filter.
 */
export function matches(record: RecordSummary, view: Pick<View, 'q' | 'toggles' | 'segments'>): boolean {
  for (const t of terms(view.q)) if (!record.search.includes(t)) return false;
  for (const key of view.toggles) if ((record.caps[key] ?? 0) < 2) return false;
  if (view.segments.length && !view.segments.includes(record.model)) return false;
  return true;
}

function byName(a: RecordSummary, b: RecordSummary): number {
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}

export function compareRecords(key: string, dir: SortDir) {
  const d = dir === 'asc' ? 1 : -1;
  return (a: RecordSummary, b: RecordSummary): number => {
    if (key === 'name') return d * byName(a, b);
    const va = valueOf(a, key);
    const vb = valueOf(b, key);
    if (va === -Infinity || vb === -Infinity) {
      if (va !== vb) return va === -Infinity ? 1 : -1;
    } else if (va !== vb) return d * (va - vb);
    // Ties break alphabetically, whichever way the column is read.
    return byName(a, b);
  };
}

export function sortRecords(records: readonly RecordSummary[], key: string, dir: SortDir): RecordSummary[] {
  return [...records].sort(compareRecords(key, dir));
}

/** A fresh field opens on the order a reader most likely wants. */
export function defaultDir(key: string, ascKeys: readonly string[]): SortDir {
  return key === 'name' || ascKeys.includes(key) ? 'asc' : 'desc';
}

const DIR_WORDS: Record<string, [string, string]> = {
  name: ['A to Z', 'Z to A'],
  year: ['Newest first', 'Oldest first'],
  community: ['Large to small', 'Small to large'],
  stars: ['Many to few', 'Few to many'],
  integrations: ['Many to few', 'Few to many'],
};

/** The direction button speaks in the field's own words. */
export function dirWords(
  key: string,
  dir: SortDir,
  extra: Record<string, [string, string]>,
  ascKeys: readonly string[],
): string {
  const pair = extra[key] ?? DIR_WORDS[key] ?? ['High to low', 'Low to high'];
  const natural = defaultDir(key, ascKeys);
  return dir === natural ? pair[0] : pair[1];
}
