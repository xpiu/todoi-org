import { cx } from '../styles/modules.ts';
/** The static site's 404 page: same copy, same hero layout, kept out of the index. */
export function NotFound() {
  return (
    <>
      <title>Page not found · todoi.org</title>
      <meta name="robots" content="noindex" />
      <main className={cx('hero')}>
        <div className={cx('shell')}>
          <p className={cx('hero-meta')}>todoi.org · 404</p>
          <h1 className={cx('hero-title')}>Page not found</h1>
          <p className={cx('hero-lede')}>
            This address does not point to a page or download. Browse the directory to find a task manager or the
            latest dataset.
          </p>
          <p className={cx('contribute-actions')}>
            <a className={cx('btn btn-primary')} href="/">
              Back to the directory
            </a>
          </p>
        </div>
      </main>
    </>
  );
}
