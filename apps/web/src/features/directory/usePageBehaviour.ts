import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useDirectory } from './state.tsx';

function reduceMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** The copy of a record that is actually on screen: its row at 900px and up, its card below. */
function visibleHost(slug: string): HTMLElement | null {
  const hosts = document.querySelectorAll<HTMLElement>(`tr.matrix-row[data-slug="${CSS.escape(slug)}"], article.card[data-slug="${CSS.escape(slug)}"]`);
  for (const h of hosts) if (h.getClientRects().length) return h;
  return null;
}

export function usePageBehaviour(): void {
  const { records, toggle, view, update } = useDirectory();
  const navigate = useNavigate();
  const state = useRef({ toggle, view, update });
  state.current = { toggle, view, update };

  // In-page links scroll (smoothly unless motion is reduced), move focus where
  // the eye went, and keep the view: the hash names a section, the query the state.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
      if (!a) return;
      const id = (a.getAttribute('href') ?? '').slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      void navigate({ to: '.', search: (s) => s, hash: id, resetScroll: false, hashScrollIntoView: false });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [navigate]);

  // The section in view is marked in the header's navigation.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const links = [...document.querySelectorAll<HTMLAnchorElement>('.site-header nav a[href^="#"]')];
    const map = links
      .map((link) => ({ link, target: document.getElementById(link.getAttribute('href')!.slice(1)) }))
      .filter((m): m is { link: HTMLAnchorElement; target: HTMLElement } => m.target !== null);
    if (!map.length) return;
    const seen: Record<string, boolean> = {};
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) seen[en.target.id] = en.isIntersecting;
        const active = map.find((m) => seen[m.target.id])?.link ?? null;
        for (const m of map) {
          if (m.link === active) m.link.setAttribute('aria-current', 'location');
          else m.link.removeAttribute('aria-current');
        }
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
    );
    map.forEach((m) => io.observe(m.target));
    return () => io.disconnect();
  }, []);

  // On arrival: a bare #slug (the record's JSON-LD @id) opens that record, and
  // whichever record the address names is brought into view.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    let slug = state.current.view.open;
    if (hash && records.some((r) => r.slug === hash) && hash !== slug) {
      slug = hash;
      state.current.toggle(hash);
    }
    if (!slug) return;
    const t = window.setTimeout(() => visibleHost(slug!)?.scrollIntoView({ behavior: 'auto', block: 'start' }), 0);
    return () => window.clearTimeout(t);
    // Arrival only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Close record" at the foot of a long record: collapse it through its own
  // expander, then bring the row back into view, because it is a long way up.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as Element | null)?.closest?.('.detail-close');
      if (!btn) return;
      const host = btn.closest<HTMLElement>('tr.detail-row, article.card');
      const owner = host?.classList.contains('card') ? host : (host?.previousElementSibling as HTMLElement | null);
      const slug = owner?.dataset.slug;
      if (!owner || !slug) return;
      state.current.toggle(slug);
      const expander = owner.querySelector<HTMLButtonElement>('button.row-expand, button.card-expand');
      owner.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
      expander?.focus({ preventScroll: true });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
}
