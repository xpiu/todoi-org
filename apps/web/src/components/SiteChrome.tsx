import { ThemeSwitch } from './ThemeSwitch.tsx';
import { WordmarkLogo, XLogo } from './icons.tsx';

const SECTIONS = [
  ['#directory', 'Task managers'],
  ['#start', 'Where to start'],
  ['#method', 'Method'],
  ['#faq', 'Questions'],
  ['#contribute', 'Contribute'],
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell site-header-inner">
        <a className="wordmark" href="/" aria-label="todoi.org, home">
          <WordmarkLogo />
          <span className="wordmark-name">
            todoi<span className="wordmark-tld">.org</span>
          </span>
        </a>
        <nav className="site-nav" aria-label="Sections">
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
    <footer className="site-footer">
      <div className="shell site-footer-inner">
        <div className="footer-brand">
          <span className="wordmark wordmark-sm">
            <span className="wordmark-name">
              todoi<span className="wordmark-tld">.org</span>
            </span>
          </span>
          <p className="footer-note">{props.note}</p>
        </div>
        <nav className="footer-nav" aria-label="Footer">
          {SECTIONS.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
          <a href={`/${props.csvFile}`}>Dataset (CSV)</a>
          <a href={props.otherHref}>{props.otherLabel}</a>
        </nav>
        <p className="footer-meta">
          Dataset compiled <time dateTime={props.compiledOn}>{props.compiledLabel}</time>. Assessments are editorial and
          subject to revision.
        </p>
        <p className="footer-contact">
          <a href="https://flo.tokyo">Contact</a>
          <a className="footer-x" href="https://x.com/flozuallaert" rel="me noopener" aria-label="X">
            <XLogo />
          </a>
        </p>
      </div>
    </footer>
  );
}
