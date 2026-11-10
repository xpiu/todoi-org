import { Accordion } from '@base-ui/react/accordion';
import { longDate } from '@todoi/shared';
import { Html } from '../../components/Html.tsx';
import { ArrowIcon, TagIcon } from '../../components/icons.tsx';
import { HeroMark } from './HeroMark.tsx';
import { useDirectory } from './state.tsx';

export function Hero() {
  const { config } = useDirectory();
  const { hero } = config.copy;
  return (
    <section className="hero">
      <div className="shell hero-inner">
        <div className="hero-copy">
          <h1 className="hero-title">{hero.title}</h1>
          <p className="hero-lede">{hero.lede}</p>
        </div>
        {hero.mark ? <HeroMark /> : null}
      </div>
    </section>
  );
}

export function Routes() {
  const { config } = useDirectory();
  return (
    <section className="routes" id="start" aria-labelledby="start-title">
      <div className="shell routes-inner">
        <div className="section-head">
          <h2 className="section-title" id="start-title">
            {config.copy.routes.title}
          </h2>
          <p className="section-note">{config.copy.routes.note}</p>
        </div>
        <dl className="route-list">
          {config.routes.map((r) => (
            <div className="route" key={r.id}>
              <dt className="route-case">{r.case}</dt>
              <Html as="dd" className="route-pick" html={r.pick} />
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
    <section className="method" id="method" aria-labelledby="method-title">
      <div className="shell method-inner">
        <div className="section-head">
          <h2 className="section-title" id="method-title">
            {method.title}
          </h2>
          <p className="section-note">{method.note}</p>
        </div>
        <dl className="criteria">
          {config.criteria.map((c) => (
            <div className="criterion" key={c.key}>
              <dt className="criterion-name">{c.name}</dt>
              <dd className="criterion-text">{c.text}</dd>
            </div>
          ))}
          <div className="criterion criterion-band">
            <dt className="criterion-name">{band.name}</dt>
            <dd className="criterion-text">{band.text}</dd>
          </div>
        </dl>
        {method.notes.map((n, i) => (
          <Html as="p" key={i} className="method-note" html={n} />
        ))}

        <div className="models">
          <h3 className="sub-title" id="models-title">
            {method.modelsTitle}
          </h3>
          <Html as="p" className="method-note" html={method.modelsNote} />
          <dl className="model-defs" aria-labelledby="models-title">
            {defined.map((s) => (
              <div className="model-def" key={s.key}>
                <dt className="model-name">
                  <span className={`tag tag-${s.tagClass}`}>
                    <TagIcon name={s.icon} />
                    {s.label}
                  </span>
                </dt>
                <dd className="model-text">{s.definition}</dd>
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
    <section className="faq" id="faq" aria-labelledby="faq-title">
      <div className="shell faq-inner">
        <div className="section-head">
          <h2 className="section-title" id="faq-title">
            Questions
          </h2>
        </div>
        <Accordion.Root className="acc-list" multiple>
          {config.faqs.map((f) => (
            <Accordion.Item className="acc" key={f.id} value={f.id}>
              <Accordion.Header className="acc-h">
                <Accordion.Trigger className="acc-q">{f.question}</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className="acc-a" hiddenUntilFound>
                <Html as="div" className="acc-a-body" html={f.answer} />
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
    <section className="contribute" id="contribute" aria-labelledby="contribute-title">
      <div className="shell contribute-inner">
        <h2 className="section-title" id="contribute-title">
          Corrections and additions
        </h2>
        <div className="contribute-col">
          <p className="contribute-text">{c.text}</p>
          <h3 className="sub-title">{c.listingTitle}</h3>
          <Html as="p" className="contribute-text" html={c.listing} />
        </div>
        <div className="contribute-col">
          <h3 className="sub-title">Revisions</h3>
          <dl className="revisions">
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
        <p className="contribute-actions">
          <a className="btn btn-primary" href={`mailto:info@todoi.org?subject=${encodeURIComponent(c.mailSubject)}`}>
            Submit a correction
          </a>{' '}
          <a className="btn btn-ghost" href={`/${config.csvFile}`} download>
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
    <aside className="crosslink" aria-label="The other directory">
      <div className="shell crosslink-inner">
        <a className="crosslink-link" href={x.href}>
          <span>
            <span className="crosslink-kicker">Also on todoi.org</span>
            <span className="crosslink-title">{x.title}</span>
            <span
              className="crosslink-text"
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
