import type { ReactNode } from 'react';
import { defaultDir, type RecordSummary } from '@todoi/shared';
import { useHydrated } from '../../lib/hydrated.ts';
import { matrixColumns, type Column } from './columns.tsx';
import { RowDetail } from './DetailSlot.tsx';
import { Expander, useRecordDisclosure } from './disclosure.tsx';
import { useDirectory } from './state.tsx';
import { cx } from '../../styles/modules.ts';

function SortHead({ sortKey, className, children }: { sortKey: string | null; className?: string; children: ReactNode }) {
  const { view, update, config } = useDirectory();
  const active = sortKey !== null && sortKey === view.sortKey;
  const cls = cx('matrix-th', className);
  if (sortKey === null) {
    return (
      <th scope="col" className={cls}>
        {children}
      </th>
    );
  }
  return (
    <th scope="col" className={cls} aria-sort={!active ? 'none' : view.sortDir === 'asc' ? 'ascending' : 'descending'}>
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
  columns,
  shown,
  eager,
}: {
  record: RecordSummary;
  columns: Column[];
  shown: boolean;
  eager: boolean;
}) {
  const { config } = useDirectory();
  const hydrated = useHydrated();
  const { open, host, expander, onTap, onDetailClick } = useRecordDisclosure<HTMLTableRowElement>(record.slug);
  const detailId = `detail-${record.slug}`;
  return (
    <>
      <tr ref={host} className={cx('matrix-row')} data-slug={record.slug} onClick={onTap} hidden={!shown}>
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
            <span className={cx('project-blurb')}>{record.blurb}</span>
          </div>
        </th>
        {columns.map((c) => (
          <td key={c.id} className={cx(c.tdClass)}>
            {c.cell(record)}
          </td>
        ))}
        <td className={cx('cell-more')}>
          <Expander ref={expander} className="row-expand" record={record} open={open} controls={detailId} />
        </td>
      </tr>
      {/* Server-rendered open for readers without JavaScript; the `js` class keeps
          closed records closed until React takes over and sets hidden itself. */}
      <tr
        className={cx('detail-row')}
        id={detailId}
        data-open={open ? '' : undefined}
        hidden={hydrated && (!open || !shown)}
        onClick={onDetailClick}
      >
        <td colSpan={columns.length + 2}>
          <RowDetail config={config} record={record} open={open} />
        </td>
      </tr>
    </>
  );
}

export function Matrix() {
  const { config, lead, ordered, visible } = useDirectory();
  const m = config.copy.matrix;
  const columns = matrixColumns(config, lead);

  return (
    // A thead over an empty body would leave sort controls with nothing to sort.
    <div
      className={cx('matrix-scroll')}
      tabIndex={0}
      role="region"
      aria-label="Comparison matrix"
      hidden={visible.size === 0}
    >
      <table className={cx('matrix')} id="matrix">
        <caption className={cx('sr-only')}>{m.caption}</caption>
        <thead>
          <tr>
            <SortHead sortKey="name" className="th-project">
              <span className={cx('methodology')} title={m.project.tip}>
                {m.project.label}
              </span>
            </SortHead>
            {columns.map((c) => (
              <SortHead key={c.id} sortKey={c.sortKey} className={c.thClass}>
                {c.head}
              </SortHead>
            ))}
            <th scope="col" className={cx('matrix-th th-more')}>
              <span className={cx('sr-only')}>Details</span>
            </th>
          </tr>
        </thead>
        <tbody id="matrix-body">
          {ordered.map((r, i) => (
            <Row key={r.slug} record={r} columns={columns} shown={visible.has(r.slug)} eager={i < m.eagerIcons} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
