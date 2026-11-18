import { ThemeSwitch } from './ThemeSwitch.tsx';
import { WordmarkLogo, XLogo } from './icons.tsx';
import { cx } from '../styles/modules.ts';

/** The page's sections, in order; null is "Where to start", which is a page of its own. */
const SECTIONS = [
  ['#directory', 'Task managers'],
  ['#map', 'Map'],
  [null, 'Where to start'],
  ['#method', 'Method'],
  ['#faq', 'Questions'],
  ['#contribute', 'Contribute'],
] as const;

/** Where the "Where to start" page of a directory lives. */
export const startPath = (path: string) => `${path}where-to-start/`;

/**
 * On the directory itself the sections are in-page anchors; from the start page
 * they are the directory's address plus the anchor. Where to start is always
 * the page, and is marked as the current page when it is the one showing.
 */
function SectionLinks({ path, onStart }: { path: string; onStart: boolean }) {
  return SECTIONS.map(([hash, label]) => {
    if (hash === null) {
      return (
        <a key="start" href={startPath(path)} aria-current={onStart ? 'page' : undefined}>
          {label}
        </a>
      );
    }
    return (
      <a key={hash} href={onStart ? `${path}${hash}` : hash}>
        {label}
      </a>
    );
  });
}

export function SiteHeader({ path, onStart = false }: { path: string; onStart?: boolean }) {
  return (
    <header className={cx('site-header')}>
      <div className={cx('shell site-header-inner')}>
        <a className={cx('wordmark')} href="/" aria-label="todoi.org, home">
          <WordmarkLogo />
          <span className={cx('wordmark-name')}>
            todoi<span className={cx('wordmark-tld')}>.org</span>
          </span>
        </a>
        <nav className={cx('site-nav')} aria-label="Sections">
          <SectionLinks path={path} onStart={onStart} />
        </nav>
        <ThemeSwitch />
      </div>
    </header>
  );
}

export function SiteFooter(props: {
  path: string;
  onStart?: boolean;
  note: string;
  csvFile: string;
  otherLabel: string;
  otherHref: string;
  compiledOn: string;
  compiledLabel: string;
}) {
  return (
    <footer className={cx('site-footer')}>
      <div className={cx('shell site-footer-inner')}>
        <div className={cx('footer-brand')}>
          <span className={cx('wordmark wordmark-sm')}>
            <span className={cx('wordmark-name')}>
              todoi<span className={cx('wordmark-tld')}>.org</span>
            </span>
          </span>
          <p className={cx('footer-note')}>{props.note}</p>
        </div>
        <nav className={cx('footer-nav')} aria-label="Footer">
          <SectionLinks path={props.path} onStart={props.onStart ?? false} />
          <a href={`/${props.csvFile}`}>Dataset (CSV)</a>
          <a href={props.otherHref}>{props.otherLabel}</a>
        </nav>
        <p className={cx('footer-meta')}>
          Dataset compiled <time dateTime={props.compiledOn}>{props.compiledLabel}</time>. Assessments are editorial and
          subject to revision.
        </p>
        <p className={cx('footer-contact')}>
          <a href="https://flo.tokyo">Contact</a>
          <a className={cx('footer-x')} href="https://x.com/flozuallaert" rel="me noopener" aria-label="X">
            <XLogo />
          </a>
        </p>
      </div>
    </footer>
  );
}
