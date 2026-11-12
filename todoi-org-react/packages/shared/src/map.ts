import type { DirectoryConfig, RecordSummary } from './directory.ts';
import { bandLabel, BAND_LABELS, formatScore, formatStars } from './score.ts';
import { sortKeys, valueOf } from './view.ts';

/**
 * The map: every record as a bubble, set by two of the figures the matrix
 * sorts by. Everything here is arithmetic on the records (which figure, where
 * along an axis, which names fit beside their bubbles), so the server and the
 * browser draw the same picture and none of it needs a DOM to test.
 */

/** Any figure the matrix sorts by can be an axis; a name has no position. */
export function mapKeys(dir: Pick<DirectoryConfig, 'kind' | 'criteria'>): string[] {
  return sortKeys(dir).filter((k) => k !== 'name');
}

export type AxisKind = 'score' | 'band' | 'year' | 'count' | 'price';

export interface AxisTick {
  /** 0 to 1 along the axis. */
  at: number;
  label: string;
  /** For a narrow plot: "M-L" where "Medium-large" will not fit. */
  short: string;
}

export interface MapAxis {
  key: string;
  kind: AxisKind;
  /** "Ease of deployment", as the sort menu names it. */
  label: string;
  /** What the figure measures, in the method's words; null when the method has no line for it. */
  note: string | null;
  ticks: AxisTick[];
  /**
   * Records without a figure (a quote-only price) sit in a lane of their own
   * past the end of the scale: where it starts, and what it is called.
   */
  lane: { from: number; label: string } | null;
  /** A record's position, 0 to 1. */
  at(record: RecordSummary): number;
  /** A raw figure's position, 0 to 1. */
  place(value: number): number;
  /** The figure as the matrix prints it: "4.5", "27.7k", "$10.99", "Large". */
  text(record: RecordSummary): string;
  /** A raw figure in the axis's own format, for a median. */
  format(value: number): string;
  /** How "more" and "less" of this figure read in a sentence: ["higher", "lower"]. */
  words: [string, string];
  /** The figure's name inside a sentence: "ease of deployment", "Score". */
  phrase: string;
}

/** The lane's share of the axis, and the clear space between the scale's last figure and it. */
const LANE = 0.1;
const LANE_GAP = 0.04;
const BAND_SHORT = ['S', 'M', 'M-L', 'L', 'XL'] as const;

function kindOf(key: string): AxisKind {
  if (key === 'community') return 'band';
  if (key === 'year') return 'year';
  if (key === 'price') return 'price';
  if (key === 'stars' || key === 'integrations') return 'count';
  return 'score';
}

/** 1500 → "1.5k", 10000 → "10k", 500 → "500". */
function compact(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  // Whole steps counted as integers, so 2.5 + 0.5 * 3 never lands on 3.9999.
  const n = Math.round((to - from) / step);
  for (let i = 0; i <= n; i++) out.push(Math.round((from + i * step) * 1000) / 1000);
  return out;
}

/** The 1-2-5 steps a logarithmic axis is ruled in, across the decades [lo, hi]. */
function steps125(lo: number, hi: number, picks: readonly number[]): number[] {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
    for (const m of picks) {
      const v = m * 10 ** e;
      if (v >= lo && v <= hi) out.push(v);
    }
  }
  return out;
}

function axisLabel(config: DirectoryConfig, key: string): string {
  for (const g of config.copy.controls.sortGroups) {
    const o = g.options.find((x) => x.value === key);
    if (o) return o.label;
  }
  return config.criteria.find((c) => c.key === key)?.name ?? key;
}

function axisNote(config: DirectoryConfig, key: string): string | null {
  const c = config.criteria.find((x) => x.key === key);
  if (c) return c.text;
  // A method note runs to a paragraph; its opening clause says what the figure is.
  const lead = (tip: string) => `${tip.split(/[.:](?=\s|$)| - /)[0]}.`;
  if (key === 'community') return lead(config.copy.band.text);
  if (key === 'avg') return lead(config.copy.score.tip);
  const m = config.copy.matrix;
  if (key === 'stars' || key === 'price') return lead(m.metric.tip);
  if (key === 'integrations') return lead(m.integrations.tip);
  if (key === 'year') return lead(m.year.tip);
  return null;
}

/**
 * One axis of the map. Its range comes from every record in the directory, not
 * from the ones a filter leaves, so a bubble never moves because another was
 * filtered out.
 */
