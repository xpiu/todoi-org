import { useSuspenseQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { longDate } from '@todoi/shared';
import { Html } from '../../components/Html.tsx';
import { SiteFooter, SiteHeader } from '../../components/SiteChrome.tsx';
import { directoryQuery } from './queries.ts';
import { Crosslink } from './Sections.tsx';
import { DirectoryProvider, useDirectory } from './state.tsx';
import { cx } from '../../styles/modules.ts';

/**
 * "Where to start": a page of its own for each directory. The same typed
 * config as the directory it belongs to, so its picks link to that directory's
 * records and its footer and crosslink are the ones the directory shows.
 */
export function StartPage({ slug }: { slug: string }) {
  const { api } = useRouteContext({ from: '__root__' });
  const { data } = useSuspenseQuery(directoryQuery(api, slug));
  return (
    <DirectoryProvider data={data}>
      <Page />
    </DirectoryProvider>
  );
}

function Page() {
  const { config } = useDirectory();
  const { copy, routes, path } = config;
  const r = copy.routes;
  return (
    <>
      <a className={cx('skip-link')} href="#start">
        Skip to the situations
      </a>
      <SiteHeader path={path} onStart />
      <main id="main">
        <section className={cx('hero start-hero')}>
          <div className={cx('shell hero-inner')}>
            <div className={cx('hero-copy')}>
              <p className={cx('start-back')}>
                <a href={path}>Back to the matrix</a>
              </p>
              <h1 className={cx('hero-title')}>{r.title}</h1>
              <Html as="p" className={cx('hero-lede')} html={r.lede} />
            </div>
          </div>
        </section>

        <section className={cx('method start-questions')} id="questions" aria-labelledby="questions-title">
          <div className={cx('shell method-inner')}>
            <div className={cx('section-head')}>
              <h2 className={cx('section-title')} id="questions-title">
                {r.questionsTitle}
              </h2>
              <p className={cx('section-note')}>{r.questionsNote}</p>
            </div>
            <dl className={cx('start-questions-list')}>
              {r.questions.map((q) => (
                <div className={cx('criterion start-question')} key={q.q}>
                  <dt className={cx('criterion-name')}>{q.q}</dt>
                  <Html as="dd" className={cx('criterion-text')} html={q.a} />
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className={cx('routes')} id="start" aria-labelledby="start-title">
          <div className={cx('shell routes-inner')}>
            <div className={cx('section-head')}>
              <h2 className={cx('section-title')} id="start-title">
                {r.situationsTitle}
              </h2>
              <Html as="p" className={cx('section-note')} html={r.situationsNote} />
            </div>
            <dl className={cx('route-list')}>
              {routes.map((x) => (
                <div className={cx('route')} key={x.id}>
                  <dt className={cx('route-case')}>{x.case}</dt>
                  <Html as="dd" className={cx('route-pick')} html={x.pick} />
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className={cx('method start-trial')} id="trial" aria-labelledby="trial-title">
          <div className={cx('shell method-inner')}>
            <div className={cx('section-head')}>
              <h2 className={cx('section-title')} id="trial-title">
                {r.trialTitle}
              </h2>
              <p className={cx('section-note')}>{r.trialNote}</p>
            </div>
            <ol className={cx('trial-list')}>
              {r.trial.map((t) => (
                <li className={cx('trial-step')} key={t.title}>
                  <h3 className={cx('trial-step-title')}>{t.title}</h3>
                  <Html as="p" className={cx('trial-step-text')} html={t.text} />
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={cx('contribute start-fallback')} id="fallback" aria-labelledby="fallback-title">
          <div className={cx('shell method-inner')}>
            <div className={cx('section-head')}>
              <h2 className={cx('section-title')} id="fallback-title">
                {r.fallbackTitle}
              </h2>
            </div>
            {r.fallback.map((p, i) => (
              <Html as="p" key={i} className={cx('method-note')} html={p} />
            ))}
          </div>
        </section>
        <Crosslink />
      </main>
      <SiteFooter
        path={path}
        onStart
        note={copy.footer.note}
        csvFile={config.csvFile}
        otherLabel={copy.footer.otherLabel}
        otherHref={copy.footer.otherHref}
        compiledOn={config.compiledOn}
        compiledLabel={longDate(config.compiledOn)}
      />
    </>
  );
}
