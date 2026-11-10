import type { ReactNode, SVGProps } from 'react';
import type { Level } from '@todoi/shared';

/**
 * Every glyph the pages draw, verbatim from the static site. Decorative:
 * hidden from assistive technology, never focusable.
 */
const hidden = { 'aria-hidden': true, focusable: 'false' } as const;

const LINE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const GLYPHS: Record<string, ReactNode> = {
  time: (
    <>
      <path d="M6.2 1.6h3.6M8 1.6v1.9" />
      <circle cx="8" cy="9.3" r="5.2" />
      <path d="M8 6.6v2.7h2.2" />
    </>
  ),
  boards: (
    <>
      <rect x="1.9" y="2.9" width="3.3" height="10.2" rx="1.1" fill="currentColor" stroke="none" />
      <rect x="6.35" y="2.9" width="3.3" height="6.4" rx="1.1" fill="currentColor" stroke="none" />
      <rect x="10.8" y="2.9" width="3.3" height="8.3" rx="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  gantt: (
    <>
      <path d="M2.1 3v10" />
      <path d="M4.5 4.9h5.8M6.7 8h6.5M5.3 11.1h4.4" strokeWidth="1.8" />
    </>
  ),
  calendar: (
    <>
      <rect x="1.9" y="3.2" width="12.2" height="10.9" rx="1.4" />
      <path d="M1.9 6.6h12.2M5.3 1.8v2.8M10.7 1.8v2.8" />
      <circle cx="5.6" cy="10.2" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  sync: (
    <>
      <path d="M14.8 3v3.7h-3.7M1.2 13V9.3h3.7" />
      <path d="M2.75 6.15a5.58 5.58 0 0 1 9.2-2.09l2.85 2.66M1.2 9.3l2.85 2.66a5.58 5.58 0 0 0 9.2-2.09" />
    </>
  ),
  free: (
    <>
      <path d="M8.7 1.9h4.6a.8.8 0 0 1 .8.8v4.6L7.7 13.7a1 1 0 0 1-1.4 0L2.3 9.7a1 1 0 0 1 0-1.4z" />
      <circle cx="11.1" cy="4.9" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  foss: (
    <>
      <path d="M5.5 7.9V5.2a2.5 2.5 0 0 1 5 0" />
      <rect x="2.9" y="7.7" width="10.2" height="6.1" rx="1.4" fill="currentColor" />
    </>
  ),
  'open-core': (
    <>
      <path d="M5.5 7.9V5.2a2.5 2.5 0 0 1 5 0" />
      <rect x="2.9" y="7.7" width="10.2" height="6.1" rx="1.4" />
      <path d="M8 8.5H4.6a.7.7 0 0 0-.7.7v2.7a.7.7 0 0 0 .7.7H8z" fill="currentColor" stroke="none" />
    </>
  ),
  'source-available': (
    <>
      <path d="M5.5 7.9V5.9a2.5 2.5 0 0 1 5 0v2" />
      <rect x="2.9" y="7.7" width="10.2" height="6.1" rx="1.4" />
    </>
  ),
  personal: (
    <>
      <circle cx="8" cy="5.2" r="2.6" />
      <path d="M3 14.2a5 5 0 0 1 10 0" />
    </>
  ),
  team: (
    <>
      <circle cx="5.6" cy="5.6" r="2.2" />
      <circle cx="11" cy="6.4" r="1.8" />
      <path d="M1.6 13.8a4 4 0 0 1 8 0M10.2 10.1a3.4 3.4 0 0 1 4.4 3.3" />
    </>
  ),
  software: <path d="M5.4 4.4 1.8 8l3.6 3.6M10.6 4.4 14.2 8l-3.6 3.6M9.1 2.9 6.9 13.1" />,
  enterprise: (
    <>
      <rect x="2.6" y="2" width="7" height="12.2" rx="0.8" />
      <path d="M9.6 6.4h3a.8.8 0 0 1 .8.8v7M1.4 14.2h13.2M4.8 4.8h2.6M4.8 7.6h2.6M4.8 10.4h2.6" />
    </>
  ),
};

/** A 16-unit line glyph: toggle icons (15px) and tag icons (13px). */
export function Glyph({ name, className, size }: { name: string; className: string; size: number }) {
  return (
    <svg className={className} viewBox="0 0 16 16" width={size} height={size} {...LINE} {...hidden}>
      {GLYPHS[name]}
    </svg>
  );
}

export const TagIcon = ({ name }: { name: string }) => <Glyph name={name} className="tag-ico" size={13} />;

/** Native, partial, none: a full disc, a half disc, a ring. */
export function MarkSvg({ level }: { level: Level }) {
  return (
    <svg className="mark-svg" viewBox="0 0 16 16" width="13" height="13" {...hidden}>
      {level === 2 ? (
        <circle cx="8" cy="8" r="6.25" fill="currentColor" />
      ) : (
        <>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
          {level === 1 ? <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" /> : null}
        </>
      )}
    </svg>
  );
}

export function DateStampIcon() {
  return (
    <svg className="date-stamp-icon" viewBox="0 0 16 16" width="10" height="10" {...hidden}>
      <rect x="2.25" y="3.25" width="11.5" height="10.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2.25 6.75h11.5M5.5 1.75v3M10.5 1.75v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WordmarkLogo() {
  return (
    <svg
      className="wordmark-logo"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...hidden}
    >
      <path d="M16.82 22.04A10.62 10.62 0 1 0 7.18 22.04" />
      <path d="M7.5 12.56L10.77 15.82L16.96 9.63" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg className="theme-switch-icon" viewBox="0 0 16 16" width="15" height="15" {...hidden}>
      <circle cx="8" cy="8" r="3.1" fill="currentColor" />
      <path
        d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg className="theme-switch-icon" viewBox="0 0 16 16" width="15" height="15" {...hidden}>
      <path fill="currentColor" d="M6.04 1.91A6.4 6.4 0 1 0 14.09 9.96 6 6 0 0 1 6.04 1.91Z" />
    </svg>
  );
}

export function FilterIcon() {
  return (
    <svg
      className="filter-disclosure-icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      {...hidden}
    >
      <path d="M2 4h12M4.5 8h7M6.5 12h3" />
      <circle cx="5" cy="4" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="8" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChevronIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" width="16" height="16" {...LINE} {...hidden}>
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

export function ArrowIcon() {
  return (
    <svg className="crosslink-arrow" viewBox="0 0 16 16" width="20" height="20" {...LINE} {...hidden}>
      <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" />
    </svg>
  );
}

export function XLogo() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" {...hidden}>
      <path
        fill="currentColor"
        d="M18.9 1.2h3.7l-8.1 9.3L24 23.1h-7.5l-5.9-7.7-6.7 7.7H.2l8.6-9.9L-.4 1.2h7.7l5.3 7 6.3-7Zm-1.3 19.7h2L6.2 3.3h-2.2Z"
      />
    </svg>
  );
}

export function GitHubIcon() {
  return (
    <svg className="th-ico" viewBox="0 0 16 16" width="11" height="11" {...hidden}>
      <path
        fill="currentColor"
        d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
      />
    </svg>
  );
}

/** The hero mark: one stroke, two rings. The ripple layer is added by HeroMark. */
export function HeroMarkSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg className="hero-mark-svg" viewBox="0 0 1462 1417" fill="none" focusable="false" {...props}>
      <path
        d="M484.05 1383.85a698 698 0 1 1 493.9 0L820.69 968.1a253.5 253.5 0 1 0-179.38 0Z"
        stroke="currentColor"
        strokeWidth="63"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
