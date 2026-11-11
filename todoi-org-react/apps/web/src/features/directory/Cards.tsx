import { useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import type { RecordSummary } from '@todoi/shared';
import { useHydrated } from '../../lib/hydrated.ts';
import { CommBand, LeadScore, Metric, ModelTag } from './cells.tsx';
import { FetchedDetail } from './DetailSlot.tsx';
import { Expander, useRecordDisclosure } from './disclosure.tsx';
import { recordQuery } from './queries.ts';
import { useDirectory } from './state.tsx';
import { cx } from '../../styles/modules.ts';

function Card({ record, shown, eager }: { record: RecordSummary; shown: boolean; eager: boolean }) {
  const { config, lead } = useDirectory();
  const { api } = useRouteContext({ from: '__root__' });
  const queryClient = useQueryClient();
  const hydrated = useHydrated();
  // The open record inside the card is reading matter: a tap there is not a request to close it.
  const { open, host, expander, onTap, onDetailClick } = useRecordDisclosure<HTMLElement>(record.slug, '.card-detail');
  const panelId = `cdetail-${record.slug}`;
  const { copy } = config;
  // Fetch the record's prose as soon as the reader reaches for it.
  const prefetch = () => void queryClient.prefetchQuery(recordQuery(api, config.slug, record.slug));

  return (
    <article ref={host} className={cx('card')} data-slug={record.slug} onClick={onTap} hidden={!shown}>
      <div className={cx('card-head')}>
        <h3 className={cx('card-title')}>
          <img
            className={cx('project-icon project-icon-lg')}
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
        </h3>
        <p className={cx('card-score')}>
          {/* On a card the label is spent width: the mean needs none; a criterion is named. */}
          <span className={cx('card-score-l')} data-score-label="" data-crit={lead.key === 'avg' ? undefined : ''}>
            {lead.key === 'avg' ? 'Score' : lead.sr}
          </span>
          <LeadScore record={record} lead={lead} />
        </p>
        <Expander ref={expander} className="card-expand" record={record} open={open} controls={panelId} onReach={prefetch} />
      </div>
      {copy.cards.blurb ? <p className={cx('card-blurb')}>{record.blurb}</p> : null}
      <dl className={cx('card-meta')}>
        <div className={cx('card-fact card-fact-lic')}>
          <dt>{copy.cards.modelLabel}</dt>
          <dd>
            <ModelTag config={config} record={record} />
            {/* The matrix has room for the short form only; a card prints the licence whole. */}
            <span className={cx('card-lic')}>{record.kind === 'oss' ? record.licence : record.modelSub}</span>
          </dd>
        </div>
        <div className={cx('card-fact card-fact-comm')}>
          <dt>{copy.cards.communityLabel}</dt>
          <dd>
            <CommBand band={record.band} />
          </dd>
        </div>
        <div className={cx(`card-fact ${record.kind === 'oss' ? 'card-fact-stars' : 'card-fact-price'}`)}>
          <dt>{copy.cards.metricLabel}</dt>
          <dd>
            <Metric record={record} sub="card-lic" />
          </dd>
        </div>
      </dl>
      <div
        className={cx('card-detail')}
        id={panelId}
        data-open={open ? '' : undefined}
        hidden={hydrated && !open}
        onClick={onDetailClick}
      >
        {hydrated ? (
          open ? (
            <FetchedDetail config={config} record={record} enabled />
          ) : null
        ) : (
          <noscript>
            <p className={cx('card-nojs')}>
              Turn on JavaScript, or widen the window, to read this record’s summary, scores and sources.
            </p>
          </noscript>
        )}
      </div>
    </article>
  );
}

/** The same records as cards: the view below 900px. Each detail is fetched when its card opens. */
export function Cards() {
  const { config, ordered, visible } = useDirectory();
  return (
    <div className={cx('cards')} id="cards">
      {ordered.map((r, i) => (
        <Card key={r.slug} record={r} shown={visible.has(r.slug)} eager={i < config.copy.cards.eagerIcons} />
      ))}
    </div>
  );
}
