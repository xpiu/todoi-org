import { useSuspenseQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import { longDate } from '@todoi/shared';
import { Html } from '../../components/Html.tsx';
import { SiteFooter, SiteHeader } from '../../components/SiteChrome.tsx';
import { Cards } from './Cards.tsx';
import { Controls } from './Controls.tsx';
import { Empty } from './Empty.tsx';
import { FieldMap } from './FieldMap.tsx';
import { Matrix } from './Matrix.tsx';
import { directoryQuery } from './queries.ts';
import { Contribute, Crosslink, Faq, Hero, Method, Routes } from './Sections.tsx';
import { DirectoryProvider, useDirectory } from './state.tsx';
import { usePageBehaviour } from './usePageBehaviour.ts';
import { useTokenTips } from './useTokenTips.ts';
import { cx } from '../../styles/modules.ts';

/**
 * Both pages are this one feature with a different typed config, as both
 * static pages shared one script.
 */
export function DirectoryPage({ slug }: { slug: string }) {
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
  const { copy } = config;
  useTokenTips(config);
  usePageBehaviour();

  return (
    <>
      <a className={cx('skip-link')} href="#directory">
        Skip to the matrix
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <section className={cx('board')} id="directory" aria-labelledby="directory-title">
          <div className={cx('shell')}>
            <h2 className={cx('sr-only')} id="directory-title">
              The matrix
            </h2>
            <Controls />
            <Matrix />
            <Cards />
            <Html as="p" className={cx('matrix-updated')} html={copy.matrix.updated} />
            <Empty />
            <div className={cx('matrix-foot')}>
              <Html as="p" className={cx('provenance')} html={copy.matrix.provenance} />
            </div>
          </div>
        </section>
        <FieldMap />
        <Routes />
        <Method />
        <Faq />
        <Contribute />
        <Crosslink />
      </main>
      <SiteFooter
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
