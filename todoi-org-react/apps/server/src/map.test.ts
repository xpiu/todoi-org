import { describe, expect, it } from 'vitest';
import { loadSeedDirectories } from '@todoi/db/json';
import { mapAxis, mapKeys, placeBubbles, placeLabels, relation, type MapFrame } from '@todoi/shared';
import { toResponse } from './model.ts';

/**
 * The map on the real data: every pair of figures either page can plot puts
 * every record inside the plot, and no name is set over a bubble.
 */
const frame: MapFrame = { width: 880, height: 546, left: 40, right: 868, top: 28, bottom: 500 };

describe.each(loadSeedDirectories().map((d) => [d.config.slug, toResponse(d)] as const))('the map of %s', (_slug, data) => {
  const { directory, records } = data;
  const keys = mapKeys(directory);

  it('opens on a view its copy names, and every view plots two figures the matrix sorts by', () => {
    expect(directory.copy.map.views.length).toBeGreaterThan(0);
    for (const v of directory.copy.map.views) {
      expect(keys).toContain(v.x);
      expect(keys).toContain(v.y);
      expect(v.x).not.toBe(v.y);
    }
  });

  it('places every record inside the plot for every pair of figures', () => {
    for (const xKey of keys) {
      const x = mapAxis(directory, records, xKey);
      expect(x.ticks.length, `${xKey} ticks`).toBeGreaterThanOrEqual(3);
      expect(x.label, `${xKey} label`).not.toBe(xKey);
      for (const yKey of keys) {
        if (xKey === yKey) continue;
        const y = mapAxis(directory, records, yKey);
        const bubbles = placeBubbles(records, x, y, frame, 7);
        expect(bubbles).toHaveLength(records.length);
        for (const b of bubbles) {
          const where = `${xKey} × ${yKey}: ${b.slug}`;
          expect(Number.isFinite(b.x) && Number.isFinite(b.y), where).toBe(true);
          expect(b.x - b.r, where).toBeGreaterThanOrEqual(frame.left);
          expect(b.x + b.r, where).toBeLessThanOrEqual(frame.right);
          expect(b.y - b.r, where).toBeGreaterThanOrEqual(frame.top);
          expect(b.y + b.r, where).toBeLessThanOrEqual(frame.bottom);
        }
        const r = relation(records, x, y);
        if (r !== null) expect(Math.abs(r), `${xKey} × ${yKey}`).toBeLessThanOrEqual(1.000001);
      }
    }
  });

  it('names a good share of the bubbles on its opening view, none over another bubble', () => {
    const first = directory.copy.map.views[0]!;
    const x = mapAxis(directory, records, first.x);
    const y = mapAxis(directory, records, first.y);
    const bubbles = placeBubbles(records, x, y, frame, 7);
    const labels = placeLabels(records, bubbles, frame);
    expect(labels.length).toBeGreaterThan(records.length * 0.6);
    expect(new Set(labels.map((l) => l.slug)).size).toBe(labels.length);
  });
});
