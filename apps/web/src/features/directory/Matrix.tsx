import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { defaultDir, type RecordSummary } from '@todoi/shared';
import { GitHubIcon } from '../../components/icons.tsx';
import { useHydrated } from '../../lib/hydrated.ts';
import { CommBand, LeadScore, leadSpec, Metric, ModelTag, type LeadSpec } from './cells.tsx';
import { RowDetail } from './DetailSlot.tsx';
import { useDirectory } from './state.tsx';
import { cx } from '../../styles/modules.ts';

// useLayoutEffect warns during the server render; nothing is measured there anyway.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function SortHead({
  sortKey,
  className,
  children,
}: {
  sortKey: string | null;
  className?: string;
  children: ReactNode;
}) {
  const { view, update, config } = useDirectory();
  const active = sortKey !== null && sortKey === view.sortKey;
  const cls = ['matrix-th', className].filter(Boolean).join(' ');
  if (sortKey === null) {
    return (
      <th scope="col" className={cx(cls)}>
        {children}
      </th>
    );
  }
  return (
    <th
      scope="col"
      className={cx(cls)}
      aria-sort={!active ? 'none' : view.sortDir === 'asc' ? 'ascending' : 'descending'}
    >
      <button
        type="button"
        className={cx('th-sort')}
        data-sort={sortKey}
        // A first click opens on the field's natural order; a second reverses it.
        onClick={() =>
          update({
            sortKey,
            sortDir: active ? (view.sortDir === 'desc' ? 'asc' : 'desc') : defaultDir(sortKey, config.copy.ascKeys),
          })
        }
      >
        {children}
      </button>
    </th>
  );
}

function Row({
  record,
  lead,
  shown,
  clamped,
  eager,
}: {
  record: RecordSummary;
  lead: LeadSpec;
  shown: boolean;
  clamped: boolean;
  eager: boolean;
}) {
  const { config, isOpen, toggle } = useDirectory();
  const hydrated = useHydrated();
  const open = isOpen(record.slug);
  const detailId = `detail-${record.slug}`;
  return (
    <Fragment>
      <tr
        className={cx('matrix-row')}
        data-slug={record.slug}
        hidden={!shown}
        style={shown ? undefined : { display: 'none' }}
      >
        <th scope="row" className={cx('cell-project')}>
          <div className={cx('project-id')}>
            <img
              className={cx('project-icon')}
              src={record.icon}
              alt=""
              width={48}
              height={48}
              decoding="async"
              loading={eager ? undefined : 'lazy'}
            />
            <a className={cx('project-name')} href={record.url} rel="noopener external">
              {record.name}
            </a>
            <span
              className={cx(clamped ? 'project-blurb is-clamped' : 'project-blurb')}
              onClick={() => {
                // A cut-off blurb opens its own row. Dragging across it to copy is not a request.
                if (!clamped || String(window.getSelection?.() ?? '').length) return;
                toggle(record.slug);
              }}
            >
              {record.blurb}
            </span>
          </div>
        </th>
        <td className={cx('cell-model')}>
          <ModelTag config={config} record={record} />
          <span className={cx('cell-sub')}>{record.modelSub}</span>
        </td>
        <td className={cx('cell-avg')}>
          <LeadScore record={record} lead={lead} />
        </td>
        <td className={cx('cell-comm')}>
          <CommBand band={record.band} pill />
        </td>
        <td className={cx(record.kind === 'oss' ? 'cell-stars' : 'cell-price')}>
          <Metric record={record} sub="cell-sub" />
        </td>
        <td className={cx('cell-int')}>
          <span className={cx('num')}>{record.integrationsLabel}</span>
        </td>
        <td className={cx('cell-year')}>
          <span className={cx('num')}>{record.year}</span>
        </td>
        <td className={cx('cell-more')}>
          <button
            type="button"
            className={cx('row-expand')}
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => toggle(record.slug)}
          >
            <span className={cx('sr-only')}>Summary, assessment and sources for {record.name}</span>
            <span className={cx('row-expand-mark')} aria-hidden="true" />
          </button>
        </td>
      </tr>
      {/* Server-rendered open for readers without JavaScript; the `js` class keeps
          closed records closed until React takes over and sets hidden itself. */}
      <tr
        className={cx('detail-row')}
        id={detailId}
        data-open={open ? '' : undefined}
        hidden={hydrated && (!open || !shown)}
        style={hydrated && (!open || !shown) ? { display: 'none' } : undefined}
      >
        <td colSpan={8}>
          <RowDetail config={config} record={record} open={open} />
        </td>
      </tr>
    </Fragment>
  );
}