export function mapAxis(config: DirectoryConfig, records: readonly RecordSummary[], key: string): MapAxis {
  const kind = kindOf(key);
  const label = axisLabel(config, key);
  const values = records.map((r) => valueOf(r, key));
  const finite = values.filter((v) => Number.isFinite(v));
  const missing = finite.length < values.length;
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 1;
  // The scale proper ends where the lane begins.
  const span = missing ? 1 - LANE - LANE_GAP : 1;

  let unit: (v: number) => number;
  let tickValues: number[];
  let format: (v: number) => string;
  let short: (v: number) => string = (v) => format(v);
  let words: [string, string] = ['higher', 'lower'];
  let text: (r: RecordSummary) => string = (r) => format(valueOf(r, key));

  switch (kind) {
    case 'score': {
      const lo = Math.max(1, Math.floor(min * 2) / 2);
      const hi = Math.min(5, Math.max(lo + 0.5, Math.ceil(max * 2) / 2));
      unit = (v) => (v - lo) / (hi - lo);
      tickValues = hi - lo > 2.5 ? range(Math.ceil(lo), hi, 1) : range(lo, hi, 0.5);
      format = formatScore;
      break;
    }
    case 'band': {
      unit = (v) => (v - 0.5) / BAND_LABELS.length;
      tickValues = BAND_LABELS.map((_, i) => i + 1);
      format = (v) => bandLabel(Math.round(v));
      short = (v) => BAND_SHORT[Math.round(v) - 1] ?? '';
      words = ['larger', 'smaller'];
      break;
    }
    case 'year': {
      const step = max - min > 30 ? 10 : 5;
      const lo = Math.floor(min / step) * step;
      const hi = Math.max(lo + step, Math.ceil(max / step) * step);
      unit = (v) => (v - lo) / (hi - lo);
      tickValues = range(lo, hi, step);
      format = (v) => String(Math.round(v));
      short = (v) => `’${String(Math.round(v)).slice(2)}`;
      words = ['later', 'earlier'];
      break;
    }
    case 'count': {
      // Counts run over orders of magnitude, so the axis is logarithmic. A
      // directory with a zero in it is shifted by one to keep the zero on it.
      const shift = min <= 0 ? 1 : 0;
      const first = steps125(1, 1e9, [1, 2, 5]);
      const lo = shift ? 1 : (first.filter((v) => v <= min).pop() ?? 1);
      const hi = first.find((v) => v >= max + shift && v > lo) ?? max + shift;
      const span10 = Math.log10(hi + shift) - Math.log10(lo);
      unit = (v) => (Math.log10(v + shift) - Math.log10(lo)) / span10;
      let picks = steps125(lo, hi, [1, 5]);
      if (picks.length > 7) picks = steps125(lo, hi, [1]);
      tickValues = shift ? [0, ...picks.filter((v) => v > 1)] : picks;
      format = (v) => compact(Math.round(v));
      words = ['more', 'fewer'];
      if (key === 'stars') text = (r) => (r.kind === 'oss' ? formatStars(r.stars) : '');
      if (key === 'integrations') text = (r) => r.integrationsLabel;
      break;
    }
    case 'price': {
      const step = max > 30 ? 10 : 5;
      const hi = Math.max(step, Math.ceil(max / step) * step);
      unit = (v) => v / hi;
      tickValues = range(0, hi, step);
      format = (v) => `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
      text = (r) => (r.kind === 'commercial' ? r.priceLabel : '');
      break;
    }
  }

  // "Paid from" and "First launched" head a column well and sit in a sentence badly.
  const lower = label.charAt(0).toLowerCase() + label.slice(1);
  const phrase = key === 'avg' ? label : kind === 'price' ? 'price' : kind === 'year' ? `year ${lower}` : lower;

  const place = (v: number) => (Number.isFinite(v) ? unit(v) * span : 1 - LANE / 2);
  const laneLabel = kind === 'price' ? 'Quote' : 'No figure';
  const ticks: AxisTick[] = tickValues.map((v) => ({ at: place(v), label: format(v), short: short(v) }));
  if (missing) ticks.push({ at: 1 - LANE / 2, label: laneLabel, short: laneLabel });

  return {
    key,
    kind,
    label,
    note: axisNote(config, key),
    ticks,
    lane: missing ? { from: 1 - LANE, label: laneLabel } : null,
    at: (r) => place(valueOf(r, key)),
    place,
    text,
    format,
    words,
    phrase,
  };
}

/** The middle figure of the records given, or null when none of them has one. */
export function medianOf(records: readonly RecordSummary[], key: string): number | null {
  const v = records.map((r) => valueOf(r, key)).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

/**
 * How the two figures move together across the records given: Pearson's r on
 * their positions along the axes, so a logarithmic axis is compared as it is
 * drawn. Null with fewer than five records to go on, or when one figure is the
 * same for all of them.
 */
export function relation(records: readonly RecordSummary[], x: MapAxis, y: MapAxis): number | null {
  const pts = records
    .filter((r) => Number.isFinite(valueOf(r, x.key)) && Number.isFinite(valueOf(r, y.key)))
    .map((r) => [x.at(r), y.at(r)] as const);
  if (pts.length < 5) return null;
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [px, py] of pts) {
    sxy += (px - mx) * (py - my);
    sxx += (px - mx) ** 2;
    syy += (py - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Below this the picture shows no pattern worth a sentence; above the second, a plain one. */
export const RELATION_LOOSE = 0.3;
export const RELATION_CLEAR = 0.6;

/**
 * The picture in one sentence, for a reader who cannot see it or does not want
 * to squint: "Price and Score do not move together."
 */
export function relationText(r: number | null, x: MapAxis, y: MapAxis): string {
  if (r === null) return '';
  const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (Math.abs(r) < RELATION_LOOSE) return sentence(`${x.phrase} and ${y.phrase} do not move together.`);
  // "the higher the price", but "the more integrations": a count takes no second article.
  const the = (axis: MapAxis, word: string) => (axis.kind === 'count' ? `the ${word} ${axis.phrase}` : `the ${word} the ${axis.phrase}`);
  const pair = `${the(x, x.words[0])}, ${the(y, y.words[r > 0 ? 0 : 1])}`;
  return sentence(`${pair}${Math.abs(r) < RELATION_CLEAR ? ', but loosely.' : '.'}`);
}

export interface MapFrame {
  width: number;
  height: number;
  /** The plot's edges inside the frame, in pixels. */
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Bubble {
  slug: string;
  x: number;
  y: number;
  r: number;
}

export interface BubbleLabel {
  slug: string;
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'end' | 'middle';
}

/** Area grows with the band, so "Very large" covers five times "Small", not twenty-five. */
export function bubbleRadius(band: number, base: number): number {
  return Math.round(base * Math.sqrt(band) * 10) / 10;
}

/**
 * Every record's bubble in the frame. Records that land on the very same spot
 * (two products at one price and one Score) are fanned out around it by a few
 * pixels, or one would hide the other completely.
 */
export function placeBubbles(
  records: readonly RecordSummary[],
  x: MapAxis,
  y: MapAxis,
  frame: MapFrame,
  base: number,
): Bubble[] {
  const pad = bubbleRadius(5, base) + 3;
  const x0 = frame.left + pad;
  const x1 = frame.right - pad;
  const y0 = frame.bottom - pad;
  const y1 = frame.top + pad;
  const bubbles = records.map((r) => ({
    slug: r.slug,
    x: x0 + x.at(r) * (x1 - x0),
    y: y0 + y.at(r) * (y1 - y0),
    r: bubbleRadius(r.band, base),
  }));
  const spots = new Map<string, Bubble[]>();
  for (const b of bubbles) {
    const key = `${Math.round(b.x / 3)}:${Math.round(b.y / 3)}`;
    spots.set(key, [...(spots.get(key) ?? []), b]);
  }
  for (const group of spots.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.slug.localeCompare(b.slug));
    const reach = Math.min(base * 1.4, 4 + group.length * 1.5);
    group.forEach((b, i) => {
      const angle = (i / group.length) * 2 * Math.PI - Math.PI / 2;
      b.x += Math.cos(angle) * reach;
      b.y += Math.sin(angle) * reach;
    });
  }
  // A fan at the edge of the plot must not push a bubble over it.
  const within = (v: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(v, hi)) * 10) / 10;
  return bubbles.map((b) => ({
    ...b,
    x: within(b.x, frame.left + b.r + 1, frame.right - b.r - 1),
    y: within(b.y, frame.top + b.r + 1, frame.bottom - b.r - 1),
  }));
}

/** The names are set in the mono face, so a label's width is its length. */
export const LABEL_SIZE = 11;
const CHAR = LABEL_SIZE * 0.62;
const LINE = LABEL_SIZE + 2;

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function hitsCircle(box: Box, c: Bubble, gap: number): boolean {
  const nx = Math.max(box.x0, Math.min(c.x, box.x1));
  const ny = Math.max(box.y0, Math.min(c.y, box.y1));
  return (nx - c.x) ** 2 + (ny - c.y) ** 2 < (c.r + gap) ** 2;
}

function hitsBox(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

/** Where a name would sit beside its bubble: right, left, above, below. */
function seats(b: Bubble, width: number): { box: Box; x: number; y: number; anchor: BubbleLabel['anchor'] }[] {
  const gap = 4;
  const half = LINE / 2;
  const base = LABEL_SIZE * 0.36; // the baseline's drop below the label's centre line
  return [
    { box: { x0: b.x + b.r + gap, y0: b.y - half, x1: b.x + b.r + gap + width, y1: b.y + half }, x: b.x + b.r + gap, y: b.y + base, anchor: 'start' },
    { box: { x0: b.x - b.r - gap - width, y0: b.y - half, x1: b.x - b.r - gap, y1: b.y + half }, x: b.x - b.r - gap, y: b.y + base, anchor: 'end' },
    { box: { x0: b.x - width / 2, y0: b.y - b.r - gap - LINE, x1: b.x + width / 2, y1: b.y - b.r - gap }, x: b.x, y: b.y - b.r - gap - half + base, anchor: 'middle' },
    { box: { x0: b.x - width / 2, y0: b.y + b.r + gap, x1: b.x + width / 2, y1: b.y + b.r + gap + LINE }, x: b.x, y: b.y + b.r + gap + half + base, anchor: 'middle' },
  ];
}

/**
 * Names for as many bubbles as have room for one. The larger a record's band
 * the earlier it is seated; a name goes beside its bubble only where it covers
 * no other bubble and no name already set, and otherwise is left to the
 * tooltip. `named` are the records to name; `all` are the bubbles a name must
 * keep clear of. (A filtered-out ghost is not one: it is faint enough to carry
 * a name across it, and a filtered view is where names matter most.)
 */
export function placeLabels(
  named: readonly RecordSummary[],
  all: readonly Bubble[],
  frame: MapFrame,
  /** Room already spoken for inside the plot: the median figures. */
  taken: readonly Box[] = [],
): BubbleLabel[] {
  const bySlug = new Map(all.map((b) => [b.slug, b]));
  const order = [...named].sort((a, b) => b.band - a.band || a.name.localeCompare(b.name));
  const placed: Box[] = [...taken];
  const labels: BubbleLabel[] = [];
  for (const record of order) {
    const bubble = bySlug.get(record.slug);
    if (!bubble) continue;
    const width = record.name.length * CHAR;
    for (const seat of seats(bubble, width)) {
      const { box } = seat;
      if (box.x0 < frame.left || box.x1 > frame.right || box.y0 < frame.top || box.y1 > frame.bottom) continue;
      if (placed.some((p) => hitsBox(box, p))) continue;
      if (all.some((c) => c.slug !== bubble.slug && hitsCircle(box, c, 1))) continue;
      placed.push({ x0: box.x0 - 3, y0: box.y0 - 1, x1: box.x1 + 3, y1: box.y1 + 1 });
      labels.push({ slug: record.slug, text: record.name, x: Math.round(seat.x * 10) / 10, y: Math.round(seat.y * 10) / 10, anchor: seat.anchor });
      break;
    }
  }
  return labels;
}

/**
 * The bubble a pointer at (px, py) means: the one it is inside, the smallest
 * first since small bubbles are drawn over large ones, or failing that the
 * nearest edge within `slack` pixels. Readers aim near a mark, not at it.
 */
export function nearestBubble(bubbles: readonly Bubble[], px: number, py: number, slack = 12): Bubble | null {
  let inside: Bubble | null = null;
  let near: Bubble | null = null;
  let nearBy = slack;
  for (const b of bubbles) {
    const d = Math.hypot(b.x - px, b.y - py);
    if (d <= b.r) {
      if (!inside || b.r < inside.r || (b.r === inside.r && d < Math.hypot(inside.x - px, inside.y - py))) inside = b;
    } else if (d - b.r < nearBy) {
      near = b;
      nearBy = d - b.r;
    }
  }
  return inside ?? near;
}

/** The next bubble from `from` in an arrow key's direction, or null at the edge of the field. */
export function stepBubble(
  bubbles: readonly Bubble[],
  from: Bubble,
  dir: 'left' | 'right' | 'up' | 'down',
): Bubble | null {
  const [ax, ay] = dir === 'left' ? [-1, 0] : dir === 'right' ? [1, 0] : dir === 'up' ? [0, -1] : [0, 1];
  let best: Bubble | null = null;
  let bestCost = Infinity;
  for (const b of bubbles) {
    if (b.slug === from.slug) continue;
    const dx = b.x - from.x;
    const dy = b.y - from.y;
    const along = dx * ax + dy * ay;
    if (along <= 0.5) continue;
    const across = Math.abs(dx * ay) + Math.abs(dy * ax);
    // Straight ahead beats near but off to one side.
    const cost = along + across * 2.5;
    if (cost < bestCost) {
      best = b;
      bestCost = cost;
    }
  }
  return best;
}

/**
 * A name for one bubble whatever is in the way: the record a reader has picked
 * out is always named. Beside it on the right, or on the left near the edge.
 */
export function forceLabel(record: RecordSummary, bubble: Bubble, frame: MapFrame): BubbleLabel {
  const width = record.name.length * CHAR;
  const [right, left] = seats(bubble, width);
  const seat = right!.box.x1 <= frame.right ? right! : left!;
  return { slug: record.slug, text: record.name, x: Math.round(seat.x * 10) / 10, y: Math.round(seat.y * 10) / 10, anchor: seat.anchor };
}

/** The width a line of the plot's mono type takes, for the gutters and the tick marks. */
export function textWidth(text: string, size = LABEL_SIZE): number {
  return text.length * size * 0.62;
}
