import type { ReactNode } from 'react';
import type { DirectoryConfig, RecordSummary } from '@todoi/shared';
import { GitHubIcon } from '../../components/icons.tsx';
import { CommBand, LeadScore, Metric, ModelTag } from './cells.tsx';
import type { LeadSpec } from './state.tsx';
import { cx } from '../../styles/modules.ts';

/**
 * One data column of the matrix: its header and the cell it draws in every row.
 * The project column (the row's header) and the expander bracket these.
 */
export interface Column {
  id: string;
  /** The field a click on the header sorts by; null for a column that does not sort. */
  sortKey: string | null;
  thClass?: string;
  tdClass: string;
  head: ReactNode;
  cell(record: RecordSummary): ReactNode;
}

/** A header's label; its method opens as a tooltip. */
function Head({ label, tip, abbr, className }: { label: string; tip: string; abbr?: boolean; className?: string }) {
  const Tag = abbr ? 'abbr' : 'span';
  return (
    <Tag className={cx('methodology', className)} title={tip}>
      {label}
    </Tag>
  );
}

/**
 * Both directories' columns. They differ in one: open source counts GitHub
 * stars where commercial quotes an entry price.
 */
export function matrixColumns(config: DirectoryConfig, lead: LeadSpec): Column[] {
  const m = config.copy.matrix;
  const oss = config.kind === 'oss';
  return [
    {
      id: 'model',
      sortKey: null,
      tdClass: 'cell-model',
      head: <Head {...m.model} />,
      cell: (r) => (
        <>
          <ModelTag config={config} record={r} />
          <span className={cx('cell-sub')}>{r.modelSub}</span>
        </>
      ),
    },
    {
      id: 'lead',
      sortKey: lead.key,
      thClass: 'th-lead',
      tdClass: 'cell-avg',
      head: <Head label={lead.head} tip={lead.title} abbr className="th-lead-l" />,
      cell: (r) => <LeadScore record={r} lead={lead} />,
    },
    {
      id: 'community',
      sortKey: 'community',
      tdClass: 'cell-comm',
      head: <Head {...m.community} />,
      cell: (r) => <CommBand band={r.band} pill />,
    },
    {
      id: 'metric',
      sortKey: oss ? 'stars' : 'price',
      thClass: oss ? 'th-stars' : 'th-price',
      tdClass: oss ? 'cell-stars' : 'cell-price',
      head: (
        <>
          {oss ? <GitHubIcon /> : null}
          <Head {...m.metric} />
        </>
      ),
      cell: (r) => <Metric record={r} sub="cell-sub" />,
    },
    {
      id: 'integrations',
      sortKey: 'integrations',
      tdClass: 'cell-int',
      head: <Head {...m.integrations} abbr />,
      cell: (r) => <span className={cx('num')}>{r.integrationsLabel}</span>,
    },
    {
      id: 'year',
      sortKey: 'year',
      thClass: 'th-year',
      tdClass: 'cell-year',
      head: <Head {...m.year} />,
      cell: (r) => <span className={cx('num')}>{r.year}</span>,
    },
  ];
}
