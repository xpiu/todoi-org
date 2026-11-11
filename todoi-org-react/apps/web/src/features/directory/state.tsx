import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  matches,
  parseView,
  sortRecords,
  viewSearch,
  type DirectoryConfig,
  type DirectoryResponse,
  type RecordSummary,
  type SortDir,
  type View,
} from '@todoi/shared';

export interface LeadSpec {
  key: string;
  head: string;
  title: string;
  sr: string;
}

/**
 * The matrix shows one score. It is the mean by default, but sorting by a
 * criterion would otherwise reorder the table against a number that is not
 * on screen, so the column follows the sort. The band and integrations have
 * columns of their own, so they leave it on the mean.
 */
export function leadSpec(config: DirectoryConfig, sortKey: string): LeadSpec {
  const c = config.criteria.find((x) => x.key === sortKey);
  if (c) return { key: c.key, head: c.head, title: c.tip + config.copy.score.critTail, sr: c.sr };
  return { key: 'avg', head: 'Score', title: config.copy.score.tip, sr: config.copy.score.sr };
}

export interface DirectoryState {
  config: DirectoryConfig;
  records: RecordSummary[];
  view: View;
  /** All records in the current order, matching or not: rows stay mounted. */
  ordered: RecordSummary[];
  /** Slugs that pass the search and filters. */
  visible: Set<string>;
  /** The score the matrix and cards show: the mean, or the criterion sorted by. */
  lead: LeadSpec;
  update(patch: Partial<View>): void;
  clearFilters(): void;
  /** Records expanded right now. Several may be; the URL names the latest. */
  isOpen(slug: string): boolean;
  toggle(slug: string): void;
}

const Ctx = createContext<DirectoryState | null>(null);

export function useDirectory(): DirectoryState {
  const value = useContext(Ctx);
  if (!value) throw new Error('useDirectory outside DirectoryProvider');
  return value;
}

/**
 * The view is the URL. Reading it parses the static site's own parameters;
 * writing it replaces the history entry, so the back button is never spent
 * on a keystroke. The filtered, sorted list is derived on every render from
 * query data and the view, never stored.
 */
export function DirectoryProvider({ data, children }: { data: DirectoryResponse; children: ReactNode }) {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const config = data.directory;
  const records = data.records;
  const view = useMemo(() => parseView(search, config), [search, config]);

  const ordered = useMemo(() => sortRecords(records, view.sortKey, view.sortDir), [records, view.sortKey, view.sortDir]);
  const visible = useMemo(
    () => new Set(records.filter((r) => matches(r, view)).map((r) => r.slug)),
    [records, view],
  );

  const lead = useMemo(() => leadSpec(config, view.sortKey), [config, view.sortKey]);

  const update = useCallback(
    (patch: Partial<View>) => {
      const next = { ...view, ...patch };
      void navigate({
        to: '.',
        search: viewSearch(next),
        // ?open=slug names the open record. Opening one drops the hash: a #section
        // no longer says where the reader is, and a #slug only repeats ?open=.
        hash: (prev) => (patch.open || (prev && prev === next.open) ? '' : (prev ?? '')),
        replace: true,
        resetScroll: false,
        // A kept #section hash must not pull the page back to that section on every
        // view change (opening a record, sorting, typing a filter).
        hashScrollIntoView: false,
      });
    },
    [view, navigate],
  );

  // Sort is a view preference, not a filter: clearing leaves it alone.
  const clearFilters = useCallback(() => update({ q: '', toggles: [], segments: [] }), [update]);

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(view.open ? [view.open] : []));

  // The address bar can name a record the set does not hold yet (a #slug turned into
  // ?open=). React to the URL changing only: closing that record empties the set a
  // moment before the URL catches up, and must not be undone here.
  const lastOpen = useRef(view.open);
  useEffect(() => {
    if (view.open === lastOpen.current) return;
    lastOpen.current = view.open;
    if (view.open) setExpanded((s) => (s.has(view.open!) ? s : new Set(s).add(view.open!)));
  }, [view.open]);

  // A filtered-out record must not stay open behind the filter: it comes back collapsed.
  useEffect(() => {
    const gone = [...expanded].filter((slug) => !visible.has(slug));
    if (!gone.length) return;
    setExpanded((s) => new Set([...s].filter((slug) => visible.has(slug))));
    if (view.open && gone.includes(view.open)) update({ open: null });
  }, [visible, expanded, view.open, update]);

  const isOpen = useCallback((slug: string) => expanded.has(slug) && visible.has(slug), [expanded, visible]);
  const toggle = useCallback(
    (slug: string) => {
      if (expanded.has(slug)) {
        setExpanded((s) => {
          const n = new Set(s);
          n.delete(slug);
          return n;
        });
        if (view.open === slug) update({ open: null });
      } else {
        setExpanded((s) => new Set(s).add(slug));
        update({ open: slug });
      }
    },
    [expanded, view.open, update],
  );

  const value = useMemo<DirectoryState>(
    () => ({ config, records, view, ordered, visible, lead, update, clearFilters, isOpen, toggle }),
    [config, records, view, ordered, visible, lead, update, clearFilters, isOpen, toggle],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export type { SortDir };
