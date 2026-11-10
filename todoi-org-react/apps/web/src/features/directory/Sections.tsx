import { Accordion } from '@base-ui/react/accordion';
import { longDate } from '@todoi/shared';
import { Html } from '../../components/Html.tsx';
import { ArrowIcon, TagIcon } from '../../components/icons.tsx';
import { HeroMark } from './HeroMark.tsx';
import { useDirectory } from './state.tsx';
import { cx } from '../../styles/modules.ts';

export function Hero() {
  const { config } = useDirectory();
  const { hero } = config.copy;
  return (
    <section className={cx('hero')}>
      <div className={cx('shell hero-inner')}>
        <div className={cx('hero-copy')}>
          <h1 className={cx('hero-title')}>{hero.title}</h1>
          <p className={cx('hero-lede')}>{hero.lede}</p>
        </div>
        {hero.mark ? <HeroMark /> : null}
      </div>
    </section>
  );
}

export function Routes() {
  const { config } = useDirectory();
  return (
    <section className={cx('routes')} id="start" aria-labelledby="start-title">
      <div className={cx('shell routes-inner')}>
        <div className={cx('section-head')}>
          <h2 className={cx('section-title')} id="start-title">
            {config.copy.routes.title}
          </h2>
          <p className={cx('section-note')}>{config.copy.routes.note}</p>
        </div>
        <dl className={cx('route-list')}>
          {config.routes.map((r) => (
            <div className={cx('route')} key={r.id}>
              <dt className={cx('route-case')}>{r.case}</dt>
              <Html as="dd" className={cx('route-pick')} html={r.pick} />
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function Method() {
  const { config } = useDirectory();
  const { method, band } = config.copy;
  const defined = config.segments.filter((s) => s.definition !== null);
  return (
    <section className={cx('method')} id="method" aria-labelledby="method-title">
      <div className={cx('shell method-inner')}>
        <div className={cx('section-head')}>
          <h2 className={cx('section-title')} id="method-title">
            {method.title}
          </h2>
          <p className={cx('section-note')}>{method.note}</p>
        </div>
        <dl className={cx('criteria')}>
          {config.criteria.map((c) => (
            <div className={cx('criterion')} key={c.key}>
              <dt className={cx('criterion-name')}>{c.name}</dt>
              <dd className={cx('criterion-text')}>{c.text}</dd>
            </div>
          ))}
          <div className={cx('criterion criterion-band')}>
            <dt className={cx('criterion-name')}>{band.name}</dt>
            <dd className={cx('criterion-text')}>{band.text}</dd>
          </div>
        </dl>
        {method.notes.map((n, i) => (
          <Html as="p" key={i} className={cx('method-note')} html={n} />
        ))}

        <div className={cx('models')}>
          <h3 className={cx('sub-title')} id="models-title">
            {method.modelsTitle}
          </h3>
          <Html as="p" className={cx('method-note')} html={method.modelsNote} />
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
    <section className={cx('faq')} id="faq" aria-labelledby="faq-title">
      <div className={cx('shell faq-inner')}>
        <div className={cx('section-head')}>
          <h2 className={cx('section-title')} id="faq-title">
            Questions
          </h2>
        </div>
        <Accordion.Root className={cx('acc-list')} multiple>
          {config.faqs.map((f) => (
            <Accordion.Item className={cx('acc')} key={f.id} value={f.id}>
              <Accordion.Header className={cx('acc-h')}>
                <Accordion.Trigger className={cx('acc-q')}>{f.question}</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className={cx('acc-a')} hiddenUntilFound>
                <Html as="div" className={cx('acc-a-body')} html={f.answer} />
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}

export function Contribute() {
  const { config } = useDirectory();
  const c = config.copy.contribute;
  return (
    <section className={cx('contribute')} id="contribute" aria-labelledby="contribute-title">
      <div className={cx('shell contribute-inner')}>
        <h2 className={cx('section-title')} id="contribute-title">
          Corrections and additions
        </h2>
        <div className={cx('contribute-col')}>
          <p className={cx('contribute-text')}>{c.text}</p>
          <h3 className={cx('sub-title')}>{c.listingTitle}</h3>
          <Html as="p" className={cx('contribute-text')} html={c.listing} />
        </div>
        <div className={cx('contribute-col')}>
          <h3 className={cx('sub-title')}>Revisions</h3>
          <dl className={cx('revisions')}>
            {config.revisions.map((r) => (
              <div key={r.id}>
                <dt>
                  <time dateTime={r.date}>{longDate(r.date)}</time>
                </dt>
                <Html as="dd" html={r.text} />
              </div>
            ))}
          </dl>
        </div>
        <p className={cx('contribute-actions')}>
          <a className={cx('btn btn-primary')} href={`mailto:info@todoi.org?subject=${encodeURIComponent(c.mailSubject)}`}>
            Submit a correction
          </a>{' '}
          <a className={cx('btn btn-ghost')} href={`/${config.csvFile}`} download>
            Download the dataset (CSV)
          </a>
        </p>
      </div>
    </section>
  );
}

export function Crosslink() {
  const { config } = useDirectory();
  const x = config.copy.crosslink;
  return (
    <aside className={cx('crosslink')} aria-label="The other directory">
      <div className={cx('shell crosslink-inner')}>
        <a className={cx('crosslink-link')} href={x.href}>
          <span>
            <span className={cx('crosslink-kicker')}>Also on todoi.org</span>
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
