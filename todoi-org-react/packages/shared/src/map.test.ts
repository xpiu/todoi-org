import { describe, expect, it } from 'vitest';
import type { DirectoryConfig, RecordSummary } from './directory.ts';
import {
  bubbleRadius,
  mapAxis,
  mapKeys,
  medianOf,
  nearestBubble,
  placeBubbles,
  placeLabels,
  relation,
  relationText,
  stepBubble,
  type Bubble,
  type MapFrame,
} from './map.ts';
import { parseView, viewSearch } from './view.ts';

const criteria = ['use', 'enterprise'].map((key) => ({ key, name: `Crit ${key}`, head: key, sr: key, tip: '', text: `What ${key} measures.`, csv: key }));

const config = {
  kind: 'commercial',
  criteria,
  toggles: [],
  segments: [],
  copy: {
    controls: {
      sortGroups: [
        {
          label: 'All',
          options: [
            { value: 'price', label: 'Paid from' },
            { value: 'avg', label: 'Score' },
            { value: 'use', label: 'Ease of use' },
            { value: 'enterprise', label: 'Enterprise features' },
            { value: 'community', label: 'Market presence' },
            { value: 'integrations', label: 'Integrations' },
            { value: 'year', label: 'First launched' },
          ],
        },
      ],
    },
    band: { text: 'The market band.' },
    score: { tip: 'The mean of seven. More words.' },
    matrix: { metric: { tip: 'The cheapest paid plan. A dagger marks a minimum.' }, integrations: { tip: 'Estimated.' }, year: { tip: 'Launch year.' } },
  },
} as unknown as DirectoryConfig;

function record(slug: string, over: Partial<Extract<RecordSummary, { kind: 'commercial' }>> = {}): RecordSummary {
  return {
    kind: 'commercial',
    slug,
    name: slug,
    url: '',
    icon: '',
    blurb: '',
    segment: 'team',
    model: 'team',
    modelSub: '',
    year: 2015,
    band: 3,
    integrationsLabel: '10',
    integrations: 10,
    scores: { use: 3, enterprise: 3 },
    caps: {},
    search: '',
    version: 1,
    price: 10,
    priceLabel: '$10',
    priceNote: null,
    pricePublished: null,
    free: false,
    ...over,
  };
}

const frame: MapFrame = { width: 800, height: 500, left: 40, right: 790, top: 30, bottom: 450 };

describe('mapKeys', () => {
  it('is every sort key but the name', () => {
    expect(mapKeys(config)).toEqual(['avg', 'use', 'enterprise', 'community', 'price', 'integrations', 'year']);
  });
});

describe('the ?map= parameter', () => {
  it('names two different figures, and is left out for the page’s own pair', () => {
    expect(parseView({ map: 'price-avg' }, config).map).toEqual(['price', 'avg']);
    expect(viewSearch(parseView({ map: 'use-enterprise' }, config))).toEqual({ map: 'use-enterprise' });
    expect(viewSearch(parseView({}, config))).toEqual({});
  });
  it.each(['price', 'price-price', 'name-avg', 'avg-nope', 'stars-avg', ''])('drops %j rather than failing', (map) => {
    expect(parseView({ map }, config).map).toBeNull();
  });
});