/**
 * Which blurbs did the browser actually cut? Measured, not guessed from
 * character counts: the cut moves with column width, font and zoom. Measured
 * again after every filter pass, on resize, and once the web font arrives.
 */
function useClamped(tbody: React.RefObject<HTMLTableSectionElement | null>, deps: unknown[]) {
  const [clamped, setClamped] = useState<ReadonlySet<string>>(new Set());
  const measure = useCallback(() => {
    const body = tbody.current;
    if (!body) return;
    const next = new Set<string>();
    body.querySelectorAll<HTMLElement>('tr.matrix-row').forEach((row) => {
      const b = row.querySelector<HTMLElement>('.project-blurb');
      if (b && b.scrollHeight - b.clientHeight > 1) next.add(row.dataset.slug!);
    });
    setClamped((prev) => (prev.size === next.size && [...next].every((s) => prev.has(s)) ? prev : next));
  }, [tbody]);

  useIsoLayoutEffect(measure, deps);
  useEffect(() => {
    let t: number | undefined;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(measure, 150);
    };
    window.addEventListener('resize', onResize);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(t);
    };
  }, [measure]);
  return clamped;
}

export function Matrix() {
  const { config, view, ordered, visible } = useDirectory();
  const { copy } = config;
  const lead = leadSpec(config, view.sortKey);
  const tbody = useRef<HTMLTableSectionElement>(null);
  const clamped = useClamped(tbody, [ordered, visible]);
  const m = copy.matrix;
  const metricKey = config.kind === 'oss' ? 'stars' : 'price';

  return (
    // A thead over an empty body would leave sort controls with nothing to sort.
    <div
      className={cx('matrix-scroll')}
      tabIndex={0}
      role="region"
      aria-label="Comparison matrix"
      hidden={visible.size === 0}
      style={visible.size === 0 ? { display: 'none' } : undefined}
    >
      <table className={cx('matrix')} id="matrix">
        <caption className={cx('sr-only')}>{m.caption}</caption>
        <thead>
          <tr>
            <SortHead sortKey="name" className={cx('th-project')}>
              <span className={cx('methodology')} title={m.project.tip}>
                {m.project.label}
              </span>
            </SortHead>
            <SortHead sortKey={null}>
              <span className={cx('methodology')} title={m.model.tip}>
                {m.model.label}
              </span>
            </SortHead>
            <SortHead sortKey={lead.key} className={cx('th-lead')}>
              <abbr className={cx('th-lead-l methodology')} title={lead.title}>
                {lead.head}
              </abbr>
            </SortHead>
            <SortHead sortKey="community">
              <span className={cx('methodology')} title={m.community.tip}>
                {m.community.label}
              </span>
            </SortHead>
            <SortHead sortKey={metricKey} className={cx(config.kind === 'oss' ? 'th-stars' : 'th-price')}>
              {config.kind === 'oss' ? <GitHubIcon /> : null}
              <span className={cx('methodology')} title={m.metric.tip}>
                {m.metric.label}
              </span>
            </SortHead>
            <SortHead sortKey="integrations">
              <abbr className={cx('methodology')} title={m.integrations.tip}>
                {m.integrations.label}
              </abbr>
            </SortHead>
            <SortHead sortKey="year" className={cx('th-year')}>
              <span className={cx('methodology')} title={m.year.tip}>
                {m.year.label}
              </span>
            </SortHead>
            <th scope="col" className={cx('matrix-th th-more')}>
              <span className={cx('sr-only')}>Details</span>
            </th>
          </tr>
        </thead>
        <tbody id="matrix-body" ref={tbody}>
          {ordered.map((r, i) => (
            <Row
              eager={i < m.eagerIcons}
              key={r.slug}
              record={r}
              lead={lead}
              shown={visible.has(r.slug)}
              clamped={clamped.has(r.slug)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
