import { useEffect } from 'react';
import type { DirectoryConfig } from '@todoi/shared';

const DELAY = 90; // sweeping a cursor along a row shouldn't flash tooltips
const GAP = 8; // trigger to tooltip
const EDGE = 8; // tooltip to viewport

/**
 * Hover and focus explanations for what a collapsed row cannot spell out: the
 * licensing or audience tag, the band, every column's method, the daggers.
 * One shared node on <body>, fixed and positioned by script, because the
 * matrix scrolls sideways and would clip a tooltip parented inside a cell.
 * Method copy is authored as title= so readers without JavaScript still get
 * it from the browser; it is lifted into data-method on first use, or both
 * tips would open at once.
 */
export function useTokenTips(config: DirectoryConfig): void {
  useEffect(() => {
    const lic: Record<string, string> = Object.fromEntries(config.segments.map((s) => [s.key, s.tip]));
    const comm = config.copy.band.tips;
    const commTail = config.copy.band.tail;
    const groups = [
      { sel: '.tag[data-lic]', attr: 'data-lic', text: lic as Record<string, string> | null, tail: '' },
      { sel: '[data-comm]', attr: 'data-comm', text: comm, tail: commTail },
      { sel: '[data-method], .methodology[title]', attr: 'data-method', text: null, tail: '' },
    ];
    const SEL = groups.map((g) => g.sel).join(', ');

    const lift = (el: Element) => {
      if (el.matches('.methodology[title]')) {
        el.setAttribute('data-method', el.getAttribute('title')!);
        el.removeAttribute('title');
      }
    };
    const copyFor = (el: Element): string | null => {
      lift(el);
      for (const g of groups) {
        if (!el.matches(g.sel)) continue;
        const raw = el.getAttribute(g.attr);
        const body = raw === null ? null : g.text ? g.text[raw] : raw;
        return body ? body + g.tail : null;
      }
      return null;
    };

    const tip = document.createElement('div');
    tip.className = 'tip';
    tip.id = 'token-tip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    const label = document.createElement('strong');
    label.className = 'tip-label';
    const body = document.createElement('span');
    tip.append(label, body);
    document.body.appendChild(tip);

    let active: Element | null = null;
    let timer: number | undefined;
    let pending = 0;

    function place() {
      if (!active) return;
      const r = active.getBoundingClientRect();
      // Trigger gone (filtered out, collapsed) or scrolled away: don't hang in empty space.
      if ((!r.width && !r.height) || r.bottom < 0 || r.top > window.innerHeight) return hide();
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      let side = 'top';
      let top = r.top - GAP - h;
      if (top < EDGE) {
        side = 'bottom';
        top = r.bottom + GAP;
      }
      let left = r.left + r.width / 2 - w / 2;
      left = Math.max(EDGE, Math.min(left, window.innerWidth - w - EDGE));
      tip.style.top = `${Math.round(top)}px`;
      tip.style.left = `${Math.round(left)}px`;
      tip.setAttribute('data-side', side);
      // The arrow tracks the trigger, not the box, which may have been clamped.
      const ax = r.left + r.width / 2 - left;
      tip.style.setProperty('--arrow-x', `${Math.round(Math.max(10, Math.min(ax, w - 10)))}px`);
    }

    function show(el: Element) {
      const copy = copyFor(el);
      if (!copy) return;
      active = el;
      // A dagger is not a heading: it names the column it qualifies instead.
      label.textContent = el.getAttribute('data-tip-label') || el.textContent;
      body.textContent = copy;
      tip.setAttribute('data-enter', '0');
      tip.hidden = false;
      el.setAttribute('aria-describedby', tip.id);
      place();
      // Measured and positioned first, then faded in.
      requestAnimationFrame(() => {
        if (active === el) tip.setAttribute('data-enter', '1');
      });
    }

    function hide() {
      window.clearTimeout(timer);
      timer = undefined;
      if (!active) return;
      active.removeAttribute('aria-describedby');
      active = null;
      tip.hidden = true;
      tip.removeAttribute('data-enter');
    }

    const onOver = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.(SEL);
      if (!el || el === active) return;
      lift(el);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        show(el);
      }, DELAY);
    };
    const onOut = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.(SEL);
      if (!el) return;
      if (e.relatedTarget && (e.relatedTarget as Element).closest?.(SEL) === el) return;
      window.clearTimeout(timer);
      timer = undefined;
      if (el === active && el !== document.activeElement) hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = (e.target as Element | null)?.closest?.(SEL);
      if (el) show(el);
      else if (active) hide();
    };
    const onFocusOut = (e: FocusEvent) => {
      if ((e.target as Element | null)?.closest?.(SEL) === active) hide();
    };
    const onKey = (e: KeyboardEvent) => {
      if (active && (e.key === 'Escape' || e.key === 'Esc')) hide();
    };
    const reposition = () => {
      if (!active || pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        place();
      });
    };

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('keydown', onKey);
    // Capture phase: the matrix scrolls inside its own box, not the window.
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      hide();
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      if (pending) cancelAnimationFrame(pending);
      tip.remove();
    };
  }, [config]);
}
