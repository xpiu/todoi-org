import { ThemeSwitch } from './ThemeSwitch.tsx';
import { WordmarkLogo, XLogo } from './icons.tsx';
import { cx } from '../styles/modules.ts';

const SECTIONS = [
  ['#directory', 'Task managers'],
  ['#map', 'Map'],
  ['#start', 'Where to start'],
  ['#method', 'Method'],
  ['#faq', 'Questions'],
  ['#contribute', 'Contribute'],
] as const;

export function SiteHeader() {
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
          {SECTIONS.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <ThemeSwitch />
      </div>
    </header>
  );
}

export function SiteFooter(props: {
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
          {SECTIONS.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
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
