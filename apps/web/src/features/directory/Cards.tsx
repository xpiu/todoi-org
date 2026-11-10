import { useQueryClient } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import type { RecordSummary } from '@todoi/shared';
import { useHydrated } from '../../lib/hydrated.ts';
import { CommBand, LeadScore, leadSpec, Metric, ModelTag, type LeadSpec } from './cells.tsx';
import { FetchedDetail } from './DetailSlot.tsx';
import { recordQuery } from './queries.ts';
import { useDirectory } from './state.tsx';

function Card({ record, lead, shown }: { record: RecordSummary; lead: LeadSpec; shown: boolean }) {
  const { config, isOpen, toggle } = useDirectory();
  const { api } = useRouteContext({ from: '__root__' });
  const queryClient = useQueryClient();
  const hydrated = useHydrated();
  const open = isOpen(record.slug);
  const panelId = `cdetail-${record.slug}`;
  const { copy } = config;
  // Fetch the record's prose as soon as the reader reaches for it.
  const prefetch = () => void queryClient.prefetchQuery(recordQuery(api, config.slug, record.slug));

  return (
    <article className="card" data-slug={record.slug} hidden={!shown} style={shown ? undefined : { display: 'none' }}>
      <div className="card-head">
        <h3 className="card-title">
          <img
            className="project-icon project-icon-lg"
            src={record.icon}
            alt=""
            width={48}
            height={48}
            decoding="async"
          />
          <a className="project-name" href={record.url} rel="noopener external">
            {record.name}
          </a>
        </h3>
        <p className="card-score">
          {/* On a card the label is spent width: the mean needs none; a criterion is named. */}
          <span className="card-score-l" data-score-label="" data-crit={lead.key === 'avg' ? undefined : ''}>
            {lead.key === 'avg' ? 'Score' : lead.sr}
          </span>
          <LeadScore record={record} lead={lead} />
        </p>
        <button
          type="button"
          className="card-expand"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`Summary, assessment and sources for ${record.name}`}
          onClick={() => toggle(record.slug)}
          onPointerEnter={prefetch}
          onFocus={prefetch}
        >
          <span className="row-expand-mark" aria-hidden="true" />
        </button>
      </div>
      {copy.cards.blurb ? <p className="card-blurb">{record.blurb}</p> : null}
      <dl className="card-meta">
        <div className="card-fact card-fact-lic">
          <dt>{copy.cards.modelLabel}</dt>
          <dd>
            <ModelTag config={config} record={record} />
            <span className="card-lic">{record.modelSub}</span>
          </dd>
        </div>
        <div className="card-fact card-fact-comm">
          <dt>{copy.cards.communityLabel}</dt>
          <dd>
            <CommBand band={record.band} />
          </dd>
        </div>
        <div className={`card-fact ${record.kind === 'oss' ? 'card-fact-stars' : 'card-fact-price'}`}>
          <dt>{copy.cards.metricLabel}</dt>
          <dd>
            <Metric record={record} sub="card-lic" />
          </dd>
        </div>
      </dl>
      <div
        className="card-detail"
        id={panelId}
        data-open={open ? '' : undefined}
        hidden={hydrated && !open}
        style={hydrated && !open ? { display: 'none' } : undefined}
      >
        {hydrated ? (
          open ? (
            <FetchedDetail config={config} record={record} enabled />
          ) : null
        ) : (
          <noscript>
            <p className="card-nojs">
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
  const { config, view, ordered, visible } = useDirectory();
  const lead = leadSpec(config, view.sortKey);
  return (
    <div className="cards" id="cards">
      {ordered.map((r) => (
        <Card key={r.slug} record={r} lead={lead} shown={visible.has(r.slug)} />
      ))}
    </div>
  );
}
