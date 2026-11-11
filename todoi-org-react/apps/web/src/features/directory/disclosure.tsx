import { useRef, type MouseEvent, type Ref } from 'react';
import type { RecordSummary } from '@todoi/shared';
import { scrollBehavior } from '../../lib/motion.ts';
import { useDirectory } from './state.tsx';
import { cx } from '../../styles/modules.ts';

// Anything that does its own thing on a tap: links, the expander, and the
// focusable tokens whose tap opens a tooltip.
const OWN_TAP = 'a, button, input, select, textarea, label, summary, [tabindex], [role="button"]';

/**
 * How one record (a matrix row or a card) opens and closes, besides its expander:
 *
 * - `onTap`, on the row or card: a tap on its background opens it, as the
 *   expander would. Taps on controls inside it, on the open detail, and the
 *   click that ends a text selection are left alone. Keyboard and screen-reader
 *   users have the expander; this is a larger target, not a second control.
 * - `onDetailClick`, on the element holding the detail: "Close record" at the
 *   foot of a long record collapses it, then brings the record back into view,
 *   because it is a long way up, with focus on its expander. The detail may be
 *   server-rendered HTML that React never mounted, but a click inside it still
 *   bubbles to this handler, so no listener on the document is needed.
 */
export function useRecordDisclosure<Host extends HTMLElement>(slug: string, detailSelector?: string) {
  const { isOpen, toggle } = useDirectory();
  const host = useRef<Host>(null);
  const expander = useRef<HTMLButtonElement>(null);

  const onTap = (e: MouseEvent<HTMLElement>) => {
    const target = e.target as Element;
    const own = target.closest(OWN_TAP);
    if (own && own !== e.currentTarget && e.currentTarget.contains(own)) return;
    if (detailSelector && target.closest(detailSelector)) return;
    if (String(window.getSelection?.() ?? '').length) return;
    toggle(slug);
  };

  const onDetailClick = (e: MouseEvent<HTMLElement>) => {
    if (!(e.target as Element).closest('.detail-close')) return;
    toggle(slug);
    host.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
    expander.current?.focus({ preventScroll: true });
  };

  return { open: isOpen(slug), host, expander, onTap, onDetailClick };
}

/** The chevron that opens and closes a record: the accessible control a tap on the row stands in for. */
export function Expander({
  ref,
  record,
  open,
  controls,
  className,
  onReach,
}: {
  ref?: Ref<HTMLButtonElement>;
  record: RecordSummary;
  open: boolean;
  controls: string;
  className: 'row-expand' | 'card-expand';
  /** The reader is reaching for it: hover or focus. */
  onReach?: () => void;
}) {
  const { toggle } = useDirectory();
  const name = `Summary, assessment and sources for ${record.name}`;
  // The same name either way. The row spells it as text, as the static page
  // did, so the row's text still matches it in the parity test.
  const inRow = className === 'row-expand';
  return (
    <button
      ref={ref}
      type="button"
      className={cx(className)}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={inRow ? undefined : name}
      onClick={() => toggle(record.slug)}
      onPointerEnter={onReach}
      onFocus={onReach}
    >
      {inRow ? <span className={cx('sr-only')}>{name}</span> : null}
      <span className={cx('row-expand-mark')} aria-hidden="true" />
    </button>
  );
}
