import { useEffect, useRef } from 'react';
import { HeroMarkSvg } from '../../components/icons.tsx';

const NS = 'http://www.w3.org/2000/svg';
const WIDTH = 58; // just under the 63-unit stroke, so a block's corners stay inside on the inner ring
const OVERLAP = 4; // blocks overlap slightly so curves show no seams
const STEP = 84; // target block length along the stroke
const CENTRE = { x: 731, y: 731 }; // shared centre of both rings
const R_OUT = 698; // outer ring radius: where the wave starts
const R_IN = 253.5; // inner ring radius: where it closes
const TRAVEL = 800; // ms for the front to go from R_OUT to R_IN
const BLOCK = 600; // ms per block; matches the CSS animation

function place(el: SVGElement, x: number, y: number, deg: number) {
  el.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${deg.toFixed(2)})`);
  return el;
}

/**
 * Plays once: the stroke is cut into blocks of its own width, and a wave
 * closes in on the centre from every side, like a ring of water contracting.
 * Purely decorative: skipped under reduced motion, when the mark is not
 * displayed, or without the SVG geometry API. Styles: .hero-mark-ripple.
 */
function ripple(svg: SVGSVGElement): () => void {
  const path = svg.querySelector('path');
  if (!path || typeof path.getTotalLength !== 'function') return () => {};
  if (getComputedStyle(svg.parentElement!).display === 'none') return () => {};

  const layer = document.createElementNS(NS, 'g');
  layer.setAttribute('class', 'hero-mark-ripple');
  let last = 0;
  try {
    const total = path.getTotalLength();
    const n = Math.max(1, Math.round(total / STEP));
    const step = total / n;
    const len = step + OVERLAP;
    for (let i = 0; i < n; i++) {
      const s = (i + 0.5) * step;
      const p = path.getPointAtLength(s);
      const a = path.getPointAtLength(Math.max(0, s - 2));
      const b = path.getPointAtLength(Math.min(total, s + 2));
      const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      const r = Math.hypot(p.x - CENTRE.x, p.y - CENTRE.y);
      const inward = Math.min(1, Math.max(0, (R_OUT - r) / (R_OUT - R_IN)));
      const delay = Math.round(inward * TRAVEL);
      last = Math.max(last, delay);

      const block = document.createElementNS(NS, 'g');
      block.setAttribute('class', 'hero-mark-block');
      block.setAttribute('style', `--d:${delay}ms`);
      const face = document.createElementNS(NS, 'rect');
      face.setAttribute('class', 'hero-mark-face');
      face.setAttribute('x', String(-len / 2));
      face.setAttribute('y', String(-WIDTH / 2));
      face.setAttribute('width', String(len));
      face.setAttribute('height', String(WIDTH));
      block.appendChild(place(face, p.x, p.y, deg));
      // The joint: a hairline across the block's leading end only.
      const seam = document.createElementNS(NS, 'line');
      const sx = String(-len / 2 + OVERLAP / 2);
      seam.setAttribute('class', 'hero-mark-seam');
      seam.setAttribute('x1', sx);
      seam.setAttribute('x2', sx);
      seam.setAttribute('y1', String(-WIDTH / 2));
      seam.setAttribute('y2', String(WIDTH / 2));
      block.appendChild(place(seam, p.x, p.y, deg));
      layer.appendChild(block);
    }
  } catch {
    return () => {};
  }
  if (!layer.firstChild) return () => {};

  const timers: number[] = [];
  let io: IntersectionObserver | null = null;
  const play = () => {
    svg.appendChild(layer);
    timers.push(window.setTimeout(() => layer.remove(), last + BLOCK + 100));
  };
  const arm = () => {
    timers.push(
      window.setTimeout(() => {
        if (!('IntersectionObserver' in window)) return play();
        io = new IntersectionObserver(
          (entries) => {
            if (!entries[0]?.isIntersecting) return;
            io?.disconnect();
            play();
          },
          { threshold: 0.6 },
        );
        io.observe(svg);
      }, 450),
    );
  };
  if (document.readyState === 'complete') arm();
  else window.addEventListener('load', arm, { once: true });
  return () => {
    timers.forEach(clearTimeout);
    io?.disconnect();
    window.removeEventListener('load', arm);
    layer.remove();
  };
}

export function HeroMark() {
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!svg.current) return;
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch {
      /* no matchMedia: play */
    }
    return ripple(svg.current);
  }, []);
  return (
    <div className="hero-mark" aria-hidden="true">
      <HeroMarkSvg ref={svg} />
    </div>
  );
}
