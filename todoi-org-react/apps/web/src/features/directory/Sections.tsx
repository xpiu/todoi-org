import { Accordion } from '@base-ui/react/accordion';
import { longDate, publishesCsv } from '@todoi/shared';
import { Html } from '../../components/Html.tsx';
import { ArrowIcon, ChevronIcon, TagIcon } from '../../components/icons.tsx';
import { startPath } from '../../components/SiteChrome.tsx';
import { HeroMark } from './HeroMark.tsx';
import { useDirectory } from './state.tsx';
import { cx } from '../../styles/modules.ts';

/** "2026-11-20" → "20 Nov 2026", fixed-width in tabular figures. */
function shortDate(iso: string): string {
  return longDate(iso).replace(/^(\d+ \w{3})\w+/, '$1');
}

const MAIL_BODY = 'Project / product: \nWhat changed: \nSource URL: \n';

export function Hero() {
  const { config } = useDirectory();
  const { hero } = config.copy;
  return (
    <section className={cx('hero')}>
      <div className={cx('shell hero-inner')}>
        <div className={cx('hero-copy')}>
          <h1 className={cx('hero-title')}>{hero.title}</h1>
          <p className={cx('hero-lede')}>{hero.lede}</p>
          <p className={cx('hero-start')}>
            <a href={startPath(config.path)}>
              Need a shortlist? <span>Where to start</span>
              <ArrowIcon />
            </a>
          </p>
        </div>
        {hero.mark ? <HeroMark /> : null}
      </div>
    </section>
  );
}

