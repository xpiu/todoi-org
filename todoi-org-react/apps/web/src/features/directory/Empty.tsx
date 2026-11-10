import type { View } from '@todoi/shared';
import { useDirectory } from './state.tsx';
import { cx } from '../../styles/modules.ts';

function listed(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items.join('');
}

/**
 * The empty state names its cause: a search, a set of filters, or both. Each
 * active constraint is a token that removes itself, so loosening is one tap
 * rather than a hunt back up the controls.
 */
export function Empty() {
  const { config, view, update, clearFilters, visible } = useDirectory();
  const { copy, toggles, segments } = config;
  const e = copy.empty;
  const query = view.q.trim();
  const on = toggles.filter((t) => view.toggles.includes(t.key));
  const lic = segments.filter((s) => view.segments.includes(s.key));
  const filters = on.length + lic.length;

  let title: string;
  let text: string;
  let action: string;
  if (query && !filters) {
    title = `Nothing matches “${query}”`;
    text = e.search;
    action = 'Clear search';
  } else if (!query && filters) {
    title = e.filtersTitle;
    text = e.filters;
    // Name the constraints actually set, not a generic list.
    if (e.dynamic) {
      const want = on.map((t) => t.inline ?? t.token);
      const aud = lic.map((s) => s.audience ?? s.chip ?? s.label);
      text = `${
        want.length
          ? `No product here has ${listed(want)}${aud.length ? ` and is built for ${aud.join(' or ')}` : ''}`
          : `No product here is built for ${aud.join(' or ')} with those filters`
      }. Partial support never satisfies a must-have. Remove one constraint below.`;
    }
    action = 'Clear filters';
  } else if (query && filters) {
    title = `Nothing matches “${query}” with those filters`;
    text = 'The search and the filters are both narrowing the list. Take one constraint off below, or clear them all.';
    action = 'Clear search and filters';
  } else {
    title = e.filtersTitle;
    text = e.filters;
    action = 'Clear filters';
  }

  const tokens: { kind: string; name: string; patch: Partial<View> }[] = [
    ...(query ? [{ kind: 'Search', name: query, patch: { q: '' } }] : []),
    ...on.map((t) => ({
      kind: copy.controls.toggleToken,
      name: t.token,
      patch: { toggles: view.toggles.filter((k) => k !== t.key) },
    })),
    ...lic.map((s) => ({
      kind: copy.controls.chipToken,
      name: s.chip ?? s.label,
      patch: { segments: view.segments.filter((k) => k !== s.key) },
    })),
  ];

  return (
    <div className={cx('empty')} id="empty" hidden={visible.size !== 0}>
      <h3 className={cx('empty-title')} id="empty-title">
        {title}
      </h3>
      <p className={cx('empty-text')} id="empty-text">
        {text}
      </p>
      <ul className={cx('empty-active')} id="empty-active" aria-label="Active constraints: activate one to remove it">
        {tokens.map((t) => (
          <li key={`${t.kind}:${t.name}`}>
            <button
              type="button"
              className={cx('empty-token')}
              aria-label={`Remove ${t.kind.toLowerCase()} ${t.name}`}
              onClick={() => update(t.patch)}
            >
              <span className={cx('empty-token-kind')}>{t.kind}:</span>
              <span>{t.name}</span>
              <span className={cx('empty-token-x')} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <p className={cx('empty-actions')}>
        <button
          type="button"
          id="empty-clear"
          className={cx('btn btn-primary btn-sm')}
          onClick={() => {
            clearFilters();
            document.getElementById('q')?.focus();
          }}
        >
          {action}
        </button>
      </p>
    </div>
  );
}
