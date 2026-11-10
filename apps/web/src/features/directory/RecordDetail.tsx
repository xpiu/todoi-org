import type { ReactNode } from 'react';
import { Html } from '../../components/Html.tsx';
import {
  bandLabel,
  bareUrl,
  fill,
  formatScore,
  type DirectoryConfig,
  type Level,
  type RecordDetail as Detail,
  type RecordSummary,
} from '@todoi/shared';
import { DateStampIcon, MarkSvg } from '../../components/icons.tsx';
import { cx } from '../../styles/modules.ts';

const LEVEL_WORDS: Record<Level, string> = { 0: 'Not native', 1: 'Partial', 2: 'Native' };
const MARK_CLASS: Record<Level, string> = { 0: 'mark-none', 1: 'mark-partial', 2: 'mark-full' };

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={cx('fact')}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} rel="noopener external">
      {children}
    </a>
  );
}

/**
 * Everything an expanded record shows: capabilities, summary, the seven
 * scores with their reasoning, the record's facts and its sources. Pure: the
 * server renders it into every row's HTML (readable without JavaScript), and
 * the browser renders it into a card when a card is opened.
 */
export function RecordDetailBody({
  config,
  record,
  detail,
}: {
  config: DirectoryConfig;
  record: RecordSummary;
  detail: Detail;
}) {
  const { copy } = config;
  const caps = config.capabilities.map((c) => {
    const level = (record.caps[c.key] ?? 0) as Level;
    return { ...c, level, note: detail.capNotes[c.key] ?? null };
  });
  const band = bandLabel(record.band);

  let facts: ReactNode;
  if (detail.kind === 'oss') {
    facts = (
      <>
        <Fact label={copy.facts.yearLabel}>{record.year}</Fact>
        <Fact label="Repository">
          <ExternalLink href={detail.repositoryUrl}>{detail.repository}</ExternalLink>
        </Fact>
        <Fact label="Licence">{detail.licence}</Fact>
        <Fact label="Model">{detail.modelNote}</Fact>
        <Fact label="Deployment">{detail.deployment}</Fact>
        <Fact label="Calendar sync">{detail.calendarSync}</Fact>
        <Fact label="Data out">{detail.dataOut}</Fact>
        <Fact label="Stack">{detail.stack}</Fact>
        <Fact label="Hosted option">{detail.hostedOption}</Fact>
        <Fact label="Integrations">{detail.integrationNotes}</Fact>
        <Fact label="Community signal">{detail.bandEvidence}</Fact>
        {detail.capabilityNotes ? (
          <div className={cx('fact')}>
            <dt>Capability notes</dt>
            <Html as="dd" html={detail.capabilityNotes} />
          </div>
        ) : null}
        <Fact label="Caveat">{detail.caveat}</Fact>
        <Fact label="Confidence">{detail.confidence}</Fact>
      </>
    );
  } else {
    facts = (
      <>
        <Fact label={copy.facts.yearLabel}>{detail.yearNote ?? record.year}</Fact>
        <Fact label="Vendor">{detail.vendor}</Fact>
        <Fact label="Website">
          <ExternalLink href={record.url}>{bareUrl(record.url)}</ExternalLink>
        </Fact>
        <Fact label="Plans">{detail.plans}</Fact>
        <Fact label="Free plan">{detail.freePlanNote}</Fact>
        <Fact label="Hosting">{detail.hosting}</Fact>
        <Fact label="Security">{detail.security}</Fact>
        <Fact label="Calendar sync">{detail.calendarSync}</Fact>
        <Fact label="Data out">{detail.dataOut}</Fact>
        <Fact label="Platforms">{detail.platforms}</Fact>
        <Fact label="AI">{detail.ai}</Fact>
        <Fact label="Integrations">{detail.integrationNotes}</Fact>
        <Fact label="Market signal">{detail.bandEvidence}</Fact>
        <Fact label="Caveat">{detail.caveat}</Fact>
        <Fact label="Confidence">{detail.confidence}</Fact>
      </>
    );
  }

  return (
    <>
      <p className={cx('detail-project')}>{record.name} - summary, assessment and sources</p>
      <div className={cx('detail-caps')}>
        <p className={cx('detail-h')}>
          <span className={cx('methodology')} data-tip-label="Capabilities" title={copy.matrix.capsTip}>
            Capabilities
          </span>
        </p>
        <div className={cx('caps')}>
          {caps.map((c) => (
            <div className={cx('cap')} key={c.key}>
              <span className={cx(`mark ${MARK_CLASS[c.level]}`)}>
                <MarkSvg level={c.level} />
              </span>
              <span className={cx('cap-l')}>
                <span className={cx('methodology')} data-tip-label={c.label} title={c.tip}>
                  {c.label}
                </span>
                {c.note ? <span className={cx('cap-note')}>{c.note}</span> : null}
              </span>
              <span className={cx('sr-only')}>
                {`${c.sr}: ${LEVEL_WORDS[c.level]}.${c.note ? ` ${c.note}` : ''}`}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className={cx('detail-summary')}>
        <p className={cx('detail-h')}>Summary</p>
        <div className={cx('summary')}>
          {detail.summary.map((p, i) => (
            <p key={i} className={cx(i === 0 ? 'summary-lead' : undefined)}>
              {p}
            </p>
          ))}
        </div>
        <p className={cx('summary-date')}>
          <span className={cx('sr-only')}>Summary written </span>
          <span className={cx('date-stamp')} title="When this summary was written">
            <DateStampIcon />
            <time dateTime={detail.summaryDate}>{detail.summaryDate}</time>
          </span>
        </p>
      </div>
      <div className={cx('detail-assess')}>
        <p className={cx('detail-h')}>Assessment</p>
        <dl className={cx('crits')}>
          {config.criteria.map((c) => {
            const score = record.scores[c.key] ?? 0;
            return (
              <div className={cx('crit')} key={c.key}>
                <dt className={cx('crit-name')}>
                  {c.name}
                  <span className={cx('crit-val')}>
                    <span className={cx('crit-bar')} style={{ '--fill': fill(score) } as never} aria-hidden="true" />
                    <span className={cx('crit-score')}>{formatScore(score)}</span>
                  </span>
                </dt>
                <dd className={cx('crit-text')}>{detail.reviews[c.key]}</dd>
              </div>
            );
          })}
          <div className={cx('crit')}>
            <dt className={cx('crit-name')}>
              {copy.band.name}
              <span className={cx('crit-val')}>
                <span className={cx('crit-bar')} style={{ '--fill': fill(record.band) } as never} aria-hidden="true" />
                <span className={cx('crit-score')}>{formatScore(record.band)}</span>
              </span>
            </dt>
            <dd className={cx('crit-text')}>{`${band}. ${detail.bandEvidence}`}</dd>
          </div>
        </dl>
      </div>
      <div className={cx('detail-record')}>
        <p className={cx('detail-h')}>Record</p>
        <dl className={cx('facts')}>{facts}</dl>
      </div>
      <div className={cx('detail-sources')}>
        <p className={cx('detail-h')}>Sources</p>
        <ul className={cx('srcs')}>
          {detail.sources.map((s, i) => (
            <li key={i}>
              <ExternalLink href={s.url}>{s.label}</ExternalLink>
            </li>
          ))}
        </ul>
      </div>
      {/* A way back from the foot of a long record; scripted, so hidden without JavaScript. */}
      <p className={cx('detail-foot')}>
        <button type="button" className={cx('btn btn-ghost btn-sm detail-close')}>
          Close record
        </button>
      </p>
    </>
  );
}