export function Method() {
  const { config } = useDirectory();
  const { method, band } = config.copy;
  const defined = config.segments.filter((s) => s.definition !== null);
  const criteriaNames = [...config.criteria.map((c) => c.name), band.name].join(' · ');
  return (
    <section className={cx('method editorial-section')} id="method" aria-labelledby="method-title">
      <div className={cx('shell method-inner editorial-inner')}>
        <div className={cx('section-head')}>
          <h2 className={cx('section-title')} id="method-title">
            {method.title}
          </h2>
          <p className={cx('section-note')}>{method.note}</p>
          <p className={cx('method-index')}>{criteriaNames}</p>
        </div>

        <div className={cx('section-body')}>
          <Accordion.Root className={cx('acc-list')} multiple>
            <Accordion.Item className={cx('acc')} value="criteria">
              <Accordion.Header className={cx('acc-h')}>
                <Accordion.Trigger className={cx('acc-q')}>
                  <span className={cx('acc-label')} id="criteria-title">
                    Criterion definitions
                  </span>
                  <span className={cx('sr-only')}>, </span>
                  <span className={cx('acc-meta')}>{config.criteria.length} criteria + 1 band</span>
                  <ChevronIcon className={cx('acc-ico')} />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className={cx('acc-a')} hiddenUntilFound>
                <dl className={cx('criteria-defs')} aria-labelledby="criteria-title">
                  {config.criteria.map((c) => (
                    <div className={cx('criterion-def')} key={c.key}>
                      <dt className={cx('criterion-name')}>{c.name}</dt>
                      <dd className={cx('criterion-text')}>{c.text}</dd>
                    </div>
                  ))}
                  <div className={cx('criterion-def', 'criterion-band-def')}>
                    <dt className={cx('criterion-name')}>
                      {band.name} <span className={cx('criterion-kind')}>1–5 band</span>
                    </dt>
                    <dd className={cx('criterion-text')}>{band.text}</dd>
                  </div>
                </dl>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item className={cx('acc')} value="models">
              <Accordion.Header className={cx('acc-h')}>
                <Accordion.Trigger className={cx('acc-q')}>
                  <span className={cx('acc-label')} id="models-title">
                    {method.modelsTitle}
                  </span>
                  <span className={cx('sr-only')}>, </span>
                  <span className={cx('acc-meta')}>{defined.length} categories</span>
                  <ChevronIcon className={cx('acc-ico')} />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className={cx('acc-a')} hiddenUntilFound>
                <div className={cx('models-body')}>
                  <Html as="p" className={cx('panel-note')} html={method.modelsNote} />
                  <dl className={cx('model-defs')} aria-labelledby="models-title">
                    {defined.map((s) => (
                      <div className={cx('model-def')} key={s.key}>
                        <dt className={cx('model-name')}>
                          <span className={cx(`tag tag-${s.tagClass}`)}>
                            <TagIcon name={s.icon} />
                            {s.label}
                          </span>
                        </dt>
                        <dd className={cx('model-text')}>{s.definition}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item className={cx('acc')} value="scoring">
              <Accordion.Header className={cx('acc-h')}>
                <Accordion.Trigger className={cx('acc-q')}>
                  <span className={cx('acc-label')}>Confidence ratings and caveats</span>
                  <span className={cx('sr-only')}>, </span>
                  <span className={cx('acc-meta')}>3 tiers</span>
                  <ChevronIcon className={cx('acc-ico')} />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className={cx('acc-a')} hiddenUntilFound>
                <div className={cx('method-notes')}>
                  {method.notes.map((n, i) => (
                    <Html as="p" key={i} className={cx('panel-note')} html={n} />
                  ))}
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        </div>
      </div>
    </section>
  );
}

/**
 * The FAQ as an accordion. Closed answers are hidden until found, so the
 * browser's find-in-page still reaches them; without JavaScript the stylesheet
 * shows every answer, as the old <details> list could be opened by hand.
 */
export function Faq() {
  const { config } = useDirectory();
  return (
    <section className={cx('faq editorial-section')} id="faq" aria-labelledby="faq-title">
      <div className={cx('shell faq-inner editorial-inner')}>
        <div className={cx('section-head')}>
          <h2 className={cx('section-title')} id="faq-title">
            Questions
          </h2>
        </div>
        <div className={cx('section-body')}>
          <Accordion.Root className={cx('acc-list')} multiple>
            {config.faqs.map((f) => (
              <Accordion.Item className={cx('acc')} key={f.id} value={f.id}>
                <Accordion.Header className={cx('acc-h')}>
                  <Accordion.Trigger className={cx('acc-q')}>
                    <span className={cx('acc-label')}>{f.question}</span>
                    <ChevronIcon className={cx('acc-ico')} />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Panel className={cx('acc-a')} hiddenUntilFound>
                  <Html as="div" className={cx('acc-a-body')} html={f.answer} />
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </div>
      </div>
    </section>
  );
}

export function Contribute() {
  const { config } = useDirectory();
  const c = config.copy.contribute;
  const revisions = [...config.revisions].reverse();
  const latest = revisions[0];
  const mailHref = `mailto:info@todoi.org?subject=${encodeURIComponent(c.mailSubject)}&body=${encodeURIComponent(MAIL_BODY)}`;
  return (
    <section className={cx('contribute editorial-section')} id="contribute" aria-labelledby="contribute-title">
      <div className={cx('shell contribute-inner editorial-inner')}>
        <div className={cx('section-head', 'contribute-head')}>
          <h2 className={cx('section-title')} id="contribute-title">
            Corrections and additions
          </h2>
          <p className={cx('section-note', 'contribute-note')}>{c.text}</p>
          <p className={cx('contribute-actions')}>
            <a className={cx('btn btn-ghost btn-sm contribute-mail')} href={mailHref}>
              Email <span className={cx('contribute-addr')}>info@todoi.org</span>
            </a>
            {publishesCsv(config.slug) ? (
              <>
                {' '}
                <a className={cx('contribute-csv')} href={`/${config.csvFile}`} download>
                  Download CSV
                </a>
              </>
            ) : null}
          </p>
        </div>

        <div className={cx('section-body')}>
          <Accordion.Root className={cx('acc-list')} multiple>
            <Accordion.Item className={cx('acc')} value="listing">
              <Accordion.Header className={cx('acc-h')}>
                <Accordion.Trigger className={cx('acc-q')}>
                  <span className={cx('acc-label')}>{c.listingTitle}</span>
                  <ChevronIcon className={cx('acc-ico')} />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className={cx('acc-a')} hiddenUntilFound>
                <Html as="div" className={cx('acc-a-body')} html={c.listing} />
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item className={cx('acc')} value="revisions">
              <Accordion.Header className={cx('acc-h')}>
                <Accordion.Trigger className={cx('acc-q')}>
                  <span className={cx('acc-label')} id="revisions-title">
                    Revision history
                  </span>
                  <span className={cx('sr-only')}>, </span>
                  <span className={cx('acc-meta')}>
                    {latest ? `${shortDate(latest.date)} · ` : ''}
                    {config.revisions.length} updates
                  </span>
                  <ChevronIcon className={cx('acc-ico')} />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className={cx('acc-a')} hiddenUntilFound>
                <dl className={cx('revisions')} aria-labelledby="revisions-title">
                  {revisions.map((r) => (
                    <div key={r.id}>
                      <dt>
                        <time dateTime={r.date}>{shortDate(r.date)}</time>
                      </dt>
                      <Html as="dd" html={r.text} />
                    </div>
                  ))}
                </dl>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        </div>
      </div>
    </section>
  );
}

export function Crosslink({ onStart = false }: { onStart?: boolean }) {
  const { config } = useDirectory();
  const x = config.copy.crosslink;
  return (
    <aside className={cx('crosslink')} aria-label="Companion directory">
      <div className={cx(onStart ? 'shell crosslink-inner routes-inner' : 'shell crosslink-inner editorial-inner')}>
        <span className={cx('crosslink-label')}>Companion directory</span>
        <a className={cx('crosslink-link')} href={x.href}>
          <span>
            <span className={cx('crosslink-title')}>{x.title}</span>
            <span
              className={cx('crosslink-text')}
              id={x.href === '/commercial-task-managers/' ? 'crosslink-commercial-text' : undefined}
            >
              {x.text}
            </span>
          </span>
          <ArrowIcon />
        </a>
      </div>
    </aside>
  );
}