describe('mapAxis', () => {
  const records = [
    record('a', { price: 0, priceLabel: 'Free', scores: { use: 2.6, enterprise: 1 }, band: 1, integrations: 0, year: 2001 }),
    record('b', { price: 12.5, priceLabel: '$12.50', scores: { use: 4.8, enterprise: 4.9 }, band: 5, integrations: 6000, year: 2025 }),
    record('c', { price: null, priceLabel: 'Quote', scores: { use: 4, enterprise: 3 }, band: 3, integrations: 90, year: 2012 }),
  ];

  it('rules a score axis in halves around the figures it holds', () => {
    const use = mapAxis(config, records, 'use');
    expect(use.label).toBe('Ease of use');
    expect(use.note).toBe('What use measures.');
    expect(use.ticks.map((t) => t.label)).toEqual(['2.5', '3.0', '3.5', '4.0', '4.5', '5.0']);
    expect(use.at(records[0]!)).toBeCloseTo(0.04);
    expect(use.text(records[1]!)).toBe('4.8');
    // Past two and a half points of range, whole steps.
    expect(mapAxis(config, records, 'enterprise').ticks.map((t) => t.label)).toEqual(['1.0', '2.0', '3.0', '4.0', '5.0']);
  });

  it('gives a quote-only price a lane past the end of the scale', () => {
    const price = mapAxis(config, records, 'price');
    expect(price.ticks.map((t) => t.label)).toEqual(['$0', '$5', '$10', '$15', 'Quote']);
    expect(price.lane).toEqual({ from: 0.9, label: 'Quote' });
    const quoted = price.at(records[2]!);
    expect(quoted).toBeGreaterThan(price.lane!.from);
    // The dearest priced record stays clear of the lane.
    expect(price.at(records[1]!)).toBeLessThan(price.lane!.from - 0.04);
    expect(price.text(records[2]!)).toBe('Quote');
    expect(price.phrase).toBe('price');
    expect(price.note).toBe('The cheapest paid plan.');
  });

  it('has no lane when every record has a figure', () => {
    const price = mapAxis(config, records.slice(0, 2), 'price');
    expect(price.lane).toBeNull();
    expect(price.at(records[1]!)).toBeCloseTo(12.5 / 15);
  });

  it('counts on a logarithmic axis that keeps its zero', () => {
    const int = mapAxis(config, records, 'integrations');
    expect(int.ticks.map((t) => t.label)).toEqual(['0', '10', '100', '1k', '10k']);
    expect(int.at(records[0]!)).toBe(0);
    expect(int.at(records[2]!)).toBeGreaterThan(0.4);
    expect(int.at(records[1]!)).toBeLessThanOrEqual(1);
    expect(int.text(records[2]!)).toBe('10');
  });

  it('names the five bands, and shortens them for a narrow plot', () => {
    const band = mapAxis(config, records, 'community');
    expect(band.ticks.map((t) => t.label)).toEqual(['Small', 'Medium', 'Medium-large', 'Large', 'Very large']);
    expect(band.ticks.map((t) => t.short)).toEqual(['S', 'M', 'M-L', 'L', 'XL']);
    expect(band.at(records[2]!)).toBeCloseTo(0.5);
    expect(band.text(records[1]!)).toBe('Very large');
  });

  it('rules years in fives', () => {
    const year = mapAxis(config, records, 'year');
    expect(year.ticks.map((t) => t.label)).toEqual(['2000', '2005', '2010', '2015', '2020', '2025']);
    expect(year.phrase).toBe('year first launched');
  });

  it('keeps every position between 0 and 1', () => {
    for (const key of mapKeys(config)) {
      const axis = mapAxis(config, records, key);
      for (const r of records) {
        expect(axis.at(r), `${key} ${r.slug}`).toBeGreaterThanOrEqual(0);
        expect(axis.at(r), `${key} ${r.slug}`).toBeLessThanOrEqual(1);
      }
      for (const t of axis.ticks) {
        expect(t.at, `${key} tick ${t.label}`).toBeGreaterThanOrEqual(0);
        expect(t.at, `${key} tick ${t.label}`).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('medianOf and relation', () => {
  const rising = [1, 2, 3, 4, 5].map((n) => record(`r${n}`, { price: n, scores: { use: n, enterprise: 6 - n } }));

  it('finds the middle figure, leaving out records without one', () => {
    expect(medianOf(rising, 'price')).toBe(3);
    expect(medianOf([...rising, record('q', { price: null })], 'price')).toBe(3);
    expect(medianOf(rising.slice(0, 4), 'price')).toBe(2.5);
    expect(medianOf([record('q', { price: null })], 'price')).toBeNull();
  });

  it('says how two figures move together, in words that fit the figure', () => {
    const price = mapAxis(config, rising, 'price');
    const use = mapAxis(config, rising, 'use');
    const ent = mapAxis(config, rising, 'enterprise');
    const int = mapAxis(config, rising, 'integrations');
    expect(relation(rising, price, use)).toBeCloseTo(1);
    expect(relation(rising, price, ent)).toBeCloseTo(-1);
    // One figure the same for everyone, or too few records: nothing to say.
    expect(relation(rising, price, int)).toBeNull();
    expect(relation(rising.slice(0, 4), price, use)).toBeNull();

    expect(relationText(1, price, use)).toBe('The higher the price, the higher the ease of use.');
    expect(relationText(-0.4, price, ent)).toBe('The higher the price, the lower the enterprise features, but loosely.');
    expect(relationText(0.7, int, use)).toBe('The more integrations, the higher the ease of use.');
    expect(relationText(0.1, price, use)).toBe('Price and ease of use do not move together.');
    expect(relationText(null, price, use)).toBe('');
  });
});

describe('placing bubbles and names', () => {
  it('sizes a bubble so its area, not its width, follows the band', () => {
    expect(bubbleRadius(4, 6)).toBe(12);
    expect(bubbleRadius(1, 6)).toBe(6);
  });

  it('keeps every bubble inside the plot, and fans out records on one spot', () => {
    const records = [
      record('low', { price: 0, scores: { use: 1, enterprise: 1 }, band: 5 }),
      record('high', { price: 20, scores: { use: 5, enterprise: 1 }, band: 5 }),
      record('twin-a', { price: 10, scores: { use: 3, enterprise: 1 } }),
      record('twin-b', { price: 10, scores: { use: 3, enterprise: 1 } }),
    ];
    const bubbles = placeBubbles(records, mapAxis(config, records, 'price'), mapAxis(config, records, 'use'), frame, 6);
    for (const b of bubbles) {
      expect(b.x - b.r).toBeGreaterThanOrEqual(frame.left);
      expect(b.x + b.r).toBeLessThanOrEqual(frame.right);
      expect(b.y - b.r).toBeGreaterThanOrEqual(frame.top);
      expect(b.y + b.r).toBeLessThanOrEqual(frame.bottom);
    }
    const [a, b] = [bubbles[2]!, bubbles[3]!];
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(5);
    // Cheap is left, high is up.
    expect(bubbles[0]!.x).toBeLessThan(bubbles[1]!.x);
    expect(bubbles[0]!.y).toBeGreaterThan(bubbles[1]!.y);
  });

  it('names a bubble only where the name covers nothing', () => {
    const bubbles: Bubble[] = [
      { slug: 'alone', x: 200, y: 200, r: 10 },
      // Hemmed in on every side by its neighbours.
      { slug: 'boxed', x: 500, y: 300, r: 8 },
      { slug: 'e', x: 530, y: 300, r: 14 },
      { slug: 'w', x: 470, y: 300, r: 14 },
      { slug: 'n', x: 500, y: 270, r: 14 },
      { slug: 's', x: 500, y: 330, r: 14 },
    ];
    const labels = placeLabels([record('alone'), record('boxed')], bubbles, frame);
    expect(labels.map((l) => l.slug)).toEqual(['alone']);
    expect(labels[0]).toMatchObject({ anchor: 'start', x: 214 });
    // Room spoken for by a median figure pushes the name to its next seat.
    const moved = placeLabels([record('alone')], bubbles, frame, [{ x0: 210, y0: 190, x1: 260, y1: 210 }]);
    expect(moved[0]!.anchor).toBe('end');
  });

  it('finds the bubble a pointer means, and the next one an arrow key means', () => {
    const big: Bubble = { slug: 'big', x: 100, y: 100, r: 20 };
    const small: Bubble = { slug: 'small', x: 108, y: 100, r: 6 };
    const far: Bubble = { slug: 'far', x: 300, y: 110, r: 8 };
    const all = [big, small, far];
    // Inside both: the small one, which is drawn on top.
    expect(nearestBubble(all, 106, 100)?.slug).toBe('small');
    expect(nearestBubble(all, 90, 100)?.slug).toBe('big');
    // Just outside a bubble still counts; open space does not.
    expect(nearestBubble(all, 300, 126)?.slug).toBe('far');
    expect(nearestBubble(all, 200, 300)).toBeNull();

    expect(stepBubble(all, big, 'right')?.slug).toBe('small');
    expect(stepBubble(all, small, 'right')?.slug).toBe('far');
    expect(stepBubble(all, far, 'right')).toBeNull();
    expect(stepBubble(all, far, 'left')?.slug).toBe('small');
  });
});
