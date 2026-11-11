import {
  bandLabel,
  fill,
  formatScore,
  formatStars,
  starGrade,
  valueOf,
  type DirectoryConfig,
  type RecordSummary,
} from '@todoi/shared';
import { TagIcon } from '../../components/icons.tsx';
import type { LeadSpec } from './state.tsx';
import { cx } from '../../styles/modules.ts';

export function ModelTag({ config, record }: { config: DirectoryConfig; record: RecordSummary }) {
  const seg = config.segments.find((s) => s.key === record.segment);
  return (
    <span className={cx(`tag tag-${seg?.tagClass ?? 'seg'}`)} data-lic={record.segment} tabIndex={0}>
      <TagIcon name={seg?.icon ?? 'team'} />
      {seg?.label ?? record.segment}
    </span>
  );
}

export function CommBand({ band, pill }: { band: number; pill?: boolean }) {
  return (
    <span className={cx(pill ? 'pill comm-band' : 'comm-band')} data-comm={band} tabIndex={0}>
      {bandLabel(band)}
    </span>
  );
}

export function LeadScore({ record, lead }: { record: RecordSummary; lead: LeadSpec }) {
  const v = valueOf(record, lead.key);
  const txt = formatScore(v);
  return (
    <>
      <span className={cx('score score-lead')} data-score="" style={{ '--fill': fill(v) } as never}>
        <span className={cx('score-num')}>{txt}</span>
      </span>
      <span className={cx('sr-only')} data-score-sr="">
        {`${lead.sr}: ${txt} out of 5`}
      </span>
    </>
  );
}

function Dagger({ label, aria, note }: { label: string; aria: string; note: string }) {
  return (
    <span className={cx('stars-note methodology')} data-tip-label={label} tabIndex={0} aria-label={aria} title={note}>
      †
    </span>
  );
}

/** Stars (open source) or the entry price (commercial), with its qualifications. */
export function Metric({ record, sub }: { record: RecordSummary; sub: 'cell-sub' | 'card-lic' }) {
  if (record.kind === 'oss') {
    return (
      <>
        <span className={cx('num')} data-grade={starGrade(record.stars)}>
          {formatStars(record.stars)}
        </span>
        {record.starsNote ? (
          <Dagger label="Stars" aria="Qualification on this star count" note={record.starsNote} />
        ) : null}
      </>
    );
  }
  return (
    <>
      <span className={cx(record.price === null ? 'num num-quote' : 'num')}>{record.priceLabel}</span>
      {record.priceNote ? <Dagger label="Price" aria="Qualification on this price" note={record.priceNote} /> : null}
      {record.pricePublished ? <span className={cx(`${sub} ${sub}-pub`)}>{record.pricePublished}</span> : null}
      {/* A product that is free outright has no paid tier to compare a free plan to. */}
      <span className={cx(sub)}>{record.price === 0 ? 'No paid tier' : record.free ? 'Free plan' : 'No free plan'}</span>
    </>
  );
}
