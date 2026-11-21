import { SiteHeader } from './SiteChrome.tsx';
import { cx } from '../styles/modules.ts';

/** 404 page: kept out of the index. */
export function NotFound() {
  return (
    <>
      <title>Page not found · todoi.org</title>
      <meta name="robots" content="noindex" />
      <SiteHeader path="/" />
      <main className={cx('hero')}>
        <div className={cx('shell')}>
          <h1 className={cx('hero-title')}>Page not found</h1>
          <p className={cx('hero-lede')}>
            Nothing lives at this address. Browse the open-source or commercial directory to compare task managers.
          </p>
          <p className={cx('contribute-actions')}>
            <a className={cx('btn btn-primary')} href="/">
              Open-source directory
            </a>
            <a className={cx('btn btn-ghost')} href="/commercial-task-managers/">
              Commercial directory
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
